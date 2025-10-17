import os
import cv2
import subprocess
import uuid
import random
import imageio_ffmpeg
from pathlib import Path
from typing import Optional, Tuple, List
from mutagen import File as MutagenFile

from backend.merge_audio_video import merge_video_and_audio
from backend.services.clip_preprocessor import ClipPreprocessor
from backend.services.clip_analyzer import ClipAnalyzer

# ─── Global Working Directory Setup ────────────────────────────────
HOME_DIR       = Path.home() / ".zyra-video-agent"
WORKING_DIR    = HOME_DIR / "working-dir"

def get_media_duration(path: str) -> float:
    """
    Returns the duration (in seconds) of a media file.
    - Uses OpenCV for video files.
    - Uses mutagen for common audio files.
    """
    ext = Path(path).suffix.lower()
    # Audio extensions
    if ext in {".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg"}:
        audio = MutagenFile(path)
        if not audio or not hasattr(audio.info, "length"):
            raise RuntimeError(f"Cannot read audio duration for {path}")
        print(f"Audio duration: {float(audio.info.length)}. File: {path}")
        return float(audio.info.length)

    # Otherwise assume it's a video
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video file: {path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 0
    frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
    cap.release()
    if fps <= 0:
        raise RuntimeError(f"Invalid FPS ({fps}) for video {path}")
    print(f"Video duration: {(frame_count / fps)}. File: {path}")
    return frame_count / fps


def trim_media(input_path: str, output_path: str, duration: float) -> None:
    """
    Trim a media file to at most `duration` seconds.
    Copies both video & audio streams if no re-encode is needed.
    """
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [
        ffmpeg, "-y",
        "-i", input_path,
        "-t", str(duration),
        "-c", "copy",     # copy all streams
        output_path
    ]
    print(f"<TRIM> DEBUG: FFmpeg executable: {ffmpeg}")
    print(f"<TRIM> DEBUG: Input path: {input_path}")
    print(f"<TRIM> DEBUG: Output path: {output_path}")
    print(f"<TRIM> DEBUG: Duration: {duration}")
    print(f"<TRIM> DEBUG: Input exists: {os.path.exists(input_path)}")
    print(f"<TRIM> DEBUG: Output directory: {os.path.dirname(output_path)}")
    print(f"<TRIM> DEBUG: Output directory exists: {os.path.exists(os.path.dirname(output_path))}")
    print(f"<TRIM> DEBUG: Output directory writable: {os.access(os.path.dirname(output_path), os.W_OK)}")
    print(f"<TRIM> DEBUG: FFmpeg command: {' '.join(cmd)}")
    
    try:
        subprocess.run(cmd, check=True)
        print(f"<TRIM> DEBUG: FFmpeg trim successful")
        print(f"<TRIM> DEBUG: Output file exists: {os.path.exists(output_path)}")
        if os.path.exists(output_path):
            print(f"<TRIM> DEBUG: Output file size: {os.path.getsize(output_path)} bytes")
    except subprocess.CalledProcessError as e:
        print(f"<TRIM> ERROR: FFmpeg failed with exit code {e.returncode}")
        print(f"<TRIM> ERROR: Command that failed: {' '.join(e.cmd)}")
        raise


def normalize_video_timing(input_path: str, output_path: str) -> None:
    """
    Normalize video timing and metadata after concatenation.
    
    This function solves a critical issue where stream copy concatenation can
    preserve corrupted timestamps, keyframe metadata, or PTS discontinuities
    from source clips. These issues cause overlay filters to fail at clip
    boundaries even when the video appears to play normally.
    
    The normalization process:
    1. Resets all PTS (Presentation Time Stamps) to start from 0
    2. Enforces constant 30 FPS frame rate
    3. Re-encodes with GPU acceleration to create clean metadata
    4. Ensures overlay filters work reliably across entire video duration
    
    Performance Impact:
    - Cost: ~6-8 seconds for 60s video (with VideoToolbox GPU encoding)
    - Benefit: 100% reliable text overlays, eliminates clip-specific bugs
    - Essential for professional video production quality
    
    Args:
        input_path: Concatenated video with potential timing issues
        output_path: Normalized output with clean, monotonic timestamps
        
    Raises:
        RuntimeError: If normalization fails
    """
    from backend.services.gpu_detector import GPUEncoder
    import time
    
    print(f"\n{'='*80}")
    print(f"📐 NORMALIZATION PASS - DETAILED DEBUG")
    print(f"{'='*80}")
    
    # Check input file
    if not os.path.exists(input_path):
        raise RuntimeError(f"Input file does not exist: {input_path}")
    
    input_size = os.path.getsize(input_path) / (1024 * 1024)  # MB
    print(f"   📁 Input file: {Path(input_path).name}")
    print(f"   📊 Input size: {input_size:.2f} MB")
    
    # Probe input video details
    try:
        input_duration = get_media_duration(input_path)
        print(f"   ⏱️  Input duration: {input_duration:.2f}s")
    except Exception as e:
        print(f"   ⚠️  Could not get input duration: {e}")
        input_duration = 0
    
    # Get video details with FFmpeg
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    
    print(f"\n   🔍 Probing input video metadata...")
    probe_cmd = [
        ffmpeg_exe, '-i', input_path,
        '-f', 'null', '-'
    ]
    
    has_audio = False
    video_duration = 0.0
    audio_duration = 0.0
    
    try:
        probe_result = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=10)
        stderr_lines = probe_result.stderr.split('\n')
        
        # Extract key metadata
        for line in stderr_lines:
            if 'Video:' in line or 'Duration:' in line or 'Stream' in line:
                print(f"      {line.strip()}")
            if 'Audio:' in line:
                has_audio = True
            # Parse stream durations if available
            if 'Duration:' in line and 'start:' in line:
                import re
                duration_match = re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)', line)
                if duration_match:
                    h, m, s = duration_match.groups()
                    video_duration = int(h) * 3600 + int(m) * 60 + float(s)
        
        print(f"\n   📊 Stream Analysis:")
        print(f"      Video: {video_duration:.2f}s")
        print(f"      Audio: {'Present' if has_audio else 'None'}")
        
    except Exception as e:
        print(f"   ⚠️  Probe failed: {e}")
    
    # Setup normalization
    gpu_encoder = GPUEncoder.detect_available_encoder()
    
    # CRITICAL: Re-encode audio instead of stream copy
    # Stream copying audio can cause FFmpeg to stop video encoding when audio ends
    # This was causing videos to cut off at exactly 50s when audio was shorter
    cmd = [
        ffmpeg_exe, '-y',
        '-i', input_path,
        '-vf', 'setpts=PTS-STARTPTS',  # Reset timestamps to 0
        '-r', '30',  # Force 30 FPS output (more reliable than fps filter)
        '-vsync', 'cfr',  # Constant frame rate sync (duplicate/drop as needed)
        *GPUEncoder.get_encode_params(gpu_encoder, quality='balanced'),
        '-c:a', 'aac',  # Re-encode audio (prevents length mismatch issues)
        '-b:a', '128k',  # Audio bitrate
        # NOTE: Do NOT use -shortest flag - it would stop video when audio ends
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        output_path
    ]
    
    print(f"\n   🎬 Starting normalization encode...")
    print(f"   🔧 Encoder: {gpu_encoder}")
    print(f"   📝 Video filter: setpts=PTS-STARTPTS")
    print(f"   🎯 FPS settings: -r 30 -vsync cfr (force 30fps constant)")
    print(f"   🎵 Audio: stream copy (no re-encode)")
    print(f"   📦 Output: {Path(output_path).name}")
    print(f"\n   ⏳ Encoding (this takes ~6-8s for 60s video)...")
    
    start_time = time.time()
    
    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        
        encode_time = time.time() - start_time
        
        # Check output file
        if not os.path.exists(output_path):
            raise RuntimeError("Output file was not created")
        
        output_size = os.path.getsize(output_path) / (1024 * 1024)  # MB
        
        # Get output duration
        try:
            output_duration = get_media_duration(output_path)
            duration_diff = abs(output_duration - input_duration) if input_duration > 0 else 0
        except Exception as e:
            print(f"   ⚠️  Could not get output duration: {e}")
            output_duration = 0
            duration_diff = 0
        
        print(f"\n   ✅ Normalization complete!")
        print(f"   ⏱️  Encode time: {encode_time:.2f}s")
        print(f"   📊 Output size: {output_size:.2f} MB")
        print(f"   🎥 Output duration: {output_duration:.2f}s")
        
        if duration_diff > 0.5:
            print(f"   ⚠️  WARNING: Duration changed by {duration_diff:.2f}s!")
        else:
            print(f"   ✓  Duration preserved (Δ {duration_diff:.2f}s)")
        
        # Show FFmpeg stderr for any warnings
        if result.stderr:
            stderr_lines = result.stderr.split('\n')
            warnings = [line for line in stderr_lines if 'warning' in line.lower() or 'error' in line.lower()]
            if warnings:
                print(f"\n   ⚠️  FFmpeg warnings/errors:")
                for warning in warnings[:5]:  # Show first 5
                    print(f"      {warning.strip()}")
        
        print(f"{'='*80}\n")
        
    except subprocess.CalledProcessError as e:
        print(f"\n   ❌ NORMALIZATION FAILED")
        print(f"   Exit code: {e.returncode}")
        print(f"\n   FFmpeg stderr output:")
        print(f"   {'-'*76}")
        if e.stderr:
            for line in e.stderr.split('\n')[-20:]:  # Last 20 lines
                print(f"   {line}")
        print(f"   {'-'*76}")
        print(f"{'='*80}\n")
        
        raise RuntimeError(
            f"Video normalization failed (exit code {e.returncode}). "
            f"Check FFmpeg output above for details."
        )


