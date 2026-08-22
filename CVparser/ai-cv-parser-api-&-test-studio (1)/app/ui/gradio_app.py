"""
Gradio application definition for the CV Parser demonstration interface.
"""

import os
import json
import tempfile
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Optional, Any, Union, Tuple
import gradio as gr

from app.core.config import Settings, get_settings
from app.core.exceptions import InvalidPDFError, UnsupportedFileTypeError, CVParserError
from app.services.cv_processing_service import CVProcessingService
from app.models.extraction_models import CVProcessingResult
from app.ui.presenters import (
    serialize_cv_processing_result,
    build_candidate_overview,
    build_diagnostics,
    format_warnings,
    compare_cv_data,
)

logger = logging.getLogger(__name__)

# Bounded temporary file retention configuration
JSON_DOWNLOAD_DIR = os.path.join(tempfile.gettempdir(), "cv_parser_json_downloads")

def cleanup_old_json_files(directory: str, max_age_seconds: float = 300) -> None:
    """
    Scans the dedicated temporary JSON directory and removes files older than max_age_seconds.
    Only deletes parser/evaluation JSON files created by this interface.
    Logs any deletion failures safely without including candidate personal data.
    """
    if not os.path.exists(directory):
        return
    now = time.time()
    try:
        for filename in os.listdir(directory):
            file_path = os.path.join(directory, filename)
            if os.path.isfile(file_path) and filename.startswith(("parsed_cv_", "evaluation_cv_")) and filename.endswith(".json"):
                mtime = os.path.getmtime(file_path)
                if now - mtime > max_age_seconds:
                    try:
                        os.unlink(file_path)
                    except Exception as e:
                        logger.warning("Failed to delete expired temporary file during cleanup: %s", type(e).__name__)
    except Exception as e:
        logger.warning("Error scanning temporary directory for cleanup: %s", type(e).__name__)


def validate_and_read_pdf_path(file_path: Any, settings: Settings) -> bytes:
    """Validate PDF file path using the existing production rules and read its contents."""
    if not file_path:
        raise InvalidPDFError("No file selected.")

    # Gradio files can sometimes be file-like wrappers or file paths
    if hasattr(file_path, "name"):
        path_str = file_path.name
    else:
        path_str = str(file_path)

    if not path_str.lower().endswith(".pdf"):
        raise UnsupportedFileTypeError("Only PDF files are accepted.")

    if not os.path.exists(path_str):
        raise InvalidPDFError("Uploaded file does not exist.")

    file_size = os.path.getsize(path_str)
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if file_size > max_bytes:
        raise CVParserError(
            message=f"The uploaded file exceeds the maximum allowed size of {settings.MAX_FILE_SIZE_MB} MB.",
            code="FILE_TOO_LARGE",
            status_code=413,
        )

    if file_size == 0:
        raise InvalidPDFError("The uploaded PDF file is empty.")

    with open(path_str, "rb") as f:
        pdf_bytes = f.read()

    stripped_bytes = pdf_bytes.lstrip()
    if not stripped_bytes.startswith(b"%PDF-"):
        raise InvalidPDFError("The uploaded file is not a valid PDF document.")

    return pdf_bytes


def get_llm_status_string(
    settings: Settings,
    service: CVProcessingService,
    result: Optional[CVProcessingResult] = None,
) -> str:
    """Generate a sanitized status display string regarding LLM enrichment capabilities."""
    if not settings.MODEL_ENABLED:
        return "### LLM Enrichment Status\n- **Status**: Disabled\n- **Configuration**: `MODEL_ENABLED=False`\n- **Model**: N/A"

    # Check availability
    llm_available = service.llm_client is not None and service.llm_client.is_available()
    status_label = "Available" if llm_available else "Unavailable"
    
    # Safe model name extraction
    model_name = "N/A"
    if service.llm_client:
        model_name = getattr(service.llm_client, "model_name", "Unknown")

    used_str = ""
    if result is not None:
        used_str = f"\n- **Used for last document**: {'Yes' if result.llm_used else 'No'}"

    return f"### LLM Enrichment Status\n- **Status**: {status_label}\n- **Configuration**: `MODEL_ENABLED=True`\n- **Model**: `{model_name}`{used_str}"


