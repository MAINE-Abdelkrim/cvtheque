"""Focused, installation-independent tests for Windows-safe OCR discovery."""

import os
import subprocess
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image

from app.core.exceptions import OCRProcessingError, OCRUnavailableError
from app.services import ocr_service
from app.services.ocr_service import OCRService


@pytest.fixture(autouse=True)
def reset_ocr_cache():
    OCRService.reset_cache()
    yield
    OCRService.reset_cache()


def completed(version="tesseract 5.5.3"):
    return subprocess.CompletedProcess([], 0, stdout=version, stderr="")


def resolver_mocks(existing):
    return (
        patch("app.services.ocr_service.os.path.isfile", side_effect=lambda p: p in existing),
        patch("app.services.ocr_service.subprocess.run", return_value=completed()),
    )


def test_environment_variable_resolves_valid_executable(monkeypatch):
    path = os.path.abspath(r"C:\Tools With Spaces\tesseract.exe")
    monkeypatch.setenv("TESSERACT_CMD", path)
    file_mock, run_mock = resolver_mocks({path})
    with file_mock, run_mock as invoked:
        assert OCRService.resolve_tesseract() == path
    assert invoked.call_args.args[0] == [path, "--version"]
    assert invoked.call_args.kwargs["shell"] is False


def test_invalid_environment_variable_falls_back_to_path(monkeypatch):
    invalid = os.path.abspath("missing-tesseract")
    discovered = os.path.abspath("path-tesseract.exe")
    monkeypatch.setenv("TESSERACT_CMD", invalid)
    with patch("app.services.ocr_service.shutil.which", return_value=discovered):
        file_mock, run_mock = resolver_mocks({discovered})
        with file_mock, run_mock:
            assert OCRService.resolve_tesseract() == discovered


def test_path_discovery_finds_tesseract(monkeypatch):
    monkeypatch.delenv("TESSERACT_CMD", raising=False)
    discovered = os.path.abspath("bin/tesseract")
    with patch("app.services.ocr_service.shutil.which", return_value=discovered):
        file_mock, run_mock = resolver_mocks({discovered})
        with file_mock, run_mock:
            assert OCRService.resolve_tesseract() == discovered


@pytest.mark.parametrize(
    "fallback",
    [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ],
)
def test_windows_program_files_fallbacks(monkeypatch, fallback):
    monkeypatch.delenv("TESSERACT_CMD", raising=False)
    absolute = os.path.abspath(fallback)
    with patch.object(OCRService, "_windows_fallback_paths", return_value=[fallback]), patch(
        "app.services.ocr_service.shutil.which", return_value=None
    ):
        file_mock, run_mock = resolver_mocks({absolute})
        with file_mock, run_mock:
            assert OCRService.resolve_tesseract() == absolute


def test_pytesseract_command_is_assigned_before_ocr():
    executable = os.path.abspath("tesseract.exe")
    OCRService._resolved_tesseract_cmd = executable
    ocr_service.pytesseract.pytesseract.tesseract_cmd = "changed-by-another-caller"
    image = Image.new("RGB", (10, 10), "white")

    def assert_command(*args, **kwargs):
        assert ocr_service.pytesseract.pytesseract.tesseract_cmd == executable
        return "text"

    with patch.object(OCRService, "get_installed_languages", return_value=["eng"]), patch(
        "app.services.ocr_service.pytesseract.image_to_data", return_value={"text": []}
    ), patch(
        "app.services.ocr_service.pytesseract.image_to_string", side_effect=assert_command
    ):
        assert OCRService.extract_text_from_image(image, "eng") == "text"


def test_failed_check_is_not_cached_and_later_succeeds():
    executable = os.path.abspath("later-tesseract.exe")
    with patch.object(OCRService, "_candidate_paths", side_effect=[[], [executable]]), patch(
        "app.services.ocr_service.os.path.isfile", return_value=True
    ), patch("app.services.ocr_service.subprocess.run", return_value=completed()):
        assert OCRService.is_ocr_available() is False
        assert OCRService.resolve_tesseract() == executable


