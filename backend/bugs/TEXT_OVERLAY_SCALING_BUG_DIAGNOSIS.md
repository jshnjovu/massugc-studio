# 🐛 Text Overlay Scaling Bug - Root Cause Analysis

## Executive Summary

**Bug:** Text overlays appear at incorrect sizes relative to the video - inconsistent between frontend preview and backend rendering.

**Root Cause:** **Dual video dimension tracking with no synchronization** between `NewCampaignForm.jsx` and `EnhancedVideoSettings.jsx`, leading to font size calculations using different base heights.

**Severity:** HIGH - Affects all campaigns where video dimensions ≠ 1080x1920

---

## 🔍 The Smoking Gun

### Problem 1: Isolated State Management

**`NewCampaignForm.jsx` (Line 19):**
```javascript
const [videoDimensions, setVideoDimensions] = useState({ width: 1080, height: 1920 });
```
- Hardcoded default: **1920px height**
- Updated via useEffect (lines 310-326) when avatar is selected
- **Issue:** Only runs for avatar-based campaigns, NOT randomized campaigns

**`EnhancedVideoSettings.jsx` (Line 100):**
```javascript
const [artboardSize, setArtboardSize] = useState({ width: 300, height: 533 });
```
- Default preview size
- Updated via `handleVideoLoadedMetadata()` (lines 167-195) when video loads
- Gets **actual video dimensions** from video element
- **Issue:** This state is NOT shared with parent component

### Problem 2: Font Size Calculation Mismatch

**NewCampaignForm.jsx** (Line 502, 551, 600, 610):
```javascript
font_size: (getFontPercentage(form.text_overlay_fontSize) / 100) * videoDimensions.height
```
- Uses `videoDimensions.height` (default: **1920**)
- Calculation: `(pixelSize / videoDimensions.height) * 100 * videoDimensions.height`
- Simplifies to: `pixelSize` (but converted through percentage)

**EnhancedVideoSettings.jsx** (Lines 628-646):
```javascript
const designHeight = artboardSize?.actualHeight || 1920;

const getFontPercentage = (pixelSize) => {
  return pixelToPercentage(pixelSize || 20, designHeight);
};
```
- Uses `designHeight` from `artboardSize.actualHeight` (**ACTUAL video height**)
- Gets real dimensions from loaded video element (line 171)

---

## 📊 Bug Manifestation Examples

### Scenario 1: 720p Video (1280x720)

**User Experience:**
1. User loads 720p avatar video
2. Sets text overlay to 58px in EnhancedVideoSettings
3. **Preview shows:** 58px relative to 720px height (8.06% - looks good)
4. **Backend receives:** `(58/1920) * 100 = 3.02%` of video height
5. **Backend renders:** `3.02% of 720px = 21.7px` ❌ **WAY TOO SMALL**

**Math Breakdown:**
```
EnhancedVideoSettings (Preview):
  designHeight = 720 (from actual video)
  User sets 58px
  Display: 58px / 720 = 8.06% (correct preview)

NewCampaignForm (Submission):
  videoDimensions.height = 1920 (hardcoded or from useEffect)
  Calculates: (58/1920)*100 = 3.02%
  Sends to backend: font_size = (3.02/100) * 1920 = 58px ✓

Backend (Rendering):
  Receives: fontSize as % or pixel value
  If receives 3.02%: applies to 720px video
  Result: 3.02% * 720 = 21.7px ❌ WRONG
```

### Scenario 2: Randomized Campaign (No Avatar)

**Critical Issue:**
```javascript
// NewCampaignForm.jsx lines 310-326
useEffect(() => {
  if (form.avatarId) {  // ← This condition is FALSE for randomized
    const selectedAvatar = avatars.find(a => a.id === form.avatarId);
    if (selectedAvatar && selectedAvatar.filePath) {
      const video = document.createElement('video');
      video.onloadedmetadata = () => {
        setVideoDimensions({
          width: video.videoWidth,
          height: video.videoHeight
        });
      };
      video.src = window.electron ? `file://${selectedAvatar.filePath}` : selectedAvatar.filePath;
    }
  }
}, [form.avatarId, avatars]);
```

**Result:** For randomized campaigns, `videoDimensions` **ALWAYS stays at 1920px**, even if source clips are different dimensions!

### Scenario 3: 4K Video (2160x3840)

**User Experience:**
1. User loads 4K portrait video
2. Sets text overlay to 116px (looks right in preview at 3.02% of 3840)
3. **Backend receives:** `(116/1920) * 100 = 6.04%` of video height
4. **Backend renders:** `6.04% of 3840px = 232px` ❌ **DOUBLE THE SIZE**

---

## 🎯 Code Flow Comparison

### Preview Rendering (EnhancedVideoSettings.jsx)

```
1. Video loads → handleVideoLoadedMetadata() (line 167)
   ↓
