"""Geometry-aware section ownership for native-text PDF pages.

This internal service preserves positioned PDF lines until headings have claimed
their same-flow bodies. It does not alter the public CV response schema.
"""

from __future__ import annotations

from dataclasses import dataclass
from statistics import median
from typing import Dict, List, Optional, Tuple
import re

import fitz

from app.services.section_service import SectionService
from app.utils.text_cleaning import normalize_header_title


@dataclass(frozen=True)
class PositionedTextLine:
    text: str
    page_number: int
    x0: float
    y0: float
    x1: float
    y1: float
    font_size: float
    bold: bool
    flow_id: str = "main"


@dataclass
class GeometrySectionResult:
    sections: Dict[str, str]
    detected_sections: List[str]
    structural_headings: List[str]
    line_count: int


class GeometrySectionService:
    """Assign positioned native text to canonical sections within page flows."""

    STRUCTURAL_BOUNDARY_TITLES = {
        "ACHIEVEMENTS",
        "ACCOMPLISHMENTS",
        "VOLUNTEERING",
        "PUBLICATIONS",
        "TRAINING",
        "PERSONAL INFORMATION",
        "PERSONAL DETAILS",
    }

    @classmethod
    def segment_page(cls, page: fitz.Page, page_number: int) -> GeometrySectionResult:
        lines = cls._extract_lines(page, page_number)
        if not lines:
            return GeometrySectionResult({}, [], [], 0)
        lines = cls._assign_flows(lines, page.rect.width)
        body_sizes = [line.font_size for line in lines if len(line.text.split()) >= 4]
        body_size = median(body_sizes) if body_sizes else median(line.font_size for line in lines)

        buffers: Dict[str, List[str]] = {}
        detected: List[str] = []
        structural: List[str] = []
        flow_order = sorted({line.flow_id for line in lines}, key=cls._flow_sort_key)
        for flow_id in flow_order:
            flow = sorted((line for line in lines if line.flow_id == flow_id), key=lambda line: (line.y0, line.x0))
            flow = cls._group_detached_date_rails(flow)
            canonical_sizes = [
                line.font_size for line in flow
                if SectionService._match_canonical_section(normalize_header_title(line.text))
            ]
            heading_size = median(canonical_sizes) if canonical_sizes else body_size * 1.15
            cls._own_flow(flow, body_size, heading_size, buffers, detected, structural)

        sections = {key: "\n".join(values).strip() for key, values in buffers.items() if any(v.strip() for v in values)}
        return GeometrySectionResult(sections, detected, structural, len(lines))

    @staticmethod
    def combine_pages(results: List[GeometrySectionResult]) -> Tuple[Dict[str, str], List[str]]:
        """Combine page-local ownership in page order without reusing coordinates."""
        combined: Dict[str, List[str]] = {}
        detected: List[str] = []
        continuation_target: Optional[str] = None
        for page_index, result in enumerate(results):
            for key, value in result.sections.items():
                if key == "HEADER" and page_index > 0:
                    # Unheaded text at the start of a later page is a controlled
                    # continuation of the prior page's last canonical section,
                    # never additional candidate identity material.
                    if value and continuation_target:
                        combined.setdefault(continuation_target, []).append(value)
                    continue
                if value:
                    combined.setdefault(key, []).append(value)
                if key != "HEADER" and key not in detected:
                    detected.append(key)
            if result.detected_sections:
                continuation_target = result.detected_sections[-1]
        return {key: "\n".join(parts).strip() for key, parts in combined.items()}, detected

    @classmethod
    def _extract_lines(cls, page: fitz.Page, page_number: int) -> List[PositionedTextLine]:
        lines: List[PositionedTextLine] = []
        for block in page.get_text("dict").get("blocks", []):
            if block.get("type") != 0:
                continue
            for raw_line in block.get("lines", []):
                spans = [span for span in raw_line.get("spans", []) if span.get("text", "").strip()]
                text = "".join(span.get("text", "") for span in spans).strip()
                if not text:
                    continue
                x0, y0, x1, y1 = raw_line["bbox"]
                size = max((float(span.get("size", 0.0)) for span in spans), default=0.0)
                bold = any("bold" in str(span.get("font", "")).casefold() for span in spans)
                lines.append(PositionedTextLine(text, page_number, x0, y0, x1, y1, size, bold))
        return lines

    @classmethod
    def _assign_flows(cls, lines: List[PositionedTextLine], page_width: float) -> List[PositionedTextLine]:
        """Find page-local flows from stable left-edge clusters."""
        if len(lines) < 6 or page_width <= 0:
            return lines
        x_values = sorted(line.x0 for line in lines if (line.x1 - line.x0) < page_width * 0.82)
        split_indexes = [
            index for index in range(len(x_values) - 1)
            if x_values[index + 1] - x_values[index] >= page_width * 0.11
        ]
        if not split_indexes:
            return lines
        splits = [(x_values[index] + x_values[index + 1]) / 2.0 for index in split_indexes]
        counts = [0] * (len(splits) + 1)
        for line in lines:
            flow_index = sum(line.x0 >= split for split in splits)
            counts[flow_index] += 1
        if sum(count >= 2 for count in counts) < 2:
            return lines

        assigned: List[PositionedTextLine] = []
        for line in lines:
            flow_index = sum(line.x0 >= split for split in splits)
            flow = f"flow_{flow_index}"
            assigned.append(PositionedTextLine(**{**line.__dict__, "flow_id": flow}))
        return assigned

    @classmethod
    def _own_flow(
        cls,
        lines: List[PositionedTextLine],
        body_size: float,
        heading_size: float,
        buffers: Dict[str, List[str]],
        detected: List[str],
        structural: List[str],
    ) -> None:
        current: Optional[str] = None
        seen_boundary = False
        index = 0
        while index < len(lines):
            line = lines[index]
            canonical = SectionService._match_canonical_section(normalize_header_title(line.text))
            consumed = 1
            if canonical and index + 1 < len(lines):
                combined = normalize_header_title(f"{line.text} {lines[index + 1].text}")
                if SectionService._match_canonical_section(combined) == canonical:
                    consumed = 2
            if canonical:
                seen_boundary = True
                current = canonical
                buffers.setdefault(canonical, [])
                if canonical not in detected:
                    detected.append(canonical)
                index += consumed
                continue
            if seen_boundary and cls._is_structural_heading(lines, index, body_size, heading_size):
                current = "__STRUCTURAL__"
                structural.append(line.text)
                index += 1
                continue
            if current != "__STRUCTURAL__":
                target = current or "HEADER"
                buffers.setdefault(target, []).append(line.text)
            index += 1

    @staticmethod
    def _group_detached_date_rails(lines: List[PositionedTextLine]) -> List[PositionedTextLine]:
        """Keep vertically stacked date-rail tokens together before record prose."""
        dateish = re.compile(
            r"^(?:(?:19|20)\d{2}|(?:0?[1-9]|1[0-2])/(?:19|20)\d{2}|"
            r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|janv|févr|mars|avr|mai|juin|juil|août|sept|déc)\w*\.?\s*(?:19|20)?\d{0,4}|"
            r"présent|present|aujourd['’]?hui|en cours|[-–—])$",
            re.IGNORECASE,
        )
        buckets: Dict[int, List[PositionedTextLine]] = {}
        for line in lines:
            if dateish.fullmatch(line.text.strip()):
                buckets.setdefault(round(line.x0 / 8), []).append(line)
        result = list(lines)
        for group in buckets.values():
            if len(group) < 2:
                continue
            group = sorted(group, key=lambda line: line.y0)
            if max(line.x1 - line.x0 for line in group) > 90:
                continue
            indexes = [result.index(line) for line in group]
            insertion = min(indexes)
            result = [line for line in result if line not in group]
            result[insertion:insertion] = group
        return result

    @staticmethod
    def _is_structural_heading(
        lines: List[PositionedTextLine], index: int, body_size: float, heading_size: float
    ) -> bool:
        line = lines[index]
        text = line.text.strip()
        if normalize_header_title(text) in GeometrySectionService.STRUCTURAL_BOUNDARY_TITLES:
            return True
        words = text.split()
        if (
            not text
            or text.startswith(("-", "•", "*"))
            or len(words) > 8
            or len(text) > 72
            or text.endswith((".", ",", ";", ":"))
        ):
            return False
        letters = [char for char in text if char.isalpha()]
        uppercase = bool(letters) and sum(char.isupper() for char in letters) / len(letters) >= 0.88
        emphasized = line.bold and line.font_size >= body_size * 1.08
        before_gap = line.y0 - lines[index - 1].y1 if index else body_size
        after_gap = lines[index + 1].y0 - line.y1 if index + 1 < len(lines) else body_size
        isolated = before_gap >= body_size * 0.45 or after_gap >= body_size * 0.45
        matches_heading_style = line.font_size >= heading_size * 0.95
        return matches_heading_style and (uppercase or (emphasized and isolated))

    @staticmethod
    def _flow_sort_key(flow_id: str) -> tuple[int, str]:
        if flow_id.startswith("flow_"):
            return (int(flow_id.removeprefix("flow_")), flow_id)
        return ({"full": 0, "left": 1, "main": 1, "right": 2}.get(flow_id, 3), flow_id)
