"""
Unit tests for ExtractionPipelineService (Phase 3 Orchestrator):
- PDF natif d'une page avec suffisamment de texte
- PDF natif multi-pages
- PDF avec une page native et une page nécessitant OCR
- Toutes les pages en OCR
- Tesseract indisponible avec texte natif insuffisant
- OCR qui retourne une chaîne vide
- Erreur OCR récupérable
- Erreur layout récupérable
- Document sans texte exploitable
- Méthode globale native_pdf / ocr_tesseract / hybrid / none
- Conservation de l'ordre des pages
- Sections détectées après nettoyage
- Diagnostics page par page
- Absence de doublons dans les warnings
- pipeline_steps présents avec durées positives ou nulles
- Propagation des exceptions pour PDF vide ou corrompu
"""

import pytest
import io
from unittest.mock import patch, MagicMock
import fitz
from PIL import Image

from app.services.extraction_pipeline_service import ExtractionPipelineService
from app.models.response_models import ExtractionMethod, LayoutType, PipelineStatus
from app.models.extraction_models import PipelineExtractionResult, PageExtractionResult
from app.services.ocr_service import OCRService
from app.services.layout_service import LayoutService
from app.services.pdf_service import PDFService
from app.services.cv_extraction_service import CVExtractionService
from app.core.config import Settings
from app.core.exceptions import (
    InvalidPDFError,
    UnsupportedFileTypeError,
    PDFPageLimitError,
    UnsupportedScannedCVError,
)


def create_pdf_bytes(pages_text: list[str]) -> bytes:
    """Helper to generate a multi-page PDF in memory with given texts."""
    doc = fitz.open()
    for text in pages_text:
        p = doc.new_page()
        if text:
            p.insert_text((50, 100), text)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def create_pdf_with_raster_page(native_text: str, *, full_page: bool) -> bytes:
    """Build a synthetic PDF containing selectable text and a raster image."""
    image_buffer = io.BytesIO()
    Image.new("RGB", (100, 100), "white").save(image_buffer, format="PNG")
    doc = fitz.open()
    text_page = doc.new_page()
    text_page.insert_text((50, 100), native_text)
    if full_page:
        image_page = doc.new_page()
        image_page.insert_image(image_page.rect, stream=image_buffer.getvalue())
    else:
        text_page.insert_image(fitz.Rect(450, 40, 520, 110), stream=image_buffer.getvalue())
    result = doc.tobytes()
    doc.close()
    return result


