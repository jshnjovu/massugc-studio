import os
import cv2
import subprocess
import uuid
import random
import imageio_ffmpeg
from pathlib import Path
from typing import Optional, Tuple
from mutagen import File as MutagenFile

from backend.merge_audio_video import merge_video_and_audio

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