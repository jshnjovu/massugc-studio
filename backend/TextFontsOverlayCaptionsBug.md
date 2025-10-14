# Text Fonts, Overlay & Captions Bug Analysis

## Problem Summary

After analyzing the codebase, test files, and the `campaigns.yaml` data, I've identified a critical bug where **text overlay specifications and caption formatting from the campaign configuration are not being properly applied** during video generation. This affects both the legacy flat property format and the enhanced nested settings format.

## Current Evidence of the Bug

### 1. **Image Evidence**
- **Image 1 (Editor)**: Shows the campaign editor with proper text overlay configurations including fonts, colors, positions, and background styles
- **Image 2 (Generated Video)**: Shows the actual generated video where these specifications are **NOT applied** - text appears with default styling instead of the configured fonts, colors, and positioning

### 2. **Configuration Evidence**
From `campaigns.yaml`, we can see detailed specifications that should be applied:

```yaml
# Text Overlay 1 - "Name One"
text_overlay_custom_text: Name One
text_overlay_font: Arial
text_overlay_fontSize: 70
text_overlay_color: '#000000'
text_overlay_backgroundColor: '#ffffff'
text_overlay_x_position: 50
text_overlay_y_position: 18

# Text Overlay 2 - "What is your other name ?"  
text_overlay_2_custom_text: What is your other name ?
text_overlay_2_font: Arial
text_overlay_2_fontSize: 58
text_overlay_2_color: '#3ea512'
text_overlay_2_y_position: 55

# Text Overlay 3 - "What is your friend's name !!"
text_overlay_3_custom_text: What is your friend's name !!
text_overlay_3_font: Georgia
text_overlay_3_fontSize: 58
text_overlay_3_color: '#e9e2e2'
text_overlay_3_backgroundColor: '#c11a1a'
text_overlay_3_y_position: 70

# Caption Settings
captions_enabled: true
captions_fontFamily: Courier New
captions_fontSize: 19
captions_color: '#00FF00'
captions_backgroundColor: '#000000'
captions_y_position: 80
```

### 3. **Enhanced Settings Evidence**
The `campaigns.yaml` also contains a properly structured `enhanced_settings` section with design-space positioning:

```yaml
enhanced_settings:
  captions:
    fontFamily: Montserrat-Bold
    fontSize: 16
    color: '#FFFFFF'
    xPct: 50
    yPct: 82
  text_overlays:
    - custom_text: Name One
      font: Arial
      fontSize: 58
      xPct: 50
      yPct: 18
    - custom_text: What is your other name ?
      font: Arial
      fontSize: 58
      color: '#3ea512'
      xPct: 50
      yPct: 55
```

## Root Cause Analysis - CORRECTED

### 1. **Primary Issue: Campaign Data Pipeline**

**CORRECTED ANALYSIS**: The `EnhancedVideoProcessor` classes work correctly (proven by runtime logs). The real issue is in the data flow from `campaigns.yaml` to the video processor.

**Evidence from logs**: 
- Design-space scaling works: `Computed scale factor: 0.992`
- Font resolution works: `Using bundled font: Montserrat-Bold.otf` / `Using fallback font: arial.ttf`
- Color conversion works: `fontcolor=white`, `fontcolor=yellow`, `fontcolor=cyan`
- Positioning works: `Mapped position: (50.0%, 85.0%) -> (544, 1438)`

