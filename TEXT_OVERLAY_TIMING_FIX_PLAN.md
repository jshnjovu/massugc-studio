# Text Overlay Timing Fix - Current Status & Plan

**Date:** October 16, 2025  
**Branch:** fix/splice  
**Status:** Implementation in progress, needs completion

---

## Current Problem

**Text overlays disappear at specific clip boundaries during video playback.**

### Confirmed Facts (20+ test runs):
- 2 specific clips ALWAYS cause the issue:
  - `2938e5d67d8c0a927c819701dd741d61_t4.mp4`
  - `db397ac4be5d6c5a1bd77ce6827c480f_t4.mp4`
- Without these clips: overlays work perfectly for entire video
- With these clips: overlays disappear when these clips appear in the stitched video
- Issue affects Text Overlay 1 specifically
- Batch processing made it worse (now ALL 3 overlays disappear instead of just 1)

---

## What's Been Implemented (Not Yet Committed)

### ✅ GPU Acceleration Working
- VideoToolbox (h264_videotoolbox) IS being used
- Uses Apple Silicon Media Engine for encoding
- Logs show: `🎬 text overlay: Using encoder=h264_videotoolbox`
- Confirmed working, reduces heat compared to pure CPU

### ✅ Batch Overlay Processing
- Combines 3 text overlays into single encoding pass
- File: `backend/backend/enhanced_video_processor.py`
- Methods added:
  - `add_text_overlays_batch()`
  - `_build_batch_overlay_filter()`
- Currently broken due to timing issue with problem clips

### ✅ CFR (Constant Frame Rate) Added to Concat
- File: `backend/backend/clip_stitch_generator.py`
- Added `-fps_mode cfr -r 30` to both concat functions
- Added `-fflags +genpts` for timestamp generation
- **Did NOT fix the text disappearing issue**

### ✅ Text Overlay Timing Control
- Added `enable='between(t,start,end)'` expressions
- Added safety margin (video_duration + 0.5s)
- Logs show timing: `[CONNECTED OVERLAY] Timing: start=0.00s, end=64.77s`
- **Still doesn't work with problem clips**

---

## Root Cause Analysis

**Stream copy concat (`-c copy`) preserves corrupted metadata from source clips:**

1. Individual clips are normalized to 1080x1920, 30fps with VideoToolbox
2. Clips are trimmed using stream copy (fast, preserves metadata)
3. Concat uses stream copy (fast, but preserves all metadata issues)
4. Problem clips have corrupted timestamps/keyframes/metadata
5. Corrupted metadata passes through into final video
6. When overlay filter hits corrupted frames, timing breaks
7. `enable='between(t,X,Y)'` expression fails due to timestamp discontinuities

**Why this is hard to understand:**
- The final video LOOKS unified (plays fine, same resolution/fps)
- But internally, timestamps can jump/reset at clip boundaries
- Overlay filters are sensitive to these timing discontinuities

---

## The Solution: Two-Pass Video Normalization

### Approach
Keep fast stream copy concat, then add ONE normalization pass to fix ALL timing issues.

### Why This Works:
- Stream copy concat stays fast (~1-2s)
- Single normalization encode creates perfectly clean timestamps
- `setpts=PTS-STARTPTS` resets ALL timestamps from 0.00
- `fps=30` filter enforces constant frame rate
- Guaranteed to work with ANY problem clips (scalable)

### Performance Impact:
- **Cost:** +6-8 seconds (one GPU encode of 64s video)
- **Benefit:** 100% reliable overlays, no clip-specific bugs
- **Total time:** ~20-22s before enhanced features (acceptable)

---

## Implementation Plan

### Phase 1: Create Normalization Function

**File:** `backend/backend/clip_stitch_generator.py`

**Add after line 80 (after trim_media function):**

```python
def normalize_video_timing(input_path: str, output_path: str) -> None:
    """
    Normalize video timing and metadata after concat.
    
    Fixes timestamp discontinuities from stream copy concat by:
    - Resetting PTS to start from 0
    - Enforcing constant 30 FPS
    - Re-encoding to create clean metadata
    
    This ensures overlay filters work reliably across entire video.
    
    Args:
        input_path: Concatenated video with potential timing issues
        output_path: Normalized output with clean timestamps
    """
    from backend.services.gpu_detector import GPUEncoder
    
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    gpu_encoder = GPUEncoder.detect_available_encoder()
    
    cmd = [
        ffmpeg_exe, '-y',
        '-i', input_path,
        '-vf', 'setpts=PTS-STARTPTS,fps=30',  # Reset timestamps + enforce CFR
        *GPUEncoder.get_encode_params(gpu_encoder, quality='balanced'),
        '-c:a', 'copy',  # Keep audio as-is
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        output_path
    ]
    
    print(f"📐 Normalizing video timing for overlay compatibility...")
    print(f"   Input: {input_path}")
    print(f"   Encoder: {gpu_encoder}")
    
    try:
        subprocess.run(cmd, check=True, capture_output=True)
        print(f"✅ Video timing normalized: {output_path}")
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Video normalization failed: {e}")
```