def create_mixed_layout_cv_bytes() -> bytes:
    """Create a fictional mixed-layout CV matching the real regression geometry."""
    doc = fitz.open()
    page = doc.new_page(width=600, height=800)
    page.insert_textbox(
        fitz.Rect(25, 45, 390, 100),
        "Alice Martin\nFuture Ingénieure en Intelligence Artificielle et Sciences des\nDonnées",
        fontsize=10,
    )
    page.insert_textbox(
        fitz.Rect(25, 105, 390, 190),
        "Profil\nÉlève ingénieure spécialisée en Sci-\nences des données et applications intel-\nligentes.",
        fontsize=9,
    )
    page.insert_textbox(
        fitz.Rect(425, 60, 585, 150),
        "Marrakech, Maroc\nalice@example.com\n07 12 34 56 78\ngithub.com/alice-example\nlinkedin.com/in/alice-example",
        fontsize=8,
    )
    page.insert_textbox(
        fitz.Rect(25, 200, 575, 330),
        "Formation Académique\nCycle Ingénieur - Intelligence Artificielle & Sciences des Données\n2024 - Présent\nEMSI, Marrakech\nMachine Learning, Deep Learning, Big Data, Data Mining, Algorithmique, Programmation, Bases de Données, Réseaux et Systèmes\nCycle Préparatoire - Ingénierie Informatique et Réseaux\n2022 - 2024\nEMSI, Marrakech\nBaccalauréat Sciences Physiques - Option Français\n2019\nLycée Exemple, Ouarzazate",
        fontsize=8,
    )
    page.insert_textbox(
        fitz.Rect(25, 340, 575, 445),
        "Expérience Professionnelle\nStagiaire Développeuse Back-end / IA\nJuil. - Août 2025\nExampleCorp\n- Développement d'une plateforme web avec Next.js et Firebase.\n- Conception d'API backend.\n- Intégration d'un assistant IA.",
        fontsize=8,
    )
    page.insert_textbox(
        fitz.Rect(25, 455, 575, 525),
        "Projets IA & Data Science\nSystème de recommandation\n- Modèle local de recommandation.",
        fontsize=8,
    )
    page.insert_textbox(
        fitz.Rect(25, 535, 440, 615),
        "Compétences Techniques\nProgrammation: Python, SQL, JavaScript, C, R\nDéveloppement: Next.js, FastAPI, Firebase, Firestore\nIA: Gemini, Genkit, CNN, RNN, LSTM, Reinforcement Learning\nData: NoSQL, Matplotlib, Seaborn, Jupyter Notebook, Prompt Engineering",
        fontsize=6.5,
    )
    page.insert_textbox(
        fitz.Rect(25, 620, 575, 715),
        "Certifications\nMachine Learning | Duke University\n|\nIntroduction to Big Data | Example University\n|\nPython Web Data | Example Institute\n|\nNoSQL\nDatabases | IBM\n|\nAgile Project Management | Google",
        fontsize=5.8,
    )
    page.insert_textbox(
        fitz.Rect(25, 720, 575, 780),
        "Langues\nArabe : Langue maternelle\nFrançais : Courant\nAnglais : Courant",
        fontsize=8,
    )
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def test_pdf_natif_une_page_suffisant():
    long_text = (
        "Jean Dupont\n"
        "Développeur Senior Python FastAPI\n"
        "Expérience de 5 ans chez Tech Corp Paris.\n"
        "Compétences: Python, FastAPI, Docker, PostgreSQL.\n"
        "Formation: Master en Informatique 2019."
    )
    pdf_bytes = create_pdf_bytes([long_text])

    res = ExtractionPipelineService.process_pdf(pdf_bytes)

    assert isinstance(res, PipelineExtractionResult)
    assert res.total_pages == 1
    assert res.extraction_method == ExtractionMethod.NATIVE_PDF
    assert "Jean Dupont" in res.raw_text
    assert len(res.pages) == 1
    assert res.pages[0].ocr_used is False
    assert len(res.pipeline_steps) == 8


def test_mixed_layout_real_cv_equivalent_end_to_end():
    pipeline = ExtractionPipelineService.process_pdf(create_mixed_layout_cv_bytes())
    cv_data = CVExtractionService.extract_from_pipeline_result(pipeline)

    assert pipeline.extraction_method == ExtractionMethod.NATIVE_PDF
    assert pipeline.pages[0].ocr_used is False
    assert pipeline.pages[0].layout_type == LayoutType.MIXED
    assert pipeline.pages[0].final_text.startswith("Alice Martin")
    assert pipeline.detected_sections == [
        "SUMMARY", "EDUCATION", "EXPERIENCES", "PROJECTS", "SKILLS", "CERTIFICATIONS", "LANGUAGES"
    ]
    assert cv_data.identity.full_name == "Alice Martin"
    assert cv_data.identity.email == "alice@example.com"
    assert cv_data.identity.phone == "07 12 34 56 78"
    assert cv_data.identity.github == "https://github.com/alice-example"
    assert cv_data.identity.linkedin == "https://linkedin.com/in/alice-example"
    assert cv_data.identity.website is None
    assert "Sciences" in cv_data.summary
    assert "intelligentes" in cv_data.summary
    assert "alice@example.com" not in cv_data.summary
    assert len(cv_data.education) == 3
    assert [item.degree for item in cv_data.education] == [
        "Cycle Ingénieur", "Cycle Préparatoire", "Baccalauréat"
    ]
    assert cv_data.education[0].institution == "EMSI"
    assert cv_data.education[0].start_date == "2024"
    assert cv_data.education[0].end_date == "Présent"
    assert cv_data.education[2].location == "Ouarzazate"
    assert cv_data.education[2].start_date is None
    assert cv_data.education[2].end_date == "2019"
    assert len(cv_data.experiences) == 1
    assert "ExampleCorp" == cv_data.experiences[0].company
    assert cv_data.experiences[0].start_date == "Juil. 2025"
    assert cv_data.experiences[0].end_date == "Août 2025"
    assert "Conception d'API backend" in cv_data.experiences[0].description
    assert "alice@example.com" not in pipeline.sections["LANGUAGES"]
    assert [(cert.name, cert.issuer) for cert in cv_data.certifications] == [
        ("Machine Learning", "Duke University"),
        ("Introduction to Big Data", "Example University"),
        ("Python Web Data", "Example Institute"),
        ("NoSQL Databases", "IBM"),
        ("Agile Project Management", "Google"),
    ]
    skill_names = {skill.name for skill in cv_data.skills}
    assert {
        "Firebase", "Firestore", "Gemini", "Genkit", "Matplotlib", "Seaborn",
        "Jupyter Notebook", "NoSQL", "CNN", "RNN", "LSTM",
        "Reinforcement Learning", "Prompt Engineering",
    } <= skill_names


