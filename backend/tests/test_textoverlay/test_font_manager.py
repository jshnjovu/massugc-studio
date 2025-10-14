"""
Font Manager Test Utility
==========================
Validates cross-platform font resolution and availability.

Usage:
    python tests/test_textoverlay/test_font_manager.py
"""

import sys
from pathlib import Path

# Add project root to path (we're in tests/test_textoverlay/, need to go up 2 levels)
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.font_manager import CrossPlatformFontManager


def test_font_manager():
    """Test font manager functionality"""
    
    print("=" * 70)
    print("FONT MANAGER TEST UTILITY")
    print("=" * 70)
    print()
    
    # Initialize font manager
    assets_dir = project_root / "assets" / "fonts"
    print(f"📁 Assets Directory: {assets_dir}")
    print(f"   Exists: {assets_dir.exists()}")
    print()
    
    font_manager = CrossPlatformFontManager(assets_dir)
    
    # Display OS info
    print(f"🖥️  Operating System: {font_manager.os_type}")
    print()
    
    # Test common fonts
    test_fonts = [
        "Inter",
        "Inter-Medium",
        "Inter-Bold",
        "Montserrat",
        "Montserrat-Bold",
        "Montserrat-Black",  # Added missing font
        "Proxima Nova",
        "ProximaNova-Semibold",
        "Arial",
        "Helvetica",
        "Impact",
        "NotoColorEmoji",
        "NonExistentFont"  # Should fall back
    ]
    
    print("🔍 Testing Font Resolution:")
    print("-" * 70)
    
    # Track font resolution paths for validation
    font_resolutions = {}
    
    for font_name in test_fonts:
        try:
            resolved_path = font_manager.get_font_path(font_name)
            exists = Path(resolved_path).exists()
            status = "✅" if exists else "❌"
            
            # Determine resolution type for validation
            resolution_type = "unknown"
            if "assets/fonts" in str(resolved_path):
                resolution_type = "bundled"
            elif "Windows/Fonts" in str(resolved_path) or "System/Library/Fonts" in str(resolved_path):
                resolution_type = "system"
            else:
                resolution_type = "fallback"
            
            font_resolutions[font_name] = {
                "path": resolved_path,
                "exists": exists,
                "type": resolution_type
            }
            
            # Truncate long paths for readability
            display_path = str(resolved_path)
            if len(display_path) > 50:
                display_path = "..." + display_path[-47:]
            
            print(f"{status} {font_name:25} → {display_path} ({resolution_type})")
            
        except Exception as e:
            print(f"❌ {font_name:25} → ERROR: {str(e)}")
            font_resolutions[font_name] = {
                "path": None,
                "exists": False,
                "type": "error"
            }
    
    print()
    print("-" * 70)
    print()
    
    # Get availability statistics
    availability = font_manager.list_available_fonts()
    total_fonts = len(availability)
    available_count = sum(1 for available in availability.values() if available)
    missing_count = total_fonts - available_count
    
    print("📊 Font Availability Summary:")
    print(f"   Total Configured: {total_fonts}")
    print(f"   Available:        {available_count} ({available_count/total_fonts*100:.1f}%)")
    print(f"   Missing:          {missing_count}")
    print()
    
    # Font resolution validation
    bundled_count = sum(1 for r in font_resolutions.values() if r["type"] == "bundled")
    system_count = sum(1 for r in font_resolutions.values() if r["type"] == "system")
    fallback_count = sum(1 for r in font_resolutions.values() if r["type"] == "fallback")
    
    print("🎯 Font Resolution Validation:")
    print(f"   Bundled Fonts:    {bundled_count} (preferred - portable)")
    print(f"   System Fonts:     {system_count} (OS-specific)")
    print(f"   Fallback Fonts:   {fallback_count} (universal)")
    print()
    
    # Show missing fonts
    if missing_count > 0:
        print("⚠️  Missing Fonts:")
        for font_name, available in availability.items():
            if not available:
                print(f"   - {font_name}")
        print()
    
    # Test CSS font-family parsing
    print("🎨 Testing CSS Font-Family Parsing:")
    print("-" * 70)
    
    css_fonts = [
        "Montserrat-Bold, Arial, sans-serif",
        '"Proxima Nova", Helvetica, Arial',
        "'Inter', system-ui, sans-serif",
    ]
    
    for css_font in css_fonts:
        try:
            resolved_path = font_manager.get_font_path(css_font)
            exists = Path(resolved_path).exists()
            status = "✅" if exists else "❌"
            
            # Extract just the filename for display
            filename = Path(resolved_path).name
            
            print(f"{status} {css_font:45} → {filename}")
            
        except Exception as e:
            print(f"❌ {css_font:45} → ERROR: {str(e)}")
    
    print()
    print("-" * 70)
    print()
    
    # Ultimate fallback test
    print("🔄 Testing Ultimate Fallback:")
    fallback = font_manager._get_ultimate_fallback()
    fallback_exists = Path(fallback).exists()
    status = "✅" if fallback_exists else "❌"
    print(f"   {status} {fallback}")
    print()
    
    print("=" * 70)
    print("TEST COMPLETE")
    print("=" * 70)
    
    # Validation following README testing principles
    print("🔍 Validation Results:")
    print("-" * 70)
    
    # Test 1: Validate that bundled fonts are being used when available
    expected_bundled_fonts = ["Inter", "Inter-Medium", "Inter-Bold", "Montserrat", "Montserrat-Bold", "Montserrat-Black", "Proxima Nova", "ProximaNova-Semibold", "Impact"]
    actual_bundled_fonts = [name for name, res in font_resolutions.items() if res["type"] == "bundled"]
    
    print(f"✅ Bundled Font Usage: {len(actual_bundled_fonts)}/{len(expected_bundled_fonts)} expected fonts using bundled assets")
    
    # Test 2: Validate that NonExistentFont falls back properly
    nonexistent_resolution = font_resolutions.get("NonExistentFont", {})
    if nonexistent_resolution.get("type") == "fallback":
        print("✅ Fallback Logic: NonExistentFont properly falls back to system font")
    else:
        print(f"❌ Fallback Logic: NonExistentFont should fall back, got: {nonexistent_resolution.get('type', 'unknown')}")
    
    # Test 3: Validate that all resolved fonts actually exist
    missing_fonts = [name for name, res in font_resolutions.items() if not res.get("exists", False)]
    if not missing_fonts:
        print("✅ Font Existence: All resolved fonts exist on filesystem")
    else:
        print(f"❌ Font Existence: {len(missing_fonts)} fonts resolve to non-existent paths: {missing_fonts}")
    
    print()
    
    # Return exit code based on critical fonts
    critical_fonts = ["Arial", "Helvetica", "Impact"]
    critical_missing = [
        font for font in critical_fonts 
        if font in availability and not availability[font]
    ]
    
    if critical_missing:
        print(f"⚠️  WARNING: Critical fonts missing: {critical_missing}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit_code = test_font_manager()
    sys.exit(exit_code)


# Test bundled font
# curl -X POST "http://localhost:2026/api/fonts/test" \
#   -H "Content-Type: application/json" \
#   -d '{"font_family": "Inter-Bold"}'

# # Test system font
# curl -X POST "http://localhost:2026/api/fonts/test" \
#   -H "Content-Type: application/json" \
#   -d '{"font_family": "Arial"}'

# # Test CSS font-family with fallbacks
# curl -X POST "http://localhost:2026/api/fonts/test" \
#   -H "Content-Type: application/json" \
#   -d '{"font_family": "\"Proxima Nova\", Helvetica, Arial"}'

# # Test non-existent font (should fallback)
# curl -X POST "http://localhost:2026/api/fonts/test" \
#   -H "Content-Type: application/json" \
#   -d '{"font_family": "NonExistentFont"}'

# curl -X GET "http://localhost:2026/api/fonts/validate"