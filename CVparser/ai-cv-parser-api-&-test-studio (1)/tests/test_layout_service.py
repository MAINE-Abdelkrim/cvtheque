"""
Unit tests for LayoutService (Phase 2):
- Détection une colonne
- Détection deux colonnes
- CV avec layout différent selon les pages
- Bloc pleine largeur en bas de page classé après les colonnes
"""

import pytest
import fitz
from app.services.layout_service import LayoutService
from app.models.response_models import LayoutType


def test_detection_une_colonne():
    doc = fitz.open()
    page = doc.new_page(width=600, height=800)
    page.insert_text((50, 50), "TITRE PRINCIPAL DU CV", fontsize=18)
    page.insert_text((50, 100), "Expérience Professionnelle chez Tech Corp (2020-2024)", fontsize=12)
    page.insert_text((50, 150), "Description des tâches et réalisations en développement Backend.", fontsize=10)

    result = LayoutService.analyze_page_layout(page)
    assert result.layout_type == LayoutType.SINGLE_COLUMN
    assert "TITRE PRINCIPAL" in result.ordered_text
    assert "Tech Corp" in result.ordered_text
    assert result.left_column_text is None
    assert result.right_column_text is None
    doc.close()


def test_detection_deux_colonnes():
    doc = fitz.open()
    page = doc.new_page(width=600, height=800)
    # Left column blocks (x0=30, x1=250)
    page.insert_text((30, 100), "COMPÉTENCES\n- Python\n- FastAPI\n- SQL", fontsize=11)
    page.insert_text((30, 300), "LANGUES\n- Français: Langue maternelle\n- Anglais: Courant (C1)", fontsize=11)
    
    # Right column blocks (x0=320, x1=550)
    page.insert_text((320, 100), "EXPÉRIENCES PROFESSIONNELLES\nDéveloppeur Senior chez DataCorp (2022-2024)\nConception d'APIs REST haute performance.", fontsize=11)
    page.insert_text((320, 300), "FORMATION\nMaster en Science des Données - Université de Paris (2018-2020)", fontsize=11)

    result = LayoutService.analyze_page_layout(page)
    assert result.layout_type in (LayoutType.TWO_COLUMNS, LayoutType.MIXED)
    assert result.left_column_text is not None
    assert result.right_column_text is not None
    assert "COMPÉTENCES" in result.left_column_text or "LANGUES" in result.left_column_text
    assert "EXPÉRIENCES" in result.right_column_text or "FORMATION" in result.right_column_text
    doc.close()


def test_cv_layout_different_selon_les_pages():
    doc = fitz.open()
    # Page 1: Two columns
    p1 = doc.new_page(width=600, height=800)
    p1.insert_text((30, 100), "COMPÉTENCES\n- Python\n- Docker\n- Linux", fontsize=11)
    p1.insert_text((320, 100), "EXPÉRIENCE PROFESSIONNELLE\nIngénieur DevOps (2021-2024)", fontsize=11)

    # Page 2: Single column
    p2 = doc.new_page(width=600, height=800)
    p2.insert_text((50, 100), "ANNEXES & PROJETS PERSONNELS", fontsize=14)
    p2.insert_text((50, 150), "Projet 1: Convertisseur PDF automatisé avec FastAPI et PyMuPDF.", fontsize=11)

    res1 = LayoutService.analyze_page_layout(doc[0])
    res2 = LayoutService.analyze_page_layout(doc[1])

    assert res1.layout_type in (LayoutType.TWO_COLUMNS, LayoutType.MIXED)
    assert res2.layout_type == LayoutType.SINGLE_COLUMN
    doc.close()


def test_bloc_pleine_largeur_en_bas_de_page():
    page_width = 600.0
    page_height = 800.0
    # Create blocks manually:
    # 1. Left column block (y0=100)
    # 2. Right column block (y0=100)
    # 3. Bottom full width block (y0=600 >= page_height * 0.4 = 320)
    blocks = [
        (30.0, 100.0, 200.0, 300.0, "COLONNE_GAUCHE_TEXTE_SUIS_JE_ASSEZ_LONG", 0, 0),
        (350.0, 100.0, 550.0, 300.0, "COLONNE_DROITE_TEXTE_SUIS_JE_ASSEZ_LONG", 1, 0),
        (50.0, 600.0, 550.0, 700.0, "PIED_DE_PAGE_PLEINE_LARGEUR", 2, 0),
    ]

    result = LayoutService.analyze_blocks_layout(blocks, page_width, page_height)
    assert result.layout_type == LayoutType.MIXED
    
    # Check that PIED_DE_PAGE_PLEINE_LARGEUR appears AFTER left and right column texts in ordered_text
    left_pos = result.ordered_text.find("COLONNE_GAUCHE")
    right_pos = result.ordered_text.find("COLONNE_DROITE")
    footer_pos = result.ordered_text.find("PIED_DE_PAGE")

    assert left_pos != -1
    assert right_pos != -1
    assert footer_pos != -1
    assert footer_pos > left_pos
    assert footer_pos > right_pos


def test_mixed_layout_uses_vertical_regions_instead_of_global_column_concatenation():
    blocks = [
        (25.0, 50.0, 380.0, 90.0, "ALEX MARTIN\nDATA ENGINEER", 0, 0),
        (25.0, 100.0, 380.0, 170.0, "PROFIL\nProfessional profile", 1, 0),
        (430.0, 60.0, 570.0, 125.0, "Paris\nalex@example.com\ngithub.com/alex", 2, 0),
        (25.0, 190.0, 575.0, 300.0, "FORMATION ACADÉMIQUE\nEngineering degree", 3, 0),
        (25.0, 320.0, 575.0, 430.0, "EXPÉRIENCE PROFESSIONNELLE\nBackend internship", 4, 0),
        (25.0, 450.0, 430.0, 560.0, "COMPÉTENCES TECHNIQUES\nPython, Next.js", 5, 0),
        (25.0, 580.0, 120.0, 600.0, "LANGUES", 6, 0),
    ]
    result = LayoutService.analyze_blocks_layout(blocks, 600.0, 800.0)

    assert result.layout_type == LayoutType.MIXED
    assert result.ordered_text.startswith("ALEX MARTIN")
    assert result.ordered_text.index("PROFIL") < result.ordered_text.index("Paris")
    assert result.ordered_text.index("Paris") < result.ordered_text.index("FORMATION ACADÉMIQUE")
    assert result.ordered_text.index("FORMATION ACADÉMIQUE") < result.ordered_text.index("EXPÉRIENCE PROFESSIONNELLE")
    assert result.ordered_text.index("EXPÉRIENCE PROFESSIONNELLE") < result.ordered_text.index("COMPÉTENCES TECHNIQUES")
