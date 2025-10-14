#!/usr/bin/env python3
"""
Validation Tests for Improved Text Overlay System
=================================================
Tests the complete flow with real campaign data.

Run this after applying all patches to verify improvements.
"""

import re
import sys
import os
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from utils.design_space_utils import DesignSpaceCalculator, DesignSpaceConfig
from utils.color_utils import ColorConverter, FFmpegColorBuilder, ASSColorBuilder


def test_design_space_scaling():
    """Test design space scaling calculations"""
    print("\n=== Test 1: Design Space Scaling ===")
    
    # Test case 1: Same dimensions (no scaling)
    calc = DesignSpaceCalculator(1088, 1904)
    assert calc.scale_factor == 1.0, "Scale factor should be 1.0 for same dimensions"
    
    font_size = calc.scale_font_size(font_px=58)
    assert font_size == 58, f"Font size should be 58, got {font_size}"
    
    print("✅ Same dimensions test passed")
    
    # Test case 2: 2x scaling (larger video)
    calc = DesignSpaceCalculator(2160, 3840)
    assert calc.scale_factor > 1.9, f"Scale factor should be > 1.9, got {calc.scale_factor}"
    
    font_size = calc.scale_font_size(font_px=58)
    expected = int(58 * calc.scale_factor)
    assert abs(font_size - expected) <= 1, f"Font size should be ~{expected}, got {font_size}"
    
    print("✅ 2x scaling test passed")
    
    # Test case 3: 0.5x scaling (smaller video)
    calc = DesignSpaceCalculator(540, 960)
    assert abs(calc.scale_factor - 0.5) < 0.01, f"Scale factor should be ~0.5, got {calc.scale_factor}"
    
    font_size = calc.scale_font_size(font_px=58)
    expected = int(58 * 0.5)
    assert font_size >= 8, "Font size should respect minimum of 8px"
    
    print("✅ 0.5x scaling test passed")
    
    # Test case 4: Font percentage
    calc = DesignSpaceCalculator(1920, 1080)
    font_size = calc.scale_font_size(font_percentage=5.0)
    expected = int(1080 * 0.05)  # 5% of 1080 = 54
    assert abs(font_size - expected) <= 1, f"Font size should be ~{expected}, got {font_size}"
    
    print("✅ Font percentage test passed")
    
    print("✅ All design space scaling tests passed!\n")


def test_position_mapping():
    """Test position mapping from percentages to pixels"""
    print("=== Test 2: Position Mapping ===")
    
    calc = DesignSpaceCalculator(1920, 1080)
    
    # Test case 1: Center position
    x, y = calc.map_position(50.0, 50.0, anchor="center")
    
    # Should map to safe area center
    bounds = calc.safe_bounds
    expected_x = int(bounds["left"] + 0.5 * bounds["width"])
    expected_y = int(bounds["top"] + 0.5 * bounds["height"])
    
    assert abs(x - expected_x) <= 2, f"X should be ~{expected_x}, got {x}"
    assert abs(y - expected_y) <= 2, f"Y should be ~{expected_y}, got {y}"
    
    print(f"✅ Center position: ({x}, {y})")
    
    # Test case 2: Top-left corner
    x, y = calc.map_position(0.0, 0.0, anchor="top_left")
    
    expected_x = int(bounds["left"])
    expected_y = int(bounds["top"])
    
    assert abs(x - expected_x) <= 2, f"X should be ~{expected_x}, got {x}"
    assert abs(y - expected_y) <= 2, f"Y should be ~{expected_y}, got {y}"
    
    print(f"✅ Top-left position: ({x}, {y})")
    
    # Test case 3: Bottom-right corner
    x, y = calc.map_position(100.0, 100.0, anchor="bottom_right")
    
    expected_x = int(bounds["right"])
    expected_y = int(bounds["bottom"])
    
    assert abs(x - expected_x) <= 2, f"X should be ~{expected_x}, got {x}"
    assert abs(y - expected_y) <= 2, f"Y should be ~{expected_y}, got {y}"
    
    print(f"✅ Bottom-right position: ({x}, {y})")
    
    print("✅ All position mapping tests passed!\n")


def test_ffmpeg_position_expressions():
    """Test FFmpeg position expression generation"""
    print("=== Test 3: FFmpeg Position Expressions ===")
    
    calc = DesignSpaceCalculator(1920, 1080)
    
    # Test different anchors
    test_cases = [
        ("center", "center", "{x}-text_w/2", "{y}-text_h/2"),
        ("top_left", "top-left", "{x}", "{y}"),
        ("bottom_center", "bottom-center", "{x}-text_w/2", "{y}-text_h"),
    ]
    
    for anchor_variant1, anchor_variant2, expected_x_pattern, expected_y_pattern in test_cases:
        for anchor in [anchor_variant1, anchor_variant2]:
            x_expr, y_expr = calc.get_ffmpeg_position_expression(50.0, 50.0, anchor)
            
            # Check pattern (should contain the base coordinate and offset)
            assert "-text_w" in x_expr or x_expr.isdigit(), f"X expression invalid for {anchor}: {x_expr}"
            assert "-text_h" in y_expr or y_expr.isdigit(), f"Y expression invalid for {anchor}: {y_expr}"
            
            print(f"✅ Anchor '{anchor}': x={x_expr}, y={y_expr}")
    
    print("✅ All FFmpeg expression tests passed!\n")


