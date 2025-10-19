"""
merge_audio_video.py

Overlay a new audio track (e.g., TTS) on top of a video's original audio, with adjustable volume
for each track. The video stream is copied, and the resulting mixed audio is re-encoded to AAC.

Usage:
    mix_video_and_audio(
        video_input="path/to/original_video.mp4",
        audio_input="path/to/new_audio.mp3",
        output_path="path/to/output_video.mp4",
        original_volume=1.0,
        new_audio_volume=1.0,
        aac_bitrate="128k"
    )
"""

import os
import subprocess
import imageio_ffmpeg


def merge_video_and_audio(
    video_input: str,
    audio_input: str,
    output_path: str,
    *,
    original_volume: float = 1.0,
    new_audio_volume: float = 1.0,
    aac_bitrate: str = "128k",
    amix_duration: str = "first",
    dropout_transition: int = 2
) -> bool:
    """
    Mixes `audio_input` on top of the existing audio of `video_input`, adjusting volumes.
    Writes the result to `output_path`. Returns True on success.

    Parameters:
        video_input     (str): Path to the source video (with its own audio).
        audio_input     (str): Path to the new audio to overlay.
        output_path     (str): Path where the final video will be saved.
        original_volume (float): Multiplier for the original video's audio (e.g., 0.8 to reduce by 20%).
        new_audio_volume(float): Multiplier for the new audio track (e.g., 0.5 to make it quieter).
                                **passing 0.0 into volume will mute the audio track.
        aac_bitrate     (str): Bitrate for the re-encoded AAC audio (e.g., "128k").
        amix_duration   (str): How to determine output length ("first", "longest", etc.). Default "first".
        dropout_transition(int): Crossfade time (in seconds) if one stream ends early. Default 2.

    Returns:
        bool: True if FFmpeg succeeds and output exists; False otherwise.
    """
    # Ensure inputs exist
    if not os.path.isfile(video_input):
        print(f"ERROR: Video input not found: {video_input}")
        return False
    if not os.path.isfile(audio_input):
        print(f"ERROR: Audio input not found: {audio_input}")
        return False

    # Get ffmpeg executable path
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    
    # Check if video has an audio stream
    probe_cmd = [
        ffmpeg_exe,
        "-i", video_input,
        "-v", "error",
        "-select_streams", "a",
        "-show_entries", "stream=codec_type",
        "-of", "default=noprint_wrappers=1:nokey=1"
    ]
    
    try:
        result = subprocess.run(probe_cmd, capture_output=True, text=True, check=False)
        video_has_audio = bool(result.stdout.strip())
    except:
        # If probe fails, assume video has audio (backward compatibility)
        video_has_audio = True
    
    # Build command based on whether video has audio
    if video_has_audio and original_volume > 0:
        # Video has audio - use amix to combine both audio streams
        filter_complex = (
            f"[0:a]volume={original_volume}[a0];"
            f"[1:a]volume={new_audio_volume}[a1];"
            f"[a0][a1]amix=inputs=2:duration={amix_duration}:dropout_transition={dropout_transition}[aout]"
        )
        audio_map = "[aout]"
    else:
        # Video has no audio OR original volume is 0 - just use new audio directly
        print(f"INFO: Video has no audio stream or original_volume=0, using voiceover only")
        filter_complex = f"[1:a]volume={new_audio_volume}[aout]"
        audio_map = "[aout]"

    cmd = [
        ffmpeg_exe,
        "-y",
        "-i", video_input,
        "-i", audio_input,
        "-filter_complex", filter_complex,
        "-map", "0:v",          # take video stream from first input
        "-map", audio_map,      # take processed audio
        "-c:v", "copy",         # copy video codec as-is
        "-c:a", "aac",          # re-encode audio to AAC
        "-b:a", aac_bitrate,
        output_path
    ]

    try:
        subprocess.run(cmd, check=True, capture_output=True)
    except subprocess.CalledProcessError as e:
        print(f"ERROR: ffmpeg mix failed (exit code {e.returncode})")
        print("Command:", " ".join(cmd))
        return False

    # Verify that output file was created successfully
    if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
        print(f"ERROR: Mixed output missing or empty: {output_path}")
        return False

    print(f"Successfully created mixed video → {output_path}")
    return True