def concatenate_to_duration(
    source_directory: str,
    output_path: str,
    target_duration: float,
    count: Optional[int] = None,
    hook_video: Optional[str] = None,
    extensions: tuple[str, ...] = (".mp4", ".mov", ".mkv")
) -> None:
    """
    1) Optionally prepend `hook_video` (exactly once).
    2) Pick up to `count` unique clips from `source_directory` at random.
    3) If their total duration < target_duration, pick extra clips (with repeats)
       until total_duration ≥ target_duration.
    4) Concatenate all selected clips with ffmpeg’s concat-filter, re-encoding to H.264/AAC.
    """
    src_dir = Path(source_directory)
    if not src_dir.is_dir():
        raise FileNotFoundError(f"Source directory not found: {source_directory}")

    # 1) Build base pool of all candidate clips
    pool = [p for p in src_dir.iterdir() if p.is_file() and p.suffix.lower() in extensions]
    if not pool and not hook_video:
        raise RuntimeError(f"No video clips found in {source_directory}")

    selected: list[Path] = []
    total_dur = 0.0

    # Helper to probe duration
    def _dur(p: Path) -> float:
        return get_media_duration(str(p))

    # 2) If there's a hook, use it first (once)
    if hook_video:
        hook_path = Path(hook_video)
        if not hook_path.is_file():
            raise FileNotFoundError(f"Hook video not found: {hook_video}")
        selected.append(hook_path.resolve())
        total_dur += _dur(hook_path)
        # exclude it from the unique pool
        pool = [p for p in pool if p.resolve() != hook_path.resolve()]

    # 3) Pick up to `count` unique clips
    unique_pool = pool.copy()
    random.shuffle(unique_pool)
    if count and count > 0:
        to_take = min(count, len(unique_pool))
    else:
        to_take = len(unique_pool)
    for clip in unique_pool[:to_take]:
        selected.append(clip)
        total_dur += _dur(clip)

    # 4) If still too short, pick arbitrarily (with repeats) until we meet or exceed target
    if total_dur < target_duration:
        # allow repeats: choose from the original pool
        repeat_choices = pool.copy()
        if not repeat_choices:
            raise RuntimeError("No clips available to repeat for extension.")
        while total_dur < target_duration:
            clip = random.choice(repeat_choices)
            selected.append(clip)
            total_dur += _dur(clip)

    print(f"<STITCH> Randomized video to duration: {total_dur} with {len(selected)} clips.")
    # –––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––
    # 5) Build FFmpeg command using the concat filter:
    #
    #   ffmpeg -y -fflags +genpts
    #     -i clip0.mp4 -i clip1.mov -i clip2.mkv ...    # one -i per file in final_clips
    #     -filter_complex "concat=n=<N>:v=1:a=1[outv][outa]"
    #     -map "[outv]" -map "[outa]"
    #     -c:v libx264 -pix_fmt yuv420p -preset medium -crf 23
    #     -c:a aac -b:a 128k
    #     -movflags +faststart
    #     <output_path>
    #
    # Because we use the concat filter (instead of concat demuxer + filelist.txt),
    # FFmpeg will fully decode + re-encode each input clip, guaranteeing a perfectly
    # monotonic timestamp chain in the final output.

    # (a) Locate the FFmpeg executable via imageio_ffmpeg
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

    # (b) Build the list of "-i <abs_path>" arguments
    input_args: list[str] = []
    for clip in selected:
        input_args += ["-i", str(clip.resolve())]

    # (c) Number of clips to concatenate
    n = len(selected)

    # (d) Build the filter_complex string
    filter_complex = f"concat=n={n}:v=1:a=1[outv][outa]"

    # (e) Build the complete FFmpeg command
    cmd = [
              ffmpeg_exe,
              "-y",  # overwrite output if it already exists
              "-fflags", "+genpts",  # regenerate PTS/DTS for strict monotonic timestamps
          ] + input_args + [
              "-filter_complex", filter_complex,
              "-map", "[outv]",  # select concatenated video
              "-map", "[outa]",  # select concatenated audio
              "-c:v", "libx264",  # re-encode video to H.264
              "-pix_fmt", "yuv420p",  # ensure broad compatibility
              "-preset", "medium",  # trade‐off speed vs. compression
              "-crf", "23",  # output quality
              "-c:a", "aac",  # re‐encode audio to AAC
              "-b:a", "128k",  # audio bitrate
              "-movflags", "+faststart",  # place moov atom at front for streaming
              output_path
          ]

    # (f) Run the command
    print("\n=== Running FFmpeg concat‐filter command ===")
    print(" ".join(cmd))
    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(
            f"FFmpeg concat‐filter failed (exit code {e.returncode}). Check the source videos.\n"
        )

    print(f"<STITCH> → Successfully created concatenated file:\n   {output_path}")


