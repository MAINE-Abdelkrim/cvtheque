"""
Response parser for LLM completion layer.
"""

from typing import Any, Dict

from app.core.exceptions import MalformedJSONError, NoJSONObjectFoundError
from app.utils.json_utils import parse_and_clean_json


class LLMResponseParser:
    """Parses raw LLM string output into a validated Python dictionary."""

    def parse_completion_response(self, raw_response: str) -> Dict[str, Any]:
        """Parse completion JSON string into a dictionary.

        Raises:
            NoJSONObjectFoundError: If raw_response is empty or contains no JSON.
            MalformedJSONError: If JSON is invalid or root is not an object.
        """
        if not raw_response or not raw_response.strip():
            raise NoJSONObjectFoundError("LLM response was empty")

        clean_raw = raw_response.strip()
        if clean_raw.startswith("```"):
            lines = clean_raw.splitlines()
            if len(lines) >= 2 and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            clean_raw = "\n".join(lines).strip()

        if clean_raw.startswith("["):
            raise MalformedJSONError("LLM response root must be a JSON object, not an array")

        parsed = parse_and_clean_json(raw_response)

        if not isinstance(parsed, dict):
            raise MalformedJSONError("LLM response root must be a JSON object")

        return parsed
