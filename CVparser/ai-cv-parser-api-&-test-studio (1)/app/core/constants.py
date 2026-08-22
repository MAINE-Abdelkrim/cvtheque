"""
Core constant definitions for pipeline steps, error/warning codes, 
quality thresholds, and layout/OCR configurations.
"""

from typing import Dict, List

# Common cities for heuristic location matching
COMMON_CITIES = [
    "Casablanca", "Rabat", "Marrakech", "Fès", "Tangier", "Tanger", "Agadir", "Ouarzazate",
    "Oujda", "Kenitra", "Kénitra", "Tétouan", "Safi", "Mohammedia", "El Jadida",
    "Paris", "Lyon", "Marseille", "Toulouse", "Nice", "Nantes", "Strasbourg",
    "Montpellier", "Bordeaux", "Lille", "Rennes", "Brussels", "Bruxelles",
    "Geneva", "Genève", "London", "Montréal", "Tunis", "Alger", "Maroc", "France"
]

# Names of stages in the execution pipeline
PIPELINE_STEP_NAMES = [
    "pdf_validation",
    "text_extraction",
    "ocr_processing",
    "layout_analysis",
    "text_cleaning",
    "llm_structuring",
    "data_validation",
    "quality_assessment",
]

# Standardized system error codes
ERROR_CODES = {
    "INVALID_PDF": "INVALID_PDF",
    "UNSUPPORTED_FILE_TYPE": "UNSUPPORTED_FILE_TYPE",
    "PDF_EXTRACTION_ERROR": "PDF_EXTRACTION_ERROR",
    "OCR_UNAVAILABLE": "OCR_UNAVAILABLE",
    "OCR_PROCESSING_ERROR": "OCR_PROCESSING_ERROR",
    "LAYOUT_DETECTION_ERROR": "LAYOUT_DETECTION_ERROR",
    "LLM_UNAVAILABLE": "LLM_UNAVAILABLE",
    "LLM_GENERATION_ERROR": "LLM_GENERATION_ERROR",
    "JSON_VALIDATION_ERROR": "JSON_VALIDATION_ERROR",
    "NO_JSON_OBJECT_FOUND": "NO_JSON_OBJECT_FOUND",
    "MALFORMED_JSON": "MALFORMED_JSON",
}

# Standardized warning codes
WARNING_CODES = {
    "LOW_NATIVE_TEXT": "LOW_NATIVE_TEXT",
    "OCR_FALLBACK_TRIGGERED": "OCR_FALLBACK_TRIGGERED",
    "MULTI_COLUMN_LAYOUT": "MULTI_COLUMN_LAYOUT",
    "MISSING_SECTION": "MISSING_SECTION",
    "SCHEMA_NORMALIZATION": "SCHEMA_NORMALIZATION",
    "DATE_FORMAT_UNCERTAIN": "DATE_FORMAT_UNCERTAIN",
}

# Quality thresholds for confidence assessment
QUALITY_THRESHOLDS = {
    "HIGH": 0.85,
    "MEDIUM": 0.60,
    "LOW": 0.0,
}

# Supported layout classification types
SUPPORTED_LAYOUT_TYPES = [
    "single_column",
    "two_columns",
    "mixed",
    "unknown",
]

# OCR Configuration Defaults
DEFAULT_OCR_LANGUAGE = "fra+eng"
DEFAULT_DPI = 300
MAX_UPLOAD_SIZE_MB = 10

# Section Header Aliases for Normalization
SECTION_HEADER_ALIASES: Dict[str, List[str]] = {
    "EXPERIENCES": [
        "experience",
        "professional experience",
        "professional experiences",
        "expérience professionnelle",
        "expériences",
        "expériences professionnelles",
        "parcours professionnel",
        "historique d'emploi",
        "expérience de travail",
        "work experience",
        "employment history",
    ],
    "EDUCATION": [
        "formation académique",
        "éducation",
        "formation",
        "formations",
        "parcours académique",
        "études",
        "diplômes",
        "education",
        "academic background",
        "education and professional training",
        "education and training",
        "professional education and training",
    ],
    "SKILLS": [
        "compétences",
        "compétences techniques",
        "savoir-faire",
        "expertises",
        "skills",
        "technical skills",
    ],
    "LANGUAGES": [
        "langues",
        "langues parlées",
        "compétences linguistiques",
        "languages",
    ],
    "CERTIFICATIONS": [
        "certifications",
        "certificats",
        "accréditations",
        "certifications et licences",
    ],
    "PROJECTS": [
        "projets",
        "réalisations",
        "projets personnels",
        "projets ia data science",
        "projects",
        "personal projects",
    ],
    "SUMMARY": [
        "profil",
        "résumé",
        "résumé professionnel",
        "à propos",
        "présentation",
        "summary",
        "professional summary",
        "about me",
        "profile",
    ],
    "CONTACT": ["contact", "contact information", "coordonnÃ©es"],
    "HOBBIES": ["loisirs", "centres d'intérêt", "hobbies", "interests"],
}
