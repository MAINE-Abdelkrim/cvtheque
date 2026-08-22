# Execution des Tests - Guide de Documentation

Toutes les vérifications et tests unitaires du projet s'exécutent directement à l'aide de **pytest**.

## Commande d'exécution standard

Pour lancer l'ensemble de la suite de tests de la Phase 1 et Mini-Phase 1.1 :

```bash
pytest tests/ -v
```

## Couverture des tests

Les suites de tests vérifient :
- **Configuration & Exceptions** (`tests/test_config_and_exceptions.py`) : Enums `ModelExecutionMode` et `OCRLayoutMode`, constantes système, exceptions héritées (`NoJSONObjectFoundError`, `MalformedJSONError`), et `Timer.lap()`.
- **Modèles Pydantic** (`tests/test_pydantic_models.py`) : Enums de réponse (`ExtractionMethod`, `LayoutType`, `ValidationAction`, `PipelineStatus`, `QualityLevel`), initialisation des valeurs par défaut (`None` / `[]`), et contraintes numériques (`page_number >= 1`, scores `[0, 1]`, etc.).
- **Nettoyage de texte** (`tests/test_text_cleaning.py`) : Normalisation des titres de section (`• EXPÉRIENCES` -> `EXPERIENCES`), conservation des dates et structures métiers (`2022 - Développeur Backend`, `03/2020 : Stage Data Science`).
- **Parsing JSON** (`tests/test_json_utils.py`) : Extrait JSON, réparation des virgules traînantes, respect des apostrophes françaises (`d'une`), refus du JSON tronqué ou vide sans modification automatique destructrice.
