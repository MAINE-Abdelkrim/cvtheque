"""
PDF processing service using PyMuPDF (fitz).
Provides PDF validation, native text extraction, and page rendering to Pillow Image.
Does NOT execute OCR.
"""

from typing import List, Tuple, Dict, Any
import fitz  # PyMuPDF
from PIL import Image

from app.core.exceptions import (
    InvalidPDFError,
    UnsupportedFileTypeError,
    PDFPageLimitError,
    PDFExtractionError,
)
from app.core.config import get_settings
from app.core.constants import DEFAULT_DPI


class PDFService:
    """Service for validating, inspecting, and extracting native content from PDF files."""

    @staticmethod
    def validate_and_open_pdf(pdf_bytes: bytes) -> fitz.Document:
        """
        Validates the PDF bytes and opens a PyMuPDF Document.
        Raises InvalidPDFError or UnsupportedFileTypeError if invalid, empty, or corrupted.
        """
        if not pdf_bytes or len(pdf_bytes) == 0:
            raise InvalidPDFError("The provided PDF file is empty.")

        settings = get_settings()
        max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
        if len(pdf_bytes) > max_bytes:
            raise InvalidPDFError(
                f"File size ({round(len(pdf_bytes)/(1024*1024), 2)} MB) exceeds the maximum allowed limit of {settings.MAX_FILE_SIZE_MB} MB."
            )

        # Basic header check for PDF signature %PDF after optional leading whitespace
        if not pdf_bytes.lstrip().startswith(b"%PDF"):
            raise UnsupportedFileTypeError("The uploaded file is not a valid PDF document.")

        doc = None
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            if doc.is_encrypted:
                # Try opening with empty password if encrypted
                opened = doc.authenticate("")
                if not opened:
                    raise InvalidPDFError("The PDF file is password protected and cannot be read.")

            if doc.page_count == 0:
                raise InvalidPDFError("The PDF file contains no pages.")

            if doc.page_count > settings.MAX_PDF_PAGES:
                raise PDFPageLimitError(
                    f"PDF exceeds the maximum allowed page count of {settings.MAX_PDF_PAGES}."
                )

            return doc
        except (InvalidPDFError, UnsupportedFileTypeError, PDFPageLimitError):
            if doc is not None:
                doc.close()
            raise
        except Exception as err:
            if doc is not None:
                doc.close()
            raise InvalidPDFError("The uploaded PDF document is malformed or corrupted.") from err

    @staticmethod
    def extract_native_text_per_page(doc: fitz.Document) -> List[Dict[str, Any]]:
        """
        Extracts raw native text for each page in the PDF without OCR.
        Returns a list of dicts with page_number (1-based), native_text, and char_count.
        """
        pages_data = []
        try:
            for page_idx in range(doc.page_count):
                page = doc.load_page(page_idx)
                text = page.get_text("text") or ""
                pages_data.append(
                    {
                        "page_number": page_idx + 1,
                        "native_text": text,
                        "char_count": len(text.strip()),
                    }
                )
            return pages_data
        except Exception as err:
            raise PDFExtractionError(f"Error during native text extraction from PDF: {str(err)}") from err

    @staticmethod
    def render_page_to_image(
        doc: fitz.Document, page_index: int, dpi: int = DEFAULT_DPI
    ) -> Image.Image:
        """
        Renders a specific page of a PDF document as a RGB Pillow Image using PyMuPDF Pixmap.
        Forces RGB without alpha channel.
        No pdf2image or Poppler is used.
        """
        if dpi <= 0:
            raise PDFExtractionError(f"DPI must be strictly positive (received: {dpi}).")

        if page_index < 0 or page_index >= doc.page_count:
            raise PDFExtractionError(f"Invalid page number {page_index + 1} (total pages: {doc.page_count}).")

        try:
            page = doc.load_page(page_index)
            pix = page.get_pixmap(
                dpi=dpi,
                colorspace=fitz.csRGB,
                alpha=False,
            )
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            return img
        except PDFExtractionError:
            raise
        except Exception as err:
            raise PDFExtractionError(
                f"Error rendering page {page_index + 1} to image: {str(err)}"
            ) from err
