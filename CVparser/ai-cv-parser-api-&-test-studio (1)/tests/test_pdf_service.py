"""
Unit tests for PDFService (Phase 2):
- PDF natif valide
- PDF vide
- PDF corrompu
- Rendu d'une page en image
- Rendu d'une page avec image et transparence
- Validation du DPI strictement supérieur à zéro
"""

import pytest
import fitz
from PIL import Image
from unittest.mock import patch

from app.services.pdf_service import PDFService
from app.core.config import Settings
from app.core.exceptions import (
    InvalidPDFError,
    UnsupportedFileTypeError,
    PDFExtractionError,
    PDFPageLimitError,
)


def create_sample_native_pdf_bytes() -> bytes:
    """Helper to generate a valid 2-page native PDF in memory using PyMuPDF."""
    doc = fitz.open()
    # Page 1
    p1 = doc.new_page()
    p1.insert_text((50, 100), "Jean Dupont\nDéveloppeur Python FastAPI\n2021-2024 Tech Corp")
    # Page 2
    p2 = doc.new_page()
    p2.insert_text((50, 100), "Formation & Diplômes\nMaster Informatique 2020")
    
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def create_pdf_bytes_with_page_count(page_count: int) -> bytes:
    doc = fitz.open()
    for _ in range(page_count):
        doc.new_page()
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def create_pdf_with_transparent_image() -> bytes:
    """Helper to generate a PDF containing an image with transparency (RGBA)."""
    doc = fitz.open()
    p = doc.new_page(width=400, height=400)
    
    # Create an RGBA image with alpha transparency in memory
    img = Image.new("RGBA", (100, 100), color=(255, 0, 0, 128))
    import io
    img_bytes = io.BytesIO()
    img.save(img_bytes, format="PNG")
    img_bytes.seek(0)
    
    p.insert_image(fitz.Rect(50, 50, 250, 250), stream=img_bytes.read())
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def test_pdf_natif_valide():
    pdf_bytes = create_sample_native_pdf_bytes()
    doc = PDFService.validate_and_open_pdf(pdf_bytes)
    assert doc is not None
    assert doc.page_count == 2

    pages_data = PDFService.extract_native_text_per_page(doc)
    assert len(pages_data) == 2
    assert pages_data[0]["page_number"] == 1
    assert "Jean Dupont" in pages_data[0]["native_text"]
    assert pages_data[1]["page_number"] == 2
    assert "Master Informatique" in pages_data[1]["native_text"]
    doc.close()


def test_pdf_vide():
    with pytest.raises(InvalidPDFError) as exc_info:
        PDFService.validate_and_open_pdf(b"")
    assert "vide" in str(exc_info.value).lower()


def test_pdf_corrompu():
    corrupted_bytes = b"NOT_A_PDF_HEADER_12345"
    with pytest.raises(UnsupportedFileTypeError):
        PDFService.validate_and_open_pdf(corrupted_bytes)

    corrupted_pdf_header = b"%PDF-1.4\nthis_is_corrupted_garbage_content_12345"
    with pytest.raises(InvalidPDFError):
        PDFService.validate_and_open_pdf(corrupted_pdf_header)


def test_rendu_page_en_image():
    pdf_bytes = create_sample_native_pdf_bytes()
    doc = PDFService.validate_and_open_pdf(pdf_bytes)
    
    img = PDFService.render_page_to_image(doc, page_index=0, dpi=150)
    assert isinstance(img, Image.Image)
    assert img.mode == "RGB"
    assert img.width > 0
    assert img.height > 0
    doc.close()


def test_rendu_page_avec_image_et_transparence():
    pdf_bytes = create_pdf_with_transparent_image()
    doc = PDFService.validate_and_open_pdf(pdf_bytes)
    
    img = PDFService.render_page_to_image(doc, page_index=0, dpi=150)
    assert isinstance(img, Image.Image)
    assert img.mode == "RGB"  # Alpha channel forced to False
    assert img.width > 0
    assert img.height > 0
    doc.close()


def test_pdf_dpi_invalide():
    pdf_bytes = create_sample_native_pdf_bytes()
    doc = PDFService.validate_and_open_pdf(pdf_bytes)
    
    with pytest.raises(PDFExtractionError) as exc_info:
        PDFService.render_page_to_image(doc, page_index=0, dpi=0)
    assert "DPI must be strictly positive" in str(exc_info.value)

    with pytest.raises(PDFExtractionError):
        PDFService.render_page_to_image(doc, page_index=0, dpi=-50)
    
    doc.close()


@pytest.mark.parametrize("page_count", [2, 3])
def test_pdf_page_count_at_or_below_limit_is_accepted(page_count):
    settings = Settings(MAX_PDF_PAGES=3, _env_file=None)
    with patch("app.services.pdf_service.get_settings", return_value=settings):
        doc = PDFService.validate_and_open_pdf(create_pdf_bytes_with_page_count(page_count))
    assert doc.page_count == page_count
    doc.close()


def test_pdf_page_count_above_limit_is_rejected_and_document_closed():
    settings = Settings(MAX_PDF_PAGES=2, _env_file=None)
    pdf_bytes = create_pdf_bytes_with_page_count(3)
    opened_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    with patch("app.services.pdf_service.get_settings", return_value=settings), patch(
        "app.services.pdf_service.fitz.open", return_value=opened_doc
    ):
        with pytest.raises(PDFPageLimitError) as exc_info:
            PDFService.validate_and_open_pdf(pdf_bytes)
    assert str(exc_info.value) == "PDF exceeds the maximum allowed page count of 2."
    assert opened_doc.is_closed
