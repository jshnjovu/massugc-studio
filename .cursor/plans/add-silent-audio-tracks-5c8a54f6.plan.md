<!-- 5c8a54f6-29d5-4528-8e88-0f8bd4cdb90d 48a4dea9-2daa-4d84-8399-2612baa9ea10 -->
# Audio-Aware Normalization with PTS Sync

## Complete Processing Flow

### SCENARIO 1: original_volume = 0 (User wants NO clip audio, only voiceover)

```
Clip A (has audio) → Normalize → Strip audio (-an) → Video only → Cache
Clip B (no audio) → Normalize → Already no audio → Video only → Cache
Clip C (silent audio) → Normalize → Strip audio (-an) → Video only → Cache

All clips trimmed → Video streams only
Concatenate → Video-only output
Add voiceover → Replace audio track (not mix)
Final output → Video with voiceover only
```

### SCENARIO 2: original_volume > 0 (User wants clip audio mixed with voiceover)

```
Clip A (has audio) → Normalize → Keep + reset PTS → Video + Audio → Cache
Clip B (no audio) → Normalize → Add silent track → Video + Audio → Cache  
Clip C (silent audio) → Normalize → Keep + reset PTS → Video + Audio → Cache

All clips trimmed → Uniform Video + Audio streams
Concatenate → Video with clip audio track
Mix with voiceover → amix at specified volumes
Final output → Video with mixed audio
```

## Key Changes

### Change 1: Pass original_volume to normalization
Normalization needs to know audio handling mode.

### Change 2: Audio handling based on original_volume

```python
if original_volume == 0:
    # Strip ALL audio - user wants voiceover only
    action = "strip"
elif clip_has_no_audio:
    # Add silent audio - maintains stream uniformity
    action = "add_silent"
else:
    # Keep existing audio - will be mixed later
    action = "keep"
```

### Change 3: Add audio_mode to cache key

```python
# Cache depends on audio handling mode
cache_key = hash(clip + size + crop + audio_mode)

audio_mode = "no_audio" if original_volume == 0 else "with_audio"
```

This way:
- original_volume=0 → cached as video-only
- original_volume=0.6 → cached as video+audio
- Different cache entries, no conflicts!

## Implementation

### 1. Update ClipPreprocessor.normalize_clips signature
**File:** `backend/backend/services/clip_preprocessor.py` (line 34)

Add audio_mode parameter:

```python
@classmethod
def normalize_clips(
    cls,
    clips: List[str],
    canvas_width: int,
    canvas_height: int,
    crop_mode: str = 'center',
    audio_mode: str = 'keep'  # NEW: 'keep' or 'strip'
) -> Tuple[List[str], dict]:
```

### 2. Update cache to include audio_mode
**File:** `backend/backend/services/clip_cache.py` (line 59)

```python
identifier = f"{clip_path}_{mtime}_{canvas_w}_{canvas_h}_{crop_mode}_{audio_mode}"
```

Update get_cached_clip and cache_clip to accept audio_mode parameter.

### 3. Update _resize_clip for audio-aware processing
**File:** `backend/backend/services/clip_preprocessor.py` (lines 137-224)

```python
@classmethod
def _resize_clip(
    cls,
    clip_path: str,
    canvas_w: int,
    canvas_h: int,
    crop_mode: str,
    gpu_encoder: str,
    audio_mode: str = 'keep'  # NEW
) -> Optional[str]:
    
    # Build video filter with PTS reset
    vf = cls._build_video_filter(canvas_w, canvas_h, crop_mode)
    vf = f"{vf},setpts=PTS-STARTPTS"  # Reset video PTS
    
    # Detect if clip has audio
    has_audio_stream, _ = cls._clip_has_audio(clip_path)
    
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    
    cmd = [
        ffmpeg_exe, '-y',
        '-fflags', '+genpts',  # Generate clean timestamps
        '-i', clip_path,
    ]
    
    # Handle audio based on mode
    if audio_mode == 'strip':
        # User wants no clip audio (original_volume=0)
        print(f"   🔇 Stripping audio (original_volume=0)")
        # No audio inputs or mappings - video only
        
    elif not has_audio_stream:
        # No audio but user wants audio mode - add silent
        print(f"   🔇 No audio stream, adding silent track")
        cmd.extend(['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100'])
        
    # else: has audio and keeping it
    
    cmd.extend([
        '-vf', vf,
        *video_params,
    ])
    
    # Audio encoding
    if audio_mode == 'strip':
        cmd.extend(['-an'])  # No audio output
    elif not has_audio_stream:
        cmd.extend([
            '-map', '0:v', '-map', '1:a',
            '-af', 'asetpts=PTS-STARTPTS',
            '-c:a', 'aac', '-b:a', '128k',
            '-shortest'
        ])
    else:
        cmd.extend([
            '-af', 'asetpts=PTS-STARTPTS',
            '-c:a', 'aac', '-b:a', '128k'
        ])
    
    cmd.extend(['-movflags', '+faststart', output_path])
```

