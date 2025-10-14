#!/usr/bin/env python3
"""
Test script to verify color conversion for caption backgrounds
"""

import sys
import os

# Add the project root to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from utils.color_utils import ColorConverter, ASSColorBuilder

def test_color_conversion():
    """Test the specific color conversion that's failing"""
    
    test_color = "#ce1c1c"  # Red color from the campaign
    test_opacity = 0.7
    
    print(f"=== Testing Color Conversion for {test_color} ===")
    
    # Test normalization
    normalized = ColorConverter.normalize_hex(test_color)
    print(f"1. Normalized: {test_color} → {normalized}")
    
    # Test RGB conversion
    r, g, b = ColorConverter.hex_to_rgb(test_color)
    print(f"2. RGB: {test_color} → ({r}, {g}, {b})")
    
    # Test ASS conversion (BGR format)
    ass_bgr = ColorConverter.hex_to_ass(test_color)
    print(f"3. ASS BGR: {test_color} → {ass_bgr}")
    
    # Test opacity addition
    ass_with_alpha = ColorConverter.add_opacity_to_ass(ass_bgr, test_opacity)
    print(f"4. ASS with opacity: {ass_bgr} @ {test_opacity} → {ass_with_alpha}")
    
    # Test full background color builder
    final_color = ASSColorBuilder.build_back_color(test_color, test_opacity)
    print(f"5. Final ASS Background: {test_color} @ {test_opacity} → {final_color}")
    
    print("\n=== Expected Results ===")
    print(f"RGB: Red=206, Green=28, Blue=28")
    print(f"BGR (ASS): Should be 1C1CCE (Blue=1C, Green=1C, Red=CE)")
    print(f"With 70% opacity: Alpha should be ~4C (76 in decimal, which is (1.0-0.7)*255)")
    print(f"Final format: &H4C1C1CCE&")
    
    # Verify calculations
    expected_alpha = int((1.0 - test_opacity) * 255)
    print(f"\nAlpha verification: (1.0 - {test_opacity}) * 255 = {expected_alpha} = 0x{expected_alpha:02X}")

if __name__ == "__main__":
    test_color_conversion()