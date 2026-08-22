"""
Custom exception hierarchy for the AI CV Parser system.
"""

from typing import Any, Dict, Optional


class CVParserError(Exception):
    """Base exception for all CV Parser errors."""

    def __init__(
        self,
        message: str,
        code: str = "CV_PARSER_ERROR",
        status_code: int = 500,
        extra_data: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.extra_data = extra_data or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "error": self.__class__.__name__,
            "code": self.code,
            "detail": self.message,
            "extra_data": self.extra_data,
        }


class InvalidPDFError(CVParserError):
    """Raised when the uploaded PDF file is corrupt, empty, or unreadable."""

    def __init__(
        self,
        message: str = "Invalid or unreadable PDF file.",
        extra_data: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            code="INVALID_PDF",
            status_code=400,
            extra_data=extra_data,
        )


class UnsupportedFileTypeError(CVParserError):
    """Raised when the uploaded file is not a PDF."""

    def __init__(
        self,
        message: str = "Only PDF files are accepted.",
        extra_data: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            code="UNSUPPORTED_FILE_TYPE",
            status_code=415,
            extra_data=extra_data,
        )


class PDFPageLimitError(CVParserError):
    """Raised when a PDF exceeds the configured page-count limit."""

    def __init__(
        self,
        message: str = "PDF exceeds the maximum allowed page count.",
        extra_data: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            code="PDF_PAGE_LIMIT_EXCEEDED",
            status_code=413,
            extra_data=extra_data,
        )


class PDFExtractionError(CVParserError):
    """Raised when text extraction from PDF fails."""

    def __init__(
        self,
        message: str = "Failed to extract text from PDF.",
        extra_data: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            code="PDF_EXTRACTION_ERROR",
            status_code=422,
            extra_data=extra_data,
        )


class UnsupportedScannedCVError(CVParserError):
    """Raised when CV content is stored as page images instead of selectable PDF text."""

    USER_MESSAGE = (
        "Ce CV ne contient pas de texte PDF exploitable. Il semble être scanné ou "
        "enregistré comme une image. Veuillez envoyer un CV PDF contenant du texte "
        "sélectionnable, par exemple exporté depuis Word, Google Docs, Canva, Europass ou LaTeX."
    )

    def __init__(
        self,
        message: str = USER_MESSAGE,
        extra_data: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            code="IMAGE_ONLY_PDF",
            status_code=422,
            extra_data=extra_data,
        )


class OCRUnavailableError(CVParserError):
    """Raised when Tesseract OCR engine is not installed or configured."""

    def __init__(
        self,
        message: str = "Tesseract OCR engine is not available.",
        extra_data: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            code="OCR_UNAVAILABLE",
            status_code=500,
            extra_data=extra_data,
        )


class OCRProcessingError(CVParserError):
    """Raised when OCR processing fails on a page."""

    def __init__(
        self,
        message: str = "Error during OCR processing on page.",
        extra_data: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            code="OCR_PROCESSING_ERROR",
            status_code=422,
            extra_data=extra_data,
        )


class LayoutDetectionError(CVParserError):
    """Raised when column/layout detection fails."""

    def __init__(
        self,
        message: str = "Error during layout detection.",
        extra_data: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            code="LAYOUT_DETECTION_ERROR",
            status_code=422,
            extra_data=extra_data,
        )


class LLMClientError(CVParserError):
    """Base exception for LLM client operations."""

    def __init__(
        self,
        message: str = "LLM client error.",
        code: str = "LLM_CLIENT_ERROR",
        status_code: int = 500,
        extra_data: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            code=code,
            status_code=status_code,
            extra_data=extra_data,
        )


class LLMClientDisabledError(LLMClientError):
    """Raised when an operation is attempted on a disabled LLM client."""

    def __init__(
        self,
        message: str = "LLM client is disabled.",
        extra_data: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            code="LLM_CLIENT_DISABLED",
            status_code=503,
            extra_data=extra_data,
        )


class LLMDependencyError(LLMClientError):
    """Raised when required LLM libraries (e.g. torch, transformers) are missing."""

    def __init__(
        self,
        message: str = "Required LLM dependencies are not installed.",
        extra_data: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            code="LLM_DEPENDENCY_ERROR",
            status_code=500,
            extra_data=extra_data,
        )


class LLMModelLoadError(LLMClientError):
    """Raised when loading model or tokenizer fails."""

    def __init__(
        self,
        message: str = "Failed to load LLM model or tokenizer.",
        extra_data: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            code="LLM_MODEL_LOAD_ERROR",
            status_code=500,
            extra_data=extra_data,
        )


class LLMUnavailableError(CVParserError):
    """Raised when the LLM model cannot be loaded or is unavailable."""

    def __init__(
        self,
        message: str = "LLM model is not available.",
        extra_data: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            code="LLM_UNAVAILABLE",
            status_code=503,
            extra_data=extra_data,
        )


class LLMGenerationError(LLMClientError):
    """Raised when the LLM model generation fails or yields empty output."""

    def __init__(
        self,
        message: str = "Error during LLM model response generation.",
        extra_data: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            code="LLM_GENERATION_ERROR",
            status_code=500,
            extra_data=extra_data,
        )


class JSONValidationError(CVParserError):
    """Raised when LLM output JSON is invalid or cannot be parsed into schema."""

    def __init__(
        self,
        message: str = "Failed to validate target JSON structure.",
        extra_data: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            code="JSON_VALIDATION_ERROR",
            status_code=422,
            extra_data=extra_data,
        )


class NoJSONObjectFoundError(JSONValidationError):
    """Raised when no valid JSON object or block can be found in LLM output."""

    def __init__(
        self,
        message: str = "No JSON object was found in the response.",
        extra_data: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            extra_data=extra_data,
        )
        self.code = "NO_JSON_OBJECT_FOUND"


class MalformedJSONError(JSONValidationError):
    """Raised when extracted JSON string cannot be parsed due to syntax errors."""

    def __init__(
        self,
        message: str = "Malformed or truncated JSON structure.",
        extra_data: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            extra_data=extra_data,
        )
        self.code = "MALFORMED_JSON"