### Phase 2: Integrate into Concat Functions

**File:** `backend/backend/clip_stitch_generator.py`

**Update `concatenate_clips_smart()` around line 253:**

```python
# Step 3: Use concat DEMUXER (stream copy with CFR enforcement)
ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

# Concat to temp file first
temp_concat = str(WORKING_DIR / f"temp_concat_{uuid.uuid4().hex[:8]}.mp4")

cmd = [
    ffmpeg_exe, '-y',
    '-fflags', '+genpts',
    '-f', 'concat',
    '-safe', '0',
    '-i', filelist_path,
    '-c:v', 'copy',
    '-c:a', 'copy',
    '-fps_mode', 'cfr',
    '-r', '30',
    '-movflags', '+faststart',
    temp_concat  # Output to temp first
]

print(f"\n⚡ Concatenating with stream copy + CFR (ultra-fast)...")
subprocess.run(cmd, check=True, capture_output=True)

# NEW: Normalize timing to fix metadata issues
normalize_video_timing(temp_concat, output_path)

# Cleanup temp
try:
    os.remove(temp_concat)
except:
    pass

print(f"✅ Smart concatenation complete: {output_path}\n")
```

**Update `concatenate_clips_with_duration_control()` around line 374:**

```python
ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

# Concat to temp file first
temp_concat = str(WORKING_DIR / f"temp_concat_{uuid.uuid4().hex[:8]}.mp4")

cmd = [
    ffmpeg_exe, '-y',
    '-fflags', '+genpts',
    '-f', 'concat',
    '-safe', '0',
    '-i', filelist_path,
    '-c:v', 'copy',
    '-c:a', 'copy',
    '-fps_mode', 'cfr',
    '-r', '30',
    '-movflags', '+faststart',
    temp_concat  # Output to temp first
]

print(f"   ⚡ Final concatenation (with PTS regeneration + CFR)...")
subprocess.run(cmd, check=True, capture_output=True)

# NEW: Normalize timing to fix metadata issues
normalize_video_timing(temp_concat, output_path)

# Cleanup temp
try:
    os.remove(temp_concat)
except:
    pass

print(f"   ✅ Duration control concatenation complete")
```

### Phase 3: Test

1. Restart backend
2. Run splice campaign that includes the 2 problem clips
3. Look for in logs: `📐 Normalizing video timing for overlay compatibility...`
4. Verify text overlays stay visible for entire video duration
5. Check that batch processing works (all 3 overlays in one pass)

---

## Expected Logs After Implementation

```
🎬 Processing 13 clips with duration control...
   ... clip processing ...
   ⚡ Final concatenation (with PTS regeneration + CFR)...
📐 Normalizing video timing for overlay compatibility...
   Input: /path/to/temp_concat.mp4
   Encoder: h264_videotoolbox
✅ Video timing normalized: /path/to/output.mp4
   ✅ Duration control concatenation complete

[Enhanced processing starts]
🎬 Batch processing 3 text overlays in single pass...
[BATCH] Overlay 1: Connected BG at (439,339), t=0.00-64.77s
[BATCH] Overlay 2: Connected BG at (365,929), t=0.00-64.77s
[BATCH] Overlay 3: Connected BG at (290,1168), t=0.00-64.77s
🎬 text overlay batch: Using encoder=h264_videotoolbox
✅ text overlay batch complete
```

---

## Files Modified (Uncommitted)

1. `backend/backend/clip_stitch_generator.py`
   - Added CFR flags to concat
   - Need to add: normalization pass

2. `backend/backend/enhanced_video_processor.py`
   - Added GPU encoder import and initialization
   - Replaced libx264 with VideoToolbox in 4 locations
   - Added batch overlay processing
   - Added timing control with enable expressions
   - Fixed duration detection bug

3. `backend/backend/services/clip_preprocessor.py`
   - Added GPU encoder logging

---

## Performance Expectations

### Before Enhanced Features:
- Clip preprocessing: ~13s
- Concat: ~1s
- **Normalize: ~6-8s (NEW)**
- Total: ~20-22s

### Enhanced Features:
- Batch overlays: ~6s (all 3 in one pass)
- Music: <1s (stream copy)
- Total enhanced: ~7s

### Grand Total: ~27-29 seconds
**Down from ~47s in logs, MacBook cooler with batch processing**

---

## Alternative If Two-Pass Is Too Slow

Try bitstream filter first (faster but might not work):

```python
'-bsf:v', 'h264_metadata=fixed_frame_rate_flag=1'
```

Add this to concat before `-c:v copy`. If this fixes it, no normalization pass needed.

---

## Next Agent Tasks

1. Implement `normalize_video_timing()` function
2. Integrate into both concat functions
3. Test with problem clips
4. If works: commit all changes
5. If doesn't work: try bitstream filter or investigate clips further

