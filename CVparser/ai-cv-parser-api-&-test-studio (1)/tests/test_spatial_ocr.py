"""Installation-independent coverage for spatial OCR reconstruction."""

from unittest.mock import patch

from PIL import Image

from app.extractors.education_extractor import EducationExtractor
from app.extractors.experience_extractor import ExperienceExtractor
from app.extractors.identity_extractor import IdentityExtractor
from app.models.ocr_models import OCRLine, OCRPage, OCRToken
from app.models.response_models import LayoutType
from app.services.layout_service import LayoutService
from app.services.ocr_service import OCRService
from app.services.section_service import SectionService


def data_for(rows):
    keys = ["text", "conf", "left", "top", "width", "height", "block_num", "par_num", "line_num", "word_num"]
    data = {key: [] for key in keys}
    for row in rows:
        values = dict(text="", conf="90", left=0, top=0, width=20, height=12,
                      block_num=1, par_num=1, line_num=1, word_num=1)
        values.update(row)
        for key in keys:
            data[key].append(values[key])
    return data


def token(text, left, top, *, line=1, word=1, conf=90, width=None):
    return OCRToken(text, conf, left, top, width or max(10, len(text) * 7), 14,
                    1, 1, 1, line, word)


def line(text, left, top, right=None):
    return OCRLine(text, left, top, right or left + max(30, len(text) * 7), top + 16, 90, len(text.split()))


def page(lines, width=1000, height=1400):
    return OCRPage(1, width, height, [], lines, "\n".join(value.text for value in lines))


def test_structured_tokens_ignore_empty_and_preserve_geometry_and_invalid_confidence():
    data = data_for([
        {"text": "", "left": 1},
        {"text": "École", "conf": "bad", "left": 42, "top": 17, "width": 51, "height": 13},
    ])
    tokens = OCRService._tokens_from_data(data, 3)
    assert len(tokens) == 1
    assert (tokens[0].text, tokens[0].confidence, tokens[0].left, tokens[0].top) == ("École", None, 42, 17)
    assert tokens[0].page_number == 3 and tokens[0].right == 93


def test_structured_ocr_uses_one_data_call_without_string_fallback():
    data = data_for([{"text": "Bonjour", "left": 10}])
    OCRService._resolved_tesseract_cmd = "tesseract"
    with patch.object(OCRService, "get_installed_languages", return_value=["fra"]), patch(
        "app.services.ocr_service.pytesseract.image_to_data", return_value=data
    ) as structured, patch("app.services.ocr_service.pytesseract.image_to_string") as fallback:
        assert OCRService.extract_text_from_image(Image.new("RGB", (300, 200)), "fra") == "Bonjour"
    structured.assert_called_once()
    fallback.assert_not_called()


def test_empty_structured_ocr_uses_string_fallback_once():
    OCRService._resolved_tesseract_cmd = "tesseract"
    with patch.object(OCRService, "get_installed_languages", return_value=["eng"]), patch(
        "app.services.ocr_service.pytesseract.image_to_data", return_value={"text": []}
    ) as structured, patch(
        "app.services.ocr_service.pytesseract.image_to_string", return_value="fallback"
    ) as fallback:
        assert OCRService.extract_text_from_image(Image.new("RGB", (100, 100)), "eng") == "fallback"
        result = OCRService.consume_last_page_result()
    structured.assert_called_once(); fallback.assert_called_once()
    assert result and result.engine == "image_to_string_fallback"


def test_line_reconstruction_sorts_words_and_preserves_email_phone_bullet_date_accents():
    tokens = [
        token("Prénom", 70, 10, word=2), token("Nom", 10, 10, word=1),
        token("exemple@gmail.com", 10, 40, line=2),
        token("06", 10, 70, line=3, word=1), token("01", 35, 70, line=3, word=2),
        token("02", 60, 70, line=3, word=3), token("03", 85, 70, line=3, word=4), token("04", 110, 70, line=3, word=5),
        token("•", 10, 100, line=4, word=1), token("Compétence", 30, 100, line=4, word=2),
        token("Juillet", 10, 130, line=5, word=1), token("2022", 65, 130, line=5, word=2),
        token("–", 100, 130, line=5, word=3), token("Présent", 120, 130, line=5, word=4),
    ]
    texts = [value.text for value in OCRService.reconstruct_lines(tokens)]
    assert texts == ["Nom Prénom", "exemple@gmail.com", "06 01 02 03 04", "• Compétence", "Juillet 2022 – Présent"]


def test_same_tesseract_line_does_not_merge_columns():
    lines = OCRService.reconstruct_lines([token("Profil", 20, 20), token("Expériences", 650, 20, word=2)])
    assert [value.text for value in lines] == ["Profil", "Expériences"]


