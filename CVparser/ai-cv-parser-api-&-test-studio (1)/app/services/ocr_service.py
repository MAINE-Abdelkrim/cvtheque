"""OCR processing service using pytesseract and Pillow."""

import os
import shutil
import re
import subprocess
from statistics import median
from typing import Dict, List, Optional, Tuple

from PIL import Image

try:
    import pytesseract
except ImportError:  # pragma: no cover - tested by patching the imported module
    pytesseract = None  # type: ignore[assignment]

from app.core.config import get_settings
from app.core.exceptions import OCRProcessingError, OCRUnavailableError
from app.models.ocr_models import OCRLine, OCRPage, OCRToken


class OCRService:
    """Service for lazy Tesseract discovery and OCR execution."""

    _resolved_tesseract_cmd: Optional[str] = None
    _resolution_diagnostic = "Tesseract OCR n'a pas encore été vérifié."
    _installed_languages_cache: Optional[Tuple[str, ...]] = None
    _selected_language: Optional[str] = None
    _last_page_result: Optional[OCRPage] = None
    _page_number_context: int = 1

    @classmethod
    def reset_cache(cls) -> None:
        """Reset successful discovery caches (primarily useful for tests)."""
        cls._resolved_tesseract_cmd = None
        cls._resolution_diagnostic = "Tesseract OCR n'a pas encore été vérifié."
        cls._installed_languages_cache = None
        cls._selected_language = None
        cls._last_page_result = None
        cls._page_number_context = 1

    @classmethod
    def set_page_context(cls, page_number: int) -> None:
        cls._page_number_context = max(1, int(page_number))

    @staticmethod
    def _safe_int(value: object, default: int = 0) -> int:
        try:
            return int(float(str(value)))
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _safe_confidence(value: object) -> Optional[float]:
        try:
            confidence = float(str(value))
        except (TypeError, ValueError):
            return None
        return confidence if 0.0 <= confidence <= 100.0 else None

    @classmethod
    def _tokens_from_data(cls, data: Dict[str, List], page_number: int) -> List[OCRToken]:
        texts = data.get("text", [])
        tokens: List[OCRToken] = []
        for index, raw_text in enumerate(texts):
            text = str(raw_text or "").strip()
            if not text:
                continue
            def value(key: str, default: object = 0) -> object:
                values = data.get(key, [])
                return values[index] if index < len(values) else default
            tokens.append(OCRToken(
                text=text,
                confidence=cls._safe_confidence(value("conf", None)),
                left=cls._safe_int(value("left")), top=cls._safe_int(value("top")),
                width=max(0, cls._safe_int(value("width"))),
                height=max(0, cls._safe_int(value("height"))),
                page_number=page_number,
                block_number=cls._safe_int(value("block_num")),
                paragraph_number=cls._safe_int(value("par_num")),
                line_number=cls._safe_int(value("line_num")),
                word_number=cls._safe_int(value("word_num")),
            ))
        return tokens

    @staticmethod
    def _join_tokens(tokens: List[OCRToken]) -> str:
        """Conservative OCR spacing: preserve email/phone/date punctuation."""
        result = ""
        closing = set(",.;:!?%)]}")
        opening = set("([{")
        for token in tokens:
            value = token.text
            if not result:
                result = value
            elif value[0] in closing or result[-1] in opening or value.startswith(("'", "’")):
                result += value
            elif value in {"@", ".", "-", "/"} or result[-1] in "@.-/":
                result += value
            else:
                result += " " + value
        return result

    @classmethod
    def reconstruct_lines(cls, tokens: List[OCRToken]) -> List[OCRLine]:
        """Build visual lines, splitting Tesseract groups at column-sized gaps."""
        groups: Dict[Tuple[int, int, int, int], List[OCRToken]] = {}
        for token in tokens:
            key = (token.page_number, token.block_number, token.paragraph_number, token.line_number)
            groups.setdefault(key, []).append(token)

        lines: List[OCRLine] = []
        for grouped in groups.values():
            ordered = sorted(grouped, key=lambda t: (t.left, t.word_number))
            typical_height = median([max(1, t.height) for t in ordered])
            chunks: List[List[OCRToken]] = [[]]
            for token in ordered:
                previous = chunks[-1][-1] if chunks[-1] else None
                # A gap of several text heights is a region/column boundary, not a space.
                if previous and token.left - previous.right > max(typical_height * 3.5, 45):
                    chunks.append([])
                chunks[-1].append(token)
            for chunk in chunks:
                if not chunk:
                    continue
                confidences = [t.confidence for t in chunk if t.confidence is not None]
                lines.append(OCRLine(
                    text=cls._join_tokens(chunk),
                    left=min(t.left for t in chunk), top=min(t.top for t in chunk),
                    right=max(t.right for t in chunk), bottom=max(t.bottom for t in chunk),
                    confidence=median(confidences) if confidences else None,
                    token_count=len(chunk), tokens=chunk,
                ))
        return sorted(lines, key=lambda line: (line.top, line.left))

    @classmethod
    def consume_last_page_result(cls) -> Optional[OCRPage]:
        result = cls._last_page_result
        cls._last_page_result = None
        return result

    @staticmethod
    def _windows_fallback_paths() -> List[str]:
        if os.name != "nt":
            return []
        return [
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        ]

    @classmethod
    def _candidate_paths(cls) -> List[str]:
        candidates: List[str] = []
        explicit = os.getenv("TESSERACT_CMD", "").strip()
        if explicit:
            candidates.append(explicit)

        if pytesseract is not None:
            configured = str(pytesseract.pytesseract.tesseract_cmd or "").strip()
            if configured:
                candidates.append(configured)

        for executable_name in ("tesseract", "tesseract.exe"):
            discovered = shutil.which(executable_name)
            if discovered:
                candidates.append(discovered)

        candidates.extend(cls._windows_fallback_paths())

        # Preserve existing Settings/.env support as the final fallback.
        configured_setting = get_settings().TESSERACT_CMD.strip()
        if configured_setting:
            candidates.append(configured_setting)
        return list(dict.fromkeys(candidates))

    @staticmethod
    def _existing_absolute_path(candidate: str) -> Optional[str]:
        expanded = os.path.expandvars(os.path.expanduser(candidate.strip().strip('"')))
        if not os.path.isabs(expanded):
            expanded = shutil.which(expanded) or expanded
        absolute = os.path.abspath(expanded)
        return absolute if os.path.isfile(absolute) else None

    @staticmethod
    def _version_check(executable: str) -> Tuple[bool, str]:
        try:
            result = subprocess.run(
                [executable, "--version"],
                capture_output=True,
                text=True,
                timeout=5,
                check=False,
                shell=False,
            )
        except (OSError, subprocess.SubprocessError) as exc:
            return False, type(exc).__name__
        output = (result.stdout or result.stderr or "").strip().splitlines()
        if result.returncode != 0:
            return False, f"code de sortie {result.returncode}"
        return True, output[0] if output else "version inconnue"

    @classmethod
    def resolve_tesseract(cls) -> Optional[str]:
        """Return a verified absolute executable path; cache successes only."""
        if pytesseract is None:
            cls._resolution_diagnostic = "Package pytesseract manquant."
            return None
        if cls._resolved_tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = cls._resolved_tesseract_cmd
            return cls._resolved_tesseract_cmd

        failed_checks: List[str] = []
        for candidate in cls._candidate_paths():
            executable = cls._existing_absolute_path(candidate)
            if not executable:
                continue
            valid, version_or_error = cls._version_check(executable)
            if not valid:
                failed_checks.append(f"{executable} ({version_or_error})")
                continue
            cls._resolved_tesseract_cmd = executable
            cls._resolution_diagnostic = (
                f"Tesseract OCR détecté: {executable} ({version_or_error})"
            )
            pytesseract.pytesseract.tesseract_cmd = executable
            return executable

        if failed_checks:
            cls._resolution_diagnostic = (
                "Exécutable Tesseract trouvé, mais la vérification de version a échoué: "
                + "; ".join(failed_checks)
            )
        else:
            cls._resolution_diagnostic = "Exécutable Tesseract introuvable."
        return None

    @classmethod
    def get_availability_diagnostic(cls) -> str:
        return cls._resolution_diagnostic

    @classmethod
    def is_ocr_available(cls) -> bool:
        """Check availability lazily; a failure is deliberately not cached."""
        return cls.resolve_tesseract() is not None

    @classmethod
    def get_installed_languages(cls) -> List[str]:
        if cls._installed_languages_cache is not None:
            return list(cls._installed_languages_cache)
        if not cls.resolve_tesseract():
            return []
        try:
            languages = pytesseract.get_languages(config="")
        except Exception as exc:
            cls._resolution_diagnostic = (
                f"Tesseract détecté, mais la liste des langues est indisponible: {type(exc).__name__}."
            )
            return []
        if not isinstance(languages, list):
            return []
        cls._installed_languages_cache = tuple(languages)
        return list(cls._installed_languages_cache)

    @classmethod
    def select_ocr_language(cls, requested: Optional[str] = None) -> Optional[str]:
        available = set(cls.get_installed_languages())
        requested_languages = [v.strip() for v in (requested or "").split("+") if v.strip()]
        if requested_languages and all(value in available for value in requested_languages):
            selected = "+".join(requested_languages)
        elif {"fra", "eng"}.issubset(available):
            selected = "fra+eng"
        elif "eng" in available:
            selected = "eng"
        elif "fra" in available:
            selected = "fra"
        else:
            selected = None
        cls._selected_language = selected
        return selected

    @classmethod
    def get_selected_language(cls) -> Optional[str]:
        return cls._selected_language

    @classmethod
    def extract_text_from_image(cls, image: Image.Image, lang: Optional[str] = None) -> str:
        executable = cls.resolve_tesseract()
        if not executable:
            raise OCRUnavailableError(cls.get_availability_diagnostic())

        # Guarantee assignment immediately before each OCR call.
        pytesseract.pytesseract.tesseract_cmd = executable
        requested = lang if lang and lang.strip() else get_settings().OCR_LANGUAGES
        target_lang = cls.select_ocr_language(requested)
        try:
            kwargs = {"lang": target_lang} if target_lang else {}
            output = getattr(getattr(pytesseract, "Output", None), "DICT", "dict")
            data = pytesseract.image_to_data(image, output_type=output, **kwargs)
            page_number = cls._page_number_context
            tokens = cls._tokens_from_data(data if isinstance(data, dict) else {}, page_number=page_number)
            lines = cls.reconstruct_lines(tokens)
            text = "\n".join(line.text for line in lines).strip()
            engine = "image_to_data"
            if not text:
                text = pytesseract.image_to_string(image, **kwargs)
                text = text.strip() if text else ""
                engine = "image_to_string_fallback"
            cls._last_page_result = OCRPage(
                page_number=page_number, image_width=image.width, image_height=image.height,
                tokens=tokens, lines=lines, text=text, engine=engine,
            )
            return text
        except Exception as err:
            raise OCRProcessingError(
                f"Échec de l'invocation OCR Tesseract ({type(err).__name__}): {err}"
            ) from err
