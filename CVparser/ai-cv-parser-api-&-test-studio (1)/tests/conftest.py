"""Shared fixtures for deterministic test-process isolation."""

import os
import subprocess
import sys

import pytest


@pytest.fixture
def isolated_python():
    """Run a Python snippet in a fresh, bytecode-disabled interpreter."""

    def run(code: str) -> subprocess.CompletedProcess[str]:
        env = os.environ.copy()
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        return subprocess.run(
            [sys.executable, "-B", "-c", code],
            capture_output=True,
            text=True,
            env=env,
            check=False,
        )

    return run