def test_single_two_column_mixed_and_sparse_layout_classification():
    single = page([line("Alpha", 100, y) for y in (100, 150, 200, 250)])
    two = page([line("L1", 70, 200), line("L2", 70, 350), line("R1", 620, 210), line("R2", 620, 360)])
    mixed = page([line("FULL WIDTH HEADER", 100, 40, 900), *two.lines])
    sparse = page([line("only", 100, 100)])
    assert LayoutService.analyze_ocr_page(single).layout_type == LayoutType.SINGLE_COLUMN
    assert LayoutService.analyze_ocr_page(two).layout_type == LayoutType.TWO_COLUMNS
    mixed_result = LayoutService.analyze_ocr_page(mixed)
    assert mixed_result.layout_type == LayoutType.MIXED and mixed_result.ordered_text.startswith("FULL WIDTH HEADER")
    assert LayoutService.analyze_ocr_page(sparse).layout_type == LayoutType.UNKNOWN


def synthetic_cv_lines():
    return [
        line("Nom Prénom", 560, 40), line("Métier", 560, 70),
        line("Résumé professionnel visible.", 560, 105),
        line("Profil", 60, 180), line("Adresse", 60, 215), line("Rue exemple", 60, 240),
        line("Email", 60, 270), line("exemple@gmail.com", 60, 295),
        line("Téléphone", 60, 325), line("06 01 02 03 04", 60, 350),
        line("Date de naissance", 60, 380), line("01/01/1990", 60, 405), line("Permis", 60, 435),
        line("Expériences professionnelles", 560, 180),
        line("Poste occupé", 560, 220), line("Entreprise", 560, 245), line("Juillet 2022 – Présent", 560, 270), line("Description une.", 560, 295),
        line("Poste occupé", 560, 340), line("Entreprise", 560, 365), line("Août 2021 – Juillet 2022", 560, 390), line("Description deux.", 560, 415),
        line("Poste occupé", 560, 460), line("Entreprise", 560, 485), line("Mars 2017 – Avril 2021", 560, 510), line("Description trois.", 560, 535),
        line("Compétences", 60, 520), line("Lorem ipsum", 60, 550),
        line("Langues", 60, 610), line("Langue 1", 60, 640), line("Langue 2", 60, 665),
        line("Loisirs", 60, 730), line("Loisir 1", 60, 760),
        line("Formations", 560, 650), line("Diplôme", 560, 690), line("Établissement", 560, 715), line("2017", 560, 740),
        line("Diplôme", 560, 790), line("Établissement", 560, 815), line("2015", 560, 840),
    ]


def test_region_order_keeps_header_columns_sections_and_contact_contiguous():
    result = LayoutService.analyze_ocr_page(page(synthetic_cv_lines()))
    assert result.layout_type in (LayoutType.TWO_COLUMNS, LayoutType.MIXED)
    text = result.ordered_text
    assert text.startswith("Nom Prénom\nMétier")
    assert text.index("Profil") < text.index("Compétences") < text.index("Langues") < text.index("Loisirs")
    assert text.index("Expériences professionnelles") < text.index("Formations")
    between = text[text.index("Expériences professionnelles"):text.index("Formations")]
    assert "Téléphone" not in between and between.count("Entreprise") == 3


def test_spatial_fixture_sections_identity_and_business_records():
    reconstructed = LayoutService.analyze_ocr_page(page(synthetic_cv_lines())).ordered_text
    sections, detected = SectionService.detect_and_segment_sections(reconstructed)
    assert {"EXPERIENCES", "EDUCATION", "SKILLS", "LANGUAGES"}.issubset(detected)
    assert "PROFILE_CONTACT" in sections and "SUMMARY" not in sections
    assert "Loisir" not in sections["EDUCATION"]
    identity = IdentityExtractor.extract(reconstructed, sections)
    assert identity.full_name == "Nom Prénom"
    assert identity.job_title == "Métier"
    assert identity.email == "exemple@gmail.com" and identity.phone == "06 01 02 03 04"
    experiences = ExperienceExtractor.extract(sections, reconstructed)
    education = EducationExtractor.extract(sections, reconstructed)
    assert len(experiences) == 3 and len(education) == 2
    assert all(exp.company not in {"06 01 02 03 04", "Permis"} for exp in experiences)
    assert [edu.start_date for edu in education] == ["2017", "2015"]


def test_sidebar_profile_is_not_summary_and_hobbies_do_not_contaminate_education():
    text = "Profil\nAdresse\nRue\nEmail\na@b.com\nTéléphone\n06 01 02 03 04\nFormations\nDiplôme\n2017\nLoisirs\nLecture"
    sections, _ = SectionService.detect_and_segment_sections(text)
    assert "PROFILE_CONTACT" in sections and "SUMMARY" not in sections
    assert sections["EDUCATION"] == "Diplôme\n2017"
