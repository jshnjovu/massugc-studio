# Text Overlay & Connected Background Debug Guide

## Overview
This document provides comprehensive context for debugging the text overlay and connected background system in the MassUGC video editor. The system has complex interactions between frontend calculations, canvas rendering, preview display, and final video output.

## System Architecture

### Frontend Components
1. **EnhancedVideoSettings.jsx** - Main UI for text overlay configuration
2. **ConnectedTextBackground.jsx** - Canvas-based background rendering and export
3. **NewCampaignForm.jsx** - Form state management and data flow

### Backend Processing
1. **enhanced_video_processor.py** - Main video processing with FFmpeg
2. **Font resolution system** - Maps CSS font-family strings to system fonts
3. **Design-space coordinate system** - Handles positioning across different video sizes

## Current Issues & Symptoms

### 1. Dimension Mismatch Issue (PRIORITY 1)
**Problem**: Connected backgrounds render at wrong size in final output
- Frontend calculates: 432x151px
- Final video shows: 373x151px (measured in Adobe Illustrator)
- Unknown scaling factor being applied somewhere in the pipeline

**Investigation Status**:
- Backend logs claim correct dimensions (432x151px)
- No dimension mismatch detected in logs
- Root cause unknown - could be FFmpeg processing, canvas export, or other factors

### 2. Font Resolution Issues
**Problem**: Text overlays use wrong fonts when no background is present
- CSS font-family strings need proper parsing
- System font mapping inconsistencies

**Status**: Fixed - backend now parses CSS font-family strings correctly

### 3. Preview vs Final Output Discrepancies
**Problem**: UI preview doesn't match final video output
- Scale defaults were causing confusion (60% vs 100%)
- Zoom vs actual artboard sizing

**Status**: Mostly fixed - scale defaults changed to 100%

## Technical Deep Dive

### Coordinate Systems
The system uses multiple coordinate systems that must be synchronized:

1. **Design Space**: Standard canvas size (e.g., 1080x1920)
2. **Preview Space**: Scaled for UI display (e.g., 324x576 at 30% zoom)
3. **Export Space**: Actual video dimensions
4. **Canvas Space**: High-DPI aware rendering space

### Data Flow
```
Frontend Form → ConnectedTextBackground.jsx → Canvas Rendering → Base64 Export → Backend Processing → FFmpeg Overlay → Final Video
```

### Key Files & Functions

#### Frontend
```javascript
// ConnectedTextBackground.jsx
function getBackgroundMetadata() {
  // ZOOM-INDEPENDENT EXPORT CALCULATION
  const exportFontSize = actualFontSize || 20;
  // ... canvas rendering logic
}
```

#### Backend
```python
# enhanced_video_processor.py
def _add_connected_text_background(self, video_path, config, video_info):
    # Dimension matching logic
    if video_width == metadata_video_width and video_height == metadata_video_height:
        scaled_width = int(canvas_width)
        scaled_height = int(canvas_height)
    else:
        # Apply scaling factor
        scale_factor = min(width_scale, height_scale)
        scaled_width = int(canvas_width * scale_factor)
```

## Debugging Steps

### Step 1: Enable Debug Logging
Add to browser console:
```javascript
window.DEBUG_BACKGROUNDS = true;
```

### Step 2: Check Dimension Flow
Monitor these key values:
1. Frontend export metadata dimensions
2. Backend video info dimensions
3. Backend metadata dimensions
4. FFmpeg scale command
5. Final output measurements

### Step 3: FFmpeg Command Analysis
The backend generates commands like:
```bash
ffmpeg -i video.mp4 -i background.png -filter_complex '[1:v]scale=432:151[bg];[0:v][bg]overlay=324:821:format=auto[final]' output.mp4
```

Key areas to investigate:
- Scale filter: `[1:v]scale=432:151[bg]`
- Overlay positioning: `overlay=324:821`
- Input video dimensions vs metadata dimensions

### Step 4: Canvas Export Verification
Check if the PNG being generated has correct dimensions:
```javascript
// In ConnectedTextBackground.jsx
console.log('Canvas actual size:', canvas.width, 'x', canvas.height);
console.log('DPR:', window.devicePixelRatio);
```

## Test Cases

### Test Case 1: Dimension Tracking
1. Create text overlay with connected background
2. Note frontend export dimensions
3. Check backend processing logs
4. Measure final video output in Adobe Illustrator/similar tool
5. Compare all three measurements

### Test Case 2: Font Resolution
1. Create text overlay without background
2. Test various CSS font-family strings:
   - `"Proxima Nova, sans-serif"`
   - `"ProximaNova-Semibold"`
   - `"Inter, -apple-system, BlinkMacSystemFont"`
3. Verify correct system fonts are used

### Test Case 3: Scale Independence
1. Set canvas zoom to different levels (50%, 100%, 200%)
2. Export connected background
3. Verify export dimensions remain consistent

## Known Working vs Broken Scenarios

### ✅ Working
- Standard text overlays (no background)
- Font resolution for CSS font-family strings
- Preview scaling (100% default)
- Backend dimension logging

### ❌ Still Broken
- Connected background final output dimensions
- Text "squishing" in some cases
- Potential canvas/FFmpeg scale mismatch

## Debugging Tools & Techniques

### 1. Adobe Illustrator Measurement
- Import final video
- Use ruler tool to measure text background dimensions
- Compare with frontend calculated dimensions

### 2. FFmpeg Direct Testing
Extract the exact FFmpeg command from logs and test manually:
```bash
# Example command to test
ffmpeg -i input.mp4 -i background.png -filter_complex '[1:v]scale=432:151[bg];[0:v][bg]overlay=324:821[final]' -map '[final]' test_output.mp4
```

