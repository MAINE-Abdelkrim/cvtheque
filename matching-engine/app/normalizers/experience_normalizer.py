from __future__ import annotations

from datetime import date

from app.schemas.cv_schema import ExperienceEntry


def _month_index(value: str) -> int:
    year, month = (int(part) for part in value[:7].split("-"))
    return year * 12 + month - 1


def calculate_experience_years(entries: list[ExperienceEntry], today: date | None = None) -> tuple[float | None, list[str]]:
    """Calculate the union of employment months, avoiding overlap double-counting."""
    current = today or date.today()
    months: set[int] = set()
    warnings: list[str] = []
    for entry in entries:
        if entry.start_date:
            start = _month_index(entry.start_date)
            end_value = f"{current.year:04d}-{current.month:02d}" if entry.is_current else entry.end_date
            if end_value:
                end = _month_index(end_value)
                if end >= start:
                    months.update(range(start, end + 1))
                    continue
        if entry.duration_months is not None:
            warnings.append("An experience duration lacked a complete date range and could not be overlap-adjusted.")
            # Undated durations are conservatively additive because no overlap evidence exists.
            marker = -(len(months) + entry.duration_months + 1)
            months.update(range(marker, marker + entry.duration_months))
    return (round(len(months) / 12, 6) if months else None), warnings

