"""
JSON extraction, syntax repairing, and parsing utilities for LLM output processing.
"""

import json
import re
from typing import Any, Dict
from app.core.exceptions import (
    JSONValidationError,
    NoJSONObjectFoundError,
    MalformedJSONError,
)


def extract_json_from_llm_output(text: str) -> str:
    """
    Locates and extracts the raw JSON string from an LLM response.
    Handles Markdown codeblocks (```json ... ```) or raw text containing JSON objects.
    """
    if not text or not text.strip():
        raise NoJSONObjectFoundError("La sortie du modèle LLM est vide.")

    # 1. Search for ```json ... ``` markdown block
    code_block_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    if code_block_match:
        extracted = code_block_match.group(1).strip()
        if extracted:
            return extracted

    # 2. Search for outermost JSON object or array brackets { ... } or [ ... ]
    start_idx = text.find("{")
    end_idx = text.rfind("}")

    if start_idx != -1:
        if end_idx != -1 and end_idx >= start_idx:
            return text[start_idx : end_idx + 1].strip()
        # Handle truncated JSON starting with {
        return text[start_idx:].strip()

    raise NoJSONObjectFoundError("Aucun objet JSON n'a été trouvé dans le texte fourni.")


def repair_json_syntax(json_str: str) -> str:
    """
    Applies non-destructive heuristic fixes to common LLM JSON syntax mistakes:
    - Removes trailing commas before closing brackets/braces ({"a": 1, })
    - Converts single-quoted JSON keys/string values to double quotes without altering inner text apostrophes
    Note: Automatic completion of missing closing braces/brackets is strictly forbidden.
    """
    if not json_str:
        return ""

    repaired = json_str.strip()

    # Remove trailing commas in objects and arrays
    repaired = re.sub(r",\s*([\}\]])", r"\1", repaired)

    # Convert single-quoted keys to double-quoted keys: 'key': -> "key":
    repaired = re.sub(r"'\s*([a-zA-Z0-9_\-]+)\s*'\s*:", r'"\1":', repaired)

    return repaired


def parse_and_clean_json(text: str) -> Dict[str, Any]:
    """
    Extracts, repairs syntax, and parses LLM text into a Python dict.
    Raises NoJSONObjectFoundError or MalformedJSONError (subclasses of JSONValidationError).
    """
    raw_json = extract_json_from_llm_output(text)

    # Try standard json.loads first
    try:
        parsed = json.loads(raw_json)
        if isinstance(parsed, dict):
            return parsed
        raise MalformedJSONError("Le JSON extrait n'est pas un objet (dictionnaire).")
    except json.JSONDecodeError:
        pass

    # Try after repairing syntax
    repaired_json = repair_json_syntax(raw_json)
    try:
        parsed = json.loads(repaired_json)
        if isinstance(parsed, dict):
            return parsed
        raise MalformedJSONError("Le JSON réparé n'est pas un objet (dictionnaire).")
    except json.JSONDecodeError as err:
        raise MalformedJSONError(
            message=f"Impossible de parser le JSON retourné par le modèle LLM: {str(err)}",
            extra_data={
                "raw_output": text[:500],
                "extracted_json": raw_json[:500],
                "repaired_json": repaired_json[:500],
                "json_error": str(err),
            },
        )
