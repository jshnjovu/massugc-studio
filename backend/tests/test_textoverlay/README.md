# Text Overlay Integration Tests

## Overview

This test suite validates the text overlay functionality described in `current_bugs_workflow.md`. The tests use **actual APIs** and **real implementation** without mocks to ensure genuine integration testing.

## Scope

These tests cover the following components mentioned in the workflow document:

### 1. API Endpoints (app.py)

- **`POST /campaigns`** (Line 1623)
  - Creates campaigns with text overlay settings
  - Validates `enhanced_settings.text_overlays` structure
  - Tests font size calculations (`fontSize`, `fontPercentage`, `fontPx`)
  - Tests video dimension handling (`videoDimensions`, `designWidth`, `designHeight`)

- **`POST /run-job`** (Line 2219)
  - Executes video generation jobs
  - Validates text overlay rendering flow
  - Tests backend processing integration

- **`GET /video-info`** (Line 2858)
  - Retrieves video metadata
  - Tests dimension detection via FFprobe
  - Validates video information accuracy

### 2. Backend Processing Functions

- **`backend/create_video.py::create_video_job()`** (Line 1145)
  - Tests `TextOverlayConfig` creation (Lines 2003-2028)
  - Validates design space parameters (`design_width`, `design_height`)
  - Tests font percentage calculations
  - Validates `fontPx` to rendered font size conversion

- **`backend/enhanced_video_processor.py::add_text_overlay()`** (Line 545)
  - Tests scale factor computation (Lines 576-581)
  - Validates design space to video space mapping
  - Tests font size rendering accuracy
  - Validates position mapping

## Test Files

### `test_text_overlay_integration.py`

**Full API integration tests** that use the Flask test client to validate end-to-end functionality:

1. **Video Info Endpoint** - Tests `GET /video-info`
2. **Campaign Creation with Text Overlays** - Tests `POST /campaigns` with text overlays
3. **Campaign Creation without Text Overlays** - Tests `POST /campaigns` baseline
4. **TextOverlayConfig Creation** - Validates dataclass instantiation
5. **EnhancedVideoProcessor Initialization** - Tests processor setup
6. **Font Size Calculations** - Validates font scaling logic
7. **Text Position Mapping** - Tests percentage-to-pixel conversion
8. **Campaign Validation** - Tests error handling for missing fields
9. **Multiple Text Overlay Configurations** - Tests multiple overlays
10. **add_extended_captions Real Implementation** - Tests actual caption processing with real audio extraction, Whisper transcription, and ASS subtitle rendering

### `test_backend_text_overlay.py`

**Backend function tests** that directly test the processing functions:

1. **`compute_scale()` Function** - Tests design-to-video scaling
2. **`map_percent_to_output()` Function** - Tests position mapping
3. **`get_default_design_dims()` Function** - Tests default dimensions
4. **`get_default_safe_margins()` Function** - Tests margin defaults
5. **`get_video_info()` Method** - Tests video metadata extraction
6. **TextOverlayConfig with Design Space** - Tests full config creation
7. **TextOverlayConfig with Connected Background** - Tests TikTok-style backgrounds
8. **Font Percentage Calculations** - Tests percentage-to-pixel conversion
9. **Scale Factor Computation** - Tests scaling algorithm (lines 576-581)

### `test_helper_functions.py`

**Helper function tests** using REAL video files and data (NO mocks):

1. **Color Conversion** - Real caption colors (white, black, yellow) with strict BGR validation
2. **Video Info Extraction** - Real video file (`nana.mp4`) with actual dimension/FPS validation
3. **SRT Time Parsing** - Real caption timing from actual SRT files
4. **Font Path Resolution** - Real production fonts (Montserrat, Arial, Impact)
5. **FFmpeg Text Escaping** - Real script text from `NaDevScript.txt`
6. **Text Config Parsing** - Real overlay configs from actual API requests
7. **Caption Config Parsing** - Real caption configs with strict field validation
8. **Audio Balance Validation** - Real audio level scenarios from actual videos

### `test_sample_video_generation.py`

**Complete video generation test** that creates an actual sample video with both extended captions and text overlays:

1. **Campaign Creation with Text Overlays** - Creates campaign with multiple text overlays via API
2. **Video Generation Job Execution** - Runs complete video generation pipeline
3. **Extended Captions Integration** - Tests caption rendering with custom styling
4. **Multiple Text Overlay Rendering** - Tests 3 different text overlays with various positions and styles
5. **Backend Processing Validation** - Tests TextOverlayConfig and EnhancedVideoProcessor directly
6. **Output Video Validation** - Validates generated video file properties and content
7. **Real File Generation** - Creates actual video file that can be inspected manually

## Requirements

- Python 3.10.11
- FFmpeg (for video processing)
- All dependencies from `requirements.txt`
- Flask app must be importable

## Running the Tests

### Run All Tests

```bash
# From project root
python tests/test_textoverlay/run_all_tests.py
```

### Run Individual Test Files

```bash
# API integration tests
python tests/test_textoverlay/test_text_overlay_integration.py

# Backend processing tests
python tests/test_textoverlay/test_backend_text_overlay.py

# Helper function tests
python tests/test_textoverlay/test_helper_functions.py

# Sample video generation test
python tests/test_textoverlay/test_sample_video_generation.py
```

### Run from Tests Directory

```bash
cd tests/test_textoverlay
python test_text_overlay_integration.py
python test_backend_text_overlay.py
python test_helper_functions.py
python test_sample_video_generation.py
```

## Test Approach

### Real Implementation Testing

These tests follow the principle of **testing what is actually implemented** rather than creating tests just to pass. honest testing is a MUST for example - if the implementation returns a non-existent path, the test should reveal that truth instead of hiding it with acceptance logic.

✅ **DO:**
- Use actual API endpoints
- Test real backend functions
- Validate actual data structures
- Test error conditions
- Use real FFmpeg processing

❌ **DON'T:**
- Mock core functionality
- Create fake or manipulate tests for the sake of making them pass (e.g., `1+2=5`=True)
- Skip validation to make tests pass
- Test theoretical implementations
- Create superficial tests that only check "is it a string?" without validating correctness
- Use dummy data that creates an illusion of functionality
- Modify production behaviour. any “test” that modifies production behaviour is not a test—it’s an unreviewed release. (Tests Not validating what IS, not modify production behavior to make tests pass)

### Test Data

Tests use real files from the user's resources directory:
- Real video file: `C:/Users/phila/Documents/massUgc_resources/nana.mp4`
- Real script file: `C:/Users/phila/Documents/massUgc_resources/NaDevScript.txt`

No test data cleanup is performed (real files are preserved).

## Expected Behavior

### Passing Tests

When all tests pass, you should see:

```
✅ All tests passed! Text overlay integration is working correctly.
```

### Failing Tests

If tests fail, the output will show:
- Specific assertion that failed
- Expected vs. actual values
- Stack traces for errors
- Detailed context for debugging

## Test Coverage

These tests validate:

1. **API Contract** - Request/response structures
2. **Data Flow** - Frontend → Backend → Processing
3. **Font Scaling** - Design space calculations
4. **Position Mapping** - Percentage to pixel conversion
5. **Video Processing** - FFmpeg integration
6. **Error Handling** - Missing fields, invalid data
7. **Configuration** - TextOverlayConfig parameters
8. **Helper Functions** - Real color conversions, SRT parsing with actual timing data
9. **Config Parsing** - Real API configs with strict field validation  
10. **Quality Validation** - Real audio balance scenarios from actual production

## Notes

- Tests use real video and script files from the resources directory
- Some tests may be skipped if FFmpeg is not available
- Tests use actual video processing (may take a few seconds)
- Real files are preserved (no cleanup performed)

## Debugging Failed Tests

If tests fail:

1. Check the detailed output for the specific failure
2. Review the expected vs. actual values
3. Verify FFmpeg is installed and accessible
4. Check that all dependencies are installed
5. Review the corresponding code sections mentioned in the test output

## Contributing

When adding new tests:

1. Use actual implementation (no mocks)
2. Test real behavior (not fake scenarios)
3. Use real files (not temporary fixtures)
4. Add clear descriptions
5. Include validation assertions

## References

- `current_bugs_workflow.md` - Test scope definition
- `app.py` - API endpoints
- `backend/create_video.py` - Video generation
- `backend/enhanced_video_processor.py` - Text overlay processing