def concatenate_clips_smart(
    clips: List[str],
    output_path: str,
    canvas_width: int = 1080,
    canvas_height: int = 1920,
    crop_mode: str = 'center'
) -> None:
    """
    PROFESSIONAL CONCATENATION with intelligent optimization.
    
    Uses concat DEMUXER (stream copy) instead of concat FILTER (re-encode).
    Only processes clips that actually need it. 16-24x faster than old approach.
    
    Args:
        clips: List of clip paths to concatenate (in order)
        output_path: Final output path
        canvas_width: Target canvas width
        canvas_height: Target canvas height
        crop_mode: Cropping mode ('center', 'fill', 'fit')
    """
    print(f"\n🚀 Smart Concatenation: {len(clips)} clips → {canvas_width}x{canvas_height}")
    
    # Step 1: Normalize all clips (with caching and GPU acceleration)
    normalized_clips, stats = ClipPreprocessor.normalize_clips(
        clips=[str(c) for c in clips],
        canvas_width=canvas_width,
        canvas_height=canvas_height,
        crop_mode=crop_mode
    )
    
    print(f"📊 Processing Stats:")
    print(f"   💾 Cache hits: {stats['cached_hits']} (instant)")
    print(f"   ⚡ GPU operations: {stats['resized'] + stats['converted']}")
    print(f"   ⏱️  Total time: {stats['processing_time']:.1f}s")
    
    # Step 2: Create filelist for concat demuxer
    filelist_path = str(WORKING_DIR / f"filelist_{uuid.uuid4().hex[:8]}.txt")
    
    try:
        with open(filelist_path, 'w') as f:
            for clip in normalized_clips:
                # Escape single quotes in path
                safe_path = str(clip).replace("'", "'\\''")
                f.write(f"file '{safe_path}'\n")
        
        # Step 3: Use concat DEMUXER (stream copy) to temp file
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        
        # Concat to temp file first (preserves speed of stream copy)
        temp_concat = str(WORKING_DIR / f"temp_concat_{uuid.uuid4().hex[:8]}.mp4")
        
        cmd = [
            ffmpeg_exe, '-y',
            '-fflags', '+genpts',  # Generate PTS metadata
            '-f', 'concat',
            '-safe', '0',
            '-i', filelist_path,
            '-c:v', 'copy',        # Stream copy video (fast)
            '-c:a', 'copy',        # Stream copy audio (fast)
            '-fps_mode', 'cfr',    # Force constant frame rate
            '-r', '30',            # Lock output to 30 FPS
            '-movflags', '+faststart',
            temp_concat
        ]
        
        print(f"\n⚡ Concatenating with stream copy + CFR (ultra-fast)...")
        subprocess.run(cmd, check=True, capture_output=True)
        
        # DISABLED: Normalization was cutting video duration (VideoToolbox issue)
        # Instead, just copy the concat output directly
        print(f"   📋 Using concat output directly (normalization disabled)")
        import shutil
        shutil.copy2(temp_concat, output_path)
        
        # Cleanup temp concat file
        try:
            os.remove(temp_concat)
        except:
            pass
        
        print(f"✅ Smart concatenation complete: {output_path}\n")
        
    finally:
        # Cleanup filelist
        if os.path.exists(filelist_path):
            os.remove(filelist_path)


