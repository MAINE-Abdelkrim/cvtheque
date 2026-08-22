"""
Service orchestrating the full CV processing pipeline:
PDF Extraction Pipeline -> Deterministic CV Field Extraction -> Optional LLM Field Enrichment.
"""

import logging
from typing import List, Optional

from app.core.config import Settings, get_settings
from app.llm.base_client import BaseLLMClient
from app.llm.client_factory import create_llm_client
from app.llm.prompt_builder import LLMPromptBuilder
from app.models.cv_models import CVData
from app.models.extraction_models import CVProcessingResult, PipelineExtractionResult
from app.services.cv_extraction_service import CVExtractionService
from app.services.extraction_pipeline_service import ExtractionPipelineService
from app.services.llm_extraction_service import LLMExtractionService
from app.services.semantic_extraction_service import SemanticExtractionService
from app.utils.list_utils import unique_preserve_order

logger = logging.getLogger(__name__)


class CVProcessingService:
    """Orchestrates end-to-end CV processing (Pipeline -> Deterministic -> LLM Enrichment)."""

    def __init__(
        self,
        pipeline_service: Optional[ExtractionPipelineService] = None,
        cv_extraction_service: Optional[CVExtractionService] = None,
        llm_extraction_service: Optional[LLMExtractionService] = None,
        semantic_extraction_service: Optional[SemanticExtractionService] = None,
        llm_client: Optional[BaseLLMClient] = None,
        settings: Optional[Settings] = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.pipeline_service = pipeline_service or ExtractionPipelineService()
        self.cv_extraction_service = cv_extraction_service or CVExtractionService()
        self.llm_extraction_service = llm_extraction_service or LLMExtractionService()
        self.semantic_extraction_service = semantic_extraction_service or SemanticExtractionService(
            timeout_seconds=self.settings.MODEL_TIMEOUT_SECONDS
        )
        self._llm_initialization_failed = False

        if llm_client is not None:
            self.llm_client = llm_client
        else:
            try:
                self.llm_client = create_llm_client(self.settings)
            except Exception:
                logger.exception("Failed to initialize optional LLM client")
                self.llm_client = None
                self._llm_initialization_failed = True

    def process_pdf(
        self,
        pdf_bytes: bytes,
        client: Optional[BaseLLMClient] = None,
    ) -> CVProcessingResult:
        """Process raw PDF bytes through deterministic extraction and optional LLM enrichment."""
        # 1. Pipeline extraction (native text, OCR, layout, text cleaning, sections)
        pipeline_result: PipelineExtractionResult = self.pipeline_service.process_pdf(pdf_bytes)

        # 2. Deterministic CV extraction
        cv_data: CVData = self.cv_extraction_service.extract(
            cleaned_text=pipeline_result.cleaned_text,
            sections=pipeline_result.sections,
        )

        # 3. Determine active client
        active_client = client if client is not None else self.llm_client

        try:
            llm_available = active_client is not None and active_client.is_available()
        except Exception:
            logger.exception("Failed to check optional LLM client availability")
            llm_available = False
        llm_used = False

        # 4. Optional LLM enrichment
        if self.settings.MODEL_ENABLED and self._llm_initialization_failed:
            cv_data.warnings.append("LLM initialization failed")
        elif active_client is not None and getattr(active_client, "enabled", False):
            if llm_available:
                try:
                    semantic_sections = {
                        key: value for key, value in pipeline_result.sections.items()
                        if key in {"SUMMARY", "SKILLS", "EXPERIENCES", "EDUCATION", "LANGUAGES", "CERTIFICATIONS"}
                        and value and value.strip()
                    }
                    if semantic_sections:
                        semantic = self.semantic_extraction_service.extract(
                            deterministic_data=cv_data,
                            sections=semantic_sections,
                            client=active_client,
                        )
                        cv_data = semantic.cv_data
                        llm_used = semantic.contributed
                    else:
                        # Compatibility fallback for text that has no reliable
                        # canonical section ownership. Section prompts are
                        # always preferred whenever section input exists.
                        before_completion = cv_data.model_dump(exclude={"warnings"})
                        cv_data = self.llm_extraction_service.enrich(
                            deterministic_data=cv_data,
                            cleaned_text=pipeline_result.cleaned_text,
                            sections=pipeline_result.sections,
                            client=active_client,
                        )
                        llm_used = cv_data.model_dump(exclude={"warnings"}) != before_completion
                except Exception:
                    logger.exception("Optional semantic extraction failed before returning")
                    cv_data.warnings.append("LLM enrichment unavailable")
            else:
                cv_data.warnings.append("LLM enrichment unavailable")

        # 5. Merge warnings preserving order and deduplicating
        all_warnings: List[str] = list(pipeline_result.warnings) + list(cv_data.warnings)
        merged_warnings = unique_preserve_order(all_warnings)
        cv_data.warnings = merged_warnings

        return CVProcessingResult(
            pipeline_result=pipeline_result,
            cv_data=cv_data,
            llm_used=llm_used,
            llm_available=llm_available,
        )