def test_pdf_natif_multi_pages():
    p1 = "Jean Dupont\nDéveloppeur Python FastAPI\n5 ans d'expérience."
    p2 = "Formation & Diplômes\nMaster Informatique 2020\nLicence Mathématiques 2018."
    pdf_bytes = create_pdf_bytes([p1, p2])

    res = ExtractionPipelineService.process_pdf(pdf_bytes)

    assert res.total_pages == 2
    assert res.extraction_method == ExtractionMethod.NATIVE_PDF
    assert len(res.pages) == 2
    assert res.pages[0].page_number == 1
    assert res.pages[1].page_number == 2
    assert "Jean Dupont" in res.pages[0].final_text
    assert "Master Informatique" in res.pages[1].final_text


def test_text_pdf_with_profile_photo_or_logo_is_accepted():
    content = "Jean Dupont développeur professionnel avec expérience, formation et compétences Python."
    result = ExtractionPipelineService.process_pdf(
        create_pdf_with_raster_page(content, full_page=False)
    )
    assert result.extraction_method == ExtractionMethod.NATIVE_PDF
    assert result.pages[0].ocr_used is False


def test_mixed_pdf_with_page_scale_image_content_is_rejected():
    content = "Jean Dupont développeur professionnel avec expérience, formation et compétences Python."
    with patch.object(OCRService, "extract_text_from_image") as ocr:
        with pytest.raises(UnsupportedScannedCVError):
            ExtractionPipelineService.process_pdf(
                create_pdf_with_raster_page(content, full_page=True)
            )
    ocr.assert_not_called()


def test_pdf_native_with_blank_decorative_page_is_accepted_without_ocr():
    p1_native = "Jean Dupont\nDéveloppeur Senior Python FastAPI 2020-2024 Tech Corp."
    p2_empty = ""
    pdf_bytes = create_pdf_bytes([p1_native, p2_empty])

    with patch.object(OCRService, "is_ocr_available") as available, patch.object(
        OCRService, "extract_text_from_image"
    ) as extract_ocr:
        res = ExtractionPipelineService.process_pdf(pdf_bytes)

    assert res.total_pages == 2
    assert res.extraction_method == ExtractionMethod.NATIVE_PDF
    assert res.pages[0].extraction_method == ExtractionMethod.NATIVE_PDF
    assert res.pages[0].ocr_used is False
    assert res.pages[1].extraction_method == ExtractionMethod.NONE
    assert res.pages[1].ocr_used is False
    available.assert_not_called()
    extract_ocr.assert_not_called()


