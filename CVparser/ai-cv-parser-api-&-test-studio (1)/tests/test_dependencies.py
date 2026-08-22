"""
Tests to verify dependency-file architecture, constraints, and safety guidelines.
"""

import os
import re
import json
import pytest

from app.core.config import Settings
from app.ui.gradio_app import create_gradio_app, validate_and_read_pdf_path
from app.core.exceptions import CVParserError


def test_requirements_file_exists_and_is_readable():
    """Verify requirements.txt is present and readable."""
    path = "requirements.txt"
    assert os.path.exists(path)
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    assert len(content) > 0


def test_no_duplicate_direct_dependency_names():
    """Verify no duplicate direct dependency names in requirements files, normalized for case and hyphens."""
    def check_file(path):
        if not os.path.exists(path):
            return
        seen = set()
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                # Match package name before comparison operators
                match = re.match(r"^([a-zA-Z0-9_\-]+)", line)
                if match:
                    name = match.group(1).lower().replace("_", "-")
                    assert name not in seen, f"Duplicate package '{name}' detected in {path}"
                    seen.add(name)

    check_file("requirements.txt")
    check_file("requirements-dev.txt")
    check_file("requirements-llm.txt")


def test_default_requirements_do_not_include_heavy_packages():
    """Verify default production requirements do not contain heavy machine learning packages."""
    with open("requirements.txt", "r", encoding="utf-8") as f:
        content = f.read().lower()

    assert "torch" not in content
    assert "transformers" not in content
    assert "accelerate" not in content
    assert "bitsandbytes" not in content


def test_dependency_files_contain_no_unsafe_or_local_paths():
    """Reject arbitrary dependency URLs while allowing the pinned official llama.cpp wheel index."""
    pattern = re.compile(r"(\.whl|git\+|http://|https://|/local/|\.git)")
    allowed_index = (
        "requirements-llm.txt",
        "--extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu",
    )
    
    for path in ["requirements.txt", "requirements-dev.txt", "requirements-llm.txt"]:
        if not os.path.exists(path):
            continue
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if (path, line) == allowed_index:
                    continue
                assert not pattern.search(line), f"Unsafe dependency marker found in {path}: {line}"


def test_huggingface_hub_constraint_if_present():
    """Ensure huggingface-hub is appropriately constrained in requirements.txt if present."""
    if os.path.exists("requirements.txt"):
        with open("requirements.txt", "r", encoding="utf-8") as f:
            content = f.read()
        if "huggingface-hub" in content.lower():
            # Ensure it is constrained to <0.25.0
            assert "<0.25.0" in content, "huggingface-hub missing Gradio compatibility constraint (<0.25.0)"


def test_gradio_config_validation():
    """Test that importing gradio_app does not run launch, and parameters are safe."""
    demo = create_gradio_app()
    # Ensure share mode defaults to false or is not explicitly set to True
    assert getattr(demo, "share", False) is False
    
    # Check default server name / port configured safely if set
    assert getattr(demo, "server_name", None) is None or getattr(demo, "server_name") == "0.0.0.0"


def test_json_download_privacy_and_structure(tmp_path):
    """Test that JSON download formatting is robust, safe, and doesn't leak paths or prompts."""
    # Ensure standard temp folder logic works
    from app.ui.presenters import serialize_cv_processing_result
    from app.models.cv_models import CVData, Identity
    from app.models.extraction_models import CVProcessingResult, PipelineExtractionResult
    from app.models.response_models import ExtractionMethod

    cv_data = CVData(identity=Identity(full_name="Alice Candidate", email="alice@example.com"))
    pipeline = PipelineExtractionResult(
        raw_text="Alice Candidate",
        cleaned_text="alice candidate",
        extraction_method=ExtractionMethod.NATIVE_PDF,
        total_pages=1,
        processing_time_seconds=0.01,
    )
    result = CVProcessingResult(
        pipeline_result=pipeline,
        cv_data=cv_data,
        llm_used=False,
        llm_available=False,
    )
    
    serialized = serialize_cv_processing_result(result)
    
    # Output must be serializable and contain no secrets or raw prompt blocks
    json_str = json.dumps(serialized, ensure_ascii=False)
    assert "Alice" in json_str
    
    # Assert no sensitive/private keys are present
    for forbidden in ["prompt", "secret", "raw_llm", "password"]:
        assert forbidden not in serialized
        assert forbidden not in serialized.get("cv_data", {})


def test_validate_pdf_path_size_limit():
    """Test size validation in validate_and_read_pdf_path with mocked/small settings."""
    settings = Settings(MAX_FILE_SIZE_MB=0) # 0 means any file will exceed limit
    
    class FakeFile:
        name = "test.pdf"

    # Create dummy file with some content
    temp_file = "dummy_test.pdf"
    with open(temp_file, "wb") as f:
        f.write(b"%PDF-1.4\ncontent")

    try:
        with pytest.raises(CVParserError) as exc:
            validate_and_read_pdf_path(temp_file, settings)
        assert "exceeds the maximum" in str(exc.value.message)
    finally:
        if os.path.exists(temp_file):
            os.unlink(temp_file)


