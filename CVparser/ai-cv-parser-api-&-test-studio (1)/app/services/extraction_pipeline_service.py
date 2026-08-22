"""
Orchestrator service for the document extraction pipeline.
Coordinates PDF validation, native text extraction, extraction method decision,
OCR execution, layout analysis, document rebuilding, text cleaning, and section detection.
"""

import logging
import time
from typing import Dict, List, Tuple

from app.core.config import get_settings
from app.models.response_models import (
    ExtractionMethod,
    LayoutType,
    PipelineStatus,
    PipelineStep,
)
from app.models.extraction_models import (
    PageExtractionResult,
    PipelineExtractionResult,
)
from app.services.pdf_service import PDFService
from app.core.exceptions import UnsupportedScannedCVError
from app.services.layout_service import LayoutService
from app.services.section_service import SectionService
from app.services.geometry_section_service import GeometrySectionResult, GeometrySectionService
from app.utils.text_cleaning import clean_raw_resume_text
from app.utils.timing import Timer
from app.utils.list_utils import unique_preserve_order


logger = logging.getLogger(__name__)


class ExtractionPipelineService:
    """Service orchestrating the complete text extraction pipeline for CV PDF documents."""

    @staticmethod
    def _has_page_scale_image(page_obj: object) -> bool:
        """Return whether a raster image covers most of a text-insufficient page."""
        try:
            page_area = float(page_obj.rect.width * page_obj.rect.height)
            if page_area <= 0:
                return False
            for image in page_obj.get_image_info(xrefs=True):
                bbox = image.get("bbox")
                if not bbox or len(bbox) < 4:
                    continue
                image_area = max(0.0, float(bbox[2] - bbox[0])) * max(
                    0.0, float(bbox[3] - bbox[1])
                )
                if image_area / page_area >= 0.5:
                    return True
        except Exception:
            # Image inspection is only a mixed-document safeguard.  The native
            # text rules remain authoritative if metadata is unavailable.
            return False
        return False

    @staticmethod
    def _post_process_pages(
        page_results: List[PageExtractionResult],
        geometry_results: List[GeometrySectionResult] | None = None,
    ) -> Tuple[str, str, Dict[str, str], List[str], List[PipelineStep], List[str]]:
        """Rebuild, clean, and segment text after all live PDF pages are processed."""
        pipeline_steps: List[PipelineStep] = []
        global_warnings: List[str] = []

        with Timer() as t_rebuild:
            page_texts = [p.final_text for p in page_results if p.final_text and p.final_text.strip()]
            raw_text = "\n\n".join(page_texts).strip()

            rebuild_warning = False
            if not raw_text:
                global_warnings.append("Document entier sans texte exploitable.")
                rebuild_warning = True

        pipeline_steps.append(
            PipelineStep(
                name="rebuild_document",
                status=PipelineStatus.WARNING if rebuild_warning else PipelineStatus.SUCCESS,
                duration_ms=t_rebuild.duration_ms,
                message="Document reconstruit en préservant l'ordre original des pages.",
            )
        )

        with Timer() as t_clean:
            _, cleaned_text = clean_raw_resume_text(raw_text)

        pipeline_steps.append(
            PipelineStep(
                name="clean_text",
                status=PipelineStatus.SUCCESS,
                duration_ms=t_clean.duration_ms,
                message="Texte brut nettoyé et normalisé.",
            )
        )

        with Timer() as t_sections:
            geometry_sections, geometry_detected = GeometrySectionService.combine_pages(geometry_results or [])
            if len(geometry_detected) >= 2:
                sections_dict = {}
                for key, value in geometry_sections.items():
                    _, cleaned_section = clean_raw_resume_text(value)
                    if cleaned_section:
                        sections_dict[key] = cleaned_section
                detected_sections = [key for key in geometry_detected if key in sections_dict]
            else:
                sections_dict, detected_sections = SectionService.detect_and_segment_sections(cleaned_text)

        pipeline_steps.append(
            PipelineStep(
                name="detect_sections",
                status=PipelineStatus.SUCCESS,
                duration_ms=t_sections.duration_ms,
                message=f"{len(detected_sections)} section(s) détectée(s).",
            )
        )

        return (
            raw_text,
            cleaned_text,
            sections_dict,
            detected_sections,
            pipeline_steps,
            global_warnings,
        )

    @classmethod
    def process_pdf(cls, pdf_bytes: bytes) -> PipelineExtractionResult:
        """
        Runs the full extraction pipeline on PDF bytes and returns PipelineExtractionResult.

        Pipeline steps:
        1. validate_pdf
        2. extract_native_text
        3. decide_extraction_method
        4. run_ocr
        5. analyze_layout
        6. rebuild_document
        7. clean_text
        8. detect_sections
        """
        start_time_perf = time.perf_counter()
        settings = get_settings()

        pipeline_steps: List[PipelineStep] = []

        doc = None
        try:
            # ------------------------------------------------------------------
            # Step 1: validate_pdf
            # ------------------------------------------------------------------
            with Timer() as t_validate:
                doc = PDFService.validate_and_open_pdf(pdf_bytes)
                total_pages = doc.page_count

            pipeline_steps.append(
                PipelineStep(
                    name="validate_pdf",
                    status=PipelineStatus.SUCCESS,
                    duration_ms=t_validate.duration_ms,
                    message=f"PDF valide contenant {total_pages} page(s).",
                )
            )

            pages_data = []

            # ------------------------------------------------------------------
            # Step 2: extract_native_text
            # ------------------------------------------------------------------
            has_native_text_issue = False
            with Timer() as t_extract:
                for page_idx in range(total_pages):
                    page_num = page_idx + 1
                    page = doc.load_page(page_idx)
                    text = page.get_text("text") or ""
                    stripped_text = text.strip()
                    length = len(stripped_text)

                    min_chars = max(1, settings.MIN_NATIVE_TEXT_CHARS_PER_PAGE)
                    ratio = min(length / min_chars, 1.0)

                    page_warnings = []
                    if length == 0:
                        page_warnings.append(f"Page {page_num} ne contient aucun texte natif.")
                        has_native_text_issue = True
                    elif length < settings.MIN_NATIVE_TEXT_CHARS_PER_PAGE or ratio < settings.MIN_NATIVE_TEXT_RATIO:
                        page_warnings.append(f"Page {page_num} : texte natif insuffisant ({length} caractères).")
                        has_native_text_issue = True

                    pages_data.append(
                        {
                            "page_number": page_num,
                            "page_obj": page,
                            "page_index": page_idx,
                            "native_text": text,
                            "native_text_length": length,
                            "native_text_ratio": ratio,
                            "page_warnings": page_warnings,
                        }
                    )

            pipeline_steps.append(
                PipelineStep(
                    name="extract_native_text",
                    status=PipelineStatus.WARNING if has_native_text_issue else PipelineStatus.SUCCESS,
                    duration_ms=t_extract.duration_ms,
                    message=f"Texte natif extrait pour {total_pages} page(s).",
                )
            )

            # ------------------------------------------------------------------
            # Step 3: decide_extraction_method
            # ------------------------------------------------------------------
            with Timer() as t_decide:
                for pdata in pages_data:
                    length = pdata["native_text_length"]
                    ratio = pdata["native_text_ratio"]

                    native_sufficient = (
                        length >= settings.MIN_NATIVE_TEXT_CHARS_PER_PAGE
                        and ratio >= settings.MIN_NATIVE_TEXT_RATIO
                    )
                    pdata["needs_ocr"] = not native_sufficient

            pipeline_steps.append(
                PipelineStep(
                    name="decide_extraction_method",
                    status=PipelineStatus.SUCCESS,
                    duration_ms=t_decide.duration_ms,
                    message="Décision de la méthode d'extraction prise page par page.",
                )
            )

            # ------------------------------------------------------------------
            # Step 3b: enforce selectable-text product policy
            # ------------------------------------------------------------------
            pages_requiring_image_reading = [p for p in pages_data if p["needs_ocr"]]
            usable_pages = [p for p in pages_data if not p["needs_ocr"]]
            total_usable_native_length = sum(p["native_text_length"] for p in usable_pages)
            image_dependent_pages = [
                p for p in pages_requiring_image_reading
                if cls._has_page_scale_image(p["page_obj"])
            ]
            reject_document = (
                not usable_pages
                or total_usable_native_length < settings.MIN_NATIVE_TEXT_CHARS_PER_PAGE
                or bool(image_dependent_pages)
            )
            if reject_document:
                raise UnsupportedScannedCVError(
                    extra_data={
                        "validation_step": "validate_native_text",
                        "diagnostic": "Document rejeté : aucun texte PDF exploitable.",
                    }
                )

            # ------------------------------------------------------------------
            # Step 4: run_ocr
            # ------------------------------------------------------------------
            ocr_step_status = PipelineStatus.SKIPPED
            ocr_step_msg = "Lecture des CV image désactivée par la politique produit."

            with Timer() as t_ocr:
                for pdata in pages_data:
                    pdata["ocr_text"] = None
                    pdata["ocr_used"] = False

            pipeline_steps.append(
                PipelineStep(
                    name="run_ocr",
                    status=ocr_step_status,
                    duration_ms=t_ocr.duration_ms,
                    message=ocr_step_msg,
                )
            )

            # ------------------------------------------------------------------
            # Step 5: analyze_layout
            # ------------------------------------------------------------------
            page_results: List[PageExtractionResult] = []
            geometry_results: List[GeometrySectionResult] = []
            layout_had_warnings = False

            with Timer() as t_layout:
                for pdata in pages_data:
                    page_num = pdata["page_number"]
                    page_obj = pdata["page_obj"]
                    p_warnings = list(pdata["page_warnings"])

                    ocr_used = pdata.get("ocr_used", False)
                    ocr_text = pdata.get("ocr_text")

                    if ocr_used and ocr_text is not None and ocr_text.strip():
                        ocr_page = pdata.get("ocr_page")
                        if ocr_page is not None and ocr_page.lines:
                            layout_res = LayoutService.analyze_ocr_page(ocr_page)
                            final_text = layout_res.ordered_text.strip()
                            layout_type = layout_res.layout_type
                            left_col = layout_res.left_column_text
                            right_col = layout_res.right_column_text
                            ocr_text = final_text
                            if layout_type == LayoutType.UNKNOWN:
                                p_warnings.append(
                                    f"Page {page_num} : OCR réussi mais layout non déterminé (LayoutType.UNKNOWN)."
                                )
                            confidence = ocr_page.median_confidence
                            if confidence is not None and confidence < settings.OCR_MIN_CONFIDENCE:
                                p_warnings.append(
                                    f"Page {page_num} : confiance OCR faible ({confidence:.1f})."
                                )
                            if ocr_page.engine == "image_to_string_fallback":
                                p_warnings.append(
                                    f"Page {page_num} : OCR structuré vide, fallback image_to_string utilisé."
                                )
                        else:
                            final_text = ocr_text.strip()
                            layout_type = LayoutType.UNKNOWN
                            left_col = None
                            right_col = None
                            p_warnings.append(f"Page {page_num} : layout non déterminé (LayoutType.UNKNOWN).")
                        extraction_method = ExtractionMethod.OCR_TESSERACT
                    else:
                        try:
                            layout_res = LayoutService.analyze_page_layout(page_obj)
                            geometry_results.append(GeometrySectionService.segment_page(page_obj, page_num))
                            layout_type = layout_res.layout_type
                            final_text = layout_res.ordered_text.strip() if layout_res.ordered_text else ""
                            left_col = layout_res.left_column_text
                            right_col = layout_res.right_column_text
                            if layout_res.warnings:
                                p_warnings.extend(layout_res.warnings)
                        except Exception:
                            logger.exception("Layout analysis failed for page %s", page_num)
                            layout_had_warnings = True
                            p_warnings.append("Layout analysis failed")
                            layout_type = LayoutType.UNKNOWN
                            final_text = pdata["native_text"].strip()
                            left_col = None
                            right_col = None

                        if final_text:
                            extraction_method = ExtractionMethod.NATIVE_PDF
                        else:
                            extraction_method = ExtractionMethod.NONE

                    if not final_text:
                        p_warnings.append(f"Page {page_num} sans texte final exploitable.")

                    diagnostic_ocr_page = pdata.get("ocr_page") if ocr_used else None
                    page_res = PageExtractionResult(
                        page_number=page_num,
                        native_text=pdata["native_text"],
                        native_text_length=pdata["native_text_length"],
                        native_text_ratio=pdata["native_text_ratio"],
                        ocr_text=ocr_text,
                        final_text=final_text,
                        extraction_method=extraction_method,
                        layout_type=layout_type,
                        left_column_text=left_col,
                        right_column_text=right_col,
                        ocr_used=ocr_used,
                        ocr_token_count=len(diagnostic_ocr_page.tokens) if diagnostic_ocr_page else 0,
                        ocr_line_count=len(diagnostic_ocr_page.lines) if diagnostic_ocr_page else 0,
                        ocr_mean_confidence=diagnostic_ocr_page.mean_confidence if diagnostic_ocr_page else None,
                        ocr_median_confidence=diagnostic_ocr_page.median_confidence if diagnostic_ocr_page else None,
                        ocr_engine=diagnostic_ocr_page.engine if diagnostic_ocr_page else None,
                        detected_column_count=diagnostic_ocr_page.column_count if diagnostic_ocr_page else 0,
                        reconstructed_region_count=diagnostic_ocr_page.region_count if diagnostic_ocr_page else 0,
                        warnings=p_warnings,
                    )
                    page_results.append(page_res)

            pipeline_steps.append(
                PipelineStep(
                    name="analyze_layout",
                    status=PipelineStatus.WARNING if layout_had_warnings else PipelineStatus.SUCCESS,
                    duration_ms=t_layout.duration_ms,
                    message=f"Analyse de layout terminée pour {total_pages} page(s).",
                )
            )

            (
                raw_text,
                cleaned_text,
                sections_dict,
                detected_sections,
                post_processing_steps,
                global_warnings,
            ) = cls._post_process_pages(page_results, geometry_results)
            pipeline_steps.extend(post_processing_steps)

            # ------------------------------------------------------------------
            # Global Extraction Method & Warnings Deduplication
            # ------------------------------------------------------------------
            methods_used = {p.extraction_method for p in page_results}
            if ExtractionMethod.NATIVE_PDF in methods_used and ExtractionMethod.OCR_TESSERACT in methods_used:
                global_method = ExtractionMethod.HYBRID
            elif ExtractionMethod.NATIVE_PDF in methods_used:
                global_method = ExtractionMethod.NATIVE_PDF
            elif ExtractionMethod.OCR_TESSERACT in methods_used:
                global_method = ExtractionMethod.OCR_TESSERACT
            else:
                global_method = ExtractionMethod.NONE

            all_warnings_raw = []
            for p in page_results:
                all_warnings_raw.extend(p.warnings)
            all_warnings_raw.extend(global_warnings)

            deduped_warnings = unique_preserve_order(all_warnings_raw)

            total_duration_sec = round(time.perf_counter() - start_time_perf, 4)


            return PipelineExtractionResult(
                raw_text=raw_text,
                cleaned_text=cleaned_text,
                sections=sections_dict,
                detected_sections=detected_sections,
                pages=page_results,
                extraction_method=global_method,
                warnings=deduped_warnings,
                pipeline_steps=pipeline_steps,
                total_pages=total_pages,
                processing_time_seconds=total_duration_sec,
            )
        finally:
            if doc is not None:
                doc.close()

    @classmethod
    def extract(cls, pdf_bytes: bytes) -> PipelineExtractionResult:
        """Alias for process_pdf."""
        return cls.process_pdf(pdf_bytes)
