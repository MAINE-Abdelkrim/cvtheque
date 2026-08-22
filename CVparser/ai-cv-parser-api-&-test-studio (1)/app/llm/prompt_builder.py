"""
Prompt builder for LLM completion layer.
Implements deterministic JSON prompt generation and section-aware,
bounded input selection.
"""

import json
import re
from typing import Any, Dict, List, Tuple

from app.models.cv_models import CVData


class LLMPromptBuilder:
    """Builds deterministic JSON prompts for filling missing CV fields."""

    MAX_TEXT_LENGTH: int = 4000  # Default safeguard character limit for prompt context

    SECTION_PRIORITY_MAP: Dict[str, List[str]] = {
        "identity": ["header", "contact", "personal", "profile"],
        "summary": ["summary", "profile", "about", "objective"],
        "experiences": ["experience", "work", "employment", "history", "positions", "professional"],
        "education": ["education", "academic", "training", "studies"],
        "skills": ["skills", "technologies", "competencies", "tools"],
        "languages": ["languages"],
        "certifications": ["certifications", "certificates", "licenses"],
    }

    def __init__(self, max_text_length: int = 4000) -> None:
        self.max_text_length = max_text_length
        self.last_text_was_bounded: bool = False

    @staticmethod
    def _is_blank(value: Any) -> bool:
        if value is None:
            return True
        if isinstance(value, str):
            return len(value.strip()) == 0
        return False

    @classmethod
    def get_missing_and_protected_fields(
        cls, deterministic_data: CVData
    ) -> Tuple[List[str], List[str]]:
        """Identify missing (allowed for completion) and protected fields in CVData."""
        missing_fields: List[str] = []
        protected_fields: List[str] = []

        # Identity fields
        identity = deterministic_data.identity
        identity_fields = [
            "full_name",
            "email",
            "phone",
            "location",
            "linkedin",
            "github",
            "website",
            "job_title",
        ]
        for field in identity_fields:
            val = getattr(identity, field, None)
            path = f"identity.{field}"
            if cls._is_blank(val):
                missing_fields.append(path)
            else:
                protected_fields.append(path)

        # Summary
        if cls._is_blank(deterministic_data.summary):
            missing_fields.append("summary")
        else:
            protected_fields.append("summary")

        # List fields
        list_fields = [
            ("skills", deterministic_data.skills),
            ("languages", deterministic_data.languages),
            ("certifications", deterministic_data.certifications),
            ("education", deterministic_data.education),
            ("experiences", deterministic_data.experiences),
        ]

        for field_name, items in list_fields:
            if len(items) == 0:
                missing_fields.append(field_name)
            else:
                protected_fields.append(field_name)

        return missing_fields, protected_fields

    @staticmethod
    def _clean_and_deduplicate_text(text: str) -> str:
        """Collapse whitespace and deduplicate identical consecutive lines/blocks."""
        if not text:
            return ""

        # Normalize line endings and collapse excessive horizontal spacing
        cleaned_lines = []
        seen_lines = set()

        for line in text.splitlines():
            normalized_line = re.sub(r"[ \t]+", " ", line).strip()
            if not normalized_line:
                continue
            # Deduplicate exact repeated lines (e.g. repeated section headers or footers)
            line_key = normalized_line.lower()
            if line_key in seen_lines and len(normalized_line) > 30:
                continue
            seen_lines.add(line_key)
            cleaned_lines.append(normalized_line)

        return "\n".join(cleaned_lines)

    def select_relevant_sections(
        self,
        cleaned_text: str,
        sections: Dict[str, str],
        missing_fields: List[str],
        max_length: int = 4000,
    ) -> Tuple[str, bool]:
        """Section-aware input selection that prioritizes sections needed for missing fields."""
        cleaned_doc = self._clean_and_deduplicate_text(cleaned_text or "")
        if len(cleaned_doc) <= max_length:
            return cleaned_doc, False

        # Determine priority section keywords based on missing fields
        priority_keywords: List[str] = []
        for missing in missing_fields:
            base_category = missing.split(".")[0]
            if base_category in self.SECTION_PRIORITY_MAP:
                priority_keywords.extend(self.SECTION_PRIORITY_MAP[base_category])

        selected_blocks: List[str] = []
        seen_keys = set()

        # 1. First pass: Add sections matching missing field priorities
        if sections:
            for key, content in sections.items():
                key_lower = key.lower()
                content_clean = self._clean_and_deduplicate_text(content)
                if not content_clean:
                    continue

                if any(kw in key_lower for kw in priority_keywords):
                    selected_blocks.append(f"=== SECTION: {key.upper()} ===\n{content_clean}")
                    seen_keys.add(key)

            # 2. Second pass: Add remaining sections
            for key, content in sections.items():
                if key in seen_keys:
                    continue
                content_clean = self._clean_and_deduplicate_text(content)
                if content_clean:
                    selected_blocks.append(f"=== SECTION: {key.upper()} ===\n{content_clean}")
                    seen_keys.add(key)

        assembled_text = "\n\n".join(selected_blocks) if selected_blocks else cleaned_doc

        # Fallback if section assembly missed main content
        if not assembled_text or len(assembled_text) < len(cleaned_doc) * 0.3:
            assembled_text = cleaned_doc

        # Enforce max bounded size
        if len(assembled_text) > max_length:
            bounded_text = assembled_text[:max_length].rsplit("\n", 1)[0]
            bounded_text += "\n[CV TEXT BOUNDED: Additional sections omitted to fit context limit]"
            return bounded_text, True

        return assembled_text, False

    def build_completion_prompt(
        self,
        cleaned_text: str,
        sections: Dict[str, str],
        deterministic_data: CVData,
    ) -> str:
        """Construct a deterministic JSON prompt string for LLM completion."""
        missing_fields, protected_fields = self.get_missing_and_protected_fields(
            deterministic_data
        )

        deterministic_json = deterministic_data.model_dump(
            mode="json", exclude={"warnings"}
        )

        safe_text, was_bounded = self.select_relevant_sections(
            cleaned_text, sections, missing_fields, max_length=self.max_text_length
        )
        self.last_text_was_bounded = was_bounded

        prompt_payload = {
            "task": "CV Field Completion",
            "rules": [
                "Extract ONLY facts explicitly present in cleaned_cv_text.",
                "Do NOT infer, invent, or extrapolate unmentioned facts.",
                "Do NOT overwrite protected_fields.",
                "Complete ONLY fields listed in allowed_completion_fields.",
                "Return null for missing scalar fields.",
                "Return [] for missing list fields.",
                "Return pure JSON ONLY without Markdown or conversational text.",
            ],
            "allowed_completion_fields": missing_fields,
            "protected_fields": protected_fields,
            "deterministic_cv_data": deterministic_json,
            # For bounded CVs, safe_text already contains the selected section
            # markers/content. Re-serializing full sections would bypass the bound.
            "detected_sections": {} if was_bounded else sections,
            "cleaned_cv_text": safe_text,
        }

        if was_bounded:
            prompt_payload["text_omission_warning"] = (
                "CV text exceeded maximum length; sections were prioritized and non-essential content was omitted."
            )

        return json.dumps(prompt_payload, ensure_ascii=False, indent=2)