def test_scanned_multi_page_pdf_is_rejected_without_ocr():
    pdf_bytes = create_pdf_bytes(["", ""])

    with patch.object(OCRService, "is_ocr_available") as available, patch.object(
        OCRService, "extract_text_from_image"
    ) as extract_ocr, patch.object(LayoutService, "analyze_page_layout") as layout:
        with pytest.raises(UnsupportedScannedCVError) as exc_info:
            ExtractionPipelineService.process_pdf(pdf_bytes)
    assert exc_info.value.code == "IMAGE_ONLY_PDF"
    available.assert_not_called()
    extract_ocr.assert_not_called()
    layout.assert_not_called()


def test_rejection_is_independent_of_tesseract_availability():
    pdf_bytes = create_pdf_bytes([""])

    for installed in (False, True):
        with patch.object(OCRService, "is_ocr_available", return_value=installed) as available:
            with pytest.raises(UnsupportedScannedCVError):
                ExtractionPipelineService.process_pdf(pdf_bytes)
        available.assert_not_called()


def test_ocr_is_never_called_for_image_only_pdf():
    pdf_bytes = create_pdf_bytes([""])

    with patch.object(OCRService, "extract_text_from_image") as extract_ocr:
        with pytest.raises(UnsupportedScannedCVError):
            ExtractionPipelineService.process_pdf(pdf_bytes)
    extract_ocr.assert_not_called()


def test_section_detection_is_not_called_after_rejection():
    pdf_bytes = create_pdf_bytes([""])

    with patch("app.services.extraction_pipeline_service.SectionService.detect_and_segment_sections") as sections:
        with pytest.raises(UnsupportedScannedCVError):
            ExtractionPipelineService.process_pdf(pdf_bytes)
    sections.assert_not_called()


def test_erreur_layout_recuperable():
    p1 = "Jean Dupont\nDéveloppeur Python FastAPI avec 5 ans d'expérience."
    pdf_bytes = create_pdf_bytes([p1])

    with patch.object(
        LayoutService,
        "analyze_page_layout",
        side_effect=Exception("CUDA device 0 failed for /home/user/private/cv.pdf"),
    ):
        res = ExtractionPipelineService.process_pdf(pdf_bytes)

    assert res.extraction_method == ExtractionMethod.NATIVE_PDF
    assert "Jean Dupont" in res.raw_text
    assert "Layout analysis failed" in res.warnings
    serialized = res.model_dump_json()
    assert "CUDA device 0" not in serialized
    assert "/home/user/private" not in serialized


def test_rejected_pdf_never_renders_an_ocr_image():
    pdf_bytes = create_pdf_bytes([""])

    with patch.object(PDFService, "render_page_to_image") as render:
        with pytest.raises(UnsupportedScannedCVError):
            ExtractionPipelineService.process_pdf(pdf_bytes)
    render.assert_not_called()


def test_page_limit_rejects_before_extraction_ocr_and_layout():
    pdf_bytes = create_pdf_bytes(["page one", "page two"])
    settings = Settings(MAX_PDF_PAGES=1, _env_file=None)
    with patch("app.services.pdf_service.get_settings", return_value=settings), patch.object(
        PDFService, "extract_native_text_per_page"
    ) as extract_native, patch.object(OCRService, "is_ocr_available") as ocr_available, patch.object(
        LayoutService, "analyze_page_layout"
    ) as analyze_layout:
        with pytest.raises(PDFPageLimitError):
            ExtractionPipelineService.process_pdf(pdf_bytes)

    extract_native.assert_not_called()
    ocr_available.assert_not_called()
    analyze_layout.assert_not_called()


def test_document_sans_texte_exploitable():
    pdf_bytes = create_pdf_bytes([""])

    with pytest.raises(UnsupportedScannedCVError, match="texte PDF exploitable"):
        ExtractionPipelineService.process_pdf(pdf_bytes)


def test_methode_globale_native_pdf():
    pdf_bytes = create_pdf_bytes(["Long native text " * 10])
    res = ExtractionPipelineService.process_pdf(pdf_bytes)
    assert res.extraction_method == ExtractionMethod.NATIVE_PDF


def test_image_only_method_is_rejected_not_ocr():
    pdf_bytes = create_pdf_bytes([""])
    with pytest.raises(UnsupportedScannedCVError):
        ExtractionPipelineService.process_pdf(pdf_bytes)