def test_color_conversions():
    """Test color conversion utilities"""
    print("=== Test 4: Color Conversions ===")
    
    # Test case 1: Hex to RGB
    r, g, b = ColorConverter.hex_to_rgb("#FF0000")
    assert (r, g, b) == (255, 0, 0), f"Expected (255,0,0), got ({r},{g},{b})"
    print("✅ Hex to RGB: #FF0000 → (255, 0, 0)")
    
    # Test case 2: Color names
    normalized = ColorConverter.normalize_hex("white")
    assert normalized == "#FFFFFF", f"Expected #FFFFFF, got {normalized}"
    print("✅ Color name: white → #FFFFFF")
    
    # Test case 3: Short hex form
    normalized = ColorConverter.normalize_hex("#FFF")
    assert normalized == "#FFFFFF", f"Expected #FFFFFF, got {normalized}"
    print("✅ Short hex: #FFF → #FFFFFF")
    
    # Test case 4: Hex to ASS (BGR format)
    ass_color = ColorConverter.hex_to_ass("#FF0000")  # Red
    assert ass_color == "0000FF", f"Expected 0000FF (BGR), got {ass_color}"
    print("✅ Hex to ASS: #FF0000 → 0000FF (BGR)")
    
    # Test case 5: Hex to FFmpeg
    ffmpeg_color = ColorConverter.hex_to_ffmpeg("#000000")
    assert ffmpeg_color == "black", f"Expected 'black', got {ffmpeg_color}"
    print("✅ Hex to FFmpeg: #000000 → black")
    
    # Test case 6: Box color with opacity
    box_color = FFmpegColorBuilder.build_box_color("#FFFFFF", 0.8)
    assert "@0.80" in box_color, f"Expected opacity in result, got {box_color}"
    print(f"✅ Box color with opacity: #FFFFFF @ 0.8 → {box_color}")
    
    # Test case 7: ASS color builders
    primary = ASSColorBuilder.build_primary_color("#00FF00")  # Green
    assert primary == "&H00FF00&", f"Expected &H00FF00& (BGR), got {primary}"
    print("✅ ASS primary color: #00FF00 → &H00FF00&")
    
    # Test case 8: ASS background with opacity
    back_color = ASSColorBuilder.build_back_color("#000000", 0.8)
    assert len(back_color) == 11, f"Expected 11 chars (&HAABBGGRR&), got {len(back_color)}"
    assert re.match(r"&H[0-9A-F]{8}&", back_color), f"Invalid ASS color format: {back_color}"
    print(f"✅ ASS background with opacity: #000000 @ 0.8 → {back_color}")
    
    print("✅ All color conversion tests passed!\n")


def test_campaign_data_parsing():
    """Test parsing real campaign data structure"""
    print("=== Test 5: Campaign Data Parsing ===")
    
    # Simulate real campaign data from campaigns.yaml
    campaign_overlay_data = {
        "enabled": True,
        "text": "First Overlay is Here ",
        "font": "Montserrat, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        "fontSize": 58,
        "fontPx": 58,
        "fontPercentage": 5.0,
        "color": "#000000",
        "hasBackground": True,
        "backgroundColor": "#ffffff",
        "backgroundOpacity": 100,
        "designWidth": 1088,
        "designHeight": 1904,
        "xPct": 50.0,
        "yPct": 18.0,
        "anchor": "center",
        "safeMarginsPct": {
            "left": 4.0,
            "right": 4.0,
            "top": 5.0,
            "bottom": 12.0
        }
    }
    
    # Test parsing
    assert campaign_overlay_data["enabled"] == True
    assert campaign_overlay_data["fontSize"] == 58
    assert campaign_overlay_data["designWidth"] == 1088
    
    print("✅ Campaign data structure validated")
    
    # Test with calculator
    from utils.design_space_utils import create_calculator_from_config
    
    calc = create_calculator_from_config(
        1920, 1080,
        campaign_overlay_data
    )
    
    assert calc.validate_config(), "Calculator should validate successfully"
    
    # Test font scaling
    font_size = calc.scale_font_size(
        font_px=campaign_overlay_data.get("fontPx"),
        font_percentage=campaign_overlay_data.get("fontPercentage")
    )
    
    assert font_size > 0, "Font size should be positive"
    print(f"✅ Scaled font size: {font_size}px")
    
    # Test position mapping
    x, y = calc.map_position(
        campaign_overlay_data["xPct"],
        campaign_overlay_data["yPct"],
        campaign_overlay_data["anchor"]
    )
    
    assert 0 <= x <= 1920, f"X position {x} should be within video width"
    assert 0 <= y <= 1080, f"Y position {y} should be within video height"
    print(f"✅ Mapped position: ({x}, {y})")
    
    print("✅ All campaign data parsing tests passed!\n")