def load_expected_json(pasted_json: str = "", uploaded_file: Any = None) -> Optional[dict]:
    """Load optional expected CV JSON without using it as parser input."""
    text = (pasted_json or "").strip()
    if not text and uploaded_file:
        path = uploaded_file.name if hasattr(uploaded_file, "name") else str(uploaded_file)
        try:
            with open(path, "r", encoding="utf-8") as file_handle:
                text = file_handle.read()
        except Exception as exc:
            raise ValueError("Expected JSON file could not be read.") from exc
    if not text:
        return None
    try:
        value = json.loads(text)
    except (TypeError, json.JSONDecodeError) as exc:
        raise ValueError("Expected JSON is invalid.") from exc
    if not isinstance(value, dict):
        raise ValueError("Expected JSON must contain an object.")
    cv_data = value.get("cv_data", value)
    if not isinstance(cv_data, dict):
        raise ValueError("Expected cv_data must contain an object.")
    return cv_data


def build_evaluation_comparison(
    parsed_result: dict, pasted_json: str = "", uploaded_file: Any = None
) -> dict:
    """Compare parsed CV data with optional expected data, without changing extraction."""
    if not parsed_result:
        return {"status": "error", "message": "Parse a CV before comparing results."}
    try:
        expected = load_expected_json(pasted_json, uploaded_file)
    except ValueError as exc:
        return {"status": "invalid_expected_json", "message": str(exc)}
    if expected is None:
        return {"status": "no_expected_json", "message": "No expected JSON was supplied."}
    extracted = parsed_result.get("cv_data", parsed_result)
    extracted_fields = {key: value for key, value in extracted.items() if key != "warnings"}
    expected_fields = {key: value for key, value in expected.items() if key != "warnings"}
    return compare_cv_data(extracted_fields, expected_fields)


def export_evaluation_record(
    source_file: Any,
    parsed_result: dict,
    diagnostics: dict,
    pasted_json: str = "",
    uploaded_expected_file: Any = None,
    comparison: Optional[dict] = None,
    quality_label: str = "",
    evaluator_notes: str = "",
) -> Tuple[Optional[str], str]:
    """Explicitly create a temporary manual-evaluation record for user download."""
    if not parsed_result:
        return None, "Parse a CV before exporting an evaluation record."
    try:
        expected = load_expected_json(pasted_json, uploaded_expected_file)
    except ValueError as exc:
        return None, str(exc)

    source_path = source_file.name if hasattr(source_file, "name") else str(source_file or "")
    selected_diagnostics = {
        key: diagnostics.get(key)
        for key in (
            "extraction_method",
            "page_count",
            "detected_sections",
            "processing_time_seconds",
            "ocr_used",
            "llm_used",
            "llm_available",
            "pipeline_warnings",
        )
    }
    record = {
        "test_timestamp": datetime.now(timezone.utc).isoformat(),
        "source_filename": os.path.basename(source_path),
        "parser_structured_result": parsed_result.get("cv_data", parsed_result),
        "selected_diagnostics": selected_diagnostics,
        "expected_cv_data": expected,
        "comparison": comparison or build_evaluation_comparison(
            parsed_result, pasted_json, uploaded_expected_file
        ),
        "manual_quality_label": quality_label or None,
        "evaluator_notes": (evaluator_notes or "").strip(),
        "privacy_notice": "This evaluation record may contain personal data.",
    }
    os.makedirs(JSON_DOWNLOAD_DIR, exist_ok=True)
    cleanup_old_json_files(JSON_DOWNLOAD_DIR, max_age_seconds=300)
    path = os.path.join(JSON_DOWNLOAD_DIR, f"evaluation_cv_{uuid.uuid4().hex}.json")
    with open(path, "w", encoding="utf-8") as file_handle:
        json.dump(record, file_handle, indent=2, ensure_ascii=False)
    return path, "Evaluation record is ready for download. It may contain personal data."


