"""
Main entry point for the FastAPI CV Parser API.
"""

from datetime import datetime, timezone
import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.exceptions import CVParserError
from app.api.routes import cv, health
from app.models.response_models import ErrorResponse


logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    """Application factory for the FastAPI CV Parser."""
    settings = get_settings()
    
    app = FastAPI(
        title=settings.APP_NAME,
        description="FastAPI backend for parsing PDF CVs into structured JSON using hybrid OCR, deterministic regex, and optional LLM extraction.",
        version="1.0.0",
    )

    # CORS configuration based on settings.NEXTJS_ORIGIN
    if settings.NEXTJS_ORIGIN:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[settings.NEXTJS_ORIGIN],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # Route Registration
    app.include_router(health.router)
    app.include_router(cv.router, prefix="/api/v1")

    @app.exception_handler(CVParserError)
    async def cv_parser_exception_handler(request: Request, exc: CVParserError) -> JSONResponse:
        """Handle controlled CV Parser application exceptions."""
        logger.error(
            f"Controlled error [{exc.code}] on {request.url.path}: {exc.message}",
            exc_info=True
        )
        
        # Prepare standardized error response
        error_resp = ErrorResponse(
            error=exc.__class__.__name__,
            code=exc.code,
            detail=exc.message,
            extra_data=exc.extra_data if exc.extra_data else None,
            timestamp=datetime.now(timezone.utc).isoformat()
        )
        
        return JSONResponse(
            status_code=exc.status_code,
            content=error_resp.model_dump() if hasattr(error_resp, "model_dump") else error_resp.dict()
        )

    @app.exception_handler(Exception)
    async def unexpected_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """Handle unexpected internal exceptions to prevent leakage of server stack traces or local paths."""
        logger.error(
            f"Unhandled exception on {request.url.path}: {str(exc)}",
            exc_info=True
        )
        
        # Safe sanitized response
        error_resp = ErrorResponse(
            error="InternalServerError",
            code="INTERNAL_SERVER_ERROR",
            detail="An unexpected internal server error occurred.",
            extra_data=None,
            timestamp=datetime.now(timezone.utc).isoformat()
        )
        
        return JSONResponse(
            status_code=500,
            content=error_resp.model_dump() if hasattr(error_resp, "model_dump") else error_resp.dict()
        )

    return app


app = create_app()
