"""
Unit tests for SkillsExtractor.
"""

from app.extractors.skills_extractor import SkillsExtractor


def test_competences_dans_skills():
    sections = {"SKILLS": "Python, Docker, PostgreSQL, React"}
    skills = SkillsExtractor.extract(sections)
    names = [s.name for s in skills]
    assert "Python" in names
    assert "Docker" in names
    assert "PostgreSQL" in names
    assert "React" in names


def test_normalisation_python():
    sections = {"SKILLS": "python, PYTHON"}
    skills = SkillsExtractor.extract(sections)
    names = [s.name for s in skills]
    assert names.count("Python") == 1


def test_normalisation_fastapi():
    sections = {"SKILLS": "FASTAPI, fastapi"}
    skills = SkillsExtractor.extract(sections)
    names = [s.name for s in skills]
    assert "FastAPI" in names
    assert names.count("FastAPI") == 1


def test_suppression_doublons():
    sections = {"SKILLS": "Docker, docker, DOCKER"}
    skills = SkillsExtractor.extract(sections)
    assert len(skills) == 1
    assert skills[0].name == "Docker"


test_java_different_javascript_text = "Développement JavaScript frontend et Node.js"

def test_java_different_javascript():
    skills = SkillsExtractor.extract(cleaned_text=test_java_different_javascript_text)
    names = [s.name for s in skills]
    assert "JavaScript" in names
    assert "Java" not in names


def test_go_non_detecte_dans_google():
    text = "Travail chez Google Cloud Platform et Google LLC"
    skills = SkillsExtractor.extract(cleaned_text=text)
    names = [s.name for s in skills]
    assert "Go" not in names


def test_r_non_detecte_dans_mot():
    text = "Résidence à Rabat, travail en R&D"
    skills = SkillsExtractor.extract(cleaned_text=text)
    names = [s.name for s in skills]
    assert "R" not in names


def test_c_plus_plus_et_c_sharp_distincts():
    sections = {"SKILLS": "C++, C#"}
    skills = SkillsExtractor.extract(sections)
    names = [s.name for s in skills]
    assert "C++" in names
    assert "C#" in names


def test_java_et_javascript_ensemble():
    sections = {"SKILLS": "Java\nJavaScript"}
    skills = SkillsExtractor.extract(sections)
    names = [s.name for s in skills]
    assert "Java" in names
    assert "JavaScript" in names
    assert names.count("Java") == 1


def test_nodejs_variations():
    for var in ["Node.js", "node js", "NODEJS"]:
        skills = SkillsExtractor.extract(sections={"SKILLS": var})
        assert len(skills) == 1
        assert skills[0].name == "Node.js"


def test_postgresql_variations():
    for var in ["PostgreSQL", "postgres", "POSTGRESQL"]:
        skills = SkillsExtractor.extract(sections={"SKILLS": var})
        assert len(skills) == 1
        assert skills[0].name == "PostgreSQL"


def test_conservation_ordre_et_source():
    sections = {"SKILLS": "Python, Docker", "EXPERIENCES": "Utilisation de PostgreSQL"}
    skills = SkillsExtractor.extract(sections)
    assert skills[0].name == "Python"
    assert skills[0].source == "skills_section"
    names = [s.name for s in skills]
    assert "PostgreSQL" in names


def test_skill_not_detected_inside_email():
    text = "Senior Data Engineer\npython@email.com"
    skills = SkillsExtractor.extract(cleaned_text=text)
    assert "Python" not in [s.name for s in skills]


def test_skill_not_detected_inside_url():
    text = "Portfolio: https://react.dev"
    skills = SkillsExtractor.extract(cleaned_text=text)
    assert "React" not in [s.name for s in skills]


def test_skill_not_detected_inside_github_url():
    text = "GitHub: https://github.com/python-user"
    skills = SkillsExtractor.extract(cleaned_text=text)
    assert "Python" not in [s.name for s in skills]


def test_real_skill_remains_after_contact_sanitization():
    text = """
    Python
    Email: java@email.com
    Portfolio: https://react.dev
    Docker
    """
    skills = SkillsExtractor.extract(cleaned_text=text)
    names = [s.name for s in skills]
    assert "Python" in names
    assert "Docker" in names
    assert "Java" not in names
    assert "React" not in names


def test_phase_43_explicit_skill_catalog_coverage_and_deduplication():
    text = """Firebase, Firestore, Gemini, Genkit, Matplotlib, Seaborn,
    Jupyter Notebook, NoSQL, CNN, RNN, LSTM, Reinforcement Learning,
    Prompt Engineering, Machine Learning, Deep Learning, Classification, Régression,
    Clustering, Feature Engineering, LLMs, Chatbots IA, Analyse exploratoire,
    Prétraitement des données, Data Processing, Dashboards, VS Code, API REST,
    firebase, C, R, Next.js"""
    skills = SkillsExtractor.extract({"SKILLS": text})
    names = [skill.name for skill in skills]
    for expected in [
        "Firebase", "Firestore", "Gemini", "Genkit", "Matplotlib", "Seaborn",
        "Jupyter Notebook", "NoSQL", "CNN", "RNN", "LSTM",
        "Reinforcement Learning", "Prompt Engineering", "C", "R", "Next.js",
        "Machine Learning", "Deep Learning", "Classification", "Regression",
        "Clustering", "Feature Engineering", "LLMs", "Chatbots IA",
        "Analyse exploratoire", "Prétraitement des données", "Data Processing",
        "Dashboards", "VS Code", "API REST",
    ]:
        assert expected in names
    assert names.count("Firebase") == 1
    assert all(skill.source == "skills_section" for skill in skills)


def test_school_and_issuer_names_are_not_skills():
    skills = SkillsExtractor.extract({"SKILLS": "Example University, IBM, Google"})
    assert skills == []
def test_explicit_skills_section_preserves_valid_uncatalogued_items():
    skills = SkillsExtractor.extract({"SKILLS": "- Terraform\n- Figma\n- Design Systems\n- Kubernetes\n- Ansible"})
    names = {skill.name for skill in skills}
    assert {"Terraform", "Figma", "Design Systems", "Kubernetes", "Ansible"} <= names


def test_explicit_skills_section_rejects_contact_date_heading_and_prose_noise():
    skills = SkillsExtractor.extract({"SKILLS": "SKILLS\nexample@example.com\n+212 600 000 999\n2024\nThis is a long paragraph sentence describing many unrelated professional achievements."})
    assert skills == []


def test_narrow_column_skill_continuations_are_recombined():
    skills = SkillsExtractor.extract({
        "SKILLS": "Gestion de projet et\nmanagement\nd'équipe\nAnalyse des\nprocessus\nTravail en équipe"
    })
    names = {skill.name for skill in skills}
    assert "Gestion de projet et management d'équipe" in names
    assert "Analyse des processus" in names
    assert "Travail en équipe" in names