### 4. Update _convert_clip similarly
**File:** `backend/backend/services/clip_preprocessor.py` (lines 248-347)

Apply exact same logic as _resize_clip with audio_mode parameter.

### 5. Pass original_volume to normalization
**File:** `backend/backend/clip_stitch_generator.py` (line 313)

```python
# Determine audio mode from original_volume
audio_mode = 'strip' if original_volume == 0 else 'keep'

normalized_clips, stats = ClipPreprocessor.normalize_clips(
    clips=[clip_path],
    canvas_width=canvas_width,
    canvas_height=canvas_height,
    crop_mode=crop_mode,
    audio_mode=audio_mode  # NEW
)
```

### 6. Update cache calls to include audio_mode
**File:** `backend/backend/services/clip_preprocessor.py` (lines 87-99, 108-120)

```python
cached = ClipCache.get_cached_clip(clip, canvas_width, canvas_height, crop_mode, audio_mode)
# ...
cached = ClipCache.cache_clip(clip, normalized, canvas_width, canvas_height, crop_mode, audio_mode)
```

### 7. Simplify audio mixing for voiceover-only mode
**File:** `backend/backend/merge_audio_video.py` (lines 81-93)

Already handles this! When video has no audio, uses voiceover only.

## Exact Flow After Implementation

### User sets original_volume=0:

```
1. Select 14 clips from directory
2. For each clip:
   - Normalize with audio_mode='strip'
   - Resize/crop to 1080x1920
   - Reset video PTS with setpts=PTS-STARTPTS
   - Strip audio with -an
   - Cache as "clip_hash_1080_1920_center_strip.mp4"
3. Trim each normalized clip to 5 seconds (stream copy, fast)
4. Concatenate 14 trimmed clips (concat demuxer, stream copy, fast)
5. Add voiceover (replaces non-existent audio, no mixing)
6. Output: Video with voiceover only
```

### User sets original_volume=0.6:

```
1. Select 14 clips from directory
2. For each clip:
   - Normalize with audio_mode='keep'
   - Resize/crop to 1080x1920
   - Reset video PTS with setpts=PTS-STARTPTS
   - IF has audio: Reset audio PTS with asetpts=PTS-STARTPTS
   - IF no audio: Add anullsrc + reset PTS with asetpts=PTS-STARTPTS
   - Cache as "clip_hash_1080_1920_center_keep.mp4"
3. Trim each normalized clip to 5 seconds (stream copy, fast)
4. Concatenate 14 trimmed clips (concat demuxer, stream copy, fast)
5. Mix with voiceover (amix: clip audio at 60% + voiceover at 100%)
6. Output: Video with mixed audio
```

## Why This Fixes Everything

1. PTS reset (setpts/asetpts) → All clips start at timestamp 0
2. Uniform streams → All clips have same structure (video-only OR video+audio)
3. Clean concatenation → No timestamp mismatches at boundaries
4. Proper caching → Different modes cached separately
5. Fast pipeline → Only normalization re-encodes, rest uses stream copy

## Performance

- Same 21-second total time (no slowdown!)
- Normalization: ~1-2s per clip (GPU, cached on rerun)
- Trimming: Instant (stream copy)
- Concatenation: Instant (stream copy, demuxer)
- Voiceover: 2-3s (audio processing only)

## What Gets Fixed

- Freeze frames from PTS misalignment
- Issues with clips lacking audio streams
- Issues with clips having silent audio
- Caching conflicts between audio modes
- 256×144 and 720×1280 problem clips
- All resolution/aspect ratio combinations


### To-dos

- [ ] Add audio_mode parameter to normalize_clips() and pass through pipeline
- [ ] Include audio_mode in cache key to prevent conflicts between strip/keep modes
- [ ] Add setpts=PTS-STARTPTS to video and asetpts=PTS-STARTPTS to audio filters
- [ ] Implement -an flag when audio_mode='strip' to remove all audio
- [ ] Test with original_volume=0 and original_volume=0.6 to verify both flows work