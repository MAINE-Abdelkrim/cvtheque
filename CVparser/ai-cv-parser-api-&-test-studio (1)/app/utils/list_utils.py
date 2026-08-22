"""List utilities shared across application layers."""

from typing import List, TypeVar


T = TypeVar("T")


def unique_preserve_order(items: List[T]) -> List[T]:
    """Remove duplicates while preserving the first occurrence of each item."""
    seen = set()
    result = []
    for item in items:
        key = item if isinstance(item, (str, int, float, bool, tuple)) else str(item)
        if key not in seen:
            seen.add(key)
            result.append(item)
    return result
