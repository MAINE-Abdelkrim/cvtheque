"""
CV parser route exposing CVProcessingService via FastAPI.
"""

from fastapi import APIRouter, Depends, File, UploadFile
from starlette.concurrency import run_in_threadpool
from app.core.config import Settings
from app.core.exceptions import InvalidPDFError, UnsupportedFileTypeError, CVParserError
from app.api.dependencies import get_settings_dep, get_cv_processing_service
from app.services.cv_processing_service import CVProcessingService
from app.models.extraction_models import CVProcessingResult


router = APIRouter()


async def validate_and_read_upload(file: UploadFile, settings: Settings) -> bytes:
    """Validate the uploaded file and read its contents incrementally up to MAX_FILE_SIZE_MB.

    Raises:
    - UnsupportedFileTypeError (415) for unsupported content types.
    - CVParserError (413) for oversized uploads.
    - InvalidPDFError (400) for empty uploads or invalid PDF signatures.
    """
    # 1. Reject clearly unsupported content types (allowing application/pdf and application/octet-stream)
    content_type = file.content_type
    if content_type and content_type not in ["application/pdf", "application/octet-stream"]:
        raise UnsupportedFileTypeError("Only PDF files are accepted.")

    # 2. Limit and read file contents incrementally
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    buffer = bytearray()
    chunk_size = 65536

    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        buffer.extend(chunk)
        if len(buffer) > max_bytes:
            raise CVParserError(
                message=f"The uploaded file exceeds the maximum allowed size of {settings.MAX_FILE_SIZE_MB} MB.",
                code="FILE_TOO_LARGE",
                status_code=413,
            )

    # 3. Reject empty files
    if len(buffer) == 0:
        raise InvalidPDFError("The uploaded PDF file is empty.")

    # 4. Verify PDF signature (%PDF-) after any permitted leading whitespace
    stripped_buffer = buffer.lstrip()
    if not stripped_buffer.startswith(b"%PDF-"):
        raise InvalidPDFError("The uploaded file is not a valid PDF document.")

    return bytes(buffer)


@router.post("/cv/parse", response_model=CVProcessingResult, summary="Parse CV PDF")
async def parse_cv(
    file: UploadFile = File(...),
    settings: Settings = Depends(get_settings_dep),
    service: CVProcessingService = Depends(get_cv_processing_service),
) -> CVProcessingResult:
    """Parse an uploaded PDF CV into structured JSON format."""
    pdf_bytes = await validate_and_read_upload(file, settings)
    return await run_in_threadpool(service.process_pdf, pdf_bytes)
