"""
Application settings and configuration module.
Loads settings from environment variables and .env file.
"""

from enum import Enum
from functools import lru_cache

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
    from pydantic import Field

    class Settings(BaseSettings):
        model_config = SettingsConfigDict(
            env_file=".env",
            env_file_encoding="utf-8",
            extra="ignore"
        )
        # Application Config
        APP_NAME: str = "AI CV Parser API"
        APP_HOST: str = "127.0.0.1"
        APP_PORT: int = 8000
        NEXTJS_ORIGIN: str = "http://localhost:3000"
        LOG_LEVEL: str = "INFO"
        MAX_FILE_SIZE_MB: int = 10
        MAX_PDF_PAGES: int = Field(default=20, gt=0)

        # LLM Model Config
        MODEL_ENABLED: bool = False
        MODEL_PROVIDER: str = "pytorch"
        MODEL_NAME: str = "Qwen/Qwen2.5-0.5B-Instruct"
        MODEL_GGUF_PATH: str = ""
        MODEL_N_THREADS: int = Field(default=4, gt=0)
        MODEL_CONTEXT_SIZE: int = Field(default=1024, gt=0)
        MODEL_DEVICE: str = "auto"
        MODEL_LOCAL_FILES_ONLY: bool = True
        MODEL_TORCH_DTYPE: str = "auto"
        MODEL_MAX_NEW_TOKENS: int = 512
        MODEL_DO_SAMPLE: bool = False
        MODEL_TEMPERATURE: float = 0.0
        MODEL_TOP_P: float = 0.9
        MODEL_REPETITION_PENALTY: float = 1.1
        MODEL_TRUST_REMOTE_CODE: bool = False
        MODEL_TIMEOUT_SECONDS: float = Field(default=30.0, gt=0)

        # OCR & Extraction Thresholds
        MIN_NATIVE_TEXT_CHARS_PER_PAGE: int = 50
        MIN_NATIVE_TEXT_RATIO: float = 0.6
        OCR_LANGUAGES: str = "fra+eng"
        TESSERACT_CMD: str = ""
        OCR_LAYOUT_MODE: str = "auto"
        OCR_MIN_CONFIDENCE: float = 25.0

        # Skills Taxonomy Path
        SKILLS_CATALOG_PATH: str = ""

except ImportError:
    # Fallback for older Pydantic v1 or environments without pydantic-settings
    from pydantic import BaseSettings, Field

    class Settings(BaseSettings):
        APP_NAME: str = Field("AI CV Parser API", env="APP_NAME")
        APP_HOST: str = Field("127.0.0.1", env="APP_HOST")
        APP_PORT: int = Field(8000, env="APP_PORT")
        NEXTJS_ORIGIN: str = Field("http://localhost:3000", env="NEXTJS_ORIGIN")
        LOG_LEVEL: str = Field("INFO", env="LOG_LEVEL")
        MAX_FILE_SIZE_MB: int = Field(10, env="MAX_FILE_SIZE_MB")
        MAX_PDF_PAGES: int = Field(20, env="MAX_PDF_PAGES", gt=0)

        MODEL_ENABLED: bool = Field(False, env="MODEL_ENABLED")
        MODEL_PROVIDER: str = Field("pytorch", env="MODEL_PROVIDER")
        MODEL_NAME: str = Field("Qwen/Qwen2.5-0.5B-Instruct", env="MODEL_NAME")
        MODEL_GGUF_PATH: str = Field("", env="MODEL_GGUF_PATH")
        MODEL_N_THREADS: int = Field(4, env="MODEL_N_THREADS", gt=0)
        MODEL_CONTEXT_SIZE: int = Field(1024, env="MODEL_CONTEXT_SIZE", gt=0)
        MODEL_DEVICE: str = Field("auto", env="MODEL_DEVICE")
        MODEL_LOCAL_FILES_ONLY: bool = Field(True, env="MODEL_LOCAL_FILES_ONLY")
        MODEL_TORCH_DTYPE: str = Field("auto", env="MODEL_TORCH_DTYPE")
        MODEL_MAX_NEW_TOKENS: Field = Field(512, env="MODEL_MAX_NEW_TOKENS")
        MODEL_DO_SAMPLE: bool = Field(False, env="MODEL_DO_SAMPLE")
        MODEL_TEMPERATURE: float = Field(0.0, env="MODEL_TEMPERATURE")
        MODEL_TOP_P: float = Field(0.9, env="MODEL_TOP_P")
        MODEL_REPETITION_PENALTY: float = Field(1.1, env="MODEL_REPETITION_PENALTY")
        MODEL_TRUST_REMOTE_CODE: bool = Field(False, env="MODEL_TRUST_REMOTE_CODE")
        MODEL_TIMEOUT_SECONDS: float = Field(30.0, env="MODEL_TIMEOUT_SECONDS", gt=0)

        MIN_NATIVE_TEXT_CHARS_PER_PAGE: int = Field(50, env="MIN_NATIVE_TEXT_CHARS_PER_PAGE")
        MIN_NATIVE_TEXT_RATIO: float = Field(0.6, env="MIN_NATIVE_TEXT_RATIO")
        OCR_LANGUAGES: str = Field("fra+eng", env="OCR_LANGUAGES")
        TESSERACT_CMD: str = Field("", env="TESSERACT_CMD")
        OCR_LAYOUT_MODE: str = Field("auto", env="OCR_LAYOUT_MODE")
        OCR_MIN_CONFIDENCE: float = Field(25.0, env="OCR_MIN_CONFIDENCE")

        SKILLS_CATALOG_PATH: str = Field("", env="SKILLS_CATALOG_PATH")

        class Config:
            env_file = ".env"
            env_file_encoding = "utf-8"
            extra = "ignore"


class OCRLayoutMode(str, Enum):
    AUTO = "auto"
    SINGLE_COLUMN = "single_column"
    TWO_COLUMNS = "two_columns"


@lru_cache()
def get_settings() -> Settings:
    """Get cached application settings."""
    return Settings()
