#
# concat_random_videos.py
#
# Shuffle a subset (or all) of the videos in a folder and concatenate them into one output file,
# forcing FFmpeg to re-encode so that concatenation works regardless of differing codecs/containers.
#

import random
import subprocess
from pathlib import Path

import imageio_ffmpeg


def concatenate_videos_randomly(
        source_directory: str,
        output_path: str,
        count: int | None = None,
        hook_video: str | None = None,
        extensions: tuple[str, ...] = (".mp4", ".mov", ".mkv")
) -> None:
    """
    1. Scans `source_directory` for all files ending in one of `extensions`.
    2. If `hook_video` is provided, that clip is forced to be the very first in the output.
    3. Randomizes the order of the remaining clips.
    4. Picks the first `count-1` of them (if `count` is given and >0). If `count` is None or <= 0, uses all.
    5. Uses FFmpeg’s concat filter (via -filter_complex) to re-encode and concatenate into `output_path`.

    Parameters:
        source_directory (str):
            folder containing video clips to choose from.

        output_path (str):
            path to the final concatenated output (e.g. "/Users/me/final.mp4").

        count (int|None):
            total number of clips in the final output (including hook_video, if any).
            If None or <= 0, concatenate all available (minus any duplicate of hook).
            If count > 0 and hook_video is provided, total clips = min(count, available+maybe hook) with hook first.

        extensions (tuple[str,...]):
            file extensions to include (case-insensitive). Default is (".mp4", ".mov", ".mkv").

        hook_video (str|None):
            path to a single clip that must appear first in the output.
            If None, everything is purely random. If provided, that single clip is placed at index 0
            and the remaining `count-1` (or all) are chosen at random from `source_directory`.
    """
    src_dir = Path(source_directory)
    if not src_dir.exists() or not src_dir.is_dir():
        raise FileNotFoundError(f"Source folder not found or not a directory: {source_directory}")

    # –––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––
    # 1) Gather all video files in `source_directory` matching `extensions`
    all_videos = [
        f for f in src_dir.iterdir()
        if f.is_file() and f.suffix.lower() in extensions
    ]
    if not all_videos:
        raise RuntimeError(f"No video files with extensions {extensions} found in {source_directory}")

    # –––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––
    # 2) Handle the optional hook_video (must appear first)
    hook_path: Path | None = None
    if hook_video:
        hook_path = Path(hook_video).resolve()
        if not hook_path.exists() or not hook_path.is_file():
            raise FileNotFoundError(f"Hook video not found or not a file: {hook_video}")

        # Remove any duplicate of hook from the "all_videos" list (by absolute path)
        # so that we don't include it twice.
        all_videos = [
            v for v in all_videos
            if v.resolve() != hook_path
        ]

    # –––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––
    # 3) Shuffle the “remaining” list of clips
    random.shuffle(all_videos)

    # –––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––
    # 4) Select how many clips we actually want to concatenate
    # If hook_video is used and count>0, then we pick (count - 1) from the remaining.
    if count and count > 0:
        if hook_path:
            # total target = count. We already have hook as first. So pick up to count-1 from shuffled “all_videos”
            desired_random = count - 1
            if desired_random <= 0:
                # They requested count=1 → only hook, no random picks.
                selected_random = []
            else:
                selected_random = all_videos[:min(desired_random, len(all_videos))]
        else:
            # Pure random selection of `count` from “all_videos”
            selected_random = all_videos[:min(count, len(all_videos))]
    else:
        # count is None or <=0 → take all (in random order)
        selected_random = all_videos

    # Build the final list in order: [hook_video (if any)] + selected_random
    final_clips: list[Path] = []
    if hook_path:
        final_clips.append(hook_path)
    final_clips.extend(selected_random)

    if not final_clips:
        raise RuntimeError("After applying hook and count logic, no clips remain to concatenate.")

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
    for clip in final_clips:
        input_args += ["-i", str(clip.resolve())]

    # (c) Number of clips to concatenate
    n = len(final_clips)

    # (d) Build the filter_complex string
    filter_complex = f"concat=n={n}:v=1:a=1[outv][outa]"

    # (e) Build the complete FFmpeg command
    cmd = [
        ffmpeg_exe,
        "-y",                        # overwrite output if it already exists
        "-fflags", "+genpts",        # regenerate PTS/DTS for strict monotonic timestamps
    ] + input_args + [
        "-filter_complex", filter_complex,
        "-map", "[outv]",            # select concatenated video
        "-map", "[outa]",            # select concatenated audio
        "-c:v", "libx264",           # re-encode video to H.264
        "-pix_fmt", "yuv420p",       # ensure broad compatibility
        "-preset", "medium",         # trade‐off speed vs. compression
        "-crf", "23",                # output quality
        "-c:a", "aac",               # re‐encode audio to AAC
        "-b:a", "128k",              # audio bitrate
        "-movflags", "+faststart",   # place moov atom at front for streaming
        output_path
    ]

    # (f) Run the command
    print("\n=== Running FFmpeg concat‐filter command ===")
    print(" ".join(cmd))
    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(
            f"FFmpeg concat‐filter failed (exit code {e.returncode}).\n"
            f"Command: {' '.join(e.cmd)}"
        )

    print(f"→ Successfully created concatenated file:\n   {output_path}")