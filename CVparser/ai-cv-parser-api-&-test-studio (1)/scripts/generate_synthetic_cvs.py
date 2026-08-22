"""Generate deterministic, text-native synthetic CV regression fixtures.

All people, organizations, institutions, contact details, and achievements in
this module are fictional test data. The PDFs are regression fixtures, not
training data.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable

import fitz


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "tests" / "fixtures" / "synthetic_cvs"
PAGE = fitz.paper_rect("a4")
INK = (0.12, 0.16, 0.22)
MUTED = (0.30, 0.36, 0.44)
ACCENT = (0.10, 0.35, 0.62)
PALE = (0.92, 0.95, 0.98)


def identity(full_name: str, job_title: str, email: str, phone: str, location: str) -> dict[str, Any]:
    return {
        "full_name": full_name,
        "email": email,
        "phone": phone,
        "linkedin": None,
        "github": None,
        "website": None,
        "location": location,
        "job_title": job_title,
        "other_links": [],
    }


CASES: list[dict[str, Any]] = [
    {
        "filename": "cv_01_single_column.pdf",
        "layout": "single_column",
        "headings": ["PROFIL", "COMPÉTENCES", "EXPÉRIENCES PROFESSIONNELLES", "FORMATION", "LANGUES", "CERTIFICATIONS"],
        "identity": identity("Sara El Mansouri", "Data Analyst", "sara.elmansouri@example.com", "+212 600 000 101", "Rabat, Maroc"),
        "summary": "Data analyst spécialisée dans la transformation de données métier en tableaux de bord clairs.",
        "skills": [{"name": name} for name in ["Python", "SQL", "Power BI", "Pandas", "Excel"]],
        "experiences": [{"job_title": "Data Analyst", "company": "Atlas Metrics", "location": "Rabat", "start_date": "2022", "end_date": "2024", "description": "Création de tableaux de bord et automatisation des contrôles de qualité."}],
        "education": [{"degree": "Master", "field_of_study": "Data Science", "institution": "Université Horizon", "location": "Rabat", "start_date": "2020", "end_date": "2022", "description": None}],
        "languages": [{"language": "French", "level": "Fluent", "original_level": "Courant"}, {"language": "English", "level": "Intermediate", "original_level": "Intermédiaire"}],
        "certifications": [{"name": "Microsoft Power BI Data Analyst", "issuer": "Microsoft", "date": "2024", "credential_id": None}],
    },
    {
        "filename": "cv_02_two_columns.pdf",
        "layout": "two_columns",
        "headings": ["COMPÉTENCES", "LANGUES", "FORMATION", "PROFIL", "EXPÉRIENCES PROFESSIONNELLES", "CERTIFICATIONS"],
        "identity": identity("Yassine Amrani", "Backend Developer", "yassine.amrani@example.com", "+212 600 000 202", "Casablanca, Maroc"),
        "summary": "Développeur backend orienté API, qualité logicielle et services conteneurisés.",
        "skills": [{"name": name} for name in ["Python", "FastAPI", "PostgreSQL", "Docker", "Git"]],
        "experiences": [{"job_title": "Backend Developer", "company": "Northwind Labs", "location": "Casablanca", "start_date": "2023", "end_date": "Présent", "description": "Développement d'API FastAPI et optimisation de requêtes PostgreSQL."}],
        "education": [{"degree": "Diplôme d'ingénieur", "field_of_study": "Génie logiciel", "institution": "École Nova Tech", "location": "Casablanca", "start_date": "2019", "end_date": "2022", "description": None}],
        "languages": [{"language": "Arabic", "level": "Native", "original_level": "Langue maternelle"}, {"language": "French", "level": "Fluent", "original_level": "Courant"}],
        "certifications": [{"name": "Docker Certified Associate", "issuer": "Docker", "date": "2024", "credential_id": None}],
    },
    {
        "filename": "cv_03_sidebar.pdf",
        "layout": "sidebar",
        "headings": ["CONTACT", "COMPÉTENCES", "LANGUES", "PROFIL", "EXPÉRIENCES PROFESSIONNELLES", "FORMATION", "CERTIFICATIONS"],
        "identity": identity("Imane Benali", "UX Designer", "imane.benali@example.com", "+212 600 000 303", "Marrakech, Maroc"),
        "summary": "UX designer centrée sur la recherche utilisateur, les parcours accessibles et les systèmes cohérents.",
        "skills": [{"name": name} for name in ["Figma", "Adobe XD", "UX Research", "Prototyping", "Design Systems"]],
        "experiences": [{"job_title": "UX Designer", "company": "Studio Pixelia", "location": "Marrakech", "start_date": "2021", "end_date": "2024", "description": "Conduite d'entretiens utilisateurs et création de prototypes testables."}],
        "education": [{"degree": "Master", "field_of_study": "Design numérique", "institution": "Institut Créatif Atlas", "location": "Marrakech", "start_date": "2019", "end_date": "2021", "description": None}],
        "languages": [{"language": "French", "level": "Fluent", "original_level": "Courant"}, {"language": "English", "level": "Professional", "original_level": "Professionnel"}, {"language": "Spanish", "level": "Basic", "original_level": "Notions"}],
        "certifications": [{"name": "UX Design Professional Certificate", "issuer": "Coursera", "date": "2023", "credential_id": None}],
    },
    {
        "filename": "cv_04_dense_experience.pdf",
        "layout": "dense_experience",
        "headings": ["PROFIL", "EXPÉRIENCES PROFESSIONNELLES", "COMPÉTENCES", "FORMATION", "LANGUES"],
        "identity": identity("Omar Alaoui", "Software Engineer", "omar.alaoui@example.com", "+212 600 000 404", "Tanger, Maroc"),
        "summary": "Ingénieur logiciel expérimenté dans la livraison de plateformes web maintenables.",
        "skills": [{"name": name} for name in ["Java", "Spring Boot", "React", "MySQL", "Docker", "Git"]],
        "experiences": [
            {"job_title": "Software Engineer", "company": "Blue Cedar Systems", "location": "Tanger", "start_date": "2023", "end_date": "Présent", "description": "Conception de services Spring Boot et revues de code pour une plateforme métier."},
            {"job_title": "Java Developer", "company": "Orion Stack", "location": "Rabat", "start_date": "2021", "end_date": "2023", "description": "Développement de modules Java et migration progressive des interfaces React."},
            {"job_title": "Software Engineer Intern", "company": "Delta Forge", "location": "Casablanca", "start_date": "2020", "end_date": "2021", "description": "Automatisation de tests et documentation des flux de déploiement."},
        ],
        "education": [{"degree": "Engineering Degree", "field_of_study": "Software Engineering", "institution": "Nova Engineering School", "location": "Tanger", "start_date": "2016", "end_date": "2020", "description": None}],
        "languages": [{"language": "Arabic", "level": "Native", "original_level": "Maternelle"}, {"language": "French", "level": "Fluent", "original_level": "Courant"}, {"language": "English", "level": "Professional", "original_level": "B2"}],
        "certifications": [],
    },
    {
        "filename": "cv_05_english.pdf",
        "layout": "english",
        "headings": ["PROFILE", "SKILLS", "EXPERIENCE", "EDUCATION", "LANGUAGES", "CERTIFICATIONS"],
        "identity": identity("Nadia Karim", "Machine Learning Engineer", "nadia.karim@example.com", "+212 600 000 505", "London, United Kingdom"),
        "summary": "Machine learning engineer building reproducible data pipelines and monitored predictive services.",
        "skills": [{"name": name} for name in ["Python", "Machine Learning", "Scikit-learn", "TensorFlow", "Pandas"]],
        "experiences": [{"job_title": "Machine Learning Engineer", "company": "Synthetic Vision Labs", "location": "London", "start_date": "Jan 2024", "end_date": "Present", "description": "Built evaluation pipelines and deployed monitored prediction services."}],
        "education": [{"degree": "Master", "field_of_study": "Artificial Intelligence", "institution": "Westbridge University", "location": "London", "start_date": "2021", "end_date": "2023", "description": None}],
        "languages": [{"language": "English", "level": "Fluent", "original_level": "Fluent"}, {"language": "French", "level": "Intermediate", "original_level": "Intermediate"}, {"language": "Arabic", "level": "Native", "original_level": "Native"}],
        "certifications": [{"name": "Machine Learning Specialization", "issuer": "Coursera", "date": "2024", "credential_id": None}],
    },
    {
        "filename": "cv_06_mixed_layout.pdf",
        "layout": "mixed",
        "headings": ["PROFIL", "COMPÉTENCES", "EXPÉRIENCES PROFESSIONNELLES", "FORMATION", "LANGUES", "CERTIFICATIONS"],
        "identity": identity("Mehdi Rami", "Cloud Engineer", "mehdi.rami@example.com", "+212 600 000 606", "Agadir, Maroc"),
        "summary": "Cloud engineer spécialisé dans l'infrastructure reproductible, l'observabilité et la fiabilité.",
        "skills": [{"name": name} for name in ["AWS", "Docker", "Kubernetes", "Terraform", "Linux", "Python"]],
        "experiences": [{"job_title": "Cloud Engineer", "company": "Nimbus Harbor", "location": "Agadir", "start_date": "2025-02", "end_date": "2025-07", "description": "Industrialisation d'environnements AWS avec Terraform et Kubernetes."}],
        "education": [{"degree": "Master", "field_of_study": "Cloud Computing", "institution": "Université des Systèmes Ouverts", "location": "Agadir", "start_date": "2022", "end_date": "2024", "description": None}],
        "languages": [{"language": "Arabic", "level": "Native", "original_level": "Maternelle"}, {"language": "French", "level": "Professional", "original_level": "Professionnel"}, {"language": "English", "level": "Fluent", "original_level": "Courant"}, {"language": "German", "level": "Basic", "original_level": "Notions"}],
        "certifications": [{"name": "AWS Certified Solutions Architect", "issuer": "AWS", "date": "2024", "credential_id": None}, {"name": "Terraform Associate", "issuer": "HashiCorp", "date": "2024", "credential_id": None}],
    },
    {
        "filename": "cv_07_independent_columns.pdf",
        "layout": "independent_columns",
        "headings": ["CONTACT", "FORMATION", "COMPÉTENCES", "LANGUES", "PROFIL", "EXPÉRIENCES", "PROFESSIONNELLES", "CERTIFICATS"],
        "identity": identity("Nadia El Mansouri", "Operations Specialist", "nadia.elmansouri@example.com", "+212 600 000 707", None),
        "summary": "Spécialiste des opérations organisée, attentive à la qualité de service et à l'amélioration continue.",
        "skills": [{"name": name} for name in ["Gestion de projet", "Analyse des processus", "Gestion des priorités", "Travail en équipe", "Adaptabilité"]],
        "experiences": [
            {"job_title": "Operations Specialist", "company": "Lumen Services", "location": "Rabat", "start_date": "2024", "end_date": "Présent", "description": "Coordination des activités et suivi des indicateurs opérationnels."},
            {"job_title": "Project Coordinator", "company": "Cedar Works", "location": "Casablanca", "start_date": "2022", "end_date": "2024", "description": "Planification des livrables et préparation des comptes rendus."},
            {"job_title": "Administrative Assistant", "company": "Atlas Office", "location": "Agadir", "start_date": "2021", "end_date": "2022", "description": "Gestion documentaire et accueil des partenaires."},
            {"job_title": "Operations Intern", "company": "Nova Transit", "location": "Marrakech", "start_date": "2020", "end_date": "2021", "description": "Observation des flux et mise à jour des tableaux de suivi."},
        ],
        "education": [
            {"degree": "Licence", "field_of_study": "Économie et gestion", "institution": "Institut Horizon", "location": "Rabat", "start_date": "2018", "end_date": "2021", "description": None},
            {"degree": "Baccalauréat", "field_of_study": "Sciences économiques", "institution": "Lycée Nouvelle Rive", "location": "Rabat", "start_date": None, "end_date": "2018", "description": None},
        ],
        "languages": [{"language": "Arabic", "level": "Native", "original_level": "Maternelle"}, {"language": "French", "level": "Fluent", "original_level": "Courant"}, {"language": "English", "level": "Intermediate", "original_level": "Intermédiaire"}],
        "certifications": [{"name": "Operations Management Certificate", "issuer": "Open Learning Academy", "date": "2024", "credential_id": None}],
    },
    {
        "filename": "cv_08_detached_date_rail.pdf", "layout": "detached_date_rail",
        "headings": ["CONTACT", "COMPÉTENCES", "LANGUES", "PROFIL", "EXPÉRIENCES PROFESSIONNELLES", "FORMATION"],
        "identity": identity("Salma Nouri", "Process Engineer", "salma.nouri@example.com", "+212 600 000 808", "Tanger, Maroc"),
        "summary": "Ingénieure procédés attentive à la qualité, aux flux opérationnels et à l'amélioration continue.",
        "skills": [{"name": n} for n in ["Process Mapping", "Lean Manufacturing", "Excel"]],
        "experiences": [{"job_title": "Process Engineer", "company": "Fictional Flow Works", "location": "Tanger", "start_date": "2023", "end_date": "Présent", "description": "Analyse des flux et animation des actions d'amélioration."}],
        "education": [{"degree": "Master", "field_of_study": "Génie industriel", "institution": "Institut Technique Horizon", "location": "Tanger", "start_date": "2021", "end_date": "2023", "description": None}],
        "languages": [{"language": "French", "level": "Fluent", "original_level": "Courant"}, {"language": "Arabic", "level": "Native", "original_level": "Maternelle"}],
        "certifications": [],
    },
    {
        "filename": "cv_09_unknown_heading_boundary.pdf", "layout": "unknown_heading_boundary",
        "headings": ["SKILLS", "ACHIEVEMENTS", "EDUCATION", "LANGUAGES"],
        "identity": identity("Elias Morel", "Platform Engineer", "elias.morel@example.com", "+33 600 000 909", "Paris, France"),
        "summary": None,
        "skills": [{"name": n} for n in ["Python", "Docker"]],
        "experiences": [],
        "education": [{"degree": "Master", "field_of_study": "Computer Science", "institution": "Northbridge Institute", "location": "Paris", "start_date": "2020", "end_date": "2022", "description": None}],
        "languages": [{"language": "French", "level": "Native", "original_level": "Native"}],
        "certifications": [],
    },
    {
        "filename": "cv_10_education_training_alias.pdf", "layout": "education_training_alias",
        "headings": ["PROFILE", "EDUCATION AND PROFESSIONAL TRAINING", "SKILLS", "LANGUAGES"],
        "identity": identity("Clara Bennett", "Quality Analyst", "clara.bennett@example.com", "+212 600 000 010", "London, United Kingdom"),
        "summary": "Quality analyst focused on reliable processes and measurable service improvements.",
        "skills": [{"name": n} for n in ["Excel", "Process Mapping"]],
        "experiences": [],
        "education": [{"degree": "Bachelor", "field_of_study": "Business Analytics", "institution": "Westford College", "location": "London", "start_date": "2018", "end_date": "2021", "description": None}],
        "languages": [{"language": "English", "level": "Native", "original_level": "Native"}],
        "certifications": [],
    },
    {
        "filename": "cv_11_title_without_name.pdf", "layout": "title_without_name",
        "headings": ["PROFILE", "SKILLS", "EXPERIENCE", "EDUCATION", "LANGUAGES"],
        "identity": identity(None, "Finance Assistant", None, None, None),
        "summary": "Reliable finance professional supporting reconciliations, reporting and month-end controls.",
        "skills": [{"name": n} for n in ["Excel", "Accounting"]],
        "experiences": [{"job_title": "Finance Assistant", "company": "Fictional Ledger Group", "location": None, "start_date": "2022", "end_date": "2024", "description": "Prepared reconciliations and supported monthly reporting."}],
        "education": [{"degree": "Bachelor", "field_of_study": "Accounting", "institution": "Central Business College", "location": None, "start_date": "2019", "end_date": "2021", "description": None}],
        "languages": [{"language": "English", "level": None, "original_level": None}, {"language": "Spanish", "level": None, "original_level": None}],
        "certifications": [],
    },
    {
        "filename": "cv_12_freeform_experience.pdf", "layout": "freeform_experience",
        "headings": ["PROFESSIONAL SUMMARY", "WORK EXPERIENCE", "EDUCATION", "SKILLS", "LANGUAGES"],
        "identity": identity("Jonas Reed", "Service Coordinator", "jonas.reed@example.com", "+212 600 000 012", "London, United Kingdom"),
        "summary": "Service coordinator experienced in operational support and customer delivery.",
        "skills": [{"name": n} for n in ["Excel", "Customer Service"]],
        "experiences": [
            {"job_title": "Service Coordinator", "company": "Fictional North Services", "location": "London", "start_date": "January 2022", "end_date": "Present", "description": "Coordinated service requests, tracked delivery issues and prepared weekly operational reports."},
            {"job_title": "Operations Assistant", "company": "Fictional Cedar Office", "location": "London", "start_date": "March 2019", "end_date": "December 2021", "description": "Maintained records, supported suppliers and organized customer documentation."},
        ],
        "education": [{"degree": "Bachelor", "field_of_study": "Business Operations", "institution": "Southbank College", "location": "London", "start_date": "2017", "end_date": "2019", "description": None}],
        "languages": [{"language": "English", "level": "Native", "original_level": "Native"}],
        "certifications": [],
    },
]


def add_text(page: fitz.Page, rect: fitz.Rect, text: str, *, size: float = 8.2, bold: bool = False,
             color: tuple[float, float, float] = INK, align: int = fitz.TEXT_ALIGN_LEFT) -> None:
    spare = page.insert_textbox(rect, text, fontsize=size, fontname="hebo" if bold else "helv",
                               color=color, lineheight=1.18, align=align)
    if spare < 0:
        raise ValueError(f"Text clipped by {abs(spare):.2f} points: {text[:60]!r}")


def draw_header(page: fitz.Page, candidate: dict[str, Any], rect: fitz.Rect, *, centered: bool = False) -> None:
    info = candidate["identity"]
    add_text(page, fitz.Rect(rect.x0, rect.y0, rect.x1, rect.y0 + 31), info["full_name"], size=19, bold=True,
             color=ACCENT, align=fitz.TEXT_ALIGN_CENTER if centered else fitz.TEXT_ALIGN_LEFT)
    add_text(page, fitz.Rect(rect.x0, rect.y0 + 30, rect.x1, rect.y0 + 49), info["job_title"], size=11, bold=True,
             align=fitz.TEXT_ALIGN_CENTER if centered else fitz.TEXT_ALIGN_LEFT)
    contact = f'{info["email"]}  |  {info["phone"]}  |  {info["location"]}'
    add_text(page, fitz.Rect(rect.x0, rect.y0 + 49, rect.x1, rect.y0 + 67), contact, size=7.4, color=MUTED,
             align=fitz.TEXT_ALIGN_CENTER if centered else fitz.TEXT_ALIGN_LEFT)


def draw_section(page: fitz.Page, rect: fitz.Rect, heading: str, body: str, *, size: float = 8.0,
                 fill: tuple[float, float, float] | None = None) -> None:
    if fill:
        page.draw_rect(rect, fill=fill, color=fill)
    add_text(page, fitz.Rect(rect.x0 + 4, rect.y0 + 3, rect.x1 - 4, rect.y0 + 19), heading, size=9, bold=True, color=ACCENT)
    add_text(page, fitz.Rect(rect.x0 + 4, rect.y0 + 21, rect.x1 - 4, rect.y1 - 3), body, size=size)


def skills_text(candidate: dict[str, Any]) -> str:
    return "\n".join(f'- {item["name"]}' for item in candidate["skills"])


def languages_text(candidate: dict[str, Any]) -> str:
    return "\n".join(f'{item["language"]} - {item["original_level"]}' for item in candidate["languages"])


def education_text(candidate: dict[str, Any]) -> str:
    lines = []
    for item in candidate["education"]:
        field = f' en {item["field_of_study"]}' if item.get("field_of_study") else ""
        institution = item["institution"] + (f', {item["location"]}' if item.get("location") else "")
        dates = f'{item["start_date"]} - {item["end_date"]}' if item.get("start_date") else str(item["end_date"])
        lines.append(f'{item["degree"]}{field}\n{institution}\n{dates}')
    return "\n\n".join(lines)


def experience_text(candidate: dict[str, Any]) -> str:
    lines = []
    for item in candidate["experiences"]:
        lines.append(f'{item["job_title"]} | {item["company"]}, {item["location"]}\n{item["start_date"]} - {item["end_date"]}\n- {item["description"]}')
    return "\n\n".join(lines)


def certifications_text(candidate: dict[str, Any]) -> str:
    # Use an ASCII visual separator supported by the built-in PDF font. This
    # also makes the exact visible text portable across PyMuPDF installations.
    return "\n".join(f'{item["name"]} | {item["issuer"]} {item["date"]}' for item in candidate["certifications"])


def layout_single_column(page: fitz.Page, c: dict[str, Any]) -> None:
    draw_header(page, c, fitz.Rect(42, 35, 553, 102))
    draw_section(page, fitz.Rect(42, 108, 553, 174), "PROFIL", c["summary"])
    draw_section(page, fitz.Rect(42, 178, 553, 252), "COMPÉTENCES", "  |  ".join(i["name"] for i in c["skills"]))
    draw_section(page, fitz.Rect(42, 256, 553, 382), "EXPÉRIENCES PROFESSIONNELLES", experience_text(c))
    draw_section(page, fitz.Rect(42, 386, 553, 480), "FORMATION", education_text(c))
    draw_section(page, fitz.Rect(42, 484, 553, 558), "LANGUES", languages_text(c))
    draw_section(page, fitz.Rect(42, 562, 553, 638), "CERTIFICATIONS", certifications_text(c))


def layout_two_columns(page: fitz.Page, c: dict[str, Any]) -> None:
    draw_header(page, c, fitz.Rect(38, 32, 557, 102), centered=True)
    page.draw_line((218, 112), (218, 790), color=(0.78, 0.82, 0.88), width=0.7)
    draw_section(page, fitz.Rect(38, 112, 207, 264), "COMPÉTENCES", skills_text(c), fill=PALE)
    draw_section(page, fitz.Rect(38, 270, 207, 376), "LANGUES", languages_text(c), fill=PALE)
    draw_section(page, fitz.Rect(38, 382, 207, 548), "FORMATION", education_text(c), size=7.5, fill=PALE)
    draw_section(page, fitz.Rect(230, 112, 557, 208), "PROFIL", c["summary"])
    draw_section(page, fitz.Rect(230, 214, 557, 410), "EXPÉRIENCES PROFESSIONNELLES", experience_text(c), size=7.7)
    draw_section(page, fitz.Rect(230, 416, 557, 528), "CERTIFICATIONS", certifications_text(c), size=7.7)


def layout_sidebar(page: fitz.Page, c: dict[str, Any]) -> None:
    page.draw_rect(fitz.Rect(0, 0, 178, PAGE.height), fill=(0.10, 0.18, 0.29), color=(0.10, 0.18, 0.29))
    info = c["identity"]
    draw_section(page, fitz.Rect(18, 45, 160, 165), "CONTACT", f'{info["email"]}\n{info["phone"]}\n{info["location"]}', size=7.2)
    draw_section(page, fitz.Rect(18, 172, 160, 352), "COMPÉTENCES", skills_text(c), size=7.5)
    draw_section(page, fitz.Rect(18, 360, 160, 506), "LANGUES", languages_text(c), size=7.3)
    add_text(page, fitz.Rect(198, 38, 555, 68), info["full_name"], size=20, bold=True, color=ACCENT)
    add_text(page, fitz.Rect(198, 70, 555, 92), info["job_title"], size=11, bold=True)
    draw_section(page, fitz.Rect(194, 108, 557, 204), "PROFIL", c["summary"], size=7.8)
    draw_section(page, fitz.Rect(194, 210, 557, 390), "EXPÉRIENCES PROFESSIONNELLES", experience_text(c), size=7.6)
    draw_section(page, fitz.Rect(194, 396, 557, 548), "FORMATION", education_text(c), size=7.5)
    draw_section(page, fitz.Rect(194, 554, 557, 666), "CERTIFICATIONS", certifications_text(c), size=7.5)


def layout_dense_experience(page: fitz.Page, c: dict[str, Any]) -> None:
    draw_header(page, c, fitz.Rect(38, 28, 557, 94))
    draw_section(page, fitz.Rect(38, 98, 557, 164), "PROFIL", c["summary"], size=7.6)
    draw_section(page, fitz.Rect(38, 168, 557, 520), "EXPÉRIENCES PROFESSIONNELLES", experience_text(c), size=7.15)
    draw_section(page, fitz.Rect(38, 526, 220, 730), "COMPÉTENCES", skills_text(c), size=7.3, fill=PALE)
    draw_section(page, fitz.Rect(228, 526, 402, 730), "FORMATION", education_text(c), size=7.0, fill=PALE)
    draw_section(page, fitz.Rect(410, 526, 557, 730), "LANGUES", languages_text(c), size=7.0, fill=PALE)


def layout_english(page: fitz.Page, c: dict[str, Any]) -> None:
    draw_header(page, c, fitz.Rect(42, 34, 553, 101), centered=True)
    draw_section(page, fitz.Rect(42, 108, 553, 176), "PROFILE", c["summary"])
    draw_section(page, fitz.Rect(42, 182, 553, 250), "SKILLS", "  |  ".join(i["name"] for i in c["skills"]))
    draw_section(page, fitz.Rect(42, 256, 553, 380), "EXPERIENCE", experience_text(c))
    draw_section(page, fitz.Rect(42, 386, 553, 486), "EDUCATION", education_text(c))
    draw_section(page, fitz.Rect(42, 492, 553, 572), "LANGUAGES", languages_text(c))
    draw_section(page, fitz.Rect(42, 578, 553, 660), "CERTIFICATIONS", certifications_text(c))


def layout_mixed(page: fitz.Page, c: dict[str, Any]) -> None:
    draw_header(page, c, fitz.Rect(38, 28, 557, 94), centered=True)
    draw_section(page, fitz.Rect(38, 100, 557, 172), "PROFIL", c["summary"])
    draw_section(page, fitz.Rect(38, 180, 216, 408), "COMPÉTENCES", skills_text(c), size=7.5, fill=PALE)
    draw_section(page, fitz.Rect(226, 180, 557, 408), "EXPÉRIENCES PROFESSIONNELLES", experience_text(c), size=7.5)
    draw_section(page, fitz.Rect(38, 418, 557, 524), "FORMATION", education_text(c))
    draw_section(page, fitz.Rect(38, 534, 286, 700), "LANGUES", languages_text(c), size=7.3, fill=PALE)
    draw_section(page, fitz.Rect(296, 534, 557, 700), "CERTIFICATIONS", certifications_text(c), size=7.3, fill=PALE)


def layout_independent_columns(page: fitz.Page, c: dict[str, Any]) -> None:
    """Asymmetric columns whose section boundaries never form a shared row grid."""
    info = c["identity"]
    add_text(page, fitz.Rect(42, 42, 218, 72), info["full_name"], size=18, bold=True, color=ACCENT)
    add_text(page, fitz.Rect(42, 75, 218, 94), info["job_title"], size=9.5, bold=True)
    draw_section(page, fitz.Rect(38, 178, 218, 270), "CONTACT", f'{info["phone"]}\n{info["email"]}', size=7.3, fill=PALE)
    draw_section(page, fitz.Rect(38, 278, 218, 468), "FORMATION", education_text(c), size=7.1, fill=PALE)
    wrapped_skills = "Gestion de projet\nAnalyse des\nprocessus\nGestion des priorités\nTravail en équipe\nAdaptabilité"
    draw_section(page, fitz.Rect(38, 476, 218, 650), "COMPÉTENCES", wrapped_skills, size=7.4, fill=PALE)
    draw_section(page, fitz.Rect(38, 658, 218, 790), "LANGUES", languages_text(c), size=7.2, fill=PALE)
    draw_section(page, fitz.Rect(236, 178, 557, 274), "PROFIL", c["summary"], size=7.6)
    add_text(page, fitz.Rect(240, 286, 540, 326), "EXPÉRIENCES\nPROFESSIONNELLES", size=9, bold=True, color=ACCENT)
    add_text(page, fitz.Rect(240, 330, 552, 710), experience_text(c), size=7.0)
    add_text(page, fitz.Rect(240, 720, 552, 738), "CERTIFICATS", size=9, bold=True, color=ACCENT)
    add_text(page, fitz.Rect(244, 743, 552, 786), "Operations Management\nCertificate | Open Learning Academy 2024", size=7.2)


def layout_detached_date_rail(page: fitz.Page, c: dict[str, Any]) -> None:
    info = c["identity"]
    add_text(page, fitz.Rect(40, 35, 210, 62), info["full_name"], size=18, bold=True, color=ACCENT)
    add_text(page, fitz.Rect(40, 65, 210, 84), info["job_title"], size=10, bold=True)
    draw_section(page, fitz.Rect(35, 140, 210, 245), "CONTACT", f'{info["email"]}\n{info["phone"]}\n{info["location"]}', size=7.2, fill=PALE)
    draw_section(page, fitz.Rect(35, 260, 210, 430), "COMPÉTENCES", skills_text(c), size=7.2, fill=PALE)
    draw_section(page, fitz.Rect(35, 650, 210, 780), "LANGUES", languages_text(c), size=7.2, fill=PALE)
    draw_section(page, fitz.Rect(235, 105, 557, 200), "PROFIL", c["summary"], size=7.6)
    add_text(page, fitz.Rect(238, 220, 545, 240), "EXPÉRIENCES PROFESSIONNELLES", size=9, bold=True, color=ACCENT)
    add_text(page, fitz.Rect(272, 255, 552, 280), "Process Engineer | Fictional Flow Works, Tanger", size=7.4, bold=True)
    add_text(page, fitz.Rect(220, 282, 262, 320), "2023\n-\nPrésent", size=7.2, bold=True)
    add_text(page, fitz.Rect(272, 286, 552, 345), "Analyse des flux et animation des actions d'amélioration.", size=7.2)
    draw_section(page, fitz.Rect(235, 470, 557, 590), "FORMATION", education_text(c), size=7.2)


def layout_unknown_heading_boundary(page: fitz.Page, c: dict[str, Any]) -> None:
    draw_header(page, c, fitz.Rect(42, 35, 553, 102))
    draw_section(page, fitz.Rect(42, 120, 553, 205), "SKILLS", "Python\nDocker")
    draw_section(page, fitz.Rect(42, 220, 553, 340), "ACHIEVEMENTS", "Built a fictional community platform\nDesigned a fictional service workflow")
    draw_section(page, fitz.Rect(42, 360, 553, 490), "EDUCATION", education_text(c))
    draw_section(page, fitz.Rect(42, 510, 553, 600), "LANGUAGES", languages_text(c))


def layout_education_training_alias(page: fitz.Page, c: dict[str, Any]) -> None:
    draw_header(page, c, fitz.Rect(42, 35, 553, 102))
    draw_section(page, fitz.Rect(42, 115, 553, 190), "PROFILE", c["summary"])
    draw_section(page, fitz.Rect(42, 210, 553, 355), "EDUCATION AND PROFESSIONAL TRAINING", education_text(c))
    draw_section(page, fitz.Rect(42, 375, 553, 460), "SKILLS", skills_text(c))
    draw_section(page, fitz.Rect(42, 480, 553, 560), "LANGUAGES", languages_text(c))


def layout_title_without_name(page: fitz.Page, c: dict[str, Any]) -> None:
    add_text(page, fitz.Rect(42, 40, 553, 72), c["identity"]["job_title"], size=19, bold=True, color=ACCENT)
    draw_section(page, fitz.Rect(42, 95, 553, 175), "PROFILE", c["summary"])
    draw_section(page, fitz.Rect(42, 195, 553, 285), "SKILLS", skills_text(c))
    draw_section(page, fitz.Rect(42, 305, 553, 430), "EXPERIENCE", experience_text(c))
    draw_section(page, fitz.Rect(42, 450, 553, 565), "EDUCATION", education_text(c))
    draw_section(page, fitz.Rect(42, 585, 553, 675), "LANGUAGES", "English\nSpanish")


def layout_freeform_experience(page: fitz.Page, c: dict[str, Any]) -> None:
    draw_header(page, c, fitz.Rect(42, 32, 553, 99))
    draw_section(page, fitz.Rect(42, 110, 553, 185), "PROFESSIONAL SUMMARY", c["summary"])
    body = (
        "Fictional North Services, London    January 2022 - Present\nService Coordinator\n"
        "Coordinated service requests, tracked delivery issues and prepared weekly operational reports.\n"
        "Maintained accurate status records and communicated exceptions to service teams.\n\n"
        "Fictional Cedar Office, London    March 2019 - December 2021\nOperations Assistant\n"
        "Maintained records, supported suppliers and organized customer documentation.\n"
        "Prepared routine updates and resolved document discrepancies."
    )
    draw_section(page, fitz.Rect(42, 205, 553, 455), "WORK EXPERIENCE", body, size=7.5)
    draw_section(page, fitz.Rect(42, 475, 553, 585), "EDUCATION", education_text(c), size=7.5)
    draw_section(page, fitz.Rect(42, 605, 340, 700), "SKILLS", skills_text(c), size=7.5)
    draw_section(page, fitz.Rect(360, 605, 553, 700), "LANGUAGES", languages_text(c), size=7.5)


LAYOUTS: dict[str, Callable[[fitz.Page, dict[str, Any]], None]] = {
    "single_column": layout_single_column,
    "two_columns": layout_two_columns,
    "sidebar": layout_sidebar,
    "dense_experience": layout_dense_experience,
    "english": layout_english,
    "mixed": layout_mixed,
    "independent_columns": layout_independent_columns,
    "detached_date_rail": layout_detached_date_rail,
    "unknown_heading_boundary": layout_unknown_heading_boundary,
    "education_training_alias": layout_education_training_alias,
    "title_without_name": layout_title_without_name,
    "freeform_experience": layout_freeform_experience,
}


def expected_payload(candidate: dict[str, Any]) -> dict[str, Any]:
    return {key: candidate[key] for key in (
        "identity", "summary", "skills", "languages", "certifications", "education", "experiences"
    )}


def generate_case(candidate: dict[str, Any]) -> None:
    document = fitz.open()
    document.set_metadata({"title": "Synthetic CV regression fixture", "author": "CV Parser test suite"})
    page = document.new_page(width=PAGE.width, height=PAGE.height)
    LAYOUTS[candidate["layout"]](page, candidate)
    pdf_path = OUTPUT_DIR / candidate["filename"]
    document.save(pdf_path, garbage=4, deflate=True, clean=True)
    document.close()

    expected_path = pdf_path.with_name(f"{pdf_path.stem}_expected.json")
    expected_path.write_text(json.dumps(expected_payload(candidate), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def validate_fixture(candidate: dict[str, Any]) -> None:
    path = OUTPUT_DIR / candidate["filename"]
    with fitz.open(path) as document:
        if document.page_count != 1:
            raise ValueError(f"{path.name}: expected exactly one page")
        page = document[0]
        text = page.get_text("text")
        if len(text.strip()) < 100:
            raise ValueError(f"{path.name}: native selectable text is unexpectedly short")
        missing = [heading for heading in candidate["headings"] if heading not in text]
        if missing:
            raise ValueError(f"{path.name}: missing headings in native text: {missing}")
        if page.get_text("blocks") and any(block[0] < -0.5 or block[1] < -0.5 or block[2] > page.rect.width + 0.5 or block[3] > page.rect.height + 0.5 for block in page.get_text("blocks")):
            raise ValueError(f"{path.name}: text block falls outside page boundaries")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    intended = set()
    for candidate in CASES:
        generate_case(candidate)
        validate_fixture(candidate)
        intended.add(candidate["filename"])
        intended.add(f'{Path(candidate["filename"]).stem}_expected.json')
    for path in OUTPUT_DIR.iterdir():
        if path.is_file() and path.name not in intended:
            raise ValueError(f"Unexpected file in synthetic fixture directory: {path.name}")
    print(f"Generated and validated {len(CASES)} synthetic CV cases in {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
