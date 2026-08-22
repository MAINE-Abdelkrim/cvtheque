from app.services.layout_service import LayoutService


def block(x0, y0, x1, y1, text, number):
    return (float(x0), float(y0), float(x1), float(y1), text, number, 0)


def ordered(blocks):
    return LayoutService.analyze_blocks_layout(blocks, 600, 800).ordered_text


def test_parallel_equal_columns_keep_each_group_contiguous():
    text = ordered([block(40, 20, 560, 70, "FULL HEADER", 0), block(40, 100, 180, 120, "SKILLS", 1),
                    block(40, 125, 180, 180, "Python", 2), block(320, 100, 550, 120, "PROFILE", 3),
                    block(320, 125, 550, 180, "Real summary", 4)])
    assert text.index("SKILLS") < text.index("Python") < text.index("PROFILE") < text.index("Real summary")


def test_narrow_sidebar_and_wide_main_keep_main_identity_contiguous():
    text = ordered([block(20, 50, 120, 70, "CONTACT", 0), block(20, 75, 150, 120, "example@example.com", 1),
                    block(200, 35, 500, 65, "FICTIONAL NAME", 2), block(200, 70, 500, 90, "UX DESIGNER", 3),
                    block(200, 110, 550, 130, "PROFILE", 4), block(200, 135, 550, 180, "Summary", 5)])
    assert text.index("FICTIONAL NAME") < text.index("UX DESIGNER") < text.index("CONTACT")


def test_full_width_then_columns_then_full_width_preserves_regions():
    text = ordered([block(30, 20, 570, 70, "HEADER", 0), block(30, 100, 250, 180, "LEFT GROUP", 1),
                    block(330, 100, 570, 180, "RIGHT GROUP", 2), block(30, 300, 570, 350, "FULL WIDTH FOOTER", 3)])
    assert text.index("HEADER") < text.index("LEFT GROUP") < text.index("RIGHT GROUP") < text.index("FULL WIDTH FOOTER")


def test_three_parallel_groups_remain_internally_contiguous():
    text = ordered([block(30, 100, 170, 120, "SKILLS", 0), block(30, 125, 170, 180, "Python", 1),
                    block(220, 100, 370, 120, "EDUCATION", 2), block(220, 125, 370, 180, "Engineering Degree", 3),
                    block(420, 100, 570, 120, "LANGUAGES", 4), block(420, 125, 570, 180, "English", 5)])
    assert text.index("SKILLS") < text.index("Python") < text.index("EDUCATION") < text.index("Engineering Degree") < text.index("LANGUAGES") < text.index("English")


def test_parallel_column_may_end_earlier():
    text = ordered([block(30, 100, 220, 120, "LEFT", 0), block(30, 125, 220, 150, "Left body", 1),
                    block(330, 100, 570, 120, "RIGHT", 2), block(330, 125, 570, 230, "Long right body", 3)])
    assert text.index("LEFT") < text.index("Left body") < text.index("RIGHT") < text.index("Long right body")


def test_certification_date_stays_with_certification_column():
    text = ordered([block(30, 100, 250, 120, "EXPERIENCE", 0), block(30, 125, 250, 180, "Engineer 2020 - 2023", 1),
                    block(330, 100, 570, 120, "CERTIFICATIONS", 2), block(330, 125, 570, 180, "Cloud Certificate 2024", 3)])
    assert text.index("Engineer 2020") < text.index("CERTIFICATIONS") < text.index("Cloud Certificate 2024")
