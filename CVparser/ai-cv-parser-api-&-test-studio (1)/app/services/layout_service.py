"""
Layout analysis service for per-page column structure detection and text reordering.
Works page by page on PDF text blocks or coordinates.
Classifies layouts into SINGLE_COLUMN, TWO_COLUMNS, MIXED, or UNKNOWN.
"""

from typing import List, Dict, Any, Tuple, Optional
import fitz  # PyMuPDF
from pydantic import BaseModel, Field
from app.models.response_models import LayoutType
from app.models.ocr_models import OCRLine, OCRPage
from app.core.constants import SECTION_HEADER_ALIASES
from app.utils.text_cleaning import normalize_header_title


class LayoutAnalysisResult(BaseModel):
    """Structure representing the result of layout analysis for a single page."""

    layout_type: LayoutType
    ordered_text: str
    left_column_text: Optional[str] = None
    right_column_text: Optional[str] = None
    warnings: List[str] = Field(default_factory=list)


class LayoutService:
    """Service for page-by-page layout analysis and reading order reconstruction."""

    @classmethod
    def analyze_page_layout(cls, page: fitz.Page) -> LayoutAnalysisResult:
        """
        Analyzes a PyMuPDF Page object, detects single vs two-column layouts,
        and reconstructs text in logical reading order.
        """
        blocks = page.get_text("blocks")  # (x0, y0, x1, y1, text, block_no, block_type)
        page_width = page.rect.width
        page_height = page.rect.height
        return cls.analyze_blocks_layout(blocks, page_width, page_height)

    @classmethod
    def analyze_ocr_page(cls, ocr_page: OCRPage) -> LayoutAnalysisResult:
        """Classify and reconstruct a page from positioned OCR lines."""
        lines = [line for line in ocr_page.lines if line.text.strip()]
        width, height = ocr_page.image_width, ocr_page.image_height
        if len(lines) < 2 or width <= 0 or height <= 0:
            ocr_page.layout_type = LayoutType.UNKNOWN.value
            ocr_page.column_count = 0
            return LayoutAnalysisResult(layout_type=LayoutType.UNKNOWN, ordered_text=ocr_page.text)

        split = cls._find_ocr_column_split(lines, width, height)
        if split is None:
            ordered = sorted(lines, key=lambda line: (line.top, line.left))
            ocr_page.layout_type = LayoutType.SINGLE_COLUMN.value
            ocr_page.column_count = 1
            ocr_page.region_count = 1
            return LayoutAnalysisResult(
                layout_type=LayoutType.SINGLE_COLUMN,
                ordered_text="\n".join(line.text for line in ordered),
            )

        gutter_left, gutter_right = split
        full = [line for line in lines if line.left <= gutter_left and line.right >= gutter_right]
        left = [line for line in lines if line not in full and line.horizontal_center < (gutter_left + gutter_right) / 2]
        right = [line for line in lines if line not in full and line not in left]
        if not left or not right:
            ordered = sorted(lines, key=lambda line: (line.top, line.left))
            return LayoutAnalysisResult(layout_type=LayoutType.SINGLE_COLUMN, ordered_text="\n".join(l.text for l in ordered))

        ordered, region_count = cls._order_ocr_regions(left, right, full, height)
        layout_type = LayoutType.MIXED if full else LayoutType.TWO_COLUMNS
        left_text = "\n".join(line.text for line in sorted(left, key=lambda line: (line.top, line.left)))
        right_text = "\n".join(line.text for line in sorted(right, key=lambda line: (line.top, line.left)))
        ocr_page.layout_type = layout_type.value
        ocr_page.column_count = 2
        ocr_page.region_count = region_count
        return LayoutAnalysisResult(
            layout_type=layout_type,
            ordered_text="\n\n".join("\n".join(line.text for line in region) for region in ordered if region),
            left_column_text=left_text or None,
            right_column_text=right_text or None,
        )

    @staticmethod
    def _find_ocr_column_split(
        lines: List[OCRLine], page_width: float, page_height: float
    ) -> Optional[Tuple[float, float]]:
        """Find a persistent normalized gutter between two populated line clusters."""
        candidates = [line for line in lines if (line.right - line.left) < page_width * 0.72]
        if len(candidates) < 4:
            return None
        centers = sorted(line.horizontal_center for line in candidates)
        gaps = [(centers[i + 1] - centers[i], i) for i in range(len(centers) - 1)]
        gap, index = max(gaps, default=(0.0, 0))
        if gap < page_width * 0.12:
            return None
        center_split = (centers[index] + centers[index + 1]) / 2.0
        left = [line for line in candidates if line.horizontal_center < center_split]
        right = [line for line in candidates if line.horizontal_center >= center_split]
        if len(left) < 2 or len(right) < 2:
            return None
        # Both clusters must occupy at least one common vertical band.  Loose bands
        # tolerate different baselines and a column ending earlier.
        band_size = max(page_height * 0.08, 1.0)
        left_bands = {int(line.vertical_center / band_size) for line in left}
        right_bands = {int(line.vertical_center / band_size) for line in right}
        if not left_bands.intersection(right_bands):
            return None
        left_edge = max(line.right for line in left if line.right <= center_split) if left else center_split
        right_edge = min(line.left for line in right if line.left >= center_split) if right else center_split
        # The inferred gutter may be crossed by wide headings; retain a narrow
        # normalized core for identifying those full-width anchors.
        return (min(left_edge, center_split - page_width * 0.015),
                max(right_edge, center_split + page_width * 0.015))

    @classmethod
    def _order_ocr_regions(
        cls, left: List[OCRLine], right: List[OCRLine], full: List[OCRLine], page_height: float
    ) -> Tuple[List[List[OCRLine]], int]:
        """Top-to-bottom regions; column order only inside parallel regions."""
        remaining_left = sorted(left, key=lambda line: (line.top, line.left))
        remaining_right = sorted(right, key=lambda line: (line.top, line.left))
        anchors = sorted(full, key=lambda line: (line.top, line.left))
        regions: List[List[OCRLine]] = []

        boundaries = anchors + [None]
        lower = 0.0
        for anchor in boundaries:
            upper = anchor.top if anchor else page_height + 1
            l_region = [line for line in remaining_left if lower <= line.top < upper]
            r_region = [line for line in remaining_right if lower <= line.top < upper]
            remaining_left = [line for line in remaining_left if line not in l_region]
            remaining_right = [line for line in remaining_right if line not in r_region]

            if l_region and r_region:
                first_parallel_y = max(min(line.top for line in l_region), min(line.top for line in r_region))
                prefix = sorted(
                    [line for line in l_region + r_region if line.bottom < first_parallel_y],
                    key=lambda line: (line.top, line.left),
                )
                # If a column starts a semantic section before the other column
                # begins, the section heading is a boundary: keep that whole
                # section in its column instead of stranding its first lines in
                # the top prefix (common with a tall identity block/sidebar).
                known_headings = {
                    normalize_header_title(alias)
                    for aliases in SECTION_HEADER_ALIASES.values()
                    for alias in aliases
                }
                for position, candidate in enumerate(prefix):
                    if normalize_header_title(candidate.text) in known_headings:
                        prefix = prefix[:position]
                        break
                if prefix:
                    regions.append(prefix)
                l_region = [line for line in l_region if line not in prefix]
                r_region = [line for line in r_region if line not in prefix]
                # This region is genuinely parallel: keep each coherent column
                # contiguous instead of alternating raw y coordinates.
                if l_region:
                    regions.append(sorted(l_region, key=lambda line: (line.top, line.left)))
                if r_region:
                    regions.append(sorted(r_region, key=lambda line: (line.top, line.left)))
            else:
                one = sorted(l_region + r_region, key=lambda line: (line.top, line.left))
                if one:
                    regions.append(one)
            if anchor:
                regions.append([anchor])
                lower = anchor.bottom
        return regions, len(regions)

    @classmethod
    def analyze_blocks_layout(
        cls, blocks: List[Tuple], page_width: float, page_height: float
    ) -> LayoutAnalysisResult:
        """
        Analyzes text blocks, page width, and page height to determine layout type and column text.
        Blocks format: (x0, y0, x1, y1, text, block_no, block_type)
        """
        # Filter for text blocks with non-empty content
        text_blocks = [
            b for b in blocks if len(b) >= 7 and b[6] == 0 and b[4].strip()
        ]

        if not text_blocks or page_width <= 0 or page_height <= 0:
            return LayoutAnalysisResult(
                layout_type=LayoutType.UNKNOWN,
                ordered_text="",
                left_column_text=None,
                right_column_text=None,
            )

        parallel_start = cls._find_parallel_region_start(text_blocks, page_width)
        if parallel_start is not None:
            later_wide_anchor = any(
                block[1] > parallel_start and (block[2] - block[0]) >= page_width * 0.65
                for block in text_blocks
            )
            prefix = [block for block in text_blocks if block[3] <= parallel_start + 0.5]
            parallel = [block for block in text_blocks if block not in prefix]
            groups = cls._cluster_horizontal_groups(parallel, page_width)
            if not later_wide_anchor and len(groups) >= 2 and all(sum(len(block[4].strip()) for block in group) >= 5 for group in groups):
                groups = sorted(groups, key=lambda group: (min(block[1] for block in group), min(block[0] for block in group)))
                ordered = sorted(prefix, key=lambda block: (block[1], block[0]))
                for group in groups:
                    ordered.extend(sorted(group, key=lambda block: (block[1], block[0])))
                group_texts = ["\n".join(block[4].strip() for block in sorted(group, key=lambda block: (block[1], block[0]))) for group in groups]
                return LayoutAnalysisResult(
                    layout_type=LayoutType.MIXED if prefix or len(groups) > 2 else LayoutType.TWO_COLUMNS,
                    ordered_text="\n".join(block[4].strip() for block in ordered),
                    left_column_text=group_texts[0] or None,
                    right_column_text="\n\n".join(group_texts[1:]) or None,
                )

        mid_point = page_width / 2.0
        left_blocks = []
        right_blocks = []
        full_width_blocks = []

        for b in text_blocks:
            x0, y0, x1, y1, text = b[0], b[1], b[2], b[3], b[4].strip()
            # Full width block covers both sides of center significantly
            is_full = (x0 < page_width * 0.35) and (x1 > page_width * 0.65)
            if is_full:
                full_width_blocks.append(b)
            elif x1 <= page_width * 0.55:
                left_blocks.append(b)
            elif x0 >= page_width * 0.45:
                right_blocks.append(b)
            else:
                # Ambiguous center blocks: assign based on center of block
                block_center = (x0 + x1) / 2.0
                if block_center < mid_point:
                    left_blocks.append(b)
                else:
                    right_blocks.append(b)

        left_text_len = sum(len(b[4].strip()) for b in left_blocks)
        right_text_len = sum(len(b[4].strip()) for b in right_blocks)

        # Check vertical overlap between left and right blocks to confirm side-by-side columns
        has_vertical_overlap = False
        if left_blocks and right_blocks:
            for lb in left_blocks:
                ly0, ly1 = lb[1], lb[3]
                for rb in right_blocks:
                    ry0, ry1 = rb[1], rb[3]
                    # Overlap if max(start) < min(end)
                    if max(ly0, ry0) < min(ly1, ry1):
                        has_vertical_overlap = True
                        break
                if has_vertical_overlap:
                    break

        is_two_columns = (
            left_text_len >= 15
            and right_text_len >= 15
            and has_vertical_overlap
        )

        if is_two_columns:
            left_sorted = sorted(left_blocks, key=lambda b: (b[1], b[0]))
            right_sorted = sorted(right_blocks, key=lambda b: (b[1], b[0]))
            left_text = "\n".join(b[4].strip() for b in left_sorted)
            right_text = "\n".join(b[4].strip() for b in right_sorted)

            layout_type = LayoutType.MIXED if full_width_blocks else LayoutType.TWO_COLUMNS

            if layout_type == LayoutType.MIXED:
                ordered_blocks = cls._order_mixed_layout_blocks(
                    left_blocks, right_blocks, full_width_blocks, mid_point
                )
                ordered_text = "\n".join(b[4].strip() for b in ordered_blocks)
            else:
                ordered_text = "\n\n".join(s for s in [left_text, right_text] if s)

            return LayoutAnalysisResult(
                layout_type=layout_type,
                ordered_text=ordered_text,
                left_column_text=left_text if left_text else None,
                right_column_text=right_text if right_text else None,
            )

        # Otherwise SINGLE_COLUMN: Sort blocks top-to-bottom, left-to-right
        sorted_blocks = sorted(text_blocks, key=lambda b: (b[1], b[0]))
        ordered_text = "\n".join(b[4].strip() for b in sorted_blocks)

        return LayoutAnalysisResult(
            layout_type=LayoutType.SINGLE_COLUMN,
            ordered_text=ordered_text,
            left_column_text=None,
            right_column_text=None,
        )

    @staticmethod
    def _find_parallel_region_start(blocks: List[Tuple], page_width: float) -> Optional[float]:
        """Find the first vertically overlapping pair separated by a real gutter."""
        candidates: List[float] = []
        minimum_gap = page_width * 0.08
        for index, first in enumerate(blocks):
            for second in blocks[index + 1:]:
                vertical_overlap = max(first[1], second[1]) < min(first[3], second[3])
                horizontal_gap = max(second[0] - first[2], first[0] - second[2])
                if vertical_overlap and horizontal_gap >= minimum_gap:
                    candidates.append(min(first[1], second[1]))
        return min(candidates) if candidates else None

    @staticmethod
    def _cluster_horizontal_groups(blocks: List[Tuple], page_width: float) -> List[List[Tuple]]:
        """Cluster by stable left edge without assuming equal column widths."""
        tolerance = page_width * 0.10
        groups: List[List[Tuple]] = []
        for block in sorted(blocks, key=lambda item: (item[0], item[1])):
            matches = [
                (abs(block[0] - sum(item[0] for item in group) / len(group)), group)
                for group in groups
                if abs(block[0] - sum(item[0] for item in group) / len(group)) <= tolerance
            ]
            if matches:
                min(matches, key=lambda match: match[0])[1].append(block)
            else:
                groups.append([block])
        return groups

    @classmethod
    def _order_mixed_layout_blocks(
        cls,
        left_blocks: List[Tuple],
        right_blocks: List[Tuple],
        full_width_blocks: List[Tuple],
        mid_point: float,
    ) -> List[Tuple]:
        """Order mixed layouts by full-width-delimited vertical regions."""
        anchors = sorted(full_width_blocks, key=lambda block: (block[1], block[0]))
        remaining = sorted(left_blocks + right_blocks, key=lambda block: (block[1], block[0]))
        ordered: List[Tuple] = []

        for anchor in anchors:
            region = [block for block in remaining if block[1] < anchor[1]]
            remaining = [block for block in remaining if block[1] >= anchor[1]]
            ordered.extend(cls._order_parallel_region(region, mid_point))
            ordered.append(anchor)

        ordered.extend(cls._order_parallel_region(remaining, mid_point))
        return ordered

    @staticmethod
    def _order_parallel_region(blocks: List[Tuple], mid_point: float) -> List[Tuple]:
        """Use column order only when a vertical region contains parallel columns."""
        if not blocks:
            return []
        left = [block for block in blocks if (block[0] + block[2]) / 2.0 < mid_point]
        right = [block for block in blocks if block not in left]
        parallel = any(
            max(left_block[1], right_block[1]) < min(left_block[3], right_block[3])
            for left_block in left
            for right_block in right
        )
        if parallel:
            return sorted(left, key=lambda block: (block[1], block[0])) + sorted(
                right, key=lambda block: (block[1], block[0])
            )
        return sorted(blocks, key=lambda block: (block[1], block[0]))