def create_gradio_app(
    settings: Optional[Settings] = None,
    processing_service: Optional[CVProcessingService] = None,
) -> gr.Blocks:
    """Construct and return the Gradio Blocks demonstration application.

    This function does NOT launch a server or load ML models into memory.
    """
    app_settings = settings or get_settings()
    app_service = processing_service or CVProcessingService(settings=app_settings)

    # Initial LLM status
    initial_llm_status = get_llm_status_string(app_settings, app_service)

    with gr.Blocks(title="CV Parser Demonstration", theme=gr.themes.Default()) as demo:
        gr.Markdown(
            """# 📄 CV Parser Demonstration
            Upload a candidate CV in PDF format to parse and extract structured contact information, skills, languages, education, and professional experience.
            """
        )

        with gr.Row():
            # Left Panel: Input & Controls
            with gr.Column(scale=1):
                file_input = gr.File(
                    label="Upload PDF CV",
                    file_types=[".pdf"],
                    interactive=True,
                )
                
                with gr.Row():
                    parse_btn = gr.Button("Parse CV", variant="primary")
                    reset_btn = gr.Button("Reset", variant="secondary")

                status_box = gr.Markdown(value="", visible=False)
                
                llm_status_box = gr.Markdown(value=initial_llm_status)

            # Right Panel: Structured extraction and manual evaluation
            with gr.Column(scale=2):
                with gr.Tabs():
                    with gr.TabItem("Structured JSON"):
                        json_output = gr.JSON(label="Final Parsed Result", value={})

                    with gr.TabItem("Candidate Overview"):
                        overview_output = gr.Markdown(value="Upload a file and press **Parse CV** to start.")

                    with gr.TabItem("Diagnostics"):
                        diagnostics_output = gr.JSON(label="Pipeline Diagnostics", value={})

                    with gr.TabItem("Warnings"):
                        warnings_output = gr.Markdown(value="No warnings to display.")

                gr.Markdown("### Manual evaluation")
                expected_text = gr.Textbox(label="Expected CV JSON (optional)", lines=8)
                expected_file = gr.File(label="Or upload expected JSON", file_types=[".json"])
                compare_btn = gr.Button("Compare structured CV data")
                comparison_output = gr.JSON(label="Deterministic comparison", value={})
                quality_label = gr.Dropdown(
                    choices=["Correct", "Mostly correct", "Partially correct", "Incorrect"],
                    label="Manual quality label",
                )
                evaluator_notes = gr.Textbox(label="Evaluator notes", lines=3)
                export_btn = gr.Button("Export evaluation record")
                download_output = gr.File(
                    label="Download Evaluation Record",
                    interactive=False,
                    visible=False,
                )
                privacy_notice = gr.Markdown(
                    "Exported evaluation records may contain personal data. Files are created only when you click Export."
                )

        def handle_parsing(file: Any) -> Tuple[str, dict, dict, str, str, Optional[str], str]:
            """Parse PDF and return UI updates."""
            if not file:
                return (
                    "Error occurred during parsing.",
                    {},
                    {},
                    "No warnings to display.",
                    get_llm_status_string(app_settings, app_service),
                    None,
                    "No file selected."
                )

            try:
                # 1. Validate and read PDF bytes safely
                pdf_bytes = validate_and_read_pdf_path(file, app_settings)

                # 2. Process with the injectable service
                result = app_service.process_pdf(pdf_bytes)

                # 3. Present data cleanly
                overview_md = build_candidate_overview(result)
                serialized_json = serialize_cv_processing_result(result)
                diagnostics_json = build_diagnostics(result)
                warnings_list = format_warnings(result)
                
                if warnings_list:
                    warnings_md = "\n".join(f"- {w}" for w in warnings_list)
                else:
                    warnings_md = "No warnings."

                updated_llm_status = get_llm_status_string(app_settings, app_service, result)

                return (
                    overview_md,
                    serialized_json,
                    diagnostics_json,
                    warnings_md,
                    updated_llm_status,
                    None,
                    "Success! Parsing completed successfully."
                )

            except InvalidPDFError as e:
                msg = str(e)
                if any(x in msg.lower() for x in ["malformed", "corrupted", "format", "objects", "stream"]):
                    err_msg = "The uploaded PDF document is malformed or corrupted."
                elif "empty" in msg.lower():
                    err_msg = "The uploaded PDF file is empty."
                else:
                    err_msg = "The uploaded file is not a valid PDF."
                
                return (
                    "Parsing failed.",
                    {},
                    {},
                    "No warnings to display.",
                    get_llm_status_string(app_settings, app_service),
                    None,
                    f"⚠️ **Error**: {err_msg}"
                )

            except UnsupportedFileTypeError as e:
                return (
                    "Parsing failed.",
                    {},
                    {},
                    "No warnings to display.",
                    get_llm_status_string(app_settings, app_service),
                    None,
                    f"⚠️ **Error**: {str(e)}"
                )

            except CVParserError as e:
                return (
                    "Parsing failed.",
                    {},
                    {},
                    "No warnings to display.",
                    get_llm_status_string(app_settings, app_service),
                    None,
                    f"⚠️ **Error**: {e.message}"
                )

            except Exception:
                logger.exception("Unexpected error processing PDF in Gradio UI:")
                return (
                    "Parsing failed.",
                    {},
                    {},
                    "No warnings to display.",
                    get_llm_status_string(app_settings, app_service),
                    None,
                    "⚠️ **Error**: An unexpected processing error occurred."
                )

        def handle_reset() -> Tuple[None, str, dict, dict, str, str, None, str]:
            """Reset components to their default states."""
            return (
                None,  # file_input
                "Upload a file and press **Parse CV** to start.",  # overview_output
                {},  # json_output
                {},  # diagnostics_output
                "No warnings to display.",  # warnings_output
                get_llm_status_string(app_settings, app_service),  # llm_status_box
                None,  # download_output
                ""  # status_box
            )

        # Wire handlers
        parse_btn.click(
            fn=handle_parsing,
            inputs=[file_input],
            outputs=[
                overview_output,
                json_output,
                diagnostics_output,
                warnings_output,
                llm_status_box,
                download_output,
                status_box,
            ]
        ).then(
            fn=lambda x: gr.update(visible=bool(x)),
            inputs=[download_output],
            outputs=[download_output]
        ).then(
            fn=lambda x: gr.update(visible=bool(x)),
            inputs=[status_box],
            outputs=[status_box]
        )

        reset_btn.click(
            fn=handle_reset,
            inputs=[],
            outputs=[
                file_input,
                overview_output,
                json_output,
                diagnostics_output,
                warnings_output,
                llm_status_box,
                download_output,
                status_box,
            ]
        ).then(
            fn=lambda: gr.update(visible=False),
            inputs=[],
            outputs=[download_output]
        ).then(
            fn=lambda: gr.update(visible=False),
            inputs=[],
            outputs=[status_box]
        ).then(
            fn=lambda: ("", None, {}, None, ""),
            inputs=[],
            outputs=[expected_text, expected_file, comparison_output, quality_label, evaluator_notes],
        )

        compare_btn.click(
            fn=build_evaluation_comparison,
            inputs=[json_output, expected_text, expected_file],
            outputs=[comparison_output],
        )

        export_btn.click(
            fn=export_evaluation_record,
            inputs=[
                file_input,
                json_output,
                diagnostics_output,
                expected_text,
                expected_file,
                comparison_output,
                quality_label,
                evaluator_notes,
            ],
            outputs=[download_output, status_box],
        ).then(
            fn=lambda x: gr.update(visible=bool(x)),
            inputs=[download_output],
            outputs=[download_output],
        )

        # Attach handler functions as properties on the gr.Blocks instance for testability
        demo.handle_parsing = handle_parsing
        demo.handle_reset = handle_reset
        demo.handle_comparison = build_evaluation_comparison
        demo.handle_export = export_evaluation_record

    return demo


def validate_port(port_str: str) -> int:
    try:
        port = int(port_str)
        if not (1024 <= port <= 65535):
            raise ValueError(f"Port must be in range [1024, 65535]: {port}")
        return port
    except ValueError as e:
        raise ValueError(f"Invalid server port configuration: {e}") from e

def validate_share(share_str: str) -> bool:
    val = share_str.lower().strip()
    if val in ("true", "1", "t", "yes", "y"):
        return True
    if val in ("false", "0", "f", "no", "n"):
        return False
    raise ValueError(f"Invalid boolean share configuration: {share_str}")


if __name__ == "__main__":
    import os
    # Standard entrypoint to run the Gradio app standalone
    server_name = os.getenv("GRADIO_SERVER_NAME", "0.0.0.0")
    
    try:
        server_port = validate_port(os.getenv("GRADIO_SERVER_PORT", "7860"))
        share = validate_share(os.getenv("GRADIO_SHARE", "False"))
    except ValueError as e:
        logger.error("Configuration error: %s", e)
        raise SystemExit(1) from e

    demo_app = create_gradio_app()
    demo_app.launch(server_name=server_name, server_port=server_port, share=share)