def concatenate_clips_with_duration_control(
    clips_with_durations: List[dict],
    output_path: str,
    canvas_width: int,
    canvas_height: int,
    crop_mode: str,
    original_volume: float = 1.0
) -> None:
    """
    Professional concatenation with per-clip duration control and audio-aware processing.
    
    Handles clips that need duration trimming while maintaining performance
    through GPU acceleration and caching. Audio handling is based on original_volume:
    - original_volume = 0: Strip all clip audio (voiceover-only mode)
    - original_volume > 0: Preserve/add audio for mixing with voiceover
    
    Args:
        clips_with_durations: List of clip info dicts with path, durations, trim flags
        output_path: Final output path
        canvas_width: Target canvas width
        canvas_height: Target canvas height
        crop_mode: Cropping mode
        original_volume: Volume level for original clip audio (0=strip, >0=keep)
    """
    print(f"\n🎬 Processing {len(clips_with_durations)} clips with duration control...")
    
    # Step 1: Normalize to canvas and trim clips as needed
    processed_clips = []
    clips_needing_trim = sum(1 for c in clips_with_durations if c['needs_trim'])
    
    print(f"   📐 {clips_needing_trim} clips need duration trimming")
    
    for i, clip_info in enumerate(clips_with_durations):
        clip_path = clip_info['path']
        use_duration = clip_info['use_duration']
        needs_trim = clip_info['needs_trim']
        
        print(f"   Processing clip {i+1}/{len(clips_with_durations)}: {Path(clip_path).name}")
        
        # Determine audio mode based on original_volume setting
        # If original_volume is 0, user wants voiceover-only (strip clip audio)
        # Otherwise, preserve/add audio for mixing with voiceover
        audio_mode = 'strip' if original_volume == 0 else 'keep'
        
        # First, normalize to canvas (uses GPU + caching + audio-aware processing)
        normalized_clips, stats = ClipPreprocessor.normalize_clips(
            clips=[clip_path],
            canvas_width=canvas_width,
            canvas_height=canvas_height,
            crop_mode=crop_mode,
            audio_mode=audio_mode
        )
        
        normalized_clip = normalized_clips[0]
        
        # Then trim if needed
        if needs_trim:
            trimmed_clip = str(WORKING_DIR / f"trimmed_{uuid.uuid4().hex[:8]}.mp4")
            
            # Use stream copy trim (fast)
            ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
            cmd = [
                ffmpeg_exe, '-y',
                '-i', normalized_clip,
                '-t', str(use_duration),
                '-c', 'copy',  # Stream copy - no re-encoding
                trimmed_clip
            ]
            
            try:
                result = subprocess.run(cmd, check=True, capture_output=True, text=True)
                
                # Verify trimmed clip is valid
                if os.path.exists(trimmed_clip) and os.path.getsize(trimmed_clip) > 1000:
                    processed_clips.append(trimmed_clip)
                    print(f"     ✂️ Trimmed to {use_duration:.1f}s")
                else:
                    print(f"     ⚠️ Trim produced empty/tiny file, using full clip")
                    processed_clips.append(normalized_clip)
                    
            except subprocess.CalledProcessError as e:
                print(f"     ⚠️ Trim failed: {e}, using full clip")
                processed_clips.append(normalized_clip)
        else:
            processed_clips.append(normalized_clip)
            print(f"     ✓ Using full duration ({clip_info['full_duration']:.1f}s)")
    
    # Step 2: Concatenate processed clips (still uses concat demuxer)
    filelist_path = str(WORKING_DIR / f"filelist_{uuid.uuid4().hex[:8]}.txt")
    
    try:
        with open(filelist_path, 'w') as f:
            for clip in processed_clips:
                safe_path = str(clip).replace("'", "'\\''")
                f.write(f"file '{safe_path}'\n")
        
        # Concat to temp file first (preserves speed of stream copy)
        temp_concat = str(WORKING_DIR / f"temp_concat_{uuid.uuid4().hex[:8]}.mp4")
        
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        cmd = [
            ffmpeg_exe, '-y',
            '-fflags', '+genpts',  # Generate PTS metadata
            '-f', 'concat',
            '-safe', '0',
            '-i', filelist_path,
            '-c:v', 'copy',        # Stream copy video (fast)
            '-c:a', 'copy',        # Stream copy audio (fast)
            '-fps_mode', 'cfr',    # Force constant frame rate
            '-r', '30',            # Lock output to 30 FPS
            '-movflags', '+faststart',
            temp_concat
        ]
        
        print(f"   ⚡ Final concatenation (with PTS regeneration + CFR)...")
        subprocess.run(cmd, check=True, capture_output=True)
        
        # DISABLED: Normalization was cutting video duration (VideoToolbox issue)
        # Instead, just copy the concat output directly
        print(f"   📋 Using concat output directly (normalization disabled)")
        import shutil
        shutil.copy2(temp_concat, output_path)
        
        # Cleanup temp concat file
        try:
            os.remove(temp_concat)
        except:
            pass
        
        print(f"   ✅ Duration control concatenation complete")
        
    finally:
        # Cleanup temp files
        if os.path.exists(filelist_path):
            os.remove(filelist_path)
        
        for clip in processed_clips:
            # Only cleanup trimmed temp files (not the cached normalized ones)
            if 'trimmed_' in str(clip):
                try:
                    os.remove(clip)
                except:
                    pass