def test_declared_dependencies_are_valid_project_metadata():
    """Validate declared requirements without depending on the active developer environment."""
    from packaging.requirements import Requirement
    from packaging.version import Version

    assert os.path.exists("requirements.txt")
    parsed = {}
    with open("requirements.txt", "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            req = Requirement(line)
            parsed[req.name.lower().replace("_", "-")] = req

    assert parsed
    uvicorn_req = parsed["uvicorn"]
    assert Version("0.30.0") in uvicorn_req.specifier
    assert Version("0.31.0") not in uvicorn_req.specifier


def test_lock_file_format_and_pins():
    """Verify requirements-lock.txt matches strict guidelines (exact == pins, no unsafe sources, no duplicates)."""
    assert os.path.exists("requirements-lock.txt")
    seen_names = set()
    with open("requirements-lock.txt", "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            assert "==" in line, f"Lock entry must be an exact pin: {line}"
            parts = line.split("==")
            assert len(parts) == 2, f"Invalid format in lock file: {line}"
            name, ver = parts[0].strip().lower().replace("_", "-"), parts[1].strip()
            
            # Check for duplicates
            assert name not in seen_names, f"Duplicate lock entry found for package: {name}"
            seen_names.add(name)
            
            # Check for unsafe sources
            for bad_source in [".whl", "git+", "http://", "https://", "/local/"]:
                assert bad_source not in line, f"Unsafe/local path source found in lock: {line}"


def test_no_heavy_llm_defaults():
    """Ensure torch, transformers, and accelerate are not in requirements.txt or requirements-lock.txt."""
    for filename in ["requirements.txt", "requirements-lock.txt"]:
        if os.path.exists(filename):
            with open(filename, "r", encoding="utf-8") as f:
                content = f.read().lower()
            for heavy in ["torch", "transformers", "accelerate", "bitsandbytes"]:
                assert heavy not in content, f"Heavy package '{heavy}' unexpectedly found in {filename}"


def test_gradio_port_and_share_validation():
    """Verify port and share validation helpers in app/ui/gradio_app.py."""
    from app.ui.gradio_app import validate_port, validate_share
    
    # Valid port inputs
    assert validate_port("7860") == 7860
    assert validate_port("3000") == 3000
    
    # Invalid port inputs
    with pytest.raises(ValueError, match="Invalid server port configuration|Port must be in range"):
        validate_port("80")
    with pytest.raises(ValueError, match="Invalid server port configuration|Port must be in range"):
        validate_port("70000")
    with pytest.raises(ValueError, match="Invalid server port configuration"):
        validate_port("not-a-port")

    # Valid share inputs
    assert validate_share("true") is True
    assert validate_share("1") is True
    assert validate_share("Y") is True
    assert validate_share("false") is False
    assert validate_share("0") is False
    assert validate_share("No") is False

    # Invalid share inputs
    with pytest.raises(ValueError, match="Invalid boolean share configuration"):
        validate_share("maybe")


def test_json_files_different_and_cleanup_isolated(tmp_path):
    """Test that generated temporary JSON files do not collide and cleanup handles them in isolation."""
    from app.ui.gradio_app import cleanup_old_json_files
    import uuid
    import time

    # Ensure two generated file names/paths are distinct
    file1 = f"parsed_cv_{uuid.uuid4().hex}.json"
    file2 = f"parsed_cv_{uuid.uuid4().hex}.json"
    assert file1 != file2

    # Create dummy files
    dir_path = tmp_path / "downloads"
    dir_path.mkdir()
    
    expired_file = dir_path / f"parsed_cv_{uuid.uuid4().hex}.json"
    fresh_file = dir_path / f"parsed_cv_{uuid.uuid4().hex}.json"
    unrelated_file = dir_path / "other_file.json"

    # Write contents
    expired_file.write_text('{"test": "expired"}', encoding="utf-8")
    fresh_file.write_text('{"test": "fresh"}', encoding="utf-8")
    unrelated_file.write_text('{"test": "unrelated"}', encoding="utf-8")

    # Artificially age the expired file (set its mtime to 1 hour ago)
    past_time = time.time() - 3600
    os.utime(str(expired_file), (past_time, past_time))

    # Run cleanup with max_age_seconds=1800 (30 mins)
    cleanup_old_json_files(str(dir_path), max_age_seconds=1800)

    # Check results: expired_file should be deleted, fresh and unrelated must remain untouched!
    assert not expired_file.exists()
    assert fresh_file.exists()
    assert unrelated_file.exists()


def test_no_broad_warning_suppression_filters():
    """Verify that pytest.ini does not contain broad or module-wide warning ignores."""
    assert os.path.exists("pytest.ini")
    with open("pytest.ini", "r", encoding="utf-8") as f:
        content = f.read()
    
    # Check that broad ignore rules are absent
    for broad_filter in [
        "ignore::Warning",
        "ignore::DeprecationWarning",
        "ignore::UserWarning",
        "ignore::RuntimeWarning"
    ]:
        assert broad_filter not in content, f"Broad filter '{broad_filter}' is forbidden in pytest.ini"
