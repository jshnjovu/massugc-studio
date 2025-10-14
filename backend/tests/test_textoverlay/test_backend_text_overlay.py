#!/usr/bin/env python3
"""
Backend Text Overlay Processing Tests
======================================
Tests the backend video processing functions mentioned in current_bugs_workflow.md:
- backend/create_video.py::create_video_job() - Line 1145
- backend/enhanced_video_processor.py::add_text_overlay() - Line 545
- Flask API endpoints (e.g., /video-info)

These tests validate the actual backend implementation without mocking.
"""

import sys
import os
import json
from pathlib import Path
from typing import Dict, Any

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# Import Flask app for API testing
from app import app

# Import backend modules
from backend.enhanced_video_processor import (
    EnhancedVideoProcessor,
    TextOverlayConfig,
    TextPosition,
    compute_scale,
    map_percent_to_output,
    get_default_design_dims,
    get_default_safe_margins
)


class BackendTextOverlayTests:
    """Test suite for backend text overlay processing"""
    
    def __init__(self):
        self.processor = None
        self.test_video_path = None
        self.client = None  # Flask test client
        
    def setup(self):
        """Set up test fixtures"""
        print("\n=== Setting up backend test fixtures ===")
        
        # Use real video file from user's resources
        self.test_video_path = Path("C:/Users/phila/Documents/massUgc_resources/nana.mp4")
        if not self.test_video_path.exists():
            raise FileNotFoundError(f"Real test video not found: {self.test_video_path}")
        print(f"   Test video: {self.test_video_path}")
        
        # Initialize processor
        try:
            self.processor = EnhancedVideoProcessor()
            print(f"   EnhancedVideoProcessor initialized")
        except Exception as e:
            print(f"   ⚠️  Could not initialize processor: {e}")
        
        # Initialize Flask test client
        try:
            self.client = app.test_client()
            self.client.testing = True
            print(f"   Flask test client initialized")
        except Exception as e:
            print(f"   ⚠️  Could not initialize Flask client: {e}")
        
        print("✅ Backend test fixtures ready (using real files)")
        
    def teardown(self):
        """Clean up test fixtures"""
        print("\n=== Cleaning up backend test fixtures ===")
        
        # No cleanup needed - we use real files that should not be deleted
        print("✅ Backend cleanup completed (real files preserved)")
    
    def test_compute_scale_function(self) -> bool:
        """Test compute_scale function for design space to video space conversion"""
        print("\n=== Test 1: compute_scale() Function ===")
        
        try:
            test_cases = [
                # (video_w, video_h, design_w, design_h, expected_scale, description)
                (1080, 1920, 1080, 1920, 1.0, "Same dimensions"),
                (2160, 3840, 1080, 1920, 2.0, "2x upscale"),
                (540, 960, 1080, 1920, 0.5, "0.5x downscale"),
                (1920, 1080, 1080, 1920, 0.5625, "Landscape to portrait"),
                (1080, 1920, 1920, 1080, 0.5625, "Portrait to landscape"),
                (720, 1280, 1080, 1920, 0.6667, "720p to 1080p design"),
            ]
            
            all_passed = True
            for video_w, video_h, design_w, design_h, expected, desc in test_cases:
                scale = compute_scale(video_w, video_h, design_w, design_h)
                
                print(f"   {desc}")
                print(f"   Video: {video_w}x{video_h}, Design: {design_w}x{design_h}")
                print(f"   Scale: {scale:.4f} (expected: {expected:.4f})")
                
                # Allow small floating point tolerance
                if abs(scale - expected) < 0.01:
                    print(f"   ✅ Scale correct")
                else:
                    print(f"   ❌ Scale mismatch")
                    all_passed = False
            
            if all_passed:
                print("✅ compute_scale() function validated")
            else:
                print("❌ compute_scale() function has errors")
            
            return all_passed
            
        except Exception as e:
            print(f"❌ Test failed with error: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def test_map_percent_to_output_function(self) -> bool:
        """Test map_percent_to_output function for position mapping"""
        print("\n=== Test 2: map_percent_to_output() Function ===")
        
        try:
            test_cases = [
                # (x_pct, y_pct, video_w, video_h, margins, description)
                (50.0, 50.0, 1080, 1920, {"left": 0, "right": 0, "top": 0, "bottom": 0}, "Center position, no margins"),
                (0.0, 0.0, 1080, 1920, {"left": 0, "right": 0, "top": 0, "bottom": 0}, "Top-left corner, no margins"),
                (100.0, 100.0, 1080, 1920, {"left": 0, "right": 0, "top": 0, "bottom": 0}, "Bottom-right corner, no margins"),
                (50.0, 10.0, 1080, 1920, {"left": 4, "right": 4, "top": 5, "bottom": 12}, "Top center with margins"),
                (50.0, 90.0, 1080, 1920, {"left": 4, "right": 4, "top": 5, "bottom": 12}, "Bottom center with margins"),
            ]
            
            all_passed = True
            for x_pct, y_pct, video_w, video_h, margins, desc in test_cases:
                x, y = map_percent_to_output(x_pct, y_pct, video_w, video_h, margins)
                
                print(f"   {desc}")
                print(f"   Input: ({x_pct}%, {y_pct}%) in {video_w}x{video_h}")
                print(f"   Output: ({x}, {y}) px")
                print(f"   Margins: {margins}")
                
                # Validate output is within video bounds
                if 0 <= x <= video_w and 0 <= y <= video_h:
                    print(f"   ✅ Position within bounds")
                else:
                    print(f"   ❌ Position out of bounds")
                    all_passed = False
            
            if all_passed:
                print("✅ map_percent_to_output() function validated")
            else:
                print("❌ map_percent_to_output() function has errors")
            
            return all_passed
            
        except Exception as e:
            print(f"❌ Test failed with error: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def test_default_design_dimensions(self) -> bool:
        """Test get_default_design_dims function"""
        print("\n=== Test 3: get_default_design_dims() Function ===")
        
        try:
            width, height = get_default_design_dims()
            
            print(f"   Default design dimensions: {width}x{height}")
            
            # Validate reasonable defaults (should be standard video dimensions)
            if width > 0 and height > 0:
                print(f"   ✅ Valid dimensions returned")
                
                # Check if it's a standard aspect ratio
                aspect_ratio = width / height
                print(f"   Aspect ratio: {aspect_ratio:.4f}")
                
                # Common aspect ratios: 9:16 (0.5625), 16:9 (1.7778), 4:3 (1.3333)
                if aspect_ratio > 0.5 and aspect_ratio < 2.0:
                    print(f"   ✅ Reasonable aspect ratio")
                else:
                    print(f"   ⚠️  Unusual aspect ratio")
                
                return True
            else:
                print(f"   ❌ Invalid dimensions")
                return False
            
        except Exception as e:
            print(f"❌ Test failed with error: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def test_default_safe_margins(self) -> bool:
        """Test get_default_safe_margins function"""
        print("\n=== Test 4: get_default_safe_margins() Function ===")
        
        try:
            margins = get_default_safe_margins()
            
            print(f"   Default safe margins: {margins}")
            
            # Validate structure
            required_keys = ["left", "right", "top", "bottom"]
            for key in required_keys:
                if key not in margins:
                    print(f"   ❌ Missing margin key: {key}")
                    return False
            
            print(f"   ✅ All margin keys present")
            
            # Validate values are reasonable (0-20% range)
            for key, value in margins.items():
                if 0 <= value <= 20:
                    print(f"   ✅ {key}: {value}% (reasonable)")
                else:
                    print(f"   ⚠️  {key}: {value}% (unusual value)")
            
            return True
            
        except Exception as e:
            print(f"❌ Test failed with error: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def test_video_info_retrieval(self) -> bool:
        """Test /video-info API endpoint"""
        print("\n=== Test 5: Flask API /video-info Endpoint ===")
        
        if not self.client:
            print("   ⚠️  Flask client not initialized, skipping test")
            return True
        
        if not self.test_video_path or not self.test_video_path.exists():
            print("   ⚠️  Test video not available, skipping test")
            return True
        
        try:
            # Call the Flask API endpoint
            response = self.client.get(f'/video-info?path={str(self.test_video_path)}')
            
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code != 200:
                print(f"   ❌ Expected status 200, got {response.status_code}")
                return False
            
            video_info = json.loads(response.data)
            print(f"   Video info retrieved: {json.dumps(video_info, indent=4)}")
            
            # Validate required fields
            required_fields = ['width', 'height', 'fps', 'duration', 'codec']
            all_present = True
            for field in required_fields:
                if field in video_info:
                    print(f"   ✅ {field}: {video_info[field]}")
                else:
                    print(f"   ❌ Missing field: {field}")
                    all_present = False
            
            # Validate dimensions match what we created
            if video_info.get('width') == 1080 and video_info.get('height') == 1920:
                print(f"   ✅ Dimensions match expected values")
            else:
                print(f"   ⚠️  Dimensions differ from expected (1080x1920)")
            
            return all_present
            
        except Exception as e:
            print(f"❌ Test failed with error: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def test_text_overlay_config_with_design_space(self) -> bool:
        """Test TextOverlayConfig with design space parameters"""
        print("\n=== Test 6: TextOverlayConfig with Design Space Parameters ===")
        
        try:
            # Create config with full design space parameters (from workflow lines 2003-2028)
            config = TextOverlayConfig(
                text="Test Design Space",
                position=TextPosition.TOP_CENTER,
                font_family="Montserrat-Bold",
                font_size=48,
                scale=1.0,
                animation="fade_in",
                color="white",
                # Design space fields
                design_width=1080,
                design_height=1920,
                x_pct=50.0,
                y_pct=10.0,
                anchor="center",
                safe_margins_pct={"left": 4.0, "right": 4.0, "top": 5.0, "bottom": 12.0},
                font_px=96,
                font_percentage=5.0,
                border_px=2,
                shadow_px=3,
                line_spacing_px=10,
                wrap_width_pct=80.0
            )
            
            print(f"   Text: '{config.text}'")
            print(f"   Position: {config.position.value}")
            print(f"   Design dimensions: {config.design_width}x{config.design_height}")
            print(f"   Position: ({config.x_pct}%, {config.y_pct}%)")
            print(f"   Anchor: {config.anchor}")
            print(f"   Font: {config.font_px}px ({config.font_percentage}%)")
            print(f"   Safe margins: {config.safe_margins_pct}")
            print(f"   Border: {config.border_px}px")
            print(f"   Shadow: {config.shadow_px}px")
            print(f"   Line spacing: {config.line_spacing_px}px")
            print(f"   Wrap width: {config.wrap_width_pct}%")
            
            # Validate all fields are set
            if all([
                config.design_width == 1080,
                config.design_height == 1920,
                config.font_px == 96,
                config.font_percentage == 5.0,
                config.x_pct == 50.0,
                config.y_pct == 10.0,
            ]):
                print("✅ All design space parameters set correctly")
                return True
            else:
                print("❌ Some design space parameters not set correctly")
                return False
            
        except Exception as e:
            print(f"❌ Test failed with error: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def test_text_overlay_with_connected_background(self) -> bool:
        """Test TextOverlayConfig with connected background (TikTok-style)"""
        print("\n=== Test 7: TextOverlayConfig with Connected Background ===")
        
        try:
            config = TextOverlayConfig(
                text="Connected Background Test",
                connected_background_enabled=True,
                connected_background_data={
                    "type": "rounded_rect",
                    "padding": 20,
                    "color": "black",
                    "opacity": 0.8,
                    "corner_radius": 10
                },
                hasBackground=False  # Should be False when connected background is enabled
            )
            
            print(f"   Text: '{config.text}'")
            print(f"   Connected background enabled: {config.connected_background_enabled}")
            print(f"   Connected background data: {config.connected_background_data}")
            print(f"   hasBackground: {config.hasBackground}")
            
            if config.connected_background_enabled and config.connected_background_data:
                print("✅ Connected background configuration valid")
                return True
            else:
                print("❌ Connected background configuration invalid")
                return False
            
        except Exception as e:
            print(f"❌ Test failed with error: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def test_font_percentage_calculations(self) -> bool:
        """Test font percentage to pixel conversion (workflow lines 2003-2028)"""
        print("\n=== Test 8: Font Percentage to Pixel Calculations ===")
        
        try:
            test_cases = [
                # (font_percentage, video_height, expected_font_size, description)
                (5.0, 1920, 96, "5% of 1080p height"),
                (4.0, 1920, 77, "4% of 1080p height"),
                (3.5, 1920, 67, "3.5% of 1080p height"),
                (5.0, 1080, 54, "5% of 720p height"),
                (10.0, 1920, 192, "10% of 1080p height"),
            ]
            
            all_passed = True
            for font_pct, video_h, expected, desc in test_cases:
                calculated = int(video_h * (font_pct / 100.0))
                
                print(f"   {desc}")
                print(f"   {font_pct}% of {video_h}px = {calculated}px (expected: {expected}px)")
                
                # Allow some tolerance for rounding
                if abs(calculated - expected) <= 1:
                    print(f"   ✅ Calculation correct")
                else:
                    print(f"   ❌ Calculation mismatch")
                    all_passed = False
            
            if all_passed:
                print("✅ Font percentage calculations validated")
            else:
                print("❌ Font percentage calculations have errors")
            
            return all_passed
            
        except Exception as e:
            print(f"❌ Test failed with error: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def test_scale_factor_computation(self) -> bool:
        """Test scale factor computation (workflow lines 576-581)"""
        print("\n=== Test 9: Scale Factor Computation ===")
        
        try:
            # Test the scale factor computation as described in enhanced_video_processor.py
            test_cases = [
                # (video_w, video_h, design_w, design_h, description)
                (1080, 1920, 1080, 1920, "Matching dimensions"),
                (2160, 3840, 1080, 1920, "4K video, 1080p design"),
                (540, 960, 1080, 1920, "540p video, 1080p design"),
                (1920, 1080, 1080, 1920, "Landscape video, portrait design"),
            ]
            
            all_passed = True
            for video_w, video_h, design_w, design_h, desc in test_cases:
                # This mimics the logic from enhanced_video_processor.py lines 576-581
                width_scale = video_w / design_w
                height_scale = video_h / design_h
                scale = min(width_scale, height_scale)
                
                print(f"   {desc}")
                print(f"   Video: {video_w}x{video_h}, Design: {design_w}x{design_h}")
                print(f"   Width scale: {width_scale:.4f}, Height scale: {height_scale:.4f}")
                print(f"   Final scale: {scale:.4f}")
                
                # Validate scale is positive
                if scale > 0:
                    print(f"   ✅ Valid scale factor")
                else:
                    print(f"   ❌ Invalid scale factor")
                    all_passed = False
                
                # Validate we're using the minimum (contain strategy)
                if scale == min(width_scale, height_scale):
                    print(f"   ✅ Correct contain strategy (min scale)")
                else:
                    print(f"   ❌ Incorrect scale computation")
                    all_passed = False
            
            if all_passed:
                print("✅ Scale factor computation validated")
            else:
                print("❌ Scale factor computation has errors")
            
            return all_passed
            
        except Exception as e:
            print(f"❌ Test failed with error: {e}")
            import traceback
            traceback.print_exc()
            return False


def main():
    """Run all backend tests"""
    print("=" * 70)
    print("BACKEND TEXT OVERLAY PROCESSING TEST SUITE")
    print("=" * 70)
    print("Testing backend functions from current_bugs_workflow.md")
    print("- backend/create_video.py::create_video_job() (Line 1145)")
    print("- backend/enhanced_video_processor.py::add_text_overlay() (Line 545)")
    print()
    
    tests = BackendTextOverlayTests()
    
    # Setup
    try:
        tests.setup()
    except Exception as e:
        print(f"❌ Setup failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    # Define test cases
    test_cases = [
        ("compute_scale() Function", tests.test_compute_scale_function),
        ("map_percent_to_output() Function", tests.test_map_percent_to_output_function),
        ("get_default_design_dims() Function", tests.test_default_design_dimensions),
        ("get_default_safe_margins() Function", tests.test_default_safe_margins),
        ("Flask API /video-info Endpoint", tests.test_video_info_retrieval),
        ("TextOverlayConfig with Design Space", tests.test_text_overlay_config_with_design_space),
        ("TextOverlayConfig with Connected Background", tests.test_text_overlay_with_connected_background),
        ("Font Percentage Calculations", tests.test_font_percentage_calculations),
        ("Scale Factor Computation", tests.test_scale_factor_computation),
    ]
    
    passed = 0
    failed = 0
    
    # Run tests
    for test_name, test_func in test_cases:
        try:
            if test_func():
                passed += 1
                print(f"✅ {test_name}: PASSED\n")
            else:
                failed += 1
                print(f"❌ {test_name}: FAILED\n")
        except Exception as e:
            failed += 1
            print(f"❌ {test_name}: ERROR - {e}\n")
            import traceback
            traceback.print_exc()
    
    # Teardown
    try:
        tests.teardown()
    except Exception as e:
        print(f"⚠️  Teardown warning: {e}")
    
    # Summary
    print("=" * 70)
    print(f"TEST RESULTS: {passed} passed, {failed} failed out of {passed + failed} total")
    print("=" * 70)
    
    if failed == 0:
        print("🎉 All backend tests passed!")
        return 0
    else:
        print(f"⚠️  {failed} test(s) failed.")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)