def test_native_plus_blank_page_remains_native_not_hybrid():
    p1 = "Long native text " * 10
    pdf_bytes = create_pdf_bytes([p1, ""])
    res = ExtractionPipelineService.process_pdf(pdf_bytes)
    assert res.extraction_method == ExtractionMethod.NATIVE_PDF


def test_empty_document_does_not_return_successful_none_method():
    pdf_bytes = create_pdf_bytes([""])
    with pytest.raises(UnsupportedScannedCVError):
        ExtractionPipelineService.process_pdf(pdf_bytes)


def test_conservation_ordre_pages():
    p1 = "PAGE UN: Jean Dupont, développeur professionnel avec expérience confirmée."
    p2 = "PAGE DEUX: Tech Corp Paris, missions et responsabilités professionnelles."
    p3 = "PAGE TROIS: Master Informatique, formation supérieure et certifications."
    pdf_bytes = create_pdf_bytes([p1, p2, p3])

    res = ExtractionPipelineService.process_pdf(pdf_bytes)

    assert res.total_pages == 3
    idx1 = res.raw_text.find("PAGE UN")
    idx2 = res.raw_text.find("PAGE DEUX")
    idx3 = res.raw_text.find("PAGE TROIS")
    assert idx1 != -1 and idx2 != -1 and idx3 != -1
    assert idx1 < idx2 < idx3


def test_sections_detectees_apres_nettoyage():
    content = (
        "Jean Dupont\n\n"
        "EXPERIENCES PROFESSIONNELLES\n"
        "2022-2024 Développeur Python FastAPI\n\n"
        "FORMATION\n"
        "Master Informatique 2021\n\n"
        "COMPETENCES\n"
        "Python, Docker, SQL"
    )
    pdf_bytes = create_pdf_bytes([content])

    res = ExtractionPipelineService.process_pdf(pdf_bytes)

    assert "EXPERIENCES" in res.sections or "EXPÉRIENCES" in res.sections
    assert len(res.detected_sections) >= 2


def test_diagnostics_page_par_page():
    content = "Jean Dupont\nDéveloppeur Python FastAPI 2020-2024 avec expérience professionnelle confirmée."
    pdf_bytes = create_pdf_bytes([content])

    res = ExtractionPipelineService.process_pdf(pdf_bytes)

    p = res.pages[0]
    assert isinstance(p, PageExtractionResult)
    assert p.page_number == 1
    assert p.native_text_length > 0
    assert 0.0 <= p.native_text_ratio <= 1.0
    assert p.extraction_method in list(ExtractionMethod)
    assert p.layout_type in list(LayoutType)


def test_absence_doublons_warnings():
    pdf_bytes = create_pdf_bytes([
        "Jean Dupont développeur professionnel avec une expérience confirmée et des compétences Python.",
        "",
    ])
    res = ExtractionPipelineService.process_pdf(pdf_bytes)

    assert len(res.warnings) == len(set(res.warnings))


def test_pipeline_steps_presents_et_durees_positives():
    pdf_bytes = create_pdf_bytes([
        "Jean Dupont Développeur Python FastAPI avec expérience professionnelle confirmée."
    ])
    res = ExtractionPipelineService.process_pdf(pdf_bytes)

    step_names = [s.name for s in res.pipeline_steps]
    expected_steps = [
        "validate_pdf",
        "extract_native_text",
        "decide_extraction_method",
        "run_ocr",
        "analyze_layout",
        "rebuild_document",
        "clean_text",
        "detect_sections",
    ]
    assert step_names == expected_steps
    for s in res.pipeline_steps:
        assert s.duration_ms >= 0.0
        assert s.status in list(PipelineStatus)


def test_pdf_vide_et_corrompu_propage_exceptions():
    with pytest.raises(InvalidPDFError):
        ExtractionPipelineService.process_pdf(b"")

    with pytest.raises(UnsupportedFileTypeError):
        ExtractionPipelineService.process_pdf(b"NOT_A_PDF_STREAM")
