"""
Tests for the FastAPI health check endpoint.
"""

import sys
import subprocess
from fastapi.testclient import TestClient
from app.main import app


def test_health_endpoint_success():
    """Test that GET /health returns 200 with stable status 'ok'."""
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    
    data = response.json()
    assert data["status"] == "ok"
    assert "ocr_available" in data
    assert "model_available" in data
    assert "model_status_message" in data


def test_health_import_safety():
    """Test that importing the app and accessing health does not load torch or transformers.

    We execute this in an isolated subprocess to guarantee a clean sys.modules state.
    """
    code = """
import sys
import app.main
# Ensure torch and transformers are not in sys.modules after import
assert "torch" not in sys.modules, "torch should not be imported eagerly!"
assert "transformers" not in sys.modules, "transformers should not be imported eagerly!"

from fastapi.testclient import TestClient
client = TestClient(app.main.app)
response = client.get("/health")
assert response.status_code == 200

# Verify modules are still not imported after running health check
assert "torch" not in sys.modules, "torch should not be imported after GET /health!"
assert "transformers" not in sys.modules, "transformers should not be imported after GET /health!"
print("SUCCESS")
"""
    result = subprocess.run([sys.executable, "-B", "-c", code], capture_output=True, text=True)
    assert result.returncode == 0, f"Import safety check failed: {result.stderr}"
    assert "SUCCESS" in result.stdout.strip()