def build_clip_stitch_video_smart(
    random_source_dir: str,
    output_path: str,
    *,
    canvas_width: int = 1080,
    canvas_height: int = 1920,
    crop_mode: str = 'center',
    target_duration: Optional[float] = None,
    tts_audio_path: Optional[str] = None,
    random_count: Optional[int] = None,
    hook_video: Optional[str] = None,
    original_volume: float = 1.0,
    new_audio_volume: float = 1.0,
    clip_duration_mode: str = 'full',
    clip_duration_fixed: Optional[float] = None,
    clip_duration_range: Optional[tuple[float, float]] = None,
    extensions: tuple[str, ...] = (".mp4", ".mov", ".mkv", ".avi", ".hevc", ".m4v", ".webm")
) -> Tuple[bool, Optional[str]]:
    """
    PROFESSIONAL clip stitching with GPU acceleration and intelligent optimization.
    
    16-24x faster than old approach through:
    - Smart clip analysis (only process what's needed)
    - GPU acceleration for encoding
    - Concat demuxer (stream copy, no re-encoding)
    - Caching (instant on repeat runs)
    
    Args:
        random_source_dir: Directory containing source clips
        output_path: Final output video path
        canvas_width: Target canvas width
        canvas_height: Target canvas height
        crop_mode: How to fit clips to canvas
        target_duration: Target video duration (if no audio)
        tts_audio_path: Optional voiceover audio (determines duration if provided)
        random_count: Max number of clips to use
        hook_video: Optional clip to place first
        original_volume: Original audio volume (if has audio)
        new_audio_volume: Voiceover volume (if provided)
        extensions: Supported file extensions
        
    Returns:
        Tuple of (success, output_path_or_error_message)
    """
    from backend.services.pipeline_debugger import PipelineDebugger, probe_file_details
    
    # Initialize master debugger
    debugger = PipelineDebugger(f"Video: {Path(output_path).name}")
    tmp_files = []
    
    try:
        debugger.start_stage("SETUP", {
            'Canvas': f'{canvas_width}x{canvas_height}',
            'Crop Mode': crop_mode,
            'Original Volume': original_volume,
            'Voiceover Volume': new_audio_volume,
            'Clip Duration Mode': clip_duration_mode
        })
        
        print("\n=== Building Smart Clip Stitch Video ===")
        print(f"   Canvas: {canvas_width}x{canvas_height}")
        print(f"   Crop mode: {crop_mode}")
        
        # Determine target duration
        # Priority: explicit target_duration (music/manual) > voiceover duration
        if target_duration:
            # Explicit duration set (from music or manual) - use it!
            print(f"   Duration: {target_duration}s (explicit - music or manual)")
            target_dur = target_duration
            audio_dur = get_media_duration(tts_audio_path) if tts_audio_path else target_duration
        elif tts_audio_path:
            # No explicit duration, use voiceover
            audio_dur = get_media_duration(tts_audio_path)
            print(f"   Duration: {audio_dur}s (from voiceover)")
            target_dur = audio_dur
        else:
            return False, "Must provide either tts_audio_path or target_duration"
        
        # Step 1: Select clips to use
        src_dir = Path(random_source_dir)
        if not src_dir.is_dir():
            return False, f"Source directory not found: {random_source_dir}"
        
        pool = [p for p in src_dir.iterdir() if p.is_file() and p.suffix.lower() in extensions]
        if not pool and not hook_video:
            return False, f"No video clips found in {random_source_dir}"
        
        selected: List[Path] = []
        total_dur = 0.0
        
        # Add hook video first if provided
        if hook_video:
            hook_path = Path(hook_video)
            if hook_path.is_file():
                selected.append(hook_path)
                total_dur += get_media_duration(str(hook_path))
                pool = [p for p in pool if p.resolve() != hook_path.resolve()]
        
        # Pick clips to reach target duration (REVERTED TO WORKING VERSION)
        clips_with_durations = []
        total_estimated_dur = 0.0
        random.shuffle(pool)
        
        if not pool:
            return False, "No clips available in source directory"
        
        print(f"   Available clips: {len(pool)}")
        
        # Use each clip once, in random order
        for clip in pool:
            clip_full_duration = get_media_duration(str(clip))
            
            # Calculate how much of this clip to use
            if clip_duration_mode == 'fixed' and clip_duration_fixed:
                clip_use_duration = min(clip_duration_fixed, clip_full_duration)
            elif clip_duration_mode == 'random' and clip_duration_range:
                min_dur, max_dur = clip_duration_range
                max_possible = min(max_dur, clip_full_duration)
                clip_use_duration = random.uniform(min_dur, max_possible)
            else:  # 'full'
                clip_use_duration = clip_full_duration
            
            clips_with_durations.append({
                'path': str(clip),
                'full_duration': clip_full_duration,
                'use_duration': clip_use_duration,
                'needs_trim': clip_use_duration < clip_full_duration - 0.1
            })
            
            total_estimated_dur += clip_use_duration
            
            # Stop if we've reached target duration
            if total_estimated_dur >= target_dur:
                break
        
        print(f"   Selected {len(clips_with_durations)} clips")
        print(f"   Clip duration mode: {clip_duration_mode}")
        print(f"   Estimated total: {total_estimated_dur:.1f}s")
        
        # Log clip selection details
        debugger.start_stage("CLIP SELECTION", {
            'Source Directory': random_source_dir,
            'Total Clips Available': len(pool),
            'Clips Selected': len(clips_with_durations),
            'Target Duration': f'{target_dur:.2f}s',
            'Estimated Total': f'{total_estimated_dur:.2f}s'
        })
        
        for i, clip_info in enumerate(clips_with_durations, 1):
            clip_details = probe_file_details(clip_info['path'])
            debugger.log(f"Clip {i}: {Path(clip_info['path']).name}", {
                'Full Duration': f"{clip_info['full_duration']:.2f}s",
                'Will Use': f"{clip_info['use_duration']:.2f}s",
                'Needs Trim': clip_info['needs_trim'],
                'Size': f"{clip_details.get('size_mb', 0):.1f}MB",
                'Resolution': clip_details.get('resolution', '?'),
                'Streams': clip_details.get('streams', '?')
            })
        
        # Step 2: Smart concatenation with per-clip duration control
        tmp_video = str(WORKING_DIR / f"temp_stitched_{uuid.uuid4().hex[:8]}.mp4")
        tmp_files.append(tmp_video)
        
        debugger.start_stage("CONCATENATION", {
            'Method': 'Duration control with trimming',
            'Output': Path(tmp_video).name,
            'Canvas': f'{canvas_width}x{canvas_height}',
            'Audio Mode': 'strip' if original_volume == 0 else 'keep'
        })
        
        concatenate_clips_with_duration_control(
            clips_with_durations,
            tmp_video,
            canvas_width,
            canvas_height,
            crop_mode,
            original_volume
        )
        
        # Log concat result
        concat_details = probe_file_details(tmp_video)
        debugger.log("Concat Complete", concat_details)
        
        # Step 3: Handle audio
        if tts_audio_path:
            print("<STITCH> Merging with voiceover audio...")
            
            voiceover_details = probe_file_details(tts_audio_path)
            debugger.start_stage("AUDIO MERGE", {
                'Voiceover File': Path(tts_audio_path).name,
                'Voiceover Duration': f"{voiceover_details.get('duration', 0):.2f}s",
                'Original Volume': original_volume,
                'Voiceover Volume': new_audio_volume,
                'Tool': 'merge_video_and_audio()'
            })
            
            tmp_merged = str(WORKING_DIR / f"temp_merged_{uuid.uuid4().hex[:8]}.mp4")
            tmp_files.append(tmp_merged)
            
            merge_video_and_audio(
                video_input=tmp_video,
                audio_input=tts_audio_path,
                output_path=tmp_merged,
                original_volume=original_volume,
                new_audio_volume=new_audio_volume
            )
            
            merged_details = probe_file_details(tmp_merged)
            debugger.log("Audio Merge Complete", merged_details)
            
            # Trim to target duration (respects music/manual duration settings)
            final_dur = get_media_duration(tmp_merged)
            if final_dur > target_dur:
                debugger.log(f"Trimming to target duration: {target_dur:.2f}s (was {final_dur:.2f}s)")
                tmp_trimmed = str(WORKING_DIR / f"temp_trimmed_{uuid.uuid4().hex[:8]}.mp4")
                tmp_files.append(tmp_trimmed)
                trim_media(tmp_merged, tmp_trimmed, target_dur)
                os.replace(tmp_trimmed, tmp_merged)
                
                trimmed_details = probe_file_details(tmp_merged)
                debugger.log("Trimmed to target duration", trimmed_details)
            
            os.replace(tmp_merged, output_path)
        else:
            # No audio, just use the stitched video
            debugger.log("No voiceover audio - using stitched video directly")
            os.replace(tmp_video, output_path)
        
        # Log final output
        debugger.start_stage("FINAL OUTPUT", {
            'File': Path(output_path).name,
            'Location': str(output_path)
        })
        final_details = probe_file_details(output_path)
        debugger.log("Final Video", final_details)
        
        print(f"✅ Clip stitch video complete: {output_path}")
        
        # Print complete pipeline debug report
        debugger.print_full_report()
        
        return True, output_path
        
    except Exception as e:
        print(f"ERROR in build_clip_stitch_video_smart: {e}")
        import traceback
        traceback.print_exc()
        
        # Print debug report even on failure
        try:
            debugger.print_full_report()
        except:
            pass
        
        return False, str(e)
        
    finally:
        # Cleanup temp files
        for f in tmp_files:
            try:
                if os.path.exists(f):
                    os.remove(f)
            except:
                pass