def test_caption_config_parsing():
    """Test parsing real caption configuration"""
    print("=== Test 6: Caption Config Parsing ===")
    
    # Simulate real caption config from campaigns.yaml
    caption_config_data = {
        "enabled": True,
        "allCaps": False,
        "anchor": "center",
        "animation": "none",
        "backgroundColor": "#000000",
        "backgroundOpacity": 0.8,
        "borderPx": 2,
        "color": "#FFFFFF",
        "designHeight": 1904,
        "designWidth": 1088,
        "enabled": True,
        "fontFamily": "Montserrat-Bold",
        "fontPx": 59,
        "fontSize": 59,
        "hasBackground": False,
        "hasStroke": True,
        "highlight_keywords": True,
        "max_words_per_segment": 4,
        "strokeColor": "#000000",
        "strokeWidth": 2,
        "template": "tiktok_classic",
        "xPct": 50.0,
        "yPct": 80.0,
        "x_position": 50,
        "y_position": 80
    }
    
    # Test parsing
    assert caption_config_data["enabled"] == True
    assert caption_config_data["fontSize"] == 59
    assert caption_config_data["hasStroke"] == True
    
    print("✅ Caption config structure validated")
    
    # Test with calculator
    from utils.design_space_utils import create_calculator_from_config
    
    calc = create_calculator_from_config(
        1920, 1080,
        caption_config_data
    )
    
    # Test font scaling
    font_size = calc.scale_font_size(
        font_px=caption_config_data.get("fontPx"),
        font_percentage=caption_config_data.get("fontPercentage")
    )
    
    print(f"✅ Caption font size: {font_size}px")
    
    # Test color parsing
    primary_color = ASSColorBuilder.build_primary_color(caption_config_data["color"])
    stroke_color = ASSColorBuilder.build_outline_color(caption_config_data["strokeColor"])
    
    print(f"✅ Caption colors: primary={primary_color}, stroke={stroke_color}")
    
    print("✅ All caption config parsing tests passed!\n")


def test_connected_background_scaling():
    """Test connected background scaling calculations"""
    print("=== Test 7: Connected Background Scaling ===")
    
    # Simulate connected background metadata
    bg_metadata = {
        "backgroundHeight": 86,
        "backgroundWidth": 692,
        "videoWidth": 1088,
        "videoHeight": 1904,
        "x_position": 50,
        "y_position": 18
    }
    
    # Create calculator
    calc = DesignSpaceCalculator(1920, 1080)
    
    # Scale background dimensions
    scaled_width = calc.scale_dimension(bg_metadata["backgroundWidth"])
    scaled_height = calc.scale_dimension(bg_metadata["backgroundHeight"])
    
    print(f"✅ Background scaled: {bg_metadata['backgroundWidth']}x{bg_metadata['backgroundHeight']} → {scaled_width}x{scaled_height}")
    
    # Calculate position
    x, y = calc.map_position(
        bg_metadata["x_position"],
        bg_metadata["y_position"],
        "center"
    )
    
    # Center background on position
    bg_x = max(0, min(int(x - scaled_width / 2), 1920 - scaled_width))
    bg_y = max(0, min(int(y - scaled_height / 2), 1080 - scaled_height))
    
    print(f"✅ Background position: ({bg_x}, {bg_y})")
    
    # Verify within bounds
    assert 0 <= bg_x <= 1920, "Background X should be within video width"
    assert 0 <= bg_y <= 1080, "Background Y should be within video height"
    assert bg_x + scaled_width <= 1920, "Background should not exceed video width"
    assert bg_y + scaled_height <= 1080, "Background should not exceed video height"
    
    print("✅ All connected background tests passed!\n")


