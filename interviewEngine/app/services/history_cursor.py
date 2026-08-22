import base64
import binascii
import json
from datetime import datetime

from app.repositories.history import RepositoryHistoryCursor
from app.services.errors import InvalidCursorError

MAX_ENCODED_CURSOR_LENGTH = 1_024
MAX_DECODED_CURSOR_BYTES = 512


def encode_history_cursor(cursor: RepositoryHistoryCursor) -> str:
    payload = json.dumps(
        {
            "created_at": cursor.created_at.isoformat(),
            "session_id": cursor.session_id,
        },
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")


def decode_history_cursor(value: str | None) -> RepositoryHistoryCursor | None:
    if value is None:
        return None
    if not value or len(value) > MAX_ENCODED_CURSOR_LENGTH:
        raise _invalid_cursor()
    try:
        padding = "=" * (-len(value) % 4)
        decoded = base64.b64decode(
            value + padding, altchars=b"-_", validate=True
        )
        if len(decoded) > MAX_DECODED_CURSOR_BYTES:
            raise ValueError
        payload = json.loads(decoded)
        if not isinstance(payload, dict) or set(payload) != {"created_at", "session_id"}:
            raise ValueError
        created_at_value = payload["created_at"]
        session_id = payload["session_id"]
        if not isinstance(created_at_value, str) or not isinstance(session_id, str):
            raise ValueError
        created_at = datetime.fromisoformat(created_at_value)
        if created_at.utcoffset() is None or not 1 <= len(session_id) <= 128:
            raise ValueError
    except (binascii.Error, UnicodeDecodeError, ValueError, TypeError, json.JSONDecodeError):
        raise _invalid_cursor() from None
    cursor = RepositoryHistoryCursor(created_at=created_at, session_id=session_id)
    if encode_history_cursor(cursor) != value:
        raise _invalid_cursor()
    return cursor


def _invalid_cursor() -> InvalidCursorError:
    return InvalidCursorError("The pagination cursor is invalid.")