2. Extract actual dimensions from video element (lines 170-171)
   actualWidth = video.videoWidth  // e.g., 1280
   actualHeight = video.videoHeight  // e.g., 720
   ↓
3. Update artboardSize state (lines 188-193)
   setArtboardSize({
     width: previewWidth,
     height: previewHeight,
     actualWidth: 1280,  ← REAL VIDEO WIDTH
     actualHeight: 720    ← REAL VIDEO HEIGHT
   })
   ↓
4. Calculate designHeight (line 629)
   const designHeight = artboardSize?.actualHeight || 1920
   = 720  ← CORRECT
   ↓
5. Display font size slider (line 960)
   value={getFontPercentage(overlaySettings.fontSize)}
   = (58 / 720) * 100 = 8.06%  ← CORRECT PREVIEW
   ↓
6. Render preview (line 3970)
   fontSize: ${(overlaySettings.fontSize || 20) * combinedScale}px
   = 58px scaled to preview canvas  ← LOOKS CORRECT
```

### Backend Submission (NewCampaignForm.jsx)

```
1. Avatar selected → useEffect fires (line 311)
   if (form.avatarId) {  ← May not fire for randomized
   ↓
2. Load video dimensions (lines 316-323)
   video.onloadedmetadata = () => {
     setVideoDimensions({
       width: video.videoWidth,  // Should be 1280
       height: video.videoHeight  // Should be 720
     });
   };
   ↓
3. BUT: Timing issue or race condition
   - If useEffect hasn't completed
   - Or if randomized campaign (no avatarId)
   - videoDimensions stays at { width: 1080, height: 1920 }
   ↓
4. Calculate font_size for backend (line 502)
   font_size: (getFontPercentage(form.text_overlay_fontSize) / 100) * videoDimensions.height
   
   where getFontPercentage = (pixelSize / videoDimensions.height) * 100
   
   Substituting:
   font_size = ((58 / 1920) * 100 / 100) * 1920
             = ((0.03021 * 100) / 100) * 1920
             = (3.021 / 100) * 1920
             = 58px  ← Looks right for 1920 video!
   ↓
5. Send to backend with designHeight (lines 496-497)
   designWidth: videoDimensions.width,   // 1080 (wrong if actual is 1280)
   designHeight: videoDimensions.height,  // 1920 (wrong if actual is 720)
   font_size: 58  // This is 58px for a 1920px video
   ↓
6. Backend receives:
   - font_size: 58
   - designHeight: 1920
   - Calculates: percentage = 58/1920 = 3.02%
   ↓
7. Backend applies to ACTUAL 720px video:
   - fontSize = 3.02% * 720 = 21.7px  ❌ TOO SMALL
```

---

## 🧩 Why This Bug is Subtle

1. **Works perfectly for 1920px videos** - The hardcoded default matches common use case
2. **Preview looks correct** - EnhancedVideoSettings uses actual dimensions
3. **Race condition masks issue** - Sometimes useEffect completes in time, sometimes not
4. **Randomized campaigns always broken** - No avatar means useEffect never runs

---

## 🔧 Technical Details

### File: `src/renderer/src/components/NewCampaignForm.jsx`

**Line 19: Initial State**
```javascript
const [videoDimensions, setVideoDimensions] = useState({ width: 1080, height: 1920 });
```
❌ **Problem:** Hardcoded default never updated for randomized campaigns

**Lines 310-326: Video Dimension Detection**
```javascript
useEffect(() => {
  if (form.avatarId) {  // ← Only for avatar campaigns
    const selectedAvatar = avatars.find(a => a.id === form.avatarId);
    if (selectedAvatar && selectedAvatar.filePath) {
      const video = document.createElement('video');
      video.onloadedmetadata = () => {
        setVideoDimensions({
          width: video.videoWidth,
          height: video.videoHeight
        });
      };
      video.src = window.electron ? `file://${selectedAvatar.filePath}` : selectedAvatar.filePath;
    }
  }
}, [form.avatarId, avatars]);
```
❌ **Problems:**
- Only runs when `form.avatarId` exists
- Async video loading may not complete before submission
- No error handling if video fails to load
- Not triggered for randomized campaigns

**Lines 502, 551, 600, 610: Font Size Calculation**
```javascript
font_size: (getFontPercentage(form.text_overlay_fontSize) / 100) * videoDimensions.height
```
❌ **Problem:** Uses potentially stale/incorrect `videoDimensions.height`

### File: `src/renderer/src/components/EnhancedVideoSettings.jsx`

**Lines 167-195: Video Metadata Handler**
```javascript
const handleVideoLoadedMetadata = () => {
  if (videoRef.current) {
    const video = videoRef.current;
    const actualWidth = video.videoWidth;   // ✓ CORRECT
    const actualHeight = video.videoHeight; // ✓ CORRECT
    
    // ... scaling logic ...
    
    setArtboardSize({
      width: Math.round(previewWidth),
      height: Math.round(previewHeight),
      actualWidth,   // ✓ Real video width
      actualHeight   // ✓ Real video height
    });
  }
};
```
✓ **Correct:** Gets actual video dimensions from loaded video element

**Lines 628-629: Design Space Dimensions**
```javascript
const designWidth = artboardSize?.actualWidth || 1080;
const designHeight = artboardSize?.actualHeight || 1920;
```
✓ **Correct:** Uses actual video dimensions for preview calculations

**Lines 640-641: Font Percentage Helper**
```javascript
const getFontPercentage = (pixelSize) => {
  return pixelToPercentage(pixelSize || 20, designHeight);
};
```
✓ **Correct:** Calculates percentage relative to ACTUAL video height

---

## 🎬 Impact Assessment

### Affected Use Cases

| Video Dimensions | Expected Font | Preview Shows | Backend Renders | Status |
|-----------------|---------------|---------------|-----------------|---------|
| 1080x1920 (Full HD Portrait) | 58px (3.02%) | ✅ 58px | ✅ 58px | **WORKS** |
| 1280x720 (HD Landscape) | 58px (8.06%) | ✅ 58px | ❌ 21.7px | **BROKEN** |
| 720x1280 (HD Portrait) | 58px (4.38%) | ✅ 58px | ❌ 38.4px | **BROKEN** |
| 2160x3840 (4K Portrait) | 116px (3.02%) | ✅ 116px | ❌ 232px | **BROKEN** |
| 1440x2560 (2K Portrait) | 77px (3.02%) | ✅ 77px | ❌ 154px | **BROKEN** |
| **Randomized (Any)** | **ANY** | ✅ **Correct** | ❌ **Wrong** | **ALWAYS BROKEN** |

### Severity by Campaign Type

- **Avatar Campaigns (Standard 1920 height):** ✅ Works (by coincidence)
- **Avatar Campaigns (Non-standard height):** ⚠️ Sometimes works (race condition)
- **Randomized Campaigns:** ❌ Always broken

---

## 💡 Root Cause Summary

**The core issue is architectural:**

1. **State Fragmentation:** Two components maintain separate video dimension state
2. **No Communication:** EnhancedVideoSettings discovers actual dimensions but doesn't tell NewCampaignForm
3. **Assumption Failure:** NewCampaignForm assumes all videos are 1920px tall
4. **Missing Prop:** `videoDimensions` should be passed as prop or lifted to shared state

**The fix requires:**
- Lift video dimension state to parent component or shared context
- Pass actual dimensions as props to both components
- Remove hardcoded 1920 default
- Ensure dimension loading happens before form submission

---

## 🎯 Next Steps

1. **Verify Bug:** Test with 720p and 4K videos to confirm inconsistent text sizes
2. **Design Fix:** Choose state management approach (lift state, context, or prop drilling)
3. **Implement Fix:** Synchronize video dimensions between components
4. **Add Validation:** Ensure dimensions are loaded before allowing campaign creation
5. **Test Coverage:** Add tests for various video dimensions

---

## 📝 Additional Evidence

**Console Debug Pattern to Look For:**

```javascript
// EnhancedVideoSettings.jsx line 349
console.log(`  Video: ${artboardSize.actualWidth || 'unknown'}x${artboardSize.actualHeight || 'unknown'}`);
// Shows: "Video: 1280x720"

// But in NewCampaignForm.jsx
console.log(`videoDimensions:`, videoDimensions);
// Shows: "videoDimensions: {width: 1080, height: 1920}"  ← MISMATCH!
```

This is the smoking gun - two different dimension values for the same video!

---

**Date:** 2025-10-06  
**Severity:** HIGH  
**Component:** Text Overlay System  
**Files Affected:**
- `src/renderer/src/components/NewCampaignForm.jsx`
- `src/renderer/src/components/EnhancedVideoSettings.jsx`

