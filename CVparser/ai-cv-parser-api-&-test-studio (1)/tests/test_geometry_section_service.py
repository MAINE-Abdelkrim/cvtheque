"""Focused tests for native PDF geometry-aware section ownership."""

from pathlib import Path

import fitz

from app.services.geometry_section_service import GeometrySectionResult, GeometrySectionService, PositionedTextLine


FIXTURES = Path(__file__).parent / "fixtures" / "synthetic_cvs"


def segment(name: str):
    with fitz.open(FIXTURES / name) as document:
        return GeometrySectionService.segment_page(document[0], 1)


def test_unknown_visual_heading_stops_same_flow_ownership():
    result = segment("cv_09_unknown_heading_boundary.pdf")
    assert result.sections["SKILLS"] == "Python\nDocker"
    assert "ACHIEVEMENTS" in result.structural_headings


def test_independent_flows_do_not_terminate_each_other():
    result = segment("cv_08_detached_date_rail.pdf")
    assert "Process Engineer" in result.sections["EXPERIENCES"]
    assert "2023" in result.sections["EXPERIENCES"]
    assert "Process Mapping" in result.sections["SKILLS"]
    assert "2023" not in result.sections["SKILLS"]


def test_common_education_training_alias_is_canonical():
    result = segment("cv_10_education_training_alias.pdf")
    assert "EDUCATION" in result.detected_sections
    assert "Business Analytics" in result.sections["EDUCATION"]


def test_later_page_unheaded_prefix_continues_prior_section_not_header():
    sections, detected = GeometrySectionService.combine_pages([
        GeometrySectionResult({"HEADER": "Fictional Person", "EXPERIENCES": "Record one"}, ["EXPERIENCES"], [], 2),
        GeometrySectionResult({"HEADER": "continued description", "EDUCATION": "Bachelor"}, ["EDUCATION"], [], 2),
    ])
    assert sections["HEADER"] == "Fictional Person"
    assert sections["EXPERIENCES"] == "Record one\ncontinued description"
    assert detected == ["EXPERIENCES", "EDUCATION"]


def test_controlled_title_case_structural_boundaries_are_not_public_sections():
    for title in ("Accomplishments", "Personal Information"):
        lines = [PositionedTextLine(title, 1, 40, 100, 180, 112, 8, False)]
        assert GeometrySectionService._is_structural_heading(lines, 0, 8, 10)
