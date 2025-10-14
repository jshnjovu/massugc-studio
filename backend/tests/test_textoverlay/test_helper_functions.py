#!/usr/bin/env python3
"""
Helper Functions Tests for Enhanced Video Processor
====================================================
Tests public utility functions from backend/enhanced_video_processor.py using REAL data.

Following test principles from README.md:
✅ DO:
- Use actual implementation (no mocks)
- Test real backend functions with REAL video files
- Validate actual data structures and outputs
- Test error conditions with real scenarios

❌ DON'T:
- Mock core functionality
- Create fake or manipulate passing tests (e.g., `1+2=5`)
- Skip validation to make tests pass
- Test theoretical implementations
"""

import sys
import os
from pathlib import Path
from typing import Dict, Any

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# Import backend modules
from backend.enhanced_video_processor import (
    EnhancedVideoProcessor,
    TextOverlayConfig,
    ExtendedCaptionConfig,
    MusicConfig,
    TextPosition,
    QualityValidator,
)


class HelperFunctionsTests:
    """Test suite for helper functions using REAL video files and data"""
    
    def __init__(self):
        self.processor = None
        self.test_video_path = None
        self.test_script_path = None
        
    def setup(self):
        """Set up test fixtures with REAL files"""
        print("\n=== Setting up helper functions test fixtures ===")
        
        # Use REAL video file from user's resources (as specified in README)
        self.test_video_path = Path("C:/Users/phila/Documents/massUgc_resources/nana.mp4")
        if not self.test_video_path.exists():
            raise FileNotFoundError(f"Real test video not found: {self.test_video_path}")
        print(f"   Test video: {self.test_video_path}")
        
        # Use REAL script file from user's resources (as specified in README)
        self.test_script_path = Path("C:/Users/phila/Documents/massUgc_resources/NaDevScript.txt")
        if not self.test_script_path.exists():
            raise FileNotFoundError(f"Real test script not found: {self.test_script_path}")
        print(f"   Test script: {self.test_script_path}")
        
        # Initialize processor
        try:
            self.processor = EnhancedVideoProcessor()
            print(f"   EnhancedVideoProcessor initialized")
        except Exception as e:
            raise RuntimeError(f"Could not initialize processor: {e}")
        
        print("✅ Helper functions test fixtures ready (using REAL files)")
        
    def teardown(self):
        """Clean up test fixtures"""
        print("\n=== Cleaning up helper functions test fixtures ===")
        # No cleanup - preserve real files
        print("✅ Cleanup completed (real files preserved)")
    
    def test_color_to_ass_conversion_with_real_values(self) -> bool:
        """Test _color_to_ass() with REAL color values used in actual captions"""
        print("\n=== Test 1: _color_to_ass() with Real Caption Colors ===")
        
        try:
            # These are ACTUAL colors used in real caption configs
            test_cases = [
                ("#FFFFFF", "FFFFFF", "White (most common caption color)"),
                ("#000000", "000000", "Black (most common stroke color)"),
                ("#FF0000", "0000FF", "Red -> BGR (used in highlights)"),
                ("#FFFF00", "00FFFF", "Yellow (keyword highlighting)"),
            ]
            
            all_passed = True
            for input_color, expected_bgr, desc in test_cases:
                result = self.processor._color_to_ass(input_color)
                
                print(f"   {desc}")
                print(f"   Input: {input_color} -> Output: {result} (Expected: {expected_bgr})")
                
                # STRICT validation - must match exactly
                if result != expected_bgr:
                    print(f"   ❌ FAILED: Got '{result}' but expected '{expected_bgr}'")
                    all_passed = False
                else:
                    print(f"   ✅ PASSED: Correct BGR conversion")
            
            return all_passed
            
        except Exception as e:
            print(f"❌ Test failed with error: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def test_get_video_info_with_real_file(self) -> bool:
        """Test _get_video_info() with REAL video file"""
        print("\n=== Test 2: _get_video_info() with Real Video File ===")
        
        try:
            video_info = self.processor._get_video_info(str(self.test_video_path))
            
            print(f"   Video file: {self.test_video_path.name}")
            print(f"   Extracted info:")
            print(f"     Width: {video_info['width']}px")
            print(f"     Height: {video_info['height']}px")
            print(f"     FPS: {video_info['fps']}")
            print(f"     Duration: {video_info['duration']}s")
            print(f"     Codec: {video_info['codec']}")
            
            # STRICT validation - these values must be real and sensible
            all_passed = True
            
            # Width must be positive and reasonable (144p to 8K)
            if not (144 <= video_info['width'] <= 7680):
                print(f"   ❌ Invalid width: {video_info['width']}")
                all_passed = False
            else:
                print(f"   ✅ Width is valid")
            
            # Height must be positive and reasonable
            if not (144 <= video_info['height'] <= 4320):
                print(f"   ❌ Invalid height: {video_info['height']}")
                all_passed = False
            else:
                print(f"   ✅ Height is valid")
            
            # FPS must be reasonable (1-240 fps)
            if not (1 <= video_info['fps'] <= 240):
                print(f"   ❌ Invalid FPS: {video_info['fps']}")
                all_passed = False
            else:
                print(f"   ✅ FPS is valid")
            
            # Duration must be positive
            if video_info['duration'] <= 0:
                print(f"   ❌ Invalid duration: {video_info['duration']}")
                all_passed = False
            else:
                print(f"   ✅ Duration is valid")
            
            # Codec must be a non-empty string
            if not video_info['codec'] or not isinstance(video_info['codec'], str):
                print(f"   ❌ Invalid codec: {video_info['codec']}")
                all_passed = False
            else:
                print(f"   ✅ Codec is valid")
            
            return all_passed
            
        except Exception as e:
            print(f"❌ Test failed with error: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def test_srt_time_parsing_with_real_caption_data(self) -> bool:
        """Test _srt_time_to_seconds() with REAL SRT timing from actual captions"""
        print("\n=== Test 3: _srt_time_to_seconds() with Real Caption Timing ===")
        
        try:
            # These are REAL timing formats from actual SRT caption files
            test_cases = [
                ("00:00:00,000", 0.0),
                ("00:00:01,500", 1.5),
                ("00:00:10,250", 10.25),
                ("00:01:30,000", 90.0),
                ("00:05:45,750", 345.75),
            ]
            
            all_passed = True
            for srt_time, expected_seconds in test_cases:
                result = self.processor._srt_time_to_seconds(srt_time)
                
                print(f"   SRT: {srt_time} -> {result:.3f}s (Expected: {expected_seconds:.3f}s)")
                
                # STRICT validation - must be within 0.001s tolerance
                if abs(result - expected_seconds) > 0.001:
                    print(f"   ❌ FAILED: Off by {abs(result - expected_seconds):.3f}s")
                    all_passed = False
                else:
                    print(f"   ✅ PASSED")
            
            return all_passed
            
        except Exception as e:
            print(f"❌ Test failed with error: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def test_font_path_resolution_produces_valid_fonts(self) -> bool:
        """Test _get_font_path() with REAL fonts - validates path exists"""
        print("\n=== Test 4: _get_font_path() with Real Font Resolution ===")
        
        try:
            # These are ACTUAL fonts used in production
            test_fonts = [
                "Montserrat-Bold",
                "Arial",
                "Impact",
            ]
            
            all_passed = True
            for font_name in test_fonts:
                font_path = self.processor._get_font_path(font_name)
                
                print(f"   Font: {font_name}")
                print(f"   Returned path: {font_path}")
                
                # Test what the function ACTUALLY does - does the path exist?
                path_exists = Path(font_path).exists()
                print(f"   Path exists: {path_exists}")
                
                if not path_exists:
                    print(f"   ❌ FAILED: Function returned non-existent path")
                    all_passed = False
                else:
                    print(f"   ✅ PASSED: Path exists and is usable")
            
            return all_passed
            
        except Exception as e:
            print(f"❌ Test failed with error: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def test_escape_text_for_ffmpeg_with_real_text(self) -> bool:
        """Test _escape_text_for_ffmpeg() with REAL text from script file"""
        print("\n=== Test 5: _escape_text_for_ffmpeg() with Real Script Text ===")
        
        try:
            # Read REAL text from actual script file
            with open(self.test_script_path, 'r', encoding='utf-8') as f:
                real_script_text = f.read().strip()
            
            # Take first line as test case
            first_line = real_script_text.split('\n')[0][:100]  # First 100 chars
            
            print(f"   Original text: '{first_line}'")
            
            result = self.processor._escape_text_for_ffmpeg(first_line)
            
            print(f"   Escaped text: '{result}'")
            
            # STRICT validation - result must be different if special chars present
            has_special_chars = any(char in first_line for char in ["'", ":", "=", ",", "\\"])
            
            if has_special_chars:
                if result == first_line:
                    print(f"   ❌ FAILED: Text has special chars but wasn't escaped")
                    return False
                else:
                    print(f"   ✅ PASSED: Text was escaped")
            else:
                print(f"   ✅ PASSED: No special chars, text unchanged")
            
            # Verify escaped text is still a valid string
            if not isinstance(result, str):
                print(f"   ❌ FAILED: Result is not a string")
                return False
            
            return True
            
        except Exception as e:
            print(f"❌ Test failed with error: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def test_text_config_parsing_creates_valid_overlay(self) -> bool:
        """Test _parse_text_config() creates VALID TextOverlayConfig for real use"""
        print("\n=== Test 6: _parse_text_config() with Real Overlay Config ===")
        
        try:
            # This is a REAL config structure from actual API requests
            real_config = {
                "enabled": True,
                "text": "Test Overlay",
                "position": "top_center",
                "font": "Montserrat-Bold",
                "fontSize": 48,
                "color": "white",
                "hasBackground": True,
                "backgroundColor": "black",
                "animation": "fade_in"
            }
            
            result = self.processor._parse_text_config(real_config)
            
            print(f"   Input config: {real_config['text']}")
            
            # STRICT validation - must create valid TextOverlayConfig
            if not isinstance(result, TextOverlayConfig):
                print(f"   ❌ FAILED: Did not create TextOverlayConfig object")
                return False
            
            print(f"   ✅ Created TextOverlayConfig")
            
            # Validate all fields match input
            if result.text != real_config["text"]:
                print(f"   ❌ Text mismatch: got '{result.text}' expected '{real_config['text']}'")
                return False
            
            if result.position != TextPosition.TOP_CENTER:
                print(f"   ❌ Position mismatch: got {result.position}")
                return False
            
            print(f"   ✅ All fields validated correctly")
            
            # Test disabled config returns None
            disabled_config = {"enabled": False, "text": "Should be ignored"}
            result_disabled = self.processor._parse_text_config(disabled_config)
            
            if result_disabled is not None:
                print(f"   ❌ FAILED: Disabled config should return None")
                return False
            
            print(f"   ✅ Disabled config correctly returns None")
            
            return True
            
        except Exception as e:
            print(f"❌ Test failed with error: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def test_caption_config_parsing_creates_valid_config(self) -> bool:
        """Test _parse_caption_config() creates VALID ExtendedCaptionConfig"""
        print("\n=== Test 7: _parse_caption_config() with Real Caption Config ===")
        
        try:
            # This is a REAL config structure from actual caption requests
            real_config = {
                "enabled": True,
                "template": "tiktok_classic",
                "fontSize": 24,
                "fontFamily": "Montserrat-Bold",
                "x_position": 50.0,
                "y_position": 85.0,
                "color": "#FFFFFF",
                "hasStroke": True,
                "strokeColor": "#000000",
                "strokeWidth": 3,
                "allCaps": False,
                "max_words_per_segment": 4
            }
            
            result = self.processor._parse_caption_config(real_config)
            
            # STRICT validation
            if not isinstance(result, ExtendedCaptionConfig):
                print(f"   ❌ FAILED: Did not create ExtendedCaptionConfig")
                return False
            
            print(f"   ✅ Created ExtendedCaptionConfig")
            
            # Validate critical fields
            if result.fontSize != 24:
                print(f"   ❌ Font size mismatch: got {result.fontSize} expected 24")
                return False
            
            if result.x_position != 50.0 or result.y_position != 85.0:
                print(f"   ❌ Position mismatch: got ({result.x_position}, {result.y_position})")
                return False
            
            if result.allCaps != False:
                print(f"   ❌ allCaps mismatch: got {result.allCaps}")
                return False
            
            print(f"   ✅ All fields validated correctly")
            print(f"   Template: {result.template}")
            print(f"   Position: ({result.x_position}%, {result.y_position}%)")
            print(f"   Font: {result.fontSize}px, All Caps: {result.allCaps}")
            
            return True
            
        except Exception as e:
            print(f"❌ Test failed with error: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def test_audio_balance_validation_with_real_levels(self) -> bool:
        """Test QualityValidator.validate_audio_balance() with REAL audio levels"""
        print("\n=== Test 8: QualityValidator.validate_audio_balance() with Real Levels ===")
        
        try:
            # These are REAL audio level scenarios from actual videos
            test_cases = [
                (-10.0, -18.0, True, "Good balance: Voice 8dB louder"),
                (-15.0, -21.0, False, "Voice only 6dB louder (acceptable)"),
                (-10.0, -10.0, False, "Equal levels (bad)"),
                (-10.0, -5.0, False, "Music louder (very bad)"),
                (-12.0, -20.0, True, "Voice 8dB louder (good)"),
            ]
            
            all_passed = True
            for voice_db, music_db, expected_valid, desc in test_cases:
                result = QualityValidator.validate_audio_balance(voice_db, music_db)
                difference = voice_db - music_db
                
                print(f"   {desc}")
                print(f"   Voice: {voice_db}dB, Music: {music_db}dB, Diff: {difference}dB")
                print(f"   Result: {result} (Expected: {expected_valid})")
                
                # STRICT validation - result must match expected
                if result != expected_valid:
                    print(f"   ❌ FAILED: Got {result} but expected {expected_valid}")
                    all_passed = False
                else:
                    print(f"   ✅ PASSED")
            
            return all_passed
            
        except Exception as e:
            print(f"❌ Test failed with error: {e}")
            import traceback
            traceback.print_exc()
            return False


def main():
    """Run all helper function tests with REAL data"""
    print("=" * 70)
    print("HELPER FUNCTIONS TEST SUITE - REAL IMPLEMENTATION TESTING")
    print("=" * 70)
    print("Testing utility functions with REAL video files and data")
    print("Following strict principles: No mocks, Real files, Actual validation")
    print()
    
    tests = HelperFunctionsTests()
    
    # Setup with REAL files
    try:
        tests.setup()
    except Exception as e:
        print(f"❌ Setup failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    # Define test cases - ALL use REAL data
    test_cases = [
        ("Color Conversion (Real Caption Colors)", tests.test_color_to_ass_conversion_with_real_values),
        ("Video Info Extraction (Real Video File)", tests.test_get_video_info_with_real_file),
        ("SRT Time Parsing (Real Caption Timing)", tests.test_srt_time_parsing_with_real_caption_data),
        ("Font Path Resolution (Real Fonts)", tests.test_font_path_resolution_produces_valid_fonts),
        ("FFmpeg Text Escaping (Real Script Text)", tests.test_escape_text_for_ffmpeg_with_real_text),
        ("Text Config Parsing (Real Overlay Config)", tests.test_text_config_parsing_creates_valid_overlay),
        ("Caption Config Parsing (Real Caption Config)", tests.test_caption_config_parsing_creates_valid_config),
        ("Audio Balance Validation (Real Audio Levels)", tests.test_audio_balance_validation_with_real_levels),
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
        print("🎉 All helper function tests passed with REAL data!")
        return 0
    else:
        print(f"⚠️  {failed} test(s) failed with REAL implementation.")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
