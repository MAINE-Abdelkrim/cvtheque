import re
import unicodedata


def normalize_text(value: str) -> str:
    """Normalize human-entered labels without semantic inference."""
    text = unicodedata.normalize("NFKD", value.strip().lower())
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = text.replace("’", " ").replace("'", " ")
    text = text.replace("&", " and ")
    text = re.sub(r"[_/\\|,;:]+", " ", text)
    text = re.sub(r"[^a-z0-9+#. -]", "", text)
    return re.sub(r"\s+", " ", text).strip(" .-")