### 3. Canvas Debug Export
Add temporary code to export canvas as image file:
```javascript
// Save canvas to file for inspection
const link = document.createElement('a');
link.download = 'debug_canvas.png';
link.href = canvas.toDataURL();
link.click();
```

### 4. Backend Dimension Logging
Current clean logging shows:
```
🎯 Connected background: 432x151px
📐 Dimension mismatch: video=1920x1920, metadata=2224x1920
📐 Scaling background: 432x151 → 373x151 (factor=0.864)
```

## Investigation Priorities

### Priority 1: Root Cause Investigation
- Determine where the dimension change occurs in the pipeline
- Could be FFmpeg scale filter, canvas export, PNG decoding, or other factors
- Systematic testing needed to isolate the issue

### Priority 2: Canvas Export Validation
- Verify base64 PNG has correct dimensions
- Check if canvas device pixel ratio affects export
- Validate PNG decoding in backend

### Priority 3: FFmpeg Processing Analysis
- Check if video container has different dimensions than stream
- Verify scale filter commands are correct
- Look for additional scaling happening after dimension logs

## Code Locations

### Frontend Debug Points
```javascript
// ConnectedTextBackground.jsx:362
console.log(`📦 Export: ${backgroundWidth}x${backgroundHeight}px, font=${fontSize}px`);

// EnhancedVideoSettings.jsx:349-369
// Frontend overlay status logging
```

### Backend Debug Points
```python
# enhanced_video_processor.py:691
logger.info(f"🎯 Connected background: {scaled_width}x{scaled_height}px")

# enhanced_video_processor.py:688-689
# Dimension mismatch detection
```

## Environment Setup
- Frontend: React app with Canvas API
- Backend: Python with FFmpeg subprocess calls
- Video processing: FFmpeg with libx264 codec
- Font system: System fonts + CSS font-family parsing

## Success Criteria
A fix is successful when:
1. Frontend export dimensions match final video dimensions
2. Text is not "squished" or distorted
3. Connected backgrounds maintain aspect ratio
4. System works consistently across different video sizes
5. Preview accurately represents final output

## Contact & Handoff Notes
- All recent changes focused on dimension debugging and logging cleanup
- Font resolution system was recently fixed
- Scale defaults changed from 60% to 100%
- Connected background export calculation was rewritten for zoom independence
- The 432px → 373px scaling issue remains the primary unsolved problem

The new developer should start by reproducing the dimension mismatch issue and systematically testing each part of the pipeline to identify where the scaling is being introduced.

---

## Campaign Caching and Data Persistence Issues

### Common Caching Problems

**Campaign Form Data Caching:**
- Existing campaigns may use cached form data with old default values
- Duplicated campaigns inherit stale data structures
- Edited campaigns may have inconsistent field combinations

**System Component Caching:**
- Browser cache affecting frontend JavaScript bundles
- Backend temporary file caching
- Font rendering cache
- Video processing cache

### Debugging Campaign Caching Issues

#### 1. Clear All Application Caches
```bash
# Frontend Application Cache
- Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
- Clear browser data completely
- Restart application

# Backend Processing Cache
rm -rf /Users/jonnybrower/.zyra-video-agent/enhanced_processing/*

# Font Cache (if needed)
fc-cache -f -v  # Linux/Mac
```

#### 2. Campaign Data Investigation
```javascript
// Inspect campaign data structure in browser console
console.log('Campaign Form Data:', JSON.stringify(form, null, 2));

// Check for old vs new field structures
console.log('Text Overlay Fields:', {
  fontSize: form.text_overlay_fontSize,
  hasBackground: form.text_overlay_hasBackground,
  color: form.text_overlay_color
});

console.log('Caption Fields:', {
  fontSize: form.captions_fontSize,
  enabled: form.captions_enabled,
  fontFamily: form.captions_fontFamily
});
```

#### 3. Test Campaign Types
**Testing Matrix:**
1. **Fresh Campaign**: Create completely new campaign
2. **Duplicated Campaign**: Copy existing campaign
3. **Edited Campaign**: Modify saved campaign
4. **Imported Campaign**: Load from template/file

**Expected Behavior:**
- Fresh campaigns should always work correctly
- Issues most likely appear in duplicated/edited campaigns

#### 4. Form State Reset
```javascript
// Clear specific campaign data
localStorage.removeItem('campaign_draft');
localStorage.removeItem('lastFormData');

// Nuclear option - clear all local storage
localStorage.clear();
sessionStorage.clear();
```

#### 5. Backend Processing Verification
Check logs for inconsistencies between frontend data and backend processing:
```
Frontend Export: fontSize=102px, hasBackground=false
Backend Received: fontSize=20px, hasBackground=true  // ❌ Mismatch!
```

### Common Cache-Related Issues

**Text Overlays:**
- Wrong font sizes (old defaults)
- Unexpected background rendering
- Color mismatches
- Position inconsistencies

**Captions:**
- Font size not updating from slider
- Style/template not applying
- Position or timing issues

**Connected Backgrounds:**
- Dimension calculation errors
- Export data mismatches
- Canvas rendering problems

### Debugging Workflow

1. **Reproduce Issue**: Try with fresh vs existing campaign
2. **Clear Caches**: Application, browser, backend
3. **Compare Data**: Log form data structures
4. **Test Components**: Text overlays, captions, backgrounds separately
5. **Verify Logs**: Frontend export vs backend received data
6. **Reset State**: Clear persistent data if needed

### Prevention Strategies

- Always test changes with both new and existing campaigns
- Implement form data validation/migration for version changes
- Clear development caches between major changes
- Use versioned localStorage keys for campaign data