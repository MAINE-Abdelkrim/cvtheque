"""
Unit tests for scripts/validate_qwen_local.py utility using mocks.
"""

import sys
from unittest.mock import MagicMock, patch
import pytest

from scripts.validate_qwen_local import (
    check_cuda_available,
    get_process_memory_mb,
    get_system_ram_gb,
    main,
    parse_args,
)


def test_parse_args():
    args = parse_args(["--model", "Qwen/Qwen2.5-0.5B-Instruct", "--device", "cpu", "--skip-cv"])
    assert args.model == "Qwen/Qwen2.5-0.5B-Instruct"
    assert args.device == "cpu"
    assert args.skip_cv is True


def test_get_process_memory_mb():
    mem = get_process_memory_mb()
    assert isinstance(mem, float)


def test_get_system_ram_gb():
    total, avail = get_system_ram_gb()
    assert isinstance(total, float)
    assert isinstance(avail, float)


def test_check_cuda_available():
    avail, dev = check_cuda_available()
    assert isinstance(avail, bool)


@patch("scripts.validate_qwen_local.get_system_ram_gb", return_value=(8.0, 4.0))
def test_main_missing_torch_returns_exit_code_2(mock_ram, monkeypatch):
    monkeypatch.setitem(sys.modules, "torch", None)
    code = main(["--skip-cv"])
    assert code == 2
    mock_ram.assert_called_once()


@patch("scripts.validate_qwen_local.get_system_ram_gb", return_value=(8.0, 0.5))
def test_main_critically_low_memory_returns_exit_code_6(mock_ram):
    code = main(["--skip-cv"])
    assert code == 6


@patch("scripts.validate_qwen_local.get_system_ram_gb", return_value=(8.0, 4.0))
@patch("app.llm.qwen_client.QwenLLMClient.load")
@patch("app.llm.qwen_client.QwenLLMClient.generate", return_value='{"status": "ok"}')
def test_main_successful_synthetic_validation(mock_gen, mock_load, mock_ram):
    code = main(["--skip-cv", "--device", "cpu"])
    assert code == 0