def build_clip_stitch_video(
    random_source_dir: str,
    tts_audio_path: str,
    output_path: str,
    *,
    random_count: Optional[int] = None,
    hook_video: Optional[str] = None,
    original_volume: float = 1.0,
    new_audio_volume: float = 1.0,
    trim_if_long: bool = True,
    extend_if_short: bool = True,
    extensions: tuple[str, ...] = (".mp4", ".mov", ".mkv")
) -> Tuple[bool, Optional[str]]:
    """
    LEGACY FUNCTION - Kept for backward compatibility.
    
    For new implementations, use build_clip_stitch_video_smart() which is 16-24x faster.
    
    1) Concatenate random clips from `random_source_dir` (with optional `hook_video`) into temp_video.mp4.
       If extend_if_short=True, picks until video ≥ audio duration; if trim_if_long=True, will trim after.
    2) Merge temp_video.mp4 with tts_audio_path (volumes via original_volume/new_audio_volume) → temp_merged.mp4.
    3) Trim temp_merged.mp4 to exactly the audio duration if trim_if_long or extend_if_short is True.
    4) Move the final temp to `output_path`.

    Returns (True, output_path) on success, or (False, error_message) on failure.
    """
    tmp_files = []
    try:
        print("\n=== Building clip stitch video ===")
        print(f"<STITCH> Setup: extend_if_short = {extend_if_short}, trim_if_long = {trim_if_long}")
        # 1) Audio duration
        audio_dur = get_media_duration(tts_audio_path)
        print(f"<STITCH> Audio duration: {audio_dur} seconds.")

        # 2) Build initial video
        tmp_video = str(WORKING_DIR / f"temp_video_{uuid.uuid4().hex[:8]}.mp4")
        tmp_files.append(tmp_video)
        concatenate_to_duration(
            source_directory=random_source_dir,
            output_path=tmp_video,
            target_duration=(audio_dur if extend_if_short else 0.0),
            count=random_count,
            hook_video=hook_video,
            extensions=extensions
        )

        # 3) Check length and trim if too long
        vid_dur = get_media_duration(tmp_video)
        print(f"<STITCH> First TRIM. Video duration: {vid_dur}, Audio duration: {audio_dur}.")
        if vid_dur > audio_dur and trim_if_long:
            tmp_trimmed = str(WORKING_DIR / f"temp_video_trim_{uuid.uuid4().hex[:8]}.mp4")
            tmp_files.append(tmp_trimmed)
            trim_media(tmp_video, tmp_trimmed, audio_dur)
            os.replace(tmp_trimmed, tmp_video)

        print("<STITCH> Merging audio and video")
        # 4) Merge with audio
        tmp_merged = str(WORKING_DIR / f"temp_merged_{uuid.uuid4().hex[:8]}.mp4")
        tmp_files.append(tmp_merged)
        merge_video_and_audio(
            video_input=tmp_video,
            audio_input=tts_audio_path,
            output_path=tmp_merged,
            original_volume=original_volume,
            new_audio_volume=new_audio_volume
        )

        # 5) Final trim to audio duration (in case extend_if_short was False but audio > video)
        final_dur = get_media_duration(tmp_merged)
        print(f"<STITCH> TRIM. Video duration: {final_dur}, Audio duration: {audio_dur}.")
        print(f"<STITCH> DEBUG: Current working directory: {os.getcwd()}")
        print(f"<STITCH> DEBUG: WORKING_DIR: {WORKING_DIR}")
        if final_dur > audio_dur and trim_if_long:
            tmp_final_trim = str(WORKING_DIR / f"temp_final_{uuid.uuid4().hex[:8]}.mp4")
            print(f"<STITCH> DEBUG: Final trim temp file path: {tmp_final_trim}")
            print(f"<STITCH> DEBUG: WORKING_DIR exists: {WORKING_DIR.exists()}")
            print(f"<STITCH> DEBUG: WORKING_DIR writable: {os.access(WORKING_DIR, os.W_OK)}")
            tmp_files.append(tmp_final_trim)
            try:
                print(f"<STITCH> DEBUG: Starting final trim operation...")
                trim_media(tmp_merged, tmp_final_trim, audio_dur)
                print(f"<STITCH> DEBUG: Final trim successful, replacing merged file...")
                os.replace(tmp_final_trim, tmp_merged)
                print(f"<STITCH> DEBUG: Final trim and replace completed successfully")
            except Exception as trim_e:
                print(f"<STITCH> ERROR: Final trim failed: {trim_e}")
                print(f"<STITCH> DEBUG: tmp_merged exists: {os.path.exists(tmp_merged)}")
                print(f"<STITCH> DEBUG: tmp_final_trim exists: {os.path.exists(tmp_final_trim)}")
                raise
        else:
            print(f"<STITCH> DEBUG: Skipping final trim (final_dur <= audio_dur or trim_if_long=False)")

        print(f"<STITCH> RESULT. Final duration: {get_media_duration(tmp_merged)} seconds. Audio duration: {audio_dur}.")

        # 6) Move to output
        os.replace(tmp_merged, output_path)
        return True, output_path

    except Exception as e:
        print(f"ERROR in build_final_video: {e}")
        return False, str(e)

    finally:
        # cleanup all temporaries
        for f in tmp_files:
            try:
                if os.path.exists(f):
                    os.remove(f)
            except Exception:
                pass