"""
Configurable catalog of technical and professional skills for deterministic extraction.
Includes regex patterns, categories, and canonical forms.
"""

from typing import Dict, List, TypedDict, Optional
import re


class SkillDefinition(TypedDict):
    canonical: str
    category: str
    pattern: str  # Regex pattern string


# Skill definitions grouped by category
SKILL_CATALOG: List[SkillDefinition] = [
    # --- Programming Languages ---
    {"canonical": "Python", "category": "programming_language", "pattern": r"\bPython\b"},
    {"canonical": "Java", "category": "programming_language", "pattern": r"\bJava\b(?!Script)"},
    {"canonical": "JavaScript", "category": "programming_language", "pattern": r"(?<!Node\s)(?<!Node\.)\b(JavaScript|JS|ECMAScript)\b"},
    {"canonical": "TypeScript", "category": "programming_language", "pattern": r"\b(TypeScript|TS)\b"},
    {"canonical": "C", "category": "programming_language", "pattern": r"(?<![A-Za-z0-9+#])C(?![A-Za-z0-9+#])"},
    {"canonical": "C++", "category": "programming_language", "pattern": r"\bC\+\+(?![A-Za-z0-9+#])"},
    {"canonical": "C#", "category": "programming_language", "pattern": r"\bC#(?![A-Za-z0-9+#])"},
    {"canonical": "PHP", "category": "programming_language", "pattern": r"\bPHP\b"},
    {"canonical": "R", "category": "programming_language", "pattern": r"(?<![A-Za-z0-9])R(?![A-Za-z0-9])"},
    {"canonical": "SQL", "category": "programming_language", "pattern": r"\bSQL\b"},
    {"canonical": "Scala", "category": "programming_language", "pattern": r"\bScala\b"},
    {"canonical": "Kotlin", "category": "programming_language", "pattern": r"\bKotlin\b"},
    {"canonical": "Swift", "category": "programming_language", "pattern": r"\bSwift\b"},
    {"canonical": "Go", "category": "programming_language", "pattern": r"\b(Go|Golang)\b(?!gle)"},

    # --- Frameworks & Libraries ---
    {"canonical": "FastAPI", "category": "framework", "pattern": r"\bFastAPI\b"},
    {"canonical": "Django", "category": "framework", "pattern": r"\bDjango\b"},
    {"canonical": "Flask", "category": "framework", "pattern": r"\bFlask\b"},
    {"canonical": "Spring Boot", "category": "framework", "pattern": r"\bSpring\s*Boot\b"},
    {"canonical": "React", "category": "framework", "pattern": r"\bReact(\.js)?\b"},
    {"canonical": "Angular", "category": "framework", "pattern": r"\bAngular(JS)?\b"},
    {"canonical": "Vue.js", "category": "framework", "pattern": r"\bVue(\.js)?\b"},
    {"canonical": "Next.js", "category": "framework", "pattern": r"\bNext(\.js)?\b"},
    {"canonical": "Node.js", "category": "framework", "pattern": r"\bNode(\.js|\s*JS)?\b"},
    {"canonical": "Express", "category": "framework", "pattern": r"\bExpress(\.js)?\b"},
    {"canonical": "PyTorch", "category": "framework", "pattern": r"\bPyTorch\b"},
    {"canonical": "TensorFlow", "category": "framework", "pattern": r"\bTensorFlow\b"},
    {"canonical": "Scikit-learn", "category": "framework", "pattern": r"\b(Scikit-learn|scikit learn|sklearn)\b"},
    {"canonical": "Firebase", "category": "framework", "pattern": r"\bFirebase\b"},
    {"canonical": "Firestore", "category": "database", "pattern": r"\bFirestore\b"},
    {"canonical": "Gemini", "category": "framework", "pattern": r"\bGemini\b"},
    {"canonical": "Genkit", "category": "framework", "pattern": r"\bGenkit\b"},

    # --- Data & Analytics ---
    {"canonical": "Pandas", "category": "data", "pattern": r"\bPandas\b"},
    {"canonical": "Polars", "category": "data", "pattern": r"\bPolars\b"},
    {"canonical": "NumPy", "category": "data", "pattern": r"\bNumPy\b"},
    {"canonical": "Spark", "category": "data", "pattern": r"\b(Apache\s+)?Spark\b"},
    {"canonical": "Hadoop", "category": "data", "pattern": r"\bHadoop\b"},
    {"canonical": "Kafka", "category": "data", "pattern": r"\b(Apache\s+)?Kafka\b"},
    {"canonical": "Airflow", "category": "data", "pattern": r"\b(Apache\s+)?Airflow\b"},
    {"canonical": "Power BI", "category": "data", "pattern": r"\bPower\s*BI\b"},
    {"canonical": "Tableau", "category": "data", "pattern": r"\bTableau\b"},
    {"canonical": "Excel", "category": "data", "pattern": r"\b(MS\s+)?Excel\b"},
    {"canonical": "Matplotlib", "category": "data", "pattern": r"\bMatplotlib\b"},
    {"canonical": "Seaborn", "category": "data", "pattern": r"\bSeaborn\b"},
    {"canonical": "NoSQL", "category": "database", "pattern": r"\bNoSQL\b"},
    {"canonical": "CNN", "category": "data", "pattern": r"\bCNNs?\b"},
    {"canonical": "RNN", "category": "data", "pattern": r"\bRNNs?\b"},
    {"canonical": "LSTM", "category": "data", "pattern": r"\bLSTMs?\b"},
    {"canonical": "Reinforcement Learning", "category": "data", "pattern": r"\bReinforcement\s+Learning\b"},
    {"canonical": "Prompt Engineering", "category": "data", "pattern": r"\bPrompt\s+Engineering\b"},
    {"canonical": "Jupyter Notebook", "category": "data", "pattern": r"\bJupyter(?:\s+Notebook)?\b"},
    {"canonical": "Machine Learning", "category": "data", "pattern": r"\bMachine\s+Learning\b"},
    {"canonical": "Deep Learning", "category": "data", "pattern": r"\bDeep\s+Learning\b"},
    {"canonical": "Classification", "category": "data", "pattern": r"\bClassification\b"},
    {"canonical": "Regression", "category": "data", "pattern": r"\bR[ée]gression\b|\bRegression\b"},
    {"canonical": "Clustering", "category": "data", "pattern": r"\bClustering\b"},
    {"canonical": "Feature Engineering", "category": "data", "pattern": r"\bFeature\s+Engineering\b"},
    {"canonical": "LLMs", "category": "data", "pattern": r"\bLLMs?\b"},
    {"canonical": "Chatbots IA", "category": "data", "pattern": r"\bChatbots?\s+IA\b"},
    {"canonical": "Analyse exploratoire", "category": "data", "pattern": r"\bAnalyse\s+exploratoire\b"},
    {"canonical": "Prétraitement des données", "category": "data", "pattern": r"\bPr[ée]traitement\s+des\s+donn[ée]es\b"},
    {"canonical": "Data Processing", "category": "data", "pattern": r"\bData\s+Processing\b"},
    {"canonical": "Dashboards", "category": "data", "pattern": r"\bDashboards?\b"},
    {"canonical": "VS Code", "category": "devops", "pattern": r"\b(?:VS\s+Code|Visual\s+Studio\s+Code)\b"},
    {"canonical": "API REST", "category": "framework", "pattern": r"\b(?:API\s+REST|REST(?:ful)?\s+API)\b"},

    # --- Databases ---
    {"canonical": "PostgreSQL", "category": "database", "pattern": r"\b(PostgreSQL|Postgres)\b"},
    {"canonical": "MySQL", "category": "database", "pattern": r"\bMySQL\b"},
    {"canonical": "SQL Server", "category": "database", "pattern": r"\b(SQL\s*Server|MSSQL)\b"},
    {"canonical": "MongoDB", "category": "database", "pattern": r"\bMongoDB\b"},
    {"canonical": "Redis", "category": "database", "pattern": r"\bRedis\b"},
    {"canonical": "Oracle", "category": "database", "pattern": r"\bOracle\b"},

    # --- DevOps & Cloud ---
    {"canonical": "Docker", "category": "devops", "pattern": r"\bDocker\b"},
    {"canonical": "Kubernetes", "category": "devops", "pattern": r"\b(Kubernetes|K8s)\b"},
    {"canonical": "Git", "category": "devops", "pattern": r"\bGit\b(?!Hub|Lab)"},
    {"canonical": "GitHub", "category": "devops", "pattern": r"\bGitHub\b"},
    {"canonical": "GitLab", "category": "devops", "pattern": r"\bGitLab\b"},
    {"canonical": "Jenkins", "category": "devops", "pattern": r"\bJenkins\b"},
    {"canonical": "AWS", "category": "cloud", "pattern": r"\b(AWS|Amazon\s+Web\s+Services)\b"},
    {"canonical": "Azure", "category": "cloud", "pattern": r"\b(Microsoft\s+)?Azure\b"},
    {"canonical": "Google Cloud", "category": "cloud", "pattern": r"\b(GCP|Google\s+Cloud(\s+Platform)?)\b"},
    {"canonical": "Linux", "category": "devops", "pattern": r"\bLinux\b"},
]
