"""Input adaptation helpers for CV command-line tools."""

import fitz


def prepare_pdf_bytes(file_bytes: bytes) -> bytes:
    """Return PDF bytes, converting UTF-8 text fixtures into an in-memory PDF."""
    if file_bytes.lstrip().startswith(b"%PDF-"):
        return file_bytes

    text = file_bytes.decode("utf-8", errors="replace")
    document = fitz.open()
    try:
        chunks = [text[index:index + 2500] for index in range(0, len(text), 2500)] or [""]
        for chunk in chunks:
            page = document.new_page()
            page.insert_textbox(
                fitz.Rect(36, 36, page.rect.width - 36, page.rect.height - 36),
                chunk,
                fontsize=10,
            )
        return document.tobytes()
    finally:
        document.close()