def test_success_is_cached_and_cache_can_be_reset():
    executable = os.path.abspath("cached-tesseract.exe")
    with patch.object(OCRService, "_candidate_paths", return_value=[executable]), patch(
        "app.services.ocr_service.os.path.isfile", return_value=True
    ), patch("app.services.ocr_service.subprocess.run", return_value=completed()) as run_mock:
        assert OCRService.resolve_tesseract() == executable
        assert OCRService.resolve_tesseract() == executable
        assert run_mock.call_count == 1
        OCRService.reset_cache()
        assert OCRService.resolve_tesseract() == executable
        assert run_mock.call_count == 2


def test_missing_pytesseract_has_precise_diagnostic():
    with patch("app.services.ocr_service.pytesseract", None):
        assert OCRService.is_ocr_available() is False
        assert "pytesseract manquant" in OCRService.get_availability_diagnostic()


def test_missing_executable_has_precise_diagnostic():
    with patch.object(OCRService, "_candidate_paths", return_value=[]):
        assert OCRService.is_ocr_available() is False
    assert "introuvable" in OCRService.get_availability_diagnostic()


def test_failed_version_check_has_precise_diagnostic():
    executable = os.path.abspath("broken-tesseract.exe")
    with patch.object(OCRService, "_candidate_paths", return_value=[executable]), patch(
        "app.services.ocr_service.os.path.isfile", return_value=True
    ), patch(
        "app.services.ocr_service.subprocess.run",
        return_value=subprocess.CompletedProcess([], 1, stdout="", stderr="bad"),
    ):
        assert OCRService.is_ocr_available() is False
    assert "vérification de version a échoué" in OCRService.get_availability_diagnostic()


def test_unavailable_error_uses_precise_diagnostic():
    with patch.object(OCRService, "_candidate_paths", return_value=[]):
        with pytest.raises(OCRUnavailableError, match="introuvable"):
            OCRService.extract_text_from_image(Image.new("RGB", (10, 10)))


def test_ocr_invocation_failure_has_precise_diagnostic():
    OCRService._resolved_tesseract_cmd = os.path.abspath("tesseract.exe")
    with patch.object(OCRService, "get_installed_languages", return_value=["eng"]), patch(
        "app.services.ocr_service.pytesseract.image_to_data", return_value={"text": []}
    ), patch(
        "app.services.ocr_service.pytesseract.image_to_string",
        side_effect=RuntimeError("engine failure"),
    ):
        with pytest.raises(OCRProcessingError, match="invocation OCR.*engine failure"):
            OCRService.extract_text_from_image(Image.new("RGB", (10, 10)), "eng")


@pytest.mark.parametrize(
    ("available", "expected"),
    [(["fra", "eng", "osd"], "fra+eng"), (["eng"], "eng"), (["fra"], "fra")],
)
def test_language_selection(available, expected):
    with patch.object(OCRService, "get_installed_languages", return_value=available):
        assert OCRService.select_ocr_language("fra+eng") == expected


def test_unavailable_requested_language_falls_back_without_crashing():
    OCRService._resolved_tesseract_cmd = os.path.abspath("tesseract.exe")
    with patch.object(OCRService, "get_installed_languages", return_value=["eng"]), patch(
        "app.services.ocr_service.pytesseract.image_to_data", return_value={"text": []}
    ), patch(
        "app.services.ocr_service.pytesseract.image_to_string", return_value="hello"
    ) as image_to_string:
        assert OCRService.extract_text_from_image(Image.new("RGB", (10, 10)), "deu") == "hello"
    assert image_to_string.call_args.kwargs["lang"] == "eng"


def test_no_preferred_language_uses_tesseract_default():
    OCRService._resolved_tesseract_cmd = os.path.abspath("tesseract.exe")
    with patch.object(OCRService, "get_installed_languages", return_value=["spa"]), patch(
        "app.services.ocr_service.pytesseract.image_to_data", return_value={"text": []}
    ), patch(
        "app.services.ocr_service.pytesseract.image_to_string", return_value="hola"
    ) as image_to_string:
        assert OCRService.extract_text_from_image(Image.new("RGB", (10, 10)), "deu") == "hola"
    assert "lang" not in image_to_string.call_args.kwargs
