<!-- ee26ff8d-8668-46f1-8f4a-f415cdad3ae4 fceecd46-52d9-480f-9f68-1ea405f67b1e -->
# Fix Text Overlays Disappearing on Specific Clips

## The Core Facts

**Proven through 20+ tests:**

- 2 specific clips ALWAYS cause overlays to disappear: `2938e5d67d8c0a927c819701dd741d61_t4.mp4` and `db397ac4be5d6c5a1bd77ce6827c480f_t4.mp4`
- Without these clips: overlays work perfectly
- With these clips: overlays disappear at their boundaries
- VideoToolbox IS working (using Media Engine for encoding)
- Batch processing is faster (good) but broken by these clips (all 3 overlays disappear)

---

## Root Cause

**Stream copy concat preserves corrupted metadata from source clips:**

- `-c copy` = fast but keeps original timestamps/keyframes/flags
- Those 2 clips have broken metadata
- Metadata passes through concat into final video
- Overlay filters fail when they hit corrupted frames/timestamps

---

## Solution: Two-Pass Video Unification (RECOMMENDED)

### Why This Approach:

- Keep fast stream copy concat (speed win)
- Add single normalization pass (fixes ALL issues)
- Guaranteed clean timestamps for overlays
- Simpler than detecting individual problem clips

### Implementation:

**Step 1: Stream Copy Concat (Current - Keep It)**

```python
# Fast concat - preserves speed
ffmpeg -f concat -c:v copy -c:a copy ...
```

**Step 2: Add Normalization Pass (NEW)**

```python
# After concat, normalize the video
ffmpeg -i concat_output.mp4 \
  -vf "setpts=PTS-STARTPTS,fps=30" \  # Reset timestamps + enforce CFR
  -c:v h264_videotoolbox \
  -c:a copy \
  final_output.mp4
```

**What `setpts=PTS-STARTPTS` does:**

- Resets ALL timestamps to start from 0.00
- Creates perfectly continuous timeline
- Eliminates any discontinuities from concat
- Fixes corrupted timestamps from problem clips

**What `fps=30` does:**

- Forces constant 30 FPS output
- Drops/duplicates frames if needed to maintain consistency
- Guarantees uniform frame timing

---

## Performance Analysis

### Current Approach:

- Clip preprocessing: ~13s (GPU, 13 clips)
- Concat: ~1s (stream copy)
- **Total before enhanced:** ~14s

### With Normalization Pass:

- Clip preprocessing: ~13s (GPU, 13 clips)
- Concat: ~1s (stream copy)
- **Normalize: ~6-8s (one GPU encode, 64-second video)**
- **Total before enhanced:** ~20-22s

**Cost:** +6-8 seconds

**Benefit:** 100% reliable overlays, no clip-specific bugs

---

## Alternative Approaches (If Two-Pass Too Slow)

### Option B: Bitstream Filter Only

**Try fixing metadata without full re-encode:**

```python
'-bsf:v', 'h264_metadata=fixed_frame_rate_flag=1:num_ticks_poc_diff_one=1'
```

**Pros:** Very fast (just rewrites metadata)

**Cons:** Might not fix deep corruption

### Option C: Re-encode Only Problem Clips During Preprocessing

**Detect the 2 problem clips, force full re-encode:**

```python
problem_clips = [
    '2938e5d67d8c0a927c819701dd741d61_t4.mp4',
    'db397ac4be5d6c5a1bd77ce6827c480f_t4.mp4'
]

if clip_name in problem_clips:
    needs_convert.append(clip)  # Force full re-encode
```

**Pros:** Surgical fix, minimal performance cost

**Cons:** Hardcoded clip names (not scalable)

---

## Implementation Plan

### Phase 1: Inspect Problem Clips

Run ffprobe on both clips to see what's actually wrong

### Phase 2: Implement Two-Pass Normalization

**File:** `backend/backend/clip_stitch_generator.py`

**Add new function:**

```python
def normalize_video_timing(input_path: str, output_path: str, gpu_encoder: str) -> None:
    """
    Normalize video timing and metadata after concat.
    Fixes timestamp discontinuities and ensures overlay compatibility.
    """
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    
    cmd = [
        ffmpeg_exe, '-y',
        '-i', input_path,
        '-vf', 'setpts=PTS-STARTPTS,fps=30',  # Reset timestamps, enforce CFR
        *GPUEncoder.get_encode_params(gpu_encoder, quality='balanced'),
        '-c:a', 'copy',  # Keep audio as-is
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        output_path
    ]
    
    print(f"📐 Normalizing video timing for overlay compatibility...")
    subprocess.run(cmd, check=True)
```

**Modify concat functions:**

```python
def concatenate_clips_with_duration_control(...):
    # Existing concat to temp file
    temp_concat = str(WORKING_DIR / f"temp_concat_{uuid.uuid4().hex[:8]}.mp4")
    
    # ... existing stream copy concat code ...
    
    # NEW: Normalize timing
    gpu_encoder = GPUEncoder.detect_available_encoder()
    normalize_video_timing(temp_concat, output_path, gpu_encoder)
    
    # Cleanup temp
    os.remove(temp_concat)
```

### Phase 3: Test

- Run with problem clips
- Verify overlays stay visible entire duration
- Check logs for normalization pass

---

## Why This Is The Right Approach

1. **Fixes the root cause:** Creates guaranteed clean timestamps
2. **Scalable:** Works for ANY problem clips, not just these 2
3. **Proven technique:** `setpts=PTS-STARTPTS` is standard for timestamp normalization
4. **Reasonable cost:** +6-8 seconds for bulletproof reliability
5. **Keeps speed wins:** Clip preprocessing and concat stay fast

---

## Next Steps

**Want me to:**

1. First inspect the 2 problem clips with ffprobe (see what's wrong)?
2. Then implement two-pass normalization?
3. Test and verify overlays work reliably?

### To-dos

- [ ] Run ffprobe on both problem clips to identify specific metadata issues
- [ ] Create normalize_video_timing() function with setpts and fps filters
- [ ] Add normalization pass after concat in both concat functions
- [ ] Test with problem clips included, verify overlays stay visible
- [ ] Confirm batch overlay processing works reliably with normalized video