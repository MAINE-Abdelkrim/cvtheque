"""
Unit tests for scripts/download_model.py utility.
"""

import sys
from unittest.mock import MagicMock, patch
import pytest

from scripts.download_model import estimate_model_disk_size, main, parse_args, sanitize_path


def test_parse_args_defaults():
    args = parse_args([])
    assert args.model is None
    assert args.cache_dir is None
    assert args.token is None
    assert args.force is False
    assert args.offline is False


def test_parse_args_overrides():
    args = parse_args(["--model", "Qwen/Qwen2.5-1.5B-Instruct", "--token", "secret123", "--offline", "--force"])
    assert args.model == "Qwen/Qwen2.5-1.5B-Instruct"
    assert args.token == "secret123"
    assert args.offline is True
    assert args.force is True


def test_estimate_model_disk_size():
    assert "1.0 GB" in estimate_model_disk_size("Qwen/Qwen2.5-0.5B-Instruct")
    assert "3.0 GB" in estimate_model_disk_size("Qwen/Qwen2.5-1.5B-Instruct")
    assert "6.2 GB" in estimate_model_disk_size("Qwen/Qwen2.5-3B-Instruct")


def test_sanitize_path():
    assert sanitize_path("") == "Default Hugging Face Cache"


def test_main_missing_dependencies_returns_exit_code_2(monkeypatch):
    monkeypatch.setitem(sys.modules, "huggingface_hub", None)
    monkeypatch.setitem(sys.modules, "transformers", None)
    code = main(["--model", "Qwen/Qwen2.5-0.5B-Instruct"])
    assert code == 2


def test_main_successful_snapshot_download(monkeypatch):
    mock_hf = MagicMock()
    mock_hf.snapshot_download.return_value = "/cache/qwen"
    monkeypatch.setitem(sys.modules, "huggingface_hub", mock_hf)
    monkeypatch.setitem(sys.modules, "transformers", None)

    code = main(["--model", "Qwen/Qwen2.5-0.5B-Instruct", "--force"])
    assert code == 0
    mock_hf.snapshot_download.assert_called_once()


def test_main_failed_download_returns_exit_code_1(monkeypatch):
    mock_hf = MagicMock()
    mock_hf.snapshot_download.side_effect = Exception("Network error")
    monkeypatch.setitem(sys.modules, "huggingface_hub", mock_hf)
    monkeypatch.setitem(sys.modules, "transformers", None)

    code = main(["--model", "Qwen/Qwen2.5-0.5B-Instruct", "--force"])
    assert code == 1


def test_main_custom_cache_dir_and_offline(monkeypatch, capsys):
    mock_hf = MagicMock()
    mock_hf.snapshot_download.return_value = "/custom/cache/dir/qwen"
    monkeypatch.setitem(sys.modules, "huggingface_hub", mock_hf)
    monkeypatch.setitem(sys.modules, "transformers", None)

    code = main([
        "--model", "Qwen/Qwen2.5-0.5B-Instruct",
        "--cache-dir", "/custom/cache/dir",
        "--offline",
        "--token", "secret_hf_token_12345"
    ])

    assert code == 0
    captured = capsys.readouterr()
    assert "secret_hf_token_12345" not in captured.out
    assert "secret_hf_token_12345" not in captured.err
    assert "Yes (redacted)" in captured.out

    mock_hf.snapshot_download.assert_called_once_with(
        repo_id="Qwen/Qwen2.5-0.5B-Instruct",
        cache_dir="/custom/cache/dir",
        local_files_only=True,
        token="secret_hf_token_12345",
    )