**Real Problem**: The specific `campaigns.yaml` data (Arial font, #3ea512 color, 55% position) is not being parsed correctly or is being overridden by test configurations.

### 2. **Configuration Parsing Gap - CONFIRMED**

**CONFIRMED**: The issue is in how `campaigns.yaml` flat properties are converted to the enhanced settings format that the working `EnhancedVideoProcessor` expects.

#### Legacy Flat Properties → Enhanced Settings Conversion
In `app.py` function `_build_enhanced_settings_from_flat_properties()`:

```python
# CONFIRMED PROBLEM: Missing critical fields in the mapping
enhanced_settings[overlay_key] = {
    "enabled": job.get(enabled_key, False),
    "font": job.get(f"{prefix}_font", "Montserrat-Bold"),  # ✅ MAPPED
    "fontSize": job.get(f"{prefix}_fontSize", 24),         # ✅ MAPPED
    "color": job.get(f"{prefix}_color", "#FFFFFF"),        # ✅ MAPPED
    # ... other fields ...
    # ❌ MISSING: Design-space positioning fields
    # ❌ MISSING: fontPx, fontPercentage 
    # ❌ MISSING: xPct, yPct, anchor, safeMarginsPct
    # ❌ MISSING: designWidth, designHeight
}
```

**This is why**: The runtime logs show the system using default test values instead of the `campaigns.yaml` specifications - because the flat properties aren't being converted to the design-space format the processor expects.

### 2. **FFmpeg Command Generation Analysis**

**UPDATE**: Based on runtime logs, the `enhanced_video_processor.py` FFmpeg command generation is actually working correctly:

#### Evidence from logs:
```
drawtext=text='\U0001f525 TRENDING NOW':fontfile='C\:/Users/phila/Documents/dev/massugc-video-service/assets/fonts/Montserrat-Bold.otf':fontsize=48:fontcolor=white:text_align=center:x=144-text_w/2:y=332-text_h/2:box=1:boxcolor=black@0.8:boxborderw=20:shadowcolor=black@0.8:shadowx=3:shadowy=3:alpha='if(lt(t\,1)\,t\,1)'
```

**✅ CONFIRMED WORKING**:
- Font file paths are correctly resolved and escaped
- Colors are properly converted to FFmpeg format (white, yellow, cyan)
- Positioning calculations use design-space mapping
- Background boxes, shadows, and animations are applied
- Both bundled and system fonts are handled correctly

### 3. **Test Integration Evidence**

The tests in `test_text_overlay_integration.py` and `test_sample_video_generation.py` demonstrate that:

1. **Configuration is properly sent** to the backend (✅)
2. **Backend receives the data** correctly (✅) 
3. **Video processing pipeline** doesn't apply the specifications (❌)

**Critical Insight**: `test_text_overlay_integration.py` **works correctly** and proves that the `EnhancedVideoProcessor` classes (`TextOverlayConfig`, `CaptionConfig`, etc.) function properly when given proper configuration data. This confirms the issue is **NOT** with the `EnhancedVideoProcessor` classes themselves, but with how `campaigns.yaml` data is parsed and passed to these classes in `create_video.py`.

From test output logs:
```python
# ✅ Data is received correctly
print(f"[{job_name}] 🎯 text_overlays content: {enhanced_settings['text_overlays']}")
print(f"[{job_name}] 🎯 captions designWidth: {captions_data.get('designWidth')}")

# ❌ But styling is not applied in the final video
```

## Specific Issues Identified from Runtime Logs

### 1. **Text Overlay Processing - Actually Working**
**✅ CONFIRMED WORKING** from runtime logs:
- Font families ARE being applied (Montserrat-Bold, Arial)
- Font sizes ARE properly scaled using design-space calculations
- Colors ARE converted to FFmpeg format correctly
- Design-space positioning IS being utilized
- Background styles ARE being applied with proper opacity

### 2. **Real Issue: Configuration Data Mismatch**  
The problem is NOT with the `EnhancedVideoProcessor` implementation, but with how the campaign data from `campaigns.yaml` is being parsed and passed to the processor.

**Evidence**: The runtime logs show the system processing test configurations correctly, but the `campaigns.yaml` specifications (Arial fonts, specific hex colors, exact positions) are not reaching the processor.

## Root Cause Analysis - Configuration Parsing Gap

### 1. **Configuration Parsing Gap in create_video.py**

**Evidence**: `test_text_overlay_integration.py` works perfectly, proving that the `EnhancedVideoProcessor` classes (`TextOverlayConfig`, `CaptionConfig`, etc.) function correctly when given proper configuration data.

**Problem**: In `create_video.py`, the parsing of `campaigns.yaml` data into these configuration objects is incomplete or incorrect.

**Location**: `backend/create_video.py:2016-2028`

The parsing extracts some design space fields but may miss others:
```python
design_width=text_overlay.get('designWidth'),
design_height=text_overlay.get('designHeight'),
x_pct=text_overlay.get('xPct'),
y_pct=text_overlay.get('yPct'),
font_px=text_overlay.get('fontPx'),
font_percentage=text_overlay.get('fontPercentage'),
```

**Problem**: The mapping from `campaigns.yaml` structure to `TextOverlayConfig`/`CaptionConfig` parameters is incomplete or incorrect.

### 2. **Design Space Scaling Feature Flag Issue**

**Location**: `backend/enhanced_video_processor.py:32`
```python
FEATURE_DESIGN_SPACE_SCALING = os.environ.get('FEATURE_DESIGN_SPACE_SCALING', '1') == '1'
```

**Problem**: The feature flag defaults to `'1'` (enabled), but the design space fields from `campaigns.yaml` are not being properly passed through the configuration pipeline.

### 3. **Font Size Calculation Issues**

**Location**: `backend/enhanced_video_processor.py:979-981`

In design-space mode:
```python
scaled_font_size = max(8, round(config.font_size or 20))
```

**Problem**: The system uses `config.font_size` instead of `config.font_px` from the design space, ignoring the precise font size from `campaigns.yaml`. However, this only becomes a problem if `config.font_px` is not being passed correctly from `create_video.py`.

### 4. **Position Mapping Issues**

**Location**: `backend/enhanced_video_processor.py:584-590`

The position mapping only works if both `x_pct` and `y_pct` are provided:
```python
if config.x_pct is not None and config.y_pct is not None:
    x, y = map_percent_to_output(...)
```

**Problem**: If either percentage is missing, the system falls back to legacy positioning, ignoring the design space coordinates. This suggests that `x_pct` and `y_pct` are not being passed correctly from `create_video.py`.

## Required Fix Implementation - CORRECTED PRIORITIES

### Phase 1: Fix Configuration Parsing in `app.py` (PRIMARY ISSUE)

**CONFIRMED**: The main problem is in `_build_enhanced_settings_from_flat_properties()` not mapping design-space fields correctly.

```python
def _build_enhanced_settings_from_flat_properties(job):
    # ADD MISSING FIELDS to the text overlay mapping:
    enhanced_settings[overlay_key] = {
        # ... existing fields ...
        
        # CRITICAL ADD: Design-space positioning fields that the working processor expects
        "designWidth": 1088,  # Default design dimensions
        "designHeight": 1904,
        "xPct": job.get(f"{prefix}_x_position", 50),
        "yPct": job.get(f"{prefix}_y_position", 20), 
        "anchor": "center",
        "safeMarginsPct": {
            "left": 4, "right": 4, "top": 5, "bottom": 12
        },
        
        # CRITICAL ADD: Font scaling fields that the working processor expects
        "fontPx": job.get(f"{prefix}_fontSize", 24) * 2,  # Scale for design space
        "fontPercentage": job.get(f"{prefix}_fontSize", 24) / 20.0,
        "borderPx": 2,
        "shadowPx": 0,
        "lineSpacingPx": job.get(f"{prefix}_lineSpacing", 0),
        "wrapWidthPct": 90
    }
```

**This fix should resolve the issue** since the `EnhancedVideoProcessor` already works correctly with proper configuration data.

## Implementation Priority - CORRECTED

1. **CRITICAL**: Fix `_build_enhanced_settings_from_flat_properties()` in `app.py` to include design-space fields
2. **High**: Add logging to verify flat properties are being read from `campaigns.yaml` correctly
3. **Medium**: Test with actual campaign data to verify the fix works
4. **Low**: ~~Fix EnhancedVideoProcessor~~ (already working correctly)

## REMOVED INCORRECT ANALYSIS

The following sections were based on incorrect assumptions about the `EnhancedVideoProcessor` being broken:
- ~~"FFmpeg Command Generation Problem"~~ - **FFmpeg generation works correctly**
- ~~"Font and color specifications not being applied"~~ - **Font and color handling works correctly**
- ~~"Positioning calculations inconsistent"~~ - **Design-space positioning works correctly**
- ~~"Fix Video Processing in enhanced_video_processor.py"~~ - **Video processing works correctly**

## Testing Strategy

1. **Primary Test**: Run `test_sample_video_generation.py` to verify fixes - this should now produce videos that match `campaigns.yaml` specifications
2. **Validation Test**: Compare generated video with `campaigns.yaml` specifications to ensure fonts, positions, and colors match
3. **Integration Test**: Use `test_text_overlay_integration.py` as a reference (since it works correctly) to validate that the same configuration patterns work in the main pipeline
4. **Field Validation**: Add logging to verify that design space fields (`fontPx`, `xPct`, `yPct`, etc.) are being passed correctly from `create_video.py` to `EnhancedVideoProcessor`
5. **Regression Test**: Test both text overlays and captions independently to ensure both work correctly

## Test Validation Requirements

1. **Verify Font Application**: Generated video should show Arial and Georgia fonts as specified
2. **Verify Color Application**: Text should appear in exact hex colors (#3ea512, #e9e2e2, etc.)
3. **Verify Positioning**: Text should appear at exact percentages (18%, 55%, 70%)
4. **Verify Caption Styling**: Captions should use Courier New/Montserrat-Bold with green color
5. **Verify Background Styles**: Text backgrounds should show with specified colors and opacity

## Dependencies for Fix

- **Font Management**: Ensure font files are available on the system
- **FFmpeg Expertise**: Proper drawtext and subtitle filter syntax
- **Color Conversion**: Hex to FFmpeg color format utilities
- **Position Calculation**: Design-space to pixel coordinate mapping
- **Backward Compatibility**: Ensure legacy configurations still work

## Expected Outcome

After fixes:
- Text overlays should match the exact specifications from `campaigns.yaml`
- Captions should appear at the correct position with the correct font size
- Design space coordinates should be respected
- Generated videos should match the editor preview

## Impact Assessment

- **High Impact**: All text overlays and captions are currently not styled properly
- **User-Facing**: Directly affects the visual quality of generated videos
- **Data Integrity**: Configuration data is preserved but not utilized
- **System Reliability**: Core video processing pipeline affected

This bug represents a **critical gap** between the configuration system and the video processing implementation, requiring comprehensive fixes across multiple components to ensure proper text and caption styling in generated videos.