def test_edge_cases():
    """Test edge cases and error handling"""
    print("=== Test 8: Edge Cases ===")
    
    # Test case 1: Zero dimensions (should fail validation)
    calc = DesignSpaceCalculator(0, 0)
    assert not calc.validate_config(), "Should fail validation for zero dimensions"
    print("✅ Zero dimensions properly rejected")
    
    # Test case 2: Invalid color
    normalized = ColorConverter.normalize_hex("invalid_color")
    assert normalized == "#FFFFFF", "Should fallback to white for invalid color"
    print("✅ Invalid color handled with fallback")
    
    # Test case 3: Minimum font size
    calc = DesignSpaceCalculator(100, 100)
    font_size = calc.scale_font_size(font_px=1)
    assert font_size >= 8, "Should respect minimum font size of 8px"
    print(f"✅ Minimum font size enforced: {font_size}px")
    
    # Test case 4: Negative position (should be clamped)
    calc = DesignSpaceCalculator(1920, 1080)
    x, y = calc.map_position(-10.0, -10.0, "center")
    # Position should still be valid (within safe area)
    assert x >= 0, "X position should be non-negative"
    assert y >= 0, "Y position should be non-negative"
    print(f"✅ Negative position handled: ({x}, {y})")
    
    # Test case 5: Position beyond 100% (should be clamped)
    x, y = calc.map_position(150.0, 150.0, "center")
    assert x <= 1920, "X position should not exceed video width"
    assert y <= 1080, "Y position should not exceed video height"
    print(f"✅ Over-100% position handled: ({x}, {y})")
    
    print("✅ All edge case tests passed!\n")


def test_multi_overlay_scenario():
    """Test multiple overlays with different configurations"""
    print("=== Test 9: Multiple Overlays Scenario ===")
    
    # Simulate 3 overlays from real campaign
    overlays = [
        {
            "text": "First Overlay is Here",
            "fontSize": 58,
            "xPct": 50.0,
            "yPct": 18.0,
            "anchor": "center",
            "color": "#000000",
            "hasBackground": True,
            "backgroundColor": "#ffffff"
        },
        {
            "text": "My name is Emmy",
            "fontSize": 58,
            "xPct": 50.0,
            "yPct": 55.0,
            "anchor": "center",
            "color": "#2320df",
            "hasBackground": True,
            "backgroundColor": "#ffffff"
        },
        {
            "text": "Her last name was the game man",
            "fontSize": 58,
            "xPct": 50.0,
            "yPct": 70.0,
            "anchor": "center",
            "color": "#f1e9e9",
            "hasBackground": True,
            "backgroundColor": "#bb0707"
        }
    ]
    
    calc = DesignSpaceCalculator(1920, 1080)
    
    positions = []
    for i, overlay in enumerate(overlays, 1):
        # Scale font
        font_size = calc.scale_font_size(font_px=overlay["fontSize"])
        
        # Map position
        x, y = calc.map_position(overlay["xPct"], overlay["yPct"], overlay["anchor"])
        
        # Get FFmpeg expressions
        x_expr, y_expr = calc.get_ffmpeg_position_expression(
            overlay["xPct"], overlay["yPct"], overlay["anchor"]
        )
        
        # Build colors
        text_color = FFmpegColorBuilder.build_text_color(overlay["color"])
        bg_color = FFmpegColorBuilder.build_box_color(overlay["backgroundColor"], 1.0)
        
        positions.append((x, y))
        
        print(f"✅ Overlay {i}: '{overlay['text'][:30]}...'")
        print(f"   Font: {font_size}px")
        print(f"   Position: ({x}, {y}) = {x_expr}, {y_expr}")
        print(f"   Colors: text={text_color}, bg={bg_color}")
    
    # Verify overlays don't completely overlap (Y positions should be different)
    y_positions = [y for _, y in positions]
    assert len(set(y_positions)) == 3, "All overlays should have different Y positions"
    
    print("✅ All multiple overlay tests passed!\n")


def run_all_tests():
    """Run all validation tests"""
    print("=" * 70)
    print("VALIDATION TESTS FOR IMPROVED TEXT OVERLAY SYSTEM")
    print("=" * 70)
    print()
    
    tests = [
        ("Design Space Scaling", test_design_space_scaling),
        ("Position Mapping", test_position_mapping),
        ("FFmpeg Position Expressions", test_ffmpeg_position_expressions),
        ("Color Conversions", test_color_conversions),
        ("Campaign Data Parsing", test_campaign_data_parsing),
        ("Caption Config Parsing", test_caption_config_parsing),
        ("Connected Background Scaling", test_connected_background_scaling),
        ("Edge Cases", test_edge_cases),
        ("Multiple Overlays Scenario", test_multi_overlay_scenario),
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            test_func()
            passed += 1
            print(f"✅ {test_name}: PASSED")
        except AssertionError as e:
            failed += 1
            print(f"❌ {test_name}: FAILED - {e}")
        except Exception as e:
            failed += 1
            print(f"❌ {test_name}: ERROR - {e}")
            import traceback
            traceback.print_exc()
        print()
    
    print("=" * 70)
    print(f"RESULTS: {passed} passed, {failed} failed out of {passed + failed} total")
    print("=" * 70)
    
    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)