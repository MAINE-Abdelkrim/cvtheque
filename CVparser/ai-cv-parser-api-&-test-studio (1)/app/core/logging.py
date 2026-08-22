"""
Logging setup module.
Configures consistent application logging format.
"""

import logging
import sys
from app.core.config import get_settings


def setup_logging() -> logging.Logger:
    """Configures root application logger based on LOG_LEVEL environment variable."""
    settings = get_settings()
    log_level_str = settings.LOG_LEVEL.upper()
    log_level = getattr(logging, log_level_str, logging.INFO)

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s:%(funcName)s:%(lineno)d - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    logger = logging.getLogger("ai_cv_parser")
    logger.setLevel(log_level)
    logger.handlers = []
    logger.addHandler(handler)
    logger.propagate = False

    return logger


logger = setup_logging()


def get_logger(module_name: str) -> logging.Logger:
    """Get a child logger for a specific module."""
    return logger.getChild(module_name)
