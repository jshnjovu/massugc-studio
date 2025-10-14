# create_video.py (v1.20 - Multi-Product + Overlay Randomization)
import os
import argparse
import cv2
import time
import uuid
import requests
import imageio_ffmpeg # For managing ffmpeg on different envs
import subprocess # For running ffmpeg
import re # For parsing ffmpeg output
import shutil # For copying files
import random
import json
from datetime import timedelta, datetime # Import datetime

import whisper
from dotenv import load_dotenv
from openai import OpenAI
from elevenlabs.client import ElevenLabs
from elevenlabs import save
from google.cloud import storage
import traceback # For detailed error logging
import math # For ceiling function later
from typing import Callable, Optional, Tuple
import os, re, time, uuid, traceback
from datetime import datetime
from pathlib import Path

from backend.randomizer import randomize_video
from backend.clip_stitch_generator import build_clip_stitch_video

# ─── Global Working Directory Setup ────────────────────────────────
HOME_DIR       = Path.home() / ".zyra-video-agent"
WORKING_DIR    = HOME_DIR / "working-dir"
OUTPUT_BASE_DIR = HOME_DIR / "output"

# Make sure they exist
for d in (WORKING_DIR, OUTPUT_BASE_DIR):
    d.mkdir(parents=True, exist_ok=True)

# --- Dynamic Timeout Helper for FFmpeg Operations ---
def calculate_ffmpeg_timeout(base_timeout=1800, operation_type="encoding"):
    """
    Calculate appropriate timeout for FFmpeg operations based on complexity.
    
    Args:
        base_timeout: Base timeout in seconds (default 30 minutes)
        operation_type: Type of operation for logging
    
    Returns:
        Timeout in seconds, scaled for complex operations but capped at maximum
    """
    # For long-running jobs, allow up to 3x the base timeout
    max_timeout = min(base_timeout * 3, 10800)  # Cap at 3 hours per operation
    print(f"FFmpeg {operation_type} timeout set to {max_timeout} seconds ({max_timeout/60:.1f} minutes)")
    return max_timeout

# --- Configuration ---
SCRIPT_VERSION = "1.17 (Overlay Feature Added, Corrected Placement, Helpers Included)" # Updated version
OPENAI_MODEL = "gpt-4o"
ELEVENLABS_MODEL = "eleven_multilingual_v2"
TEMP_AUDIO_FILENAME_BASE = "temp_generated_audio" # Base name, will add UUID
DREAMFACE_SUBMIT_URL = "https://api.newportai.com/api/async/talking_face"
DREAMFACE_POLL_URL = "https://api.newportai.com/api/getAsyncResult"

# Polling config - EXTENDED FOR LONG DREAMFACE PROCESSING
POLLING_INTERVAL_SECONDS = 20
MAX_POLLING_ATTEMPTS = 180  # 20 * 180 = 3600s (1 hour total)
# Silence removal config
SILENCE_THRESHOLD_DB = "-35dB"
SILENCE_MIN_DURATION_S = "0.4"

# --- Overlay Defaults (Temporary fallback if no config file is used) ---
DEFAULT_OVERLAY_POSITIONS = [{"x": "10", "y": "10", "w": "-1", "h": "-1"}]

# --- Helper Functions (Copied from User's v1.16) ---

def run_ffmpeg_command(cmd):
    """Runs an FFmpeg command using subprocess and returns (success, error_message)."""
    try:
        subprocess.run(cmd, check=True)
        return True, None
    except subprocess.CalledProcessError as e:
        return False, str(e)

def generate_script(client: OpenAI, product: str, persona: str, setting: str, emotion: str, hook_guidance: str, example_script: str, language: str, enhance_for_elevenlabs: bool, brand_name: str) -> str | None:
    """Generates script via OpenAI based on refined prompt structure and length request. Returns script text or None."""


def generate_script(client: OpenAI, product: str, persona: str, setting: str, emotion: str, hook_guidance: str, example_script: str, language: str, enhance_for_elevenlabs: bool, brand_name: str) -> str | None:
    """Generates script via OpenAI based on refined prompt structure and length request. Returns script text or None."""
    # Inside the generate_script function in create_video.py
# (Make sure this is within the function definition that now accepts language, enhance_for_elevenlabs, brand_name)

    print(f"Generating script with model: {OPENAI_MODEL} using updated prompt logic...")
    if not example_script or len(example_script.strip()) < 50:
        print("ERROR: Example script provided is missing or too short. Please provide a valid example.")
        return None

    # --- Step 3 START: Modify Prompt Construction ---

    # 3.1: New System Prompt (More specific constraints)
    system_prompt = (
        "You are a professional scriptwriter and persuasive storyteller focused on crafting emotionally resonant, high-converting TikTok Shop video scripts "
        "Your goal is to transform simple prompts into compelling, human-centered narratives that flow naturally in voiceover — using structured storytelling, emotional insight, and subtle persuasion to spark trust and drive action "
        "You are an introspective storyteller crafting grounded, emotionally compelling TikTok Shop scripts. Your scripts are written like personal reflections the kind of quiet honesty someone might share on a podcast or in a heartfelt voiceover. Avoid buzzwords, and sales tactics. Let the narrative unfold naturally, using human struggles like fatigue, burnout, loss of drive to guide the arc. Speak plainly and insightfully. Your goal is not to sell, but to share and in doing so, build quiet trust."
        "Avoid overused supplement marketing clichés. Do not use words like zest, vital, game-changer, enhances. Speak like someone unpacking their personal journey in a quiet moment not performing."
        "Strictly adhere to the output format requested. Do NOT include explanations, introductions, summaries, "
        "or any text other than the script content itself unless specifically asked to use SSML tags. "
        "Do NOT use markers like 'Script:', '[HOOK]', '[INTRO]', stage directions like '[camera pans]', or sound cues."
    )

    # 3.2: Build the User Prompt Dynamically
    prompt_lines = []
    prompt_lines.append(f"Product: {product}")
    prompt_lines.append(f"Creator Persona: {persona}")
    prompt_lines.append(f"Setting: {setting}")
    prompt_lines.append(f"Emotion: {emotion}")
    prompt_lines.append(f"Language: {language}") # Use language variable
    prompt_lines.append(f"Hook Requirement: {hook_guidance}")
    prompt_lines.append(f"Brand Name to include naturally near the end: {brand_name}") # Add brand name context

    # Add conditional SSML instructions
    if enhance_for_elevenlabs:
        prompt_lines.append(
            "\nIMPORTANT FORMATTING REQUIREMENT: "
            "Make this script perfect for eleven labs to make it sound very human-like. " # Your requested instruction
            "Wrap the entire script output in <speak> tags. Use SSML tags like <break time=\"Xs\"/> for pauses (vary duration appropriately, e.g., 0.3s, 0.7s, 1s) "
            "and <emphasis level=\"moderate\"> for moderate emphasis on key words/phrases to ensure a human-like delivery for ElevenLabs text-to-speech. "
            "Focus on natural pauses and tonality. But don't add anything that tries to change the pronunciation of specific words." # Your requested instruction
        )
        prompt_lines.append("The example script below MAY NOT contain SSML, but your output MUST use SSML tags as described above.") # Clarify example relevance
    else:
        prompt_lines.append(
            "\nIMPORTANT FORMATTING REQUIREMENT: "
            "Output ONLY the raw spoken dialogue text, with no extra tags (like SSML) or formatting."
        )

    # --- Start Replace --- (Replace the single length request line with this block)

    target_duration = "75 to 90 seconds" # Define target duration
    if enhance_for_elevenlabs:
        # If SSML is ON, explicitly ask AI to account for break times
        prompt_lines.append(
            f"\nGenerate one unique script based on these details. IMPORTANT: The total duration, including both the spoken dialogue AND the <break> tag pause times, "
            f"should be approximately {target_duration} long. Please factor in the pause durations when determining script length."
        )
    else:
        # If SSML is OFF, the original time request is probably fine
        prompt_lines.append(
            f"\nGenerate one unique script based on these details. The script should be suitable for a video approximately {target_duration} long."
        )

    # --- End Replace ---

    prompt_lines.append(f"\nHere is an example script primarily for structure, tone, and style inspiration, please follow this style closely (ignore its specific formatting if SSML was requested above):")
    prompt_lines.append(f"\n--- BEGIN EXAMPLE SCRIPT ---")
    prompt_lines.append(example_script) # Assumes example_script is the full string content
    prompt_lines.append(f"--- END EXAMPLE SCRIPT ---")

    # New Final Reminder (accounts for conditional SSML)
    if enhance_for_elevenlabs:
        prompt_lines.append(
            "\nFinal Reminder: Output ONLY the script content enclosed in <speak> tags, using appropriate <break> and <emphasis> SSML tags as requested. "
            "Do not add any other commentary, introductions, summaries, bracketed notes, or stage directions."
        )
    else:
        prompt_lines.append(
            "\nFinal Reminder: Output ONLY the raw spoken dialogue text for the script. "
            "Do not add any commentary, introductions, summaries, SSML tags, bracketed notes, or stage directions."
        )

    # Combine lines into the final user prompt string
    user_prompt = "\n".join(prompt_lines)

    # --- Step 3 END: Modify Prompt Construction ---

    # The rest of the function (OpenAI API call, cleanup) remains largely the same...
    print("\n--- Sending Prompt to OpenAI ---")
    # Optional: Print the constructed prompt to see exactly what's being sent
    # print("--- USER PROMPT ---")
    # print(user_prompt)
    # print("-------------------")
    print("-------------------------------\n")

    try:
        response = client.chat.completions.create(
            # ... rest of API call parameters (model, messages, temperature) ...
            # Make sure messages uses the new system_prompt and user_prompt variables
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7 # Keep temperature for now, can tweak later if needed
        )
        script_content = response.choices[0].message.content.strip()

        # --- IMPORTANT: SSML needs careful cleanup ---
        # The existing cleanup might strip SSML tags. We need to adjust it.
        # If SSML is expected, we probably want LESS cleanup, just removing prefix/suffix junk.
        # If SSML is NOT expected, the old cleanup is fine.

        if enhance_for_elevenlabs:
            # For SSML, maybe only strip leading/trailing whitespace and common GPT preamble/postamble,
            # but be careful not to strip the <speak> tags themselves or tags within.
            # This needs careful testing. Let's start minimal:
            print(f"DEBUG: Raw SSML content from OpenAI:\n---\n{script_content}\n---")
            # Minimal cleanup for SSML - remove common non-SSML junk
            unwanted_phrases_ssml = ["```xml", "```", "Response:", "Output:", "Generated Script:"] # Add others if needed
            cleaned_script = script_content
            for phrase in unwanted_phrases_ssml:
                if cleaned_script.startswith(phrase):
                    cleaned_script = cleaned_script[len(phrase):].lstrip()
                if cleaned_script.endswith(phrase):
                    cleaned_script = cleaned_script[:-len(phrase)].rstrip()
            # Ensure it starts/ends with <speak> tags (basic check)
            if not cleaned_script.startswith("<speak>"):
                print("Warning: SSML output doesn't start with <speak>. Might need manual correction.")
            if not cleaned_script.endswith("</speak>"):
                print("Warning: SSML output doesn't end with </speak>. Might need manual correction.")

        else:
            # Use the ORIGINAL more aggressive cleanup for non-SSML text
            print(f"DEBUG: Raw non-SSML content from OpenAI:\n---\n{script_content}\n---")
            unwanted_phrases = [
                "script:", "here's the script:", "script start", "script end",
                "--- begin script ---", "--- end script ---",
                "--- begin example script ---", "--- end example script ---",
                "okay, here is the script:", "sure, here's a script:", "certainly, here is the script:",
                "here is one script:", "one script:", "```markdown", "```",
                "Response:", "Output:", "Generated Script:", "Okay, here's a script...",
                "<speak>", "</speak>" # Also remove speak tags if enhance was FALSE
            ]
            cleaned_script = script_content
            modified = True
            while modified:
                modified = False
                original_content = cleaned_script
                for phrase in unwanted_phrases:
                    if cleaned_script.lower().startswith(phrase.lower()):
                        cleaned_script = cleaned_script[len(phrase):].lstrip(" \n\t:")
                        modified = True
                        break
                    if cleaned_script.lower().endswith(phrase.lower()):
                        cleaned_script = cleaned_script[:-len(phrase)].rstrip(" \n\t:")
                        modified = True
                        break
            # Add the regex cleanup here as discussed (Idea D) for non-SSML
            cleaned_script = re.sub(r'\[.*?\]', '', cleaned_script) # Remove [...]
            # Optional: Remove (...) - use with caution
            # cleaned_script = re.sub(r'\(.*?\)', '', cleaned_script)
            cleaned_script = "\n".join(line for line in cleaned_script.splitlines() if line.strip()) # Remove empty lines

        cleaned_script = cleaned_script.strip()
        if not cleaned_script:
            print("ERROR: Script content became empty after cleanup.")
            return None

        # --- END Adjust Cleanup ---

        print("Script generated successfully by OpenAI (after cleanup).")
        return cleaned_script

    # ... keep the rest of the function (except block) ...

    except Exception as e:
        print(f"Error calling OpenAI API: {e}")
        traceback.print_exc() # Add traceback for OpenAI errors
        return None

def generate_audio(client: ElevenLabs, script_text: str, voice_id: str, output_path: str, model: str = ELEVENLABS_MODEL) -> bool:
    """Generates audio via ElevenLabs. Returns True/False."""
    print(f"Generating audio with ElevenLabs Voice ID: {voice_id}...")
    try:
        if not script_text:
            print("Error: Cannot generate audio from empty script.")
            return False
        
        # Use the new ElevenLabs API structure
        audio_bytes = client.text_to_speech.convert(
            text=script_text,
            voice_id=voice_id,
            model_id=model,
            output_format="mp3_44100_128"
        )
        
        # Save the audio bytes to file
        with open(output_path, 'wb') as f:
            for chunk in audio_bytes:
                if isinstance(chunk, bytes):
                    f.write(chunk)
        
        # Verify file creation and size
        if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
             print(f"Audio successfully generated and saved to: {output_path}")
             return True
        else:
             print(f"Error: Audio file generation appeared successful but file is missing or empty: {output_path}")
             if os.path.exists(output_path): # Clean up empty file if created
                 try: os.remove(output_path)
                 except OSError: pass
             return False
    except Exception as e:
        print(f"Error calling ElevenLabs API or saving audio: {e}")
        traceback.print_exc() # Add traceback
        return False


def upload_to_gcs(bucket_name: str, source_file_name: str, destination_blob_name: str) -> bool:
    """Uploads a file to the GCS bucket."""
    if not os.path.exists(source_file_name):
        print(f"Error: Source file for GCS upload not found: {source_file_name}"); return False
    if os.path.getsize(source_file_name) == 0:
        print(f"Error: Source file for GCS upload is empty: {source_file_name}"); return False
    print(f"Uploading {source_file_name} to gs://{bucket_name}/{destination_blob_name}...")
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(destination_blob_name)
        # Consider adding a timeout? Default might be long.
        blob.upload_from_filename(source_file_name, timeout=600)
        print("File uploaded successfully.")
        return True
    except Exception as e:
        print(f"Error uploading to GCS: {e}")
        traceback.print_exc() # Add traceback
        return False

def generate_signed_url(bucket_name: str, blob_name: str, expiration_minutes: int = 20) -> str | None:
    """Generates a v4 signed URL for downloading a blob."""
    print(f"Generating signed URL for gs://{bucket_name}/{blob_name}...")
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        url_expiration = timedelta(minutes=expiration_minutes)
        # Ensure the blob actually exists before generating URL? Optional, but safer.
        # if not blob.exists():
        #     print(f"Error: Blob {blob_name} does not exist in bucket {bucket_name}.")
        #     return None
        url = blob.generate_signed_url(version="v4", expiration=url_expiration, method="GET")
        print(f"Signed URL generated (valid for {url_expiration.total_seconds() / 60.0} mins).")
        return url
    except Exception as e:
        print(f"Error generating signed URL: {e}")
        traceback.print_exc() # Add traceback
        return None

def submit_dreamface_job(api_key: str, video_url: str, audio_url: str) -> str | None:
    """Submits job to DreamFace /talking_face endpoint. Returns taskId or None."""
    print("Submitting job to DreamFace API...")
    print(f"DEBUG: Video URL: {video_url}")
    print(f"DEBUG: Audio URL: {audio_url}")
    print(f"DEBUG: API Key (first 10 chars): {api_key[:10]}...")
    
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    # Consider increasing video_enhance if quality is needed, maybe impacts time/cost?
    payload = {"srcVideoUrl": video_url, "audioUrl": audio_url, "videoParams": {"video_width": 0, "video_height": 0, "video_enhance": 1, "fps": "original"}}
    
    print(f"DEBUG: Request payload: {payload}")
    print(f"DEBUG: Request headers: {headers}")
    
    try:
        response = requests.post(DREAMFACE_SUBMIT_URL, headers=headers, json=payload, timeout=30) # Standard 30s timeout
        print(f"DEBUG: Response status code: {response.status_code}")
        print(f"DEBUG: Response headers: {dict(response.headers)}")
        
        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
        result = response.json()
        print(f"DEBUG: Full response JSON: {result}")
        
        if result.get("code") == 0 and result.get("data", {}).get("taskId"):
            task_id = result["data"]["taskId"]
            print(f"DreamFace job submitted successfully. Task ID: {task_id}")
            return task_id
        else:
            # Log more details on failure
            error_msg = result.get('message', 'Unknown error')
            print(f"DreamFace job submission failed: {error_msg}")
            print(f"Full API response: {result}")
            return None
    except requests.exceptions.Timeout:
        print("Error calling DreamFace submit API: Request timed out.")
        return None
    except requests.exceptions.RequestException as e:
        print(f"Error calling DreamFace submit API: {e}")
        print(f"DEBUG: Response content (if available): {getattr(e.response, 'text', 'No response content')}")
        return None
    except Exception as e: # Catch potential JSON parsing errors or others
        print(f"Error processing DreamFace submit response: {e}")
        traceback.print_exc()
        return None

def poll_dreamface_job(api_key: str, task_id: str) -> str | None:
    """Polls DreamFace /getAsyncResult endpoint. Returns final video URL or None."""
    print(f"Polling DreamFace job status for Task ID: {task_id}...")
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {"taskId": task_id}
    attempts = 0
    while attempts < MAX_POLLING_ATTEMPTS:
        attempts += 1
        print(f"Polling attempt {attempts}/{MAX_POLLING_ATTEMPTS}...")
        try:
            response = requests.post(DREAMFACE_POLL_URL, headers=headers, json=payload, timeout=30) # Poll timeout
            print(f"DEBUG: Poll response status: {response.status_code}")
            response.raise_for_status()
            result = response.json()
            print(f"DEBUG: Poll response JSON: {result}")

            if result.get("code") != 0:
                error_msg = result.get('message', 'Unknown polling error')
                print(f"Polling failed: {error_msg}")
                print(f"Full API response: {result}")
                return None # Stop polling on API error

            task_data = result.get("data", {}).get("task", {})
            status = task_data.get("status")
            status_map = {1: "Submitted", 2: "Processing", 3: "Success", 4: "Failed"}
            status_str = status_map.get(status, f"Unknown ({status})")
            print(f"  Current task status: {status_str} (code: {status})")
            print(f"DEBUG: Task data: {task_data}")

            if status == 3: # Success
                # Try to extract videoUrl robustly
                videos_list = result.get("data", {}).get("videos", [])
                url = None
                print(f"DEBUG: Videos list: {videos_list}")
                if videos_list and isinstance(videos_list, list) and len(videos_list) > 0:
                    video_info = videos_list[0]
                    if isinstance(video_info, dict):
                        url = video_info.get("videoUrl")
                        print(f"DEBUG: Found URL in videos[0]: {url}")
                if not url:
                    url = result.get("data", {}).get("videoUrl") # Fallback to top level if needed
                    print(f"DEBUG: Fallback URL from data.videoUrl: {url}")

                if url:
                    print(f"DreamFace job successful! Final video URL: {url}")
                    return url
                else:
                    print(f"ERROR: Polling status is Success(3), but videoUrl not found.")
                    print(f"Full response data: {result.get('data')}")
                    return None # Treat as failure if URL missing on success
            elif status == 4: # Failure
                reason = task_data.get("reason", "Unknown reason")
                print(f"DreamFace job failed: {reason}")
                print(f"DEBUG: Full task data on failure: {task_data}")
                return None
            elif status in [1, 2]: # Still processing
                print(f"  Job still processing. Waiting {POLLING_INTERVAL_SECONDS} seconds...")
                time.sleep(POLLING_INTERVAL_SECONDS)
            else: # Unknown status
                print(f"  Unknown status code encountered: {status}. Stopping polling.")
                print(f"DEBUG: Full response on unknown status: {result}")
                return None

        except requests.exceptions.Timeout:
            print(f"Timeout during polling attempt {attempts}. Retrying after {POLLING_INTERVAL_SECONDS}s...")
            time.sleep(POLLING_INTERVAL_SECONDS)
        except requests.exceptions.RequestException as e:
            print(f"Error calling DreamFace poll API: {e}. Retrying after {POLLING_INTERVAL_SECONDS}s...")
            print(f"DEBUG: Poll error response: {getattr(e.response, 'text', 'No response content')}")
            time.sleep(POLLING_INTERVAL_SECONDS)
        except Exception as e:
            print(f"Error processing DreamFace poll response: {e}. Stopping polling.")
            traceback.print_exc()
            return None

    print(f"ERROR: Polling timed out after {MAX_POLLING_ATTEMPTS} attempts.")
    print(f"Total polling time: {MAX_POLLING_ATTEMPTS * POLLING_INTERVAL_SECONDS} seconds")
    return None

def download_video(video_url: str, local_filename: str) -> bool:
    """Downloads a video from a URL to a local file."""
    print(f"Downloading final video from {video_url} to {local_filename}...")
    try:
        # Use stream=True and iterate content to handle potentially large files
        with requests.get(video_url, stream=True, timeout=(10, 300)) as r: # (connect timeout, read timeout)
            r.raise_for_status()
            # Ensure directory exists before opening file
            os.makedirs(os.path.dirname(local_filename) or '.', exist_ok=True)
            with open(local_filename, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
        # Verify download
        if os.path.exists(local_filename) and os.path.getsize(local_filename) > 0:
            print("Video downloaded successfully.")
            return True
        else:
            print(f"Error: Downloaded file is missing or empty after download attempt: {local_filename}")
            if os.path.exists(local_filename): # Clean up potentially corrupted file
                 try: os.remove(local_filename)
                 except OSError: pass
            return False
    except requests.exceptions.Timeout:
        print(f"Error downloading video: Request timed out from {video_url}")
        return False
    except requests.exceptions.RequestException as e:
        print(f"Error downloading video: {e}")
        return False
    except Exception as e:
        print(f"Error saving downloaded video file to {local_filename}: {e}")
        traceback.print_exc()
        # Clean up if file exists but saving failed mid-way
        if os.path.exists(local_filename):
             try: os.remove(local_filename)
             except OSError: pass
        return False

def delete_from_gcs(bucket_name: str, blob_name: str):
    """Deletes a blob from the GCS bucket."""
    print(f"Deleting temporary file gs://{bucket_name}/{blob_name} from GCS...")
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        # Check if blob exists before attempting delete to avoid unnecessary warnings on cleanup
        if blob.exists():
            blob.delete()
            print(f"Temporary file gs://{bucket_name}/{blob_name} deleted successfully.")
        else:
             print(f"Temporary file gs://{bucket_name}/{blob_name} not found, skipping delete.")
    except Exception as e:
        # Log as warning, cleanup failure shouldn't stop the whole process usually
        print(f"Warning: Failed to delete temporary file {blob_name} from GCS: {e}")
        # Optionally add traceback here if needed for debugging GCS issues
        # traceback.print_exc()

def remove_silence_from_video(input_path: str, output_path: str) -> bool:
    """Removes silence from video using ffmpeg silencedetect and applies audio fades."""
    # This is a complex function. Adding detailed comments or breaking it down further
    # might improve maintainability, but using the user's provided code directly for now.
    print(f"\n--- DEBUG: Starting Silence Removal ---")
    print(f"Input: {input_path}")
    print(f"Output: {output_path}")
    print(f"Silence Threshold: {SILENCE_THRESHOLD_DB}, Min Duration: {SILENCE_MIN_DURATION_S}s")
    if not os.path.exists(input_path):
        print(f"DEBUG: Error - Input video for silence removal not found: {input_path}")
        return False
    print("DEBUG: Detecting silence intervals...")

    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

    if not ffmpeg_exe:
        print("ERROR: ffmpeg not found. Please install ffmpeg or add it to your PATH.")
        return False

    silence_detect_cmd = [
        ffmpeg_exe, '-nostdin', '-i', input_path,
        '-af', f'silencedetect=noise={SILENCE_THRESHOLD_DB}:d={SILENCE_MIN_DURATION_S}',
        '-f', 'null', '-'
    ]
    print(f"DEBUG: Running silencedetect command: {' '.join(silence_detect_cmd)}")
    try:
        # Increased timeout for silence detection, might take longer on some videos
        process = subprocess.run(silence_detect_cmd, capture_output=True, text=True, check=False, encoding='utf-8', errors='ignore', timeout=600)  # 10 minutes
        print("DEBUG: silencedetect command finished.")
    except subprocess.TimeoutExpired:
        print(f"DEBUG: Error - FFmpeg silencedetect command timed out for {input_path}")
        return False
    except FileNotFoundError:
        print("DEBUG: Error - ffmpeg command not found. Make sure FFmpeg is installed and in your system's PATH.")
        return False
    except Exception as e:
        print(f"DEBUG: Error running ffmpeg silencedetect: {e}")
        traceback.print_exc()
        return False

    stderr_output = process.stderr
    # print("\n----- DEBUG: FFmpeg silencedetect stderr START -----\n") # Reduce noise
    # print(stderr_output)
    # print("\n----- DEBUG: FFmpeg silencedetect stderr END -----\n")

    # Use try-except for float conversion, more robust
    try:
        silence_starts = [float(t) for t in re.findall(r"silence_start:\s*([\d\.]+)", stderr_output)]
        silence_ends = [float(t) for t in re.findall(r"silence_end:\s*([\d\.]+)", stderr_output)]
    except ValueError as e:
        print(f"DEBUG: Error parsing silence timestamps from ffmpeg output: {e}")
        print(f"FFmpeg stderr was:\n{stderr_output}")
        return False # Cannot proceed if timestamps are invalid

    duration_match = re.search(r"Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d+)", stderr_output) # Match one or more decimal digits
    print(f"DEBUG: Detected silence starts: {silence_starts}")
    print(f"DEBUG: Detected silence ends: {silence_ends}")

    if not silence_starts or not silence_ends:
        if "error" in stderr_output.lower() or "invalid" in stderr_output.lower() or process.returncode != 0:
            print("DEBUG: Error detected in FFmpeg silencedetect output. Cannot proceed.")
            print(f"FFmpeg stderr:\n{stderr_output}")
            return False
        print("DEBUG: No silence detected or silence detection output not parsed.")
        try:
            shutil.copy(input_path, output_path)
            print(f"DEBUG: Copied input to output as no silence was processed: {output_path}")
            return True
        except Exception as e:
            print(f"DEBUG: Error copying file when no silence detected: {e}")
            return False

    if len(silence_starts) != len(silence_ends):
        print(f"DEBUG: Warning - Mismatched silence start ({len(silence_starts)}) and end ({len(silence_ends)}) counts. Attempting simple fix.")
        # Simple fix: assume last start or first end is cut off
        if len(silence_starts) > len(silence_ends):
             silence_starts.pop() # Remove last start
        elif len(silence_ends) > len(silence_starts):
             silence_ends.pop(0) # Remove first end
        # If still mismatched or empty after fix, bail out by copying
        if len(silence_starts) != len(silence_ends) or not silence_starts:
            print("DEBUG: Reconciliation failed or resulted in no pairs. Copying original.")
            try: shutil.copy(input_path, output_path); return True
            except Exception as copy_e: print(f"DEBUG: Error copying file after reconciliation failed: {copy_e}"); return False

    print(f"DEBUG: Processing {len(silence_starts)} silence interval(s).")
    video_duration = 0
    if duration_match:
        try:
            h, m, s, ms_str = duration_match.groups()
            # Handle potentially short ms_str like '7' -> 0.07 or '71' -> 0.71
            ms = float(f"0.{ms_str}")
            video_duration = int(h) * 3600 + int(m) * 60 + int(s) + ms
            print(f"DEBUG: Parsed video duration: {video_duration:.3f}s")
        except ValueError as e:
            print(f"DEBUG: Error parsing video duration: {e}. Attempting estimation.")
            video_duration = 0 # Reset duration if parsing failed
    else:
         print("DEBUG: Warning - Could not parse video duration from FFmpeg output.")

    # Estimate duration if parsing failed or wasn't found, but we have silence ends
    if video_duration <= 0 and silence_ends:
        # Estimate based on the maximum end time found
        max_end_time = max(silence_ends) if silence_ends else 0
        if max_end_time > 0:
             # Add a small buffer (e.g., 1 second) to estimated duration
             estimated_duration = max_end_time + 1.0
             print(f"DEBUG: Estimating duration from max silence end time: {estimated_duration:.3f}s")
             video_duration = estimated_duration
        else:
             print(f"DEBUG: Error - Cannot reliably determine video duration.")
             return False # Cannot proceed without duration

    if video_duration <= 0:
        print(f"DEBUG: Error - Invalid or undetermined video duration ({video_duration:.3f}s).")
        return False

    # --- Build segments to keep ---
    segments = []
    min_segment_len = 0.1 # Minimum length of a non-silent segment to keep

    last_end_time = 0.0
    for i in range(len(silence_starts)):
         start_segment = last_end_time
         end_segment = silence_starts[i]
         # Ensure times are valid and segment has minimum length
         if start_segment >= 0 and end_segment > start_segment and (end_segment - start_segment) >= min_segment_len:
              segments.append((start_segment, end_segment))
         # Update last_end_time for the next iteration
         last_end_time = silence_ends[i]
         # Handle potential negative end times from detection? Clamp to 0?
         if last_end_time < 0: last_end_time = 0

    # Add the final segment after the last silence
    if last_end_time < video_duration and (video_duration - last_end_time) >= min_segment_len:
         segments.append((last_end_time, video_duration))

    if not segments:
        print("DEBUG: No non-silent segments found after processing silence intervals.")
        try: shutil.copy(input_path, output_path); return True
        except Exception as e: print(f"DEBUG: Error copying file when no segments found: {e}"); return False

    print(f"DEBUG: Identified {len(segments)} non-silent segments to keep:")
    total_kept_duration = 0.0
    for i, (start, end) in enumerate(segments):
        # Clamp segment times to ensure they are within video duration
        clamped_start = max(0.0, start)
        clamped_end = min(video_duration, end)
        duration = clamped_end - clamped_start
        if duration < min_segment_len / 2: # Skip tiny segments after clamping
             print(f"  Segment {i}: Skipping tiny segment after clamping ({clamped_start:.3f}s -> {clamped_end:.3f}s)")
             continue
        print(f"  Segment {i}: {clamped_start:.3f}s -> {clamped_end:.3f}s (Duration: {duration:.3f}s)")
        total_kept_duration += duration

    if total_kept_duration == 0:
         print("DEBUG: Error - Total duration of segments to keep is zero.")
         return False

    # --- Build complex filtergraph ---
    fade_duration = 0.05 # Shorter fade
    video_select_parts = []
    audio_filter_chains = []
    valid_segment_count = 0

    current_offset = 0.0 # Track time offset for concatenation
    for i, (start, end) in enumerate(segments):
        clamped_start = max(0.0, start)
        clamped_end = min(video_duration, end)
        segment_duration = clamped_end - clamped_start

        if segment_duration < min_segment_len / 2.0: continue # Skip tiny segments

        v_select = f"between(t,{clamped_start},{clamped_end})"
        video_select_parts.append(v_select)

        # Audio chain for this segment
        in_label = f"[0:a]" # Original audio input
        trim_label = f"[a_trimmed_{valid_segment_count}]"
        fade_label = f"[a_faded_{valid_segment_count}]"

        # Trim audio segment and reset its timestamp
        trim_filter = f"{in_label}atrim={clamped_start}:{clamped_end},asetpts=PTS-STARTPTS{trim_label}"

        # Apply fades (in for all except first, out for all except last)
        fade_filters = []
        effective_fade_duration = min(fade_duration, segment_duration / 2.0) # Ensure fade isn't longer than half segment
        if valid_segment_count > 0: # Fade in if not the first segment
             fade_filters.append(f"afade=t=in:st=0:d={effective_fade_duration}")
        if i < len(segments) -1: # Check original index to see if it's the last *potential* segment
             # Check if the *next* valid segment exists to determine if fade out is needed
             next_valid_exists = False
             for k in range(i + 1, len(segments)):
                  next_start, next_end = segments[k]
                  next_clamped_start = max(0.0, next_start)
                  next_clamped_end = min(video_duration, next_end)
                  if (next_clamped_end - next_clamped_start) >= min_segment_len / 2.0:
                       next_valid_exists = True
                       break
             if next_valid_exists: # Fade out if not the last valid segment
                 fade_out_start = max(0.0, segment_duration - effective_fade_duration)
                 fade_filters.append(f"afade=t=out:st={fade_out_start:.3f}:d={effective_fade_duration}")

        if fade_filters:
            fade_chain = f"{trim_label}{','.join(fade_filters)}{fade_label}"
        else: # No fades needed (single segment case)
             fade_chain = f"{trim_label}anull{fade_label}" # Use anull filter as placeholder

        audio_filter_chains.append(trim_filter + ";" + fade_chain)
        valid_segment_count += 1

    if valid_segment_count == 0:
        print("DEBUG: Error - No valid segments left after processing for filtergraph.")
        try: shutil.copy(input_path, output_path); print("DEBUG: Copying original file as fallback."); return True
        except Exception as copy_e: print(f"DEBUG: Error copying fallback file: {copy_e}"); return False

    # --- Combine filters ---
    video_filtergraph = f"select='{'+'.join(video_select_parts)}',setpts=N/(FRAME_RATE*TB)[outv]" # Correct PTS adjustment for select

    if valid_segment_count == 1: # Simpler audio graph if only one segment
         # The single audio chain already ends in [a_faded_0]
         full_audio_filtergraph = audio_filter_chains[0].replace('[a_faded_0]', '[outa]') # Rename final output label
    else: # Concatenate multiple audio segments
        concat_inputs = "".join([f"[a_faded_{j}]" for j in range(valid_segment_count)])
        audio_concat_filter = f"{concat_inputs}concat=n={valid_segment_count}:v=0:a=1[outa]"
        full_audio_filtergraph = ";".join(audio_filter_chains) + ";" + audio_concat_filter

    filter_complex_string = f"{full_audio_filtergraph};{video_filtergraph}"

    print("\n----- DEBUG: Generated Filter Complex String START -----\n")
    print(filter_complex_string)
    print("\n----- DEBUG: Generated Filter Complex String END -----\n")
    print(f"DEBUG: Estimated final duration: {total_kept_duration:.3f}s")

    print(f"DEBUG: Generating final trimmed video with audio fades: {output_path}...")
    final_cmd = [
        ffmpeg_exe, '-hide_banner', '-loglevel', 'warning', # Less verbose output
        '-i', input_path,
        '-filter_complex', filter_complex_string,
        '-map', '[outv]', # Map final video stream
        '-map', '[outa]', # Map final audio stream
        # Encoding parameters (consider adjusting preset/crf for speed/quality)
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart', # Good for web/streaming
        '-y', # Overwrite output without asking
        output_path
    ]
    # print(f"DEBUG: Running final ffmpeg command: {' '.join(final_cmd)}") # Less verbose now

    try:
        # Increased timeout for final encoding
        process = subprocess.run(final_cmd, capture_output=True, text=True, check=True, encoding='utf-8', errors='ignore', timeout=calculate_ffmpeg_timeout(1800, "final_encoding"))  # Dynamic timeout
        print("DEBUG: Final ffmpeg command finished successfully.")
        if process.stderr: # Log warnings/info even on success
             print("--- FFmpeg Info/Warnings ---")
             print(process.stderr)
             print("--------------------------")
        if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            print("DEBUG: Error - FFmpeg reported success, but output file is missing or empty.")
            try: shutil.copy(input_path, output_path); print("DEBUG: Copying original file as fallback."); return True
            except Exception as copy_e: print(f"DEBUG: Error copying fallback file: {copy_e}"); return False
        print("DEBUG: Silence removal with fades successful.")
        return True
    except subprocess.TimeoutExpired:
        print("DEBUG: Error - Final ffmpeg command timed out.")
        try: shutil.copy(input_path, output_path); print("DEBUG: Copying original file as fallback."); return True
        except Exception as copy_e: print(f"DEBUG: Error copying fallback file: {copy_e}"); return False
    except subprocess.CalledProcessError as e:
        print(f"DEBUG: Error running final ffmpeg command (Return Code: {e.returncode})")
        print("\n----- DEBUG: Final FFmpeg stderr START -----\n")
        print(e.stderr)
        print("\n----- DEBUG: Final FFmpeg stderr END -----\n")
        try: shutil.copy(input_path, output_path); print("DEBUG: Copying original file as fallback."); return True
        except Exception as copy_e: print(f"DEBUG: Error copying fallback file: {copy_e}"); return False
    except FileNotFoundError:
        print("DEBUG: Error - ffmpeg not found during final command execution.")
        return False
    except Exception as e:
        print(f"DEBUG: An unexpected error occurred during final ffmpeg execution: {e}")
        traceback.print_exc()
        try: shutil.copy(input_path, output_path); print("DEBUG: Copying original file as fallback."); return True
        except Exception as copy_e: print(f"DEBUG: Error copying fallback file: {copy_e}"); return False
    finally:
         print(f"--- DEBUG: Ending Silence Removal ---")


# --- Whisper Timestamp Function (Simplified Logic v2) ---
transcription_cache = {}
whisper_model = None

# --- Whisper Timestamp Function (v3 - First Trigger + Fixed Duration) ---
transcription_cache = {}
whisper_model = None


# === Helper Function for Phase 2: Calculate Overlay Geometry (Revised for Constraints) ===
def calculate_overlay_geometry(placement_str, relative_size, main_w, main_h, overlay_aspect_ratio,
                               margin_percent=7):  # Increased default margin to 7%
    """
    Calculates overlay X, Y, Width, Height based on placement string, relative size,
    main video dimensions, overlay aspect ratio, and margin preference.
    Supports multiple placement positions around the video frame.

    Args:
        placement_str (str): Position code like "top_left", "middle_right", "bottom_center", etc.
        relative_size (float): Desired overlay width relative to main video width (e.g., 0.4).
        main_w (int): Width of the main video in pixels.
        main_h (int): Height of the main video in pixels.
        overlay_aspect_ratio (float): Width / Height of the overlay clip itself.
        margin_percent (int): Percentage margin from edges (default: 7).

    Returns:
        dict | None: Dictionary {'x': int, 'y': int, 'w': int, 'h': int} or None if inputs are invalid.
    """
    if not all([placement_str, relative_size, main_w, main_h, overlay_aspect_ratio]):
        print("ERROR: Invalid inputs to calculate_overlay_geometry.")
        return None
    if main_w <= 0 or main_h <= 0 or overlay_aspect_ratio <= 0 or relative_size <= 0:
        print("ERROR: Non-positive dimension or size input to calculate_overlay_geometry.")
        return None

    print(
        f"Calculating geometry for: placement='{placement_str}', rel_size={relative_size:.2f}, main={main_w}x{main_h}, AR={overlay_aspect_ratio:.2f}")

    # Calculate pixel margins - but skip margins if size is 1.0 (full screen)
    if relative_size >= 1.0:
        margin_x = 0
        margin_y = 0
        print(f"Full screen overlay detected (size={relative_size:.2f}), skipping margins for true full-screen effect.")
    else:
        margin_x = int(main_w * margin_percent / 100)
        margin_y = int(main_h * margin_percent / 100)

    # Calculate overlay dimensions
    overlay_w = int(relative_size * main_w)
    overlay_h = int(overlay_w / overlay_aspect_ratio)

    # Skip constraint checks for full screen overlays (size >= 1.0)
    if relative_size < 1.0:
        # Ensure overlay fits within the frame (considering potential margins)
        max_allowable_w = main_w - 2 * margin_x
        max_allowable_h = main_h - 2 * margin_y  # Max height also constrained by margins now
        if overlay_w > max_allowable_w:
            overlay_w = max_allowable_w
            overlay_h = int(overlay_w / overlay_aspect_ratio)  # Recalculate height if width clamped
        if overlay_h > max_allowable_h:
            overlay_h = max_allowable_h
            overlay_w = int(overlay_h * overlay_aspect_ratio)  # Recalculate width if height clamped
    else:
        print(f"Full screen overlay detected - skipping size constraint checks to allow true full screen coverage.")
        # For full screen, ensure we use exactly the main video dimensions
        overlay_w = main_w
        overlay_h = main_h

    if overlay_w <= 0 or overlay_h <= 0:
        print("ERROR: Calculated overlay dimension is zero or negative after margin/size checks.")
        return None

    # --- Calculate X, Y based on placement string ---
    x, y = 0, 0  # Default initialization

    # Handle different placement options with proper edge alignment
    if placement_str == "top_left":
        x, y = margin_x, margin_y  # Use margin_x for left edge (0 if full screen)
    elif placement_str == "top_center":
        x, y = (main_w - overlay_w) // 2, margin_y
    elif placement_str == "top_right":
        x, y = main_w - overlay_w - margin_x, margin_y  # Use margin_x for right edge (0 if full screen)
    elif placement_str == "middle_left":
        x, y = margin_x, (main_h - overlay_h) // 2  # Use margin_x for left edge (0 if full screen)
    elif placement_str == "middle_center" or placement_str == "center":
        x, y = (main_w - overlay_w) // 2, (main_h - overlay_h) // 2
    elif placement_str == "middle_right":
        x, y = main_w - overlay_w - margin_x, (main_h - overlay_h) // 2  # Use margin_x for right edge (0 if full screen)
    elif placement_str == "bottom_left":
        x, y = margin_x, main_h - overlay_h - margin_y  # Use margin_x for left edge (0 if full screen)
    elif placement_str == "bottom_center":
        x, y = (main_w - overlay_w) // 2, main_h - overlay_h - margin_y
    elif placement_str == "bottom_right":
        x, y = main_w - overlay_w - margin_x, main_h - overlay_h - margin_y  # Use margin_x for right edge (0 if full screen)
    else:
        # Fallback if an unexpected placement string is passed
        print(f"WARNING: Unsupported placement string '{placement_str}'. Defaulting to middle_left calculation.")
        x, y = margin_x, (main_h - overlay_h) // 2  # Use margin_x for left edge (0 if full screen)

    # Final check to prevent going off-screen (shouldn't happen with clamping above, but safe)
    if x + overlay_w > main_w: x = main_w - overlay_w
    if y + overlay_h > main_h: y = main_h - overlay_h

    print(f"Calculated Geometry: X={x}, Y={y}, W={overlay_w}, H={overlay_h}")
    return {'x': x, 'y': y, 'w': overlay_w, 'h': overlay_h}
# === End Helper Function ===

def get_product_mention_times(audio_path: str, trigger_keywords: list[str], language: str, job_name: str = "Job", desired_duration: float = 5.0) -> tuple[float | None, float | None]: # Added language parameter
    """
    Analyzes audio using Whisper to find the FIRST occurrence of any trigger keyword
    and returns a fixed duration window starting from that point.

    Args:
        audio_path: Path to the audio file.
        trigger_keywords: List of keywords (case-insensitive) to trigger the overlay.
        job_name: Identifier for logging.
        desired_duration: How long the overlay should last in seconds (default: 5.0).
                           Adjust this value between 3.0 and 8.0 as needed.

    Returns:
        A tuple (start_time, end_time) in seconds if a trigger keyword is found,
        otherwise (None, None).
    """
    global whisper_model
    if whisper is None:
        print(f"ERROR [{job_name}]: Whisper library not installed. Cannot analyze.")
        return None, None

    print(f"[{job_name}] Analyzing audio for trigger keywords: {trigger_keywords}")

    # Use cached result if available (optional, clear cache if script logic changes significantly)
    if audio_path in transcription_cache:
        print(f"[{job_name}] Using cached transcription for {audio_path}")
        result = transcription_cache[audio_path]
    else:
        try:
            if whisper_model is None:
                # --- Ensure correct model is specified here ---
                target_model = "small.en" # Or "medium.en" etc.
                print(f"[{job_name}] Loading Whisper model ({target_model})...")
                whisper_model = whisper.load_model(target_model)
                print(f"[{job_name}] Whisper model loaded.")

            print(f"[{job_name}] Transcribing audio file: {audio_path} with word timestamps...")
            language_code = {"english": "en", "spanish": "es"}.get(language.lower(), "en")
            result = whisper_model.transcribe(audio_path, word_timestamps=True, fp16=False, language=language_code)
            transcription_cache[audio_path] = result
            print(f"[{job_name}] Transcription complete.")
            # Optional: Log full transcript for debugging
            print(f"DEBUG [{job_name}]: Whisper Transcript Text:\n{result.get('text', 'N/A')}\n-----")

        except Exception as e:
            print(f"ERROR [{job_name}]: Whisper transcription failed for {audio_path}: {e}")
            traceback.print_exc()
            if audio_path in transcription_cache: del transcription_cache[audio_path]
            return None, None

    # --- Search Logic: Find FIRST trigger keyword ---
    if not result or 'segments' not in result:
        print(f"Warning [{job_name}]: Whisper result invalid or missing segments.")
        return None, None

    # --- Start Paste --- (Paste this block where you just deleted)

    # Prepare initial keywords from the input list
    base_trigger_keywords = {keyword.lower().strip() for keyword in trigger_keywords if keyword}

    # --- Add conditional keywords based on language ---
    final_trigger_keywords = set(base_trigger_keywords) # Start with a copy of base keywords
    # Check language case-insensitively
    if language and language.lower() == 'spanish':
        print(f"[{job_name}] Language is Spanish, adding 'gomitas' to trigger keywords.")
        final_trigger_keywords.add("gomitas") # Add the Spanish word
    # --- End conditional keywords ---

    # Check if there are any keywords to search for *after* potential additions
    if not final_trigger_keywords:
        print(f"Warning [{job_name}]: No valid trigger keywords to search for.")
        return None, None

    # Use the potentially expanded set of keywords for searching
    print(f"[{job_name}] Searching for FIRST occurrence of any keyword in {final_trigger_keywords}...")

    # --- End Paste ---

    for segment in result.get('segments', []):
        for word_info in segment.get('words', []):
            if not isinstance(word_info, dict) or 'word' not in word_info or 'start' not in word_info:
                continue # Skip invalid word data

            word_text = word_info['word'].lower().strip(".,!?;:").strip() # Strip punctuation AND whitespace

            if word_text in final_trigger_keywords:
                # Found the FIRST match!
                found_start_time = word_info['start']
                print(f"[{job_name}] Found FIRST trigger keyword '{word_text}' (from search set {final_trigger_keywords}) at {found_start_time:.2f}s")
                # Calculate end time based on desired duration
                found_end_time = found_start_time + desired_duration
                print(f"[{job_name}] Setting overlay end time to {found_end_time:.2f}s ({desired_duration}s duration)")
                # --- IMPORTANT: Return immediately after finding the first match ---
                return found_start_time, found_end_time

    # If loop finishes without finding any trigger keyword
    print(f"[{job_name}] Trigger keywords {final_trigger_keywords} not found in audio.")
    return None, None

def overlay_product_video(
    main_video_path: str,
    product_clip_path: str,
    start_time: float,
    end_time: float,
    output_path: str,
    # Replace position_config with specific geometry values
    overlay_x: int,
    overlay_y: int,
    overlay_w: int,
    overlay_h: int,
    job_name: str = "Job"
) -> bool:
    # Note: end_time argument is now ignored by the filter, but kept for function signature consistency
    print(f"[{job_name}] Starting product overlay process (Alpha Attempt 2.3: Use gte(t,start) + Popen)...") # Log attempt
    print(f"  Main Video: {main_video_path}")
    print(f"  Product Clip (.mov): {product_clip_path}")
    # Log the start time, mention end_time is ignored by filter now
    print(f"  Overlay Start Time: {start_time:.2f}s (Will play for clip duration or until main video ends)")
    # === V1.20/Phase 2 CHANGE B: Update log message ===
    print(f"  Calculated Geometry: X={overlay_x}, Y={overlay_y}, W={overlay_w}, H={overlay_h}")
    print(f"  Output Path: {output_path}")

    # --- Input file checks ---
    if not os.path.exists(main_video_path): print(f"ERROR [{job_name}]: Main video for overlay not found: {main_video_path}"); return False
    if not os.path.exists(product_clip_path): print(f"ERROR [{job_name}]: Product clip (.mov) for overlay not found: {product_clip_path}"); return False
    if start_time is None: print(f"ERROR [{job_name}]: Invalid start time for overlay ({start_time})"); return False # Only check start_time now

# --- Configure Filter Complex (Using Calculated Geometry) ---

    # Ensure start_time and end_time are correctly defined before this block
    if start_time is None or end_time is None:
        print(f"ERROR [{job_name}]: Cannot build filter_complex, start_time or end_time is None.")
        return False

    # === V1.20/Phase 2 CHANGE C: Update filter_complex string ===
    filter_complex = (
        # 1. Scale the overlay clip [1:v] precisely to the calculated width/height
        #    and ensure it has an alpha channel (format=yuva444p recommended for MOV transparency).
        f"[1:v]scale={overlay_w}:{overlay_h},format=pix_fmts=yuva444p[scaled_overlay_input];" # Use calculated W:H

        # 2. Prepare main video PTS [0:v] (no change needed here)
        f"[0:v]setpts=PTS-STARTPTS[main_v];"

        # 3. Overlay the scaled clip onto the main video using calculated X/Y coordinates.
        #    Enable the overlay only between the calculated start and end times.
        f"[main_v][scaled_overlay_input]overlay=x={overlay_x}:y={overlay_y}" # Use calculated X:Y
        f":enable='between(t,{start_time:.3f},{end_time:.3f})'[outv]"
    )
    # === End Filter Complex Update ===

    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

# --- Construct FFmpeg Command (Applying -itsoffset - Step 2) ---
    ffmpeg_cmd = [
        ffmpeg_exe, '-hide_banner', '-loglevel', 'warning',

        # Input 0: Main Video (Keep genpts from original for this test)
        '-i', main_video_path,

        # Input 1: Overlay Video (Add -itsoffset BEFORE this input)
        '-itsoffset', f"{start_time:.3f}", # Shifts timestamps of the overlay input
        '-i', product_clip_path,           # The .mov file with alpha

        # Filters (filter_complex string defined above this block remains the same for Step 2)
        '-filter_complex', filter_complex,

        # Output Mapping
        '-map', '[outv]', # Map video from filter
        '-map', '0:a?',   # Map audio from main video (if it exists)

        # Encoding options (Same as your original)
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-profile:v', 'high', '-level:v', '4.0', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart',
        '-y', # Overwrite output file without asking
        output_path # The final output path
    ]
    # --- End FFmpeg Command Construction ---

    print(f"[{job_name}] Running FFmpeg overlay command (Alpha Attempt 2.3)...")
    # print(f"DEBUG CMD: {' '.join(ffmpeg_cmd)}")

    # --- Execute using Popen + communicate (Keep this robust method) ---
    # ... (Execution code remains the same as previous attempt) ...
    process = None
    stderr_output = ""
    try:
        process = subprocess.Popen(ffmpeg_cmd, stderr=subprocess.PIPE, stdout=subprocess.DEVNULL, text=True, encoding='utf-8', errors='ignore')
        stderr_output, _ = process.communicate(timeout=calculate_ffmpeg_timeout(1800, "overlay_processing"))  # Dynamic timeout - was 30 minutes

        if process.returncode == 0:
            print(f"[{job_name}] FFmpeg overlay process (Alpha Attempt 2.3) completed successfully.")
            # ...(Same success logging)...
            if stderr_output:
                 filtered_stderr = "\n".join(line for line in stderr_output.splitlines() if not line.strip().startswith('frame=') and not line.strip().startswith('size=') and not line.strip().startswith('LAVF'))
                 if filtered_stderr.strip(): print(f"--- FFmpeg Info/Warnings ---\n{filtered_stderr}\n--------------------------")
            if not os.path.exists(output_path) or os.path.getsize(output_path) == 0: print(f"ERROR [{job_name}]: FFmpeg reported success, but output file is missing or empty: {output_path}"); return False
            return True
        else:
            print(f"ERROR [{job_name}]: FFmpeg overlay command failed (Return Code: {process.returncode})")
            # ...(Same error logging)...
            print(f"--- FFmpeg stderr ---\n{stderr_output if stderr_output else 'N/A'}\n---------------------")
            return False
    except subprocess.TimeoutExpired:
        print(f"ERROR [{job_name}]: FFmpeg overlay command timed out after 600 seconds.")
        # ...(Same timeout handling)...
        if process: process.kill()
        if stderr_output: print(f"--- FFmpeg stderr before timeout ---\n{stderr_output}\n---------------------")
        return False
    except FileNotFoundError:
        print(f"ERROR [{job_name}]: ffmpeg command not found. Ensure FFmpeg is installed and in PATH.")
        return False
    except Exception as e:
        print(f"ERROR [{job_name}]: An unexpected error occurred during FFmpeg overlay execution: {e}")
        # ...(Same exception handling)...
        traceback.print_exc()
        if process and process.poll() is None: process.kill()
        return False


# --- Core Video Generation Function (Modified Signature) ---
def create_video_job(
    # --- Existing parameters ---
    product: str, persona: str, setting: str, emotion: str, hook: str,
    elevenlabs_voice_id: str, avatar_video_path: str, example_script_content: str,
    remove_silence: bool, use_randomization: bool, language: str, enhance_for_elevenlabs: bool, brand_name: str,
    # --- API keys / Config ---
    openai_api_key: str, elevenlabs_api_key: str, dreamface_api_key: str, gcs_bucket_name: str,
    output_path: str,
    # --- Product Overlay Parameters ---
    use_overlay: bool,
    product_clip_path: str | None = None, # Product clip for overlay on top of avatar speach
    trigger_keywords: list[str] | None = None,  # Accepts trigger keywords list
    overlay_settings: dict | None = None,  # Accepts overlay settings dictionary
    # --- Randomization Parameters ---
    randomization_intensity: str = "medium",
    # --- Exact Script Feature ---
    use_exact_script: bool = False,
    # --- Enhanced Video Processing ---
    enhanced_video_settings: dict | None = None,  # TikTok-style enhancements
    # --- Job Info ---
    job_name: str = "Unnamed Job",
    # --- Progress callback ---
    progress_callback: Optional[Callable[[int, int, str], None]] = None
    ) -> tuple[bool, str]:
    """
    Performs the complete video generation process for a single job.
    Returns (True, output_path) on success,
    or (False, last_error_message) on failure.
    """
    # === Optional: Add Repeatable Randomness Seed ===
    # If you want the *same* job_name to always pick the same random values (useful for debugging)
    # uncomment the next line. Otherwise, randomness will be different each run.
    # random.seed(job_name)
    # === End Optional Seed ===

    steps = [
        "Initialization...",
        "Generating script",
        "Synthesizing audio",
        "Uploading to GCS",
        "Signing uploaded files",
        "Running lip-sync",
        "Checking generated video",
        "Removing silence",
        "Preparing video base",
        "Randomizing video",
        "Checking randomized video",
        "Product Overlay",
        "Uploading video result"
    ]
    total_steps = len(steps)
    step = 0
    last_error_message = ""

    print(f"\n--- Starting Job: {job_name} [{datetime.now().isoformat()}] ---")
    job_start_time = time.time()
    # Step 1: Initialization
    if progress_callback:
        progress_callback(step, total_steps, steps[step])
        step += 1

    # --- Validate Inputs ---
    if not all([product, persona, setting, emotion, hook, elevenlabs_voice_id, avatar_video_path, example_script_content]):
        print(f"ERROR [{job_name}]: Missing one or more required text parameters.")
        last_error_message = "Missing one or more required text parameters."
        return False, last_error_message
    if not all([openai_api_key, elevenlabs_api_key, dreamface_api_key, gcs_bucket_name]):
        print(f"ERROR [{job_name}]: Missing one or more required API keys or GCS bucket name.")
        last_error_message = "Missing one or more required API keys or GCS bucket name"
        return False, last_error_message
    if not os.path.exists(avatar_video_path):
        print(f"ERROR [{job_name}]: Avatar video file not found: {avatar_video_path}")
        last_error_message = f"Avatar video file not found: {avatar_video_path}"
        return False, last_error_message
    if len(example_script_content.strip()) < 50:
        print(f"Warning [{job_name}]: Example script content seems very short.")

    # --- API Client Initialization ---
    openai_client = None
    if not use_exact_script:
        # Only initialize OpenAI client if we're generating scripts
        try:
            openai_client = OpenAI(api_key=openai_api_key)
            print(f"[{job_name}] OpenAI client initialized.")
        except Exception as e:
            print(f"ERROR [{job_name}] initializing OpenAI client: {e}")
            traceback.print_exc()    # Add traceback and return
            last_error_message = f"Failed initializing OpenAI client: {e}"
            return False, last_error_message
    else:
        print(f"[{job_name}] Exact script mode - skipping OpenAI client initialization")
    try:
        elevenlabs_client = ElevenLabs(api_key=elevenlabs_api_key)
        print(f"[{job_name}] ElevenLabs client initialized.")
    except Exception as e:
        print(f"ERROR [{job_name}] Failed initializing ElevenLabs client: {e}")
        traceback.print_exc()    # Add traceback and return
        last_error_message = f"Failed initializing ElevenLabs client: {e}"
        return False, last_error_message

    # --- Unique Identifiers and Paths for this Job ---
    # Add microseconds and random suffix to prevent conflicts in rapid 10x runs
    import random
    microseconds = int(time.time() * 1000000) % 1000000  # Get microseconds part
    random_suffix = random.randint(1000, 9999)
    run_uuid = f"{uuid.uuid4().hex[:8]}_{microseconds}_{random_suffix}"
    timestamp_uuid = f"{int(time.time())}_{run_uuid}"
    temp_audio_filename = str(WORKING_DIR / f"{TEMP_AUDIO_FILENAME_BASE}_{run_uuid}.mp3")
    raw_downloaded_video_path = str(WORKING_DIR / f"temp_video_raw_{timestamp_uuid}.mp4")
    # Define GCS names early for use in finally block, even if upload fails
    gcs_audio_blob_name = f"audio_uploads/{timestamp_uuid}_audio.mp3"
    gcs_video_blob_name = f"video_uploads/{timestamp_uuid}_avatar.mp4"

    # --- Sanitize Names for Filename/Paths ---
    sanitized_product_name = re.sub(r'[^\w\-]+', '_', product).strip('_')
    if not sanitized_product_name: sanitized_product_name = "unknown_product"
    try:
        avatar_filename = os.path.basename(avatar_video_path)
        avatar_name_base, _ = os.path.splitext(avatar_filename)
        sanitized_avatar_name = re.sub(r'[^\w\-]+', '_', avatar_name_base).strip('_')
        if not sanitized_avatar_name: sanitized_avatar_name = "unknown_avatar"
    except Exception as e:
        print(f"Warning [{job_name}]: Could not extract avatar name from path: {e}")
        sanitized_avatar_name = "unknown_avatar"

    # --- Define Output Paths ---
    today_date_str = datetime.now().strftime('%Y-%m-%d')
    print(f"DEBUG: today_date_str = {today_date_str}") # DEBUG PRINT
    print(f"DEBUG: OUTPUT_BASE_DIR = {output_path}") # DEBUG PRINT
    print(f"DEBUG: sanitized_product_name = {sanitized_product_name}") # DEBUG PRINT

    # Define the output_product_folder path string first
    # Wrap this in its own try-except in case os.path.join fails
    output_product_folder = None # Initialize to None
    path = None
    if not os.path.exists(output_path):
        path = OUTPUT_BASE_DIR
    else:
        path = output_path

    try:
        output_product_folder_path_string = os.path.join(path, today_date_str, sanitized_product_name)
        print(f"DEBUG: Attempting to define output_product_folder as string: '{output_product_folder_path_string}'") # DEBUG PRINT
        output_product_folder = output_product_folder_path_string # Assign the string path
    except Exception as join_e:
        print(f"ERROR [{job_name}]: Failed during os.path.join for output_product_folder: {join_e}")
        traceback.print_exc()
        output_product_folder = "." # Fallback on any join error
        print(f"DEBUG: Set output_product_folder to '.' due to os.path.join Exception") # DEBUG PRINT

    # --- Define output_file_base AFTER output_product_folder is set --- <<< MOVED HERE
    output_file_base = os.path.join(output_product_folder, f"{job_name}_{run_uuid}")

    # Now try creating the directory using the determined path string
    try:
        # Ensure output_product_folder is a usable path before os.makedirs
        if not output_product_folder: output_product_folder = "." # Ensure it's at least "."

        os.makedirs(output_product_folder, exist_ok=True)
        print(f"[{job_name}] Ensured output directory exists: {output_product_folder}")
        print(f"DEBUG: Successfully created/found output_product_folder: '{output_product_folder}'") # DEBUG PRINT
    except OSError as e:
        print(f"ERROR [{job_name}]: Could not create output directory '{output_product_folder}': {e}. Saving locally.")
        output_product_folder = "." # Fallback assignment only on OSError
        print(f"DEBUG: Set output_product_folder to '.' due to OSError") # DEBUG PRINT
    except Exception as e_generic: # Catch any other potential error during makedirs
         print(f"ERROR [{job_name}]: Unexpected error creating directory '{output_product_folder}': {e_generic}")
         traceback.print_exc()
         output_product_folder = "." # Fallback just in case
         print(f"DEBUG: Set output_product_folder to '.' due to generic Exception during makedirs") # DEBUG PRINT

    # --- Define output_file_base AFTER output_product_folder should be set ---
    # Add prints right before the line that failed
    print(f"DEBUG: About to define output_file_base.") # DEBUG PRINT
    # Use locals().get() for safer access in debug print just in case it's still None or undefined
    print(f"DEBUG: Value of output_product_folder just before use: '{locals().get('output_product_folder', 'Not Defined!')}'") # DEBUG PRINT
    print(f"DEBUG: Value of job_name just before use: '{locals().get('job_name', 'Not Defined!')}'") # DEBUG PRINT
    print(f"DEBUG: Value of run_uuid just before use: '{locals().get('run_uuid', 'Not Defined!')}'") # DEBUG PRINT

    # The line that previously failed, wrapped in try-except for more info
    output_file_base = None # Initialize
    try:
        # Ensure output_product_folder has a usable value before joining
        if not output_product_folder:
             print(f"ERROR [{job_name}]: output_product_folder is missing before defining output_file_base!")
             raise ValueError("output_product_folder was not set correctly.")

        output_file_base = os.path.join(output_product_folder, f"{job_name}_{run_uuid}")
        print(f"DEBUG: Successfully defined output_file_base: {output_file_base}") # DEBUG PRINT
    except Exception as base_e:
         print(f"ERROR [{job_name}]: Failed during os.path.join for output_file_base: {base_e}")
         traceback.print_exc()
         # Cannot proceed without output_file_base, maybe raise or return False?
         print(f"ERROR [{job_name}]: Cannot define output_file_base, exiting job.")
         last_error_message = "Cannot define output_file_base, exiting job" # Exit the job cleanly if this fails
         return False, last_error_message

    # --- Define other specific output filenames that depend on output_file_base ---
    # Make sure these come AFTER output_file_base is successfully defined
    silence_removed_path = f"{output_file_base}_edited.mp4"
    # final_raw_video_path is defined using output_product_folder earlier, which is okay
    final_output_with_overlay_path = f"{output_file_base}_final_overlay.mp4"


    # KEEP these definitions using output_product_folder as they define specific target paths for earlier steps
    edited_filename = f"edited_{sanitized_product_name}_{sanitized_avatar_name}_{run_uuid}.mp4"
    raw_filename = f"raw_{sanitized_product_name}_{sanitized_avatar_name}_{run_uuid}.mp4"
    edited_video_path = os.path.abspath(os.path.join(output_product_folder, edited_filename))
    final_raw_video_path = os.path.abspath(os.path.join(output_product_folder, raw_filename))

    # --- Variable Placeholders ---
    final_output_path = None # Will hold the path *before* overlay attempt
    video_with_overlay_path = None # Will hold the path *after* overlay attempt

    # --- Main Process Steps ---
    step_start_time = time.time()
    try:
        # Step 2: Generate Script
        if progress_callback:
            progress_callback(step, total_steps, steps[step])
            step += 1
        print(f"\n--- [{job_name}] Step 2: Generate Script ---")
        
        if use_exact_script:
            # Use exact script content instead of generating with AI
            print(f"[{job_name}] Using exact script mode - skipping OpenAI generation")
            generated_script = example_script_content.strip()
            if not generated_script:
                print(f"ERROR [{job_name}]: Exact script mode enabled but script content is empty.")
                last_error_message = "Exact script content is empty"
                return False, last_error_message
            print(f"[{job_name}] Using exact script content: {len(generated_script)} characters")
        else:
            # Generate script using OpenAI
            generated_script = generate_script(
                openai_client, product, persona, setting, emotion, hook, example_script_content, language=language, enhance_for_elevenlabs=enhance_for_elevenlabs, brand_name=brand_name
            )
            if not generated_script:
                print(f"ERROR [{job_name}]: Script generation failed.")
                last_error_message = "Script generation failed"
                return False, last_error_message
        
        print(f"[{job_name}] Generated Script Preview:\n---\n{generated_script[:200]}...\n---")
        print(f"[{job_name}] Step 2 completed in {time.time() - step_start_time:.2f}s"); step_start_time = time.time()

        # Step 3: Generate Audio
        if progress_callback:
            progress_callback(step, total_steps, steps[step])
            step += 1
        print(f"\n--- [{job_name}] Step 3: Generate Audio ---")
        audio_success = generate_audio(
            elevenlabs_client, generated_script, elevenlabs_voice_id, temp_audio_filename
        )
        if not audio_success:
            print(f"ERROR [{job_name}]: Audio generation failed.")
            last_error_message = "Audio generation failed"
            return False, last_error_message
        print(f"[{job_name}] Step 3 completed in {time.time() - step_start_time:.2f}s"); step_start_time = time.time()

        # Step 4: Upload & Get URLs
        if progress_callback:
            progress_callback(step, total_steps, steps[step])
            step += 1
        print(f"\n--- [{job_name}] Step 4: Upload & Get URLs ---")
        audio_upload_success = upload_to_gcs(gcs_bucket_name, temp_audio_filename, gcs_audio_blob_name)
        # Only upload avatar video if audio succeeded (save API call if not needed)
        video_upload_success = False
        if audio_upload_success:
            video_upload_success = upload_to_gcs(gcs_bucket_name, avatar_video_path, gcs_video_blob_name)
        if not (audio_upload_success and video_upload_success): # Cleanup in finally
            print(f"ERROR [{job_name}]: GCS upload failed.")
            last_error_message = "GCS upload failed"
            return False, last_error_message

        # Step 5: Signing uploaded files
        if progress_callback:
            progress_callback(step, total_steps, steps[step])
            step += 1
        audio_signed_url = generate_signed_url(gcs_bucket_name, gcs_audio_blob_name)
        video_signed_url = generate_signed_url(gcs_bucket_name, gcs_video_blob_name)
        if not (audio_signed_url and video_signed_url): # Cleanup in finally
            print(f"ERROR [{job_name}]: Signed URL generation failed.")
            last_error_message = "Signed URL generation failed"
            return False, last_error_message
        print(f"[{job_name}] Step 4 completed in {time.time() - step_start_time:.2f}s"); step_start_time = time.time()
        # Note: temp_audio_filename cleanup moved to finally block to ensure it's available for overlay processing

        # Step 6: DreamFace Lip-Sync
        if progress_callback:
            progress_callback(step, total_steps, steps[step])
            step += 1
        print(f"\n--- [{job_name}] Step 5: DreamFace Lip-Sync ---")
        task_id = submit_dreamface_job(dreamface_api_key, video_signed_url, audio_signed_url)
        if not task_id:         # Cleanup in finally
            print(f"ERROR [{job_name}]: DreamFace job submission failed.")
            last_error_message = "DreamFace job submission failed"
            return False, last_error_message
        final_video_url = poll_dreamface_job(dreamface_api_key, task_id)
        if not final_video_url:  # Cleanup in finally
            print(f"ERROR [{job_name}]: Failed to get final video URL from DreamFace.")
            last_error_message = "Failed to get final video URL from DreamFace"
            return False, last_error_message
        # Step 7: Checking generated video
        if progress_callback:
            progress_callback(step, total_steps, steps[step])
            if remove_silence:
                step += 1
            else:
                step += 2
        # Ensure download path exists
        os.makedirs(os.path.dirname(raw_downloaded_video_path) or '.', exist_ok=True)
        download_success = download_video(final_video_url, raw_downloaded_video_path)
        if not download_success or not os.path.exists(raw_downloaded_video_path) or os.path.getsize(raw_downloaded_video_path) == 0:
            print(f"ERROR [{job_name}]: Failed to download, verify, or got empty file from DreamFace: {raw_downloaded_video_path}.")
            last_error_message = f"Failed to download, verify, or got empty file from DreamFace: {raw_downloaded_video_path}"
            return False, last_error_message
        print(f"[{job_name}] Raw lip-synced video saved locally temporarily as: {raw_downloaded_video_path}")
        print(f"[{job_name}] Step 5 completed in {time.time() - step_start_time:.2f}s"); step_start_time = time.time()


        print(f"\n--- [{job_name}] Step 6: Finalize Base Video (Silence Removal / Rename) ---")
        current_video_path = raw_downloaded_video_path # Start with the downloaded path
        intended_final_path = None # Path *before* overlay

        if remove_silence:
            # Step 8: Silence Removal / Rename
            if progress_callback:
                progress_callback(step, total_steps, steps[step])
                step += 1
            print(f"[{job_name}] Attempting silence removal from {current_video_path} to {edited_video_path}...")
            # Ensure output dir for edited video exists
            os.makedirs(os.path.dirname(edited_video_path) or '.', exist_ok=True)
            edit_success = remove_silence_from_video(current_video_path, edited_video_path)
            if edit_success and os.path.exists(edited_video_path) and os.path.getsize(edited_video_path) > 0 :
                print(f"[{job_name}] Silence removal successful. Using edited video.")
                intended_final_path = edited_video_path
                # Delete the raw downloaded file now that edited version is confirmed good
                try:
                    if current_video_path and os.path.exists(current_video_path): # Check if path is valid
                         os.remove(current_video_path); print(f"[{job_name}] Removed raw downloaded file: {current_video_path}")
                         raw_downloaded_video_path = None # Clear variable since file is gone
                except OSError as e: print(f"Warning [{job_name}]: Failed to remove raw downloaded file {current_video_path}: {e}")
            else:
                print(f"[{job_name}] Silence removal failed or produced empty file. Using original raw video.")
                # Try to move the original raw video to its final raw path name
                try:
                    # Ensure output dir for raw video exists
                    os.makedirs(os.path.dirname(final_raw_video_path) or '.', exist_ok=True)
                    os.rename(current_video_path, final_raw_video_path)
                    print(f"[{job_name}] Renamed raw video to final raw path: {final_raw_video_path}")
                    intended_final_path = final_raw_video_path
                    raw_downloaded_video_path = None # Clear variable since file is moved/renamed
                except OSError as e:
                     print(f"Warning [{job_name}]: Failed to rename raw video: {e}. Using temp path: {current_video_path}")
                     intended_final_path = current_video_path
                     # Keep raw_downloaded_video_path set, cleanup will handle later if it wasn't moved
        else:
            print(f"[{job_name}] Skipping silence removal step. Using raw video.")
            # Try to move the original raw video to its final raw path name
            try:
                 # Ensure output dir for raw video exists
                os.makedirs(os.path.dirname(final_raw_video_path) or '.', exist_ok=True)
                os.rename(current_video_path, final_raw_video_path)
                print(f"[{job_name}] Renamed raw video to final raw path: {final_raw_video_path}")
                intended_final_path = final_raw_video_path
                raw_downloaded_video_path = None # Clear variable since file is moved/renamed
            except OSError as e:
                 print(f"Warning [{job_name}]: Failed to rename raw video: {e}. Using temp path: {current_video_path}")
                 intended_final_path = current_video_path
                 # Keep raw_downloaded_video_path set, cleanup will handle later if it wasn't moved

        # === Crucial Check ===
        if not intended_final_path or not os.path.exists(intended_final_path) or os.path.getsize(intended_final_path) == 0:
            print(f"ERROR [{job_name}]: Failed to determine valid base video path after finalization.")
            print(f"  Intended path: '{intended_final_path}'")
            print(f"  Check logs for download/rename/silence removal errors.")
            # If original download still exists, maybe keep it? Check raw_downloaded_video_path
            if raw_downloaded_video_path and os.path.exists(raw_downloaded_video_path):
                 print(f"  Original downloaded file still exists at: {raw_downloaded_video_path}")
            last_error_message = "Failed to determine valid base video path after finalization"
            return False, last_error_message

        print(f"[{job_name}] Base video path set to: {intended_final_path}")
        print(f"[{job_name}] Step 6 completed in {time.time() - step_start_time:.2f}s"); step_start_time = time.time()
        final_output_path = intended_final_path

        # --- Step 7: Randomization (Optional) --- << NEW STEP POSITION
        print(f"\n--- [{job_name}] Step 7: Randomization (Optional) ---")
        progress_callback(step, total_steps, steps[step])
        if use_randomization:
            step += 1
        else:
            step += 2
        # The input to this step is the path determined by Step 6
        path_before_randomization = intended_final_path
        path_after_randomization = path_before_randomization  # Default to previous path if randomization skipped/fails
        applied_randomization_settings = None  # Initialize log variable

        # Check the 'use_randomization' flag passed into this function
        if use_randomization:
            print(
                f"[{job_name}] Randomization enabled. Attempting (Intensity: {randomization_intensity}) on: {path_before_randomization}")
            if progress_callback:
                progress_callback(step, total_steps, steps[step])
                step += 1
            # Ensure the base path for output (directory part) exists
            # 'output_file_base' should have been defined earlier based on output dir and job name
            os.makedirs(os.path.dirname(output_file_base), exist_ok=True)

            randomization_log_path = str(WORKING_DIR)
            # --- Call the imported randomize_video function ---
            # It expects input path, base for output names, and intensity.
            # It returns the path to the new video and a dictionary of applied settings.
            randomized_path_output, applied_randomization_settings = randomize_video(
                input_path=path_before_randomization,
                output_base_path=output_file_base,
                working_dir=WORKING_DIR,
                intensity=randomization_intensity,
                randomization_log_path=randomization_log_path,
            )

            # Already assigned above from return value, so this line is now unnecessary
            # You can just delete that old assignment

            # --- Check if randomization was successful ---
            if randomized_path_output and os.path.exists(randomized_path_output) and os.path.getsize(
                    randomized_path_output) > 0:
                print(f"[{job_name}] Randomization successful. Path is now: {randomized_path_output}")
                path_after_randomization = randomized_path_output  # Update the path for the next step

                # If successful, delete the input file to randomization (the pre-randomized version)
                if path_before_randomization != path_after_randomization:  # Safety check
                    try:
                        print(f"[{job_name}] Removing pre-randomization file: {path_before_randomization}")
                        os.remove(path_before_randomization)
                    except OSError as e:
                        print(
                            f"Warning [{job_name}]: Failed to remove pre-randomization file {path_before_randomization}: {e}")
            else:
                # Randomization function failed or produced an empty file
                print(f"Warning [{job_name}]: Randomization failed or produced empty file.")
                # The path variable 'path_after_randomization' still holds the previous path (fallback)
                print(f"[{job_name}] Using non-randomized video path for subsequent steps: {path_after_randomization}")
                # Try to clean up the failed/empty randomized file if it exists
                if randomized_path_output and os.path.exists(randomized_path_output):
                    try:
                        os.remove(randomized_path_output)
                    except OSError:
                        pass
                # Update log status if we got a log dictionary back
                if applied_randomization_settings:
                    applied_randomization_settings["status"] = "failed_fallback"

        else:
            # Randomization was disabled by the 'use_randomization' flag for this job
            print(f"[{job_name}] Skipping randomization (use_randomization is False).")
            # 'path_after_randomization' correctly holds the input path already

        # --- Sanity Check (Make sure we have a valid video file before proceeding) ---
        if not path_after_randomization or not os.path.exists(path_after_randomization) or os.path.getsize(
                path_after_randomization) == 0:
            print(
                f"ERROR [{job_name}]: Video path is invalid after Step 7 (Randomization): '{path_after_randomization}'")
            last_error_message = f"Video path is invalid after Step 7 (Randomization): '{path_after_randomization}'"
            # Log failure details if possible before returning
            json_output_folder = os.path.join(OUTPUT_BASE_DIR, "json")
            os.makedirs(json_output_folder, exist_ok=True)
            randomization_log_path = os.path.join(json_output_folder, f"{job_name}_{run_uuid}_randomizations.json")

            if applied_randomization_settings and randomization_log_path:
                try:
                    applied_randomization_settings["status"] = "job_failed"
                    applied_randomization_settings["job_error"] = "Video missing or empty after randomization step"
                    # Ensure directory exists before writing log
                    os.makedirs(os.path.dirname(randomization_log_path), exist_ok=True)
                    with open(randomization_log_path, 'w') as f:
                        json.dump(applied_randomization_settings, f, indent=4)
                except Exception as log_e:
                    print(f"Warning: Failed to write job failure log: {log_e}")
                    last_error_message = f"Video path is invalid after Step 7 (Randomization): '{path_after_randomization}'"
            return False, last_error_message # Fail the entire job

        # --- Log completion of this step ---
        current_step_time = time.time() - step_start_time  # Calculate time for this step
        print(f"[{job_name}] Step 7 completed in {current_step_time:.2f}s");
        step_start_time = time.time()  # Reset timer for the next step
        final_output_path = path_after_randomization

        # --- Step 8: Product Overlay (Optional) ---
        print(f"\n--- [{job_name}] Step 8: Product Overlay (Optional) ---")
        progress_callback(step, total_steps, steps[step])
        if use_overlay:
            step += 1
        else:
            step += 2
        # Input path for this step is the result of Step 7 (Randomization)
        path_before_overlay = path_after_randomization  # Or whatever variable holds the correct path now

        # This variable will track the final path *resulting* from this step.
        final_output_path = path_before_overlay

        if use_overlay:
            if progress_callback:
                progress_callback(step, total_steps, steps[step])
                step += 1

            # === V1.20/Phase 2 START: Get Main Video Dimensions via OpenCV ===
            main_video_width = None
            main_video_height = None
            print(f"[{job_name}] Attempting to get dimensions for main video: {path_before_overlay}")

            if path_before_overlay and os.path.exists(path_before_overlay):
                try:
                    cap = cv2.VideoCapture(path_before_overlay)
                    if not cap.isOpened():
                        print(f"ERROR [{job_name}]: OpenCV failed to open video: {path_before_overlay}")
                    else:
                        # CAP_PROP_FRAME_WIDTH and _HEIGHT return floats
                        w = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
                        h = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
                        cap.release()

                        # Convert to int if valid
                        if w > 0 and h > 0:
                            main_video_width = int(w)
                            main_video_height = int(h)
                            print(f"[{job_name}] Found main video dimensions: {main_video_width}×{main_video_height}")
                        else:
                            print(f"WARNING [{job_name}]: OpenCV returned non-positive dimensions ({w}×{h})")
                except Exception as e:
                    print(f"ERROR [{job_name}]: Exception getting dimensions via OpenCV: {e}")
                    traceback.print_exc()
            else:
                print(f"WARNING [{job_name}]: Cannot get dimensions, invalid or missing path: {path_before_overlay}")
            # === V1.20/Phase 2 END ===

            # === Check if overlay is possible ===
            # Now this check can safely use product_clip_path because it was initialized earlier
            should_overlay = (
                    path_before_overlay and os.path.exists(path_before_overlay)
                    and product_clip_path and os.path.exists(
                product_clip_path)  # product_clip_path guaranteed to exist (as None or path)
                    and main_video_width and main_video_height  # Check we got main dimensions too
            )

            # Initialize geometry variable
            calculated_geometry = None
            overlay_ready = False  # Flag to track if we have geometry needed for overlay

            if should_overlay:
                print(f"[{job_name}] Overlay possible. Proceeding with geometry calculation.")
                overlay_duration = 5.0  # Default duration

                # --- Get Overlay Clip Aspect Ratio via OpenCV ---
                overlay_aspect_ratio = None
                print(f"[{job_name}] Getting dimensions for overlay clip: {product_clip_path}")

                if product_clip_path and os.path.exists(product_clip_path):
                    try:
                        cap = cv2.VideoCapture(product_clip_path)
                        if not cap.isOpened():
                            print(f"ERROR [{job_name}]: OpenCV failed to open overlay clip: {product_clip_path}")
                        else:
                            w = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
                            h = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
                            cap.release()

                            if h > 0:
                                overlay_aspect_ratio = w / h
                                print(
                                    f"[{job_name}] Found overlay clip dimensions: "
                                    f"{int(w)}×{int(h)}, Aspect Ratio: {overlay_aspect_ratio:.3f}"
                                )
                            else:
                                print(
                                    f"WARNING [{job_name}]: Overlay clip height is zero → "
                                    f"cannot compute aspect ratio."
                                )
                    except Exception as e:
                        print(
                            f"ERROR [{job_name}]: Exception getting overlay clip dimensions via OpenCV: {e}"
                        )
                        traceback.print_exc()
                else:
                    print(
                        f"WARNING [{job_name}]: Cannot get overlay dimensions, "
                        f"invalid or missing path: {product_clip_path}"
                    )
                # --- End Aspect-Ratio Extraction ---

                # --- Determine Placement and Size ---
                if overlay_aspect_ratio:  # Only proceed if we got aspect ratio
                    # Defaults and supported placements based on constraints
                    selected_placement = "middle_left"
                    relative_size = 0.4
                    # Expand the list of supported placements to allow for more positioning options
                    supported_placements = [
                        "top_left", "top_center", "top_right",
                        "middle_left", "middle_center", "middle_right",
                        "bottom_left", "bottom_center", "bottom_right"
                    ]

                    # Check overlay_settings from YAML
                    if overlay_settings and isinstance(overlay_settings, dict):
                        print(f"[{job_name}] Using overlay_settings from job config.")
                        placements_list = overlay_settings.get('placements', [])
                        valid_user_placements = [p for p in placements_list if
                                                 isinstance(p, str) and p in supported_placements]
                        size_range_list = overlay_settings.get('size_range', [])
                        overlay_duration = overlay_settings.get('maximum_overlay_duration', 5.0)

                        if valid_user_placements:
                            # Use the first placement from the list (not random choice) to ensure consistent placement
                            selected_placement = valid_user_placements[0]
                            print(f"[{job_name}] Using specified placement from config: '{selected_placement}'")
                        else:
                            print(
                                f"WARNING [{job_name}]: No supported placements ({supported_placements}) found in overlay_settings: {placements_list}. Using default '{selected_placement}'.")

                        if isinstance(size_range_list, list) and len(size_range_list) == 2 and \
                                isinstance(size_range_list[0], (int, float)) and isinstance(size_range_list[1],
                                                                                            (int, float)) and \
                                0.05 < size_range_list[0] <= size_range_list[1] <= 1.0:
                            # Use the maximum size in the range for larger overlays
                            relative_size = size_range_list[1]
                            print(
                                f"[{job_name}] Using size from YAML: placement='{selected_placement}', size={relative_size:.2f}")
                        else:
                            print(
                                f"WARNING [{job_name}]: Invalid 'size_range' in overlay_settings: {size_range_list}. Using default size {relative_size:.2f}.")
                    else:
                        print(
                            f"[{job_name}] No valid 'overlay_settings' found in job config. Using defaults: placement='{selected_placement}', size={relative_size:.2f}")

                    # --- Calculate Final Geometry using Helper Function ---
                    calculated_geometry = calculate_overlay_geometry(
                        placement_str=selected_placement,
                        relative_size=relative_size,
                        main_w=main_video_width,
                        main_h=main_video_height,
                        overlay_aspect_ratio=overlay_aspect_ratio,
                        margin_percent=7  # Using 7% margin as discussed
                    )

                    if calculated_geometry:
                        overlay_ready = True
                        print(f"[{job_name}] Geometry calculated. Ready for overlay.")
                    else:
                        print(f"ERROR [{job_name}]: Failed to calculate overlay geometry. Skipping overlay.")
                else:
                    print(
                        f"WARNING [{job_name}]: Missing overlay aspect ratio. Cannot calculate geometry. Skipping overlay.")

                # --- Proceed ONLY if geometry was successfully calculated ---
                if overlay_ready:
                    overlay_step_start_time = time.time()
                    video_with_overlay_path = f"{output_file_base}_final_overlay.mp4"
                    start_time_asr = None
                    end_time_asr = None
                    overlay_success = False

                    try:
                        # Use the original ElevenLabs TTS audio file for keyword detection
                        # This provides better ASR accuracy than extracting from final video
                        print(f"[{job_name}] Using original ElevenLabs TTS audio for keyword detection: {temp_audio_filename}")
                        
                        if not os.path.exists(temp_audio_filename):
                            raise RuntimeError(f"Original TTS audio file not found: {temp_audio_filename}")

                        # Get timestamps using Whisper on the original clean TTS audio
                        keywords_to_use = trigger_keywords if trigger_keywords is not None else []
                        print(f"DEBUG [{job_name}]: Using trigger keywords for ASR from job config: {keywords_to_use}")
                        start_time_asr, end_time_asr = get_product_mention_times(
                            audio_path=temp_audio_filename, trigger_keywords=keywords_to_use,
                            language=language, job_name=job_name, desired_duration=overlay_duration
                        )

                        # Perform overlay if times were found
                        if start_time_asr is not None and end_time_asr is not None:
                            os.makedirs(os.path.dirname(video_with_overlay_path), exist_ok=True)
                            print(f"[{job_name}] Attempting FFmpeg overlay using calculated geometry...")

                            print(f"[{job_name}] Calling overlay function with geometry: {calculated_geometry}")
                            overlay_success = overlay_product_video(
                                main_video_path=path_before_overlay, product_clip_path=product_clip_path,
                                start_time=start_time_asr, end_time=end_time_asr,
                                output_path=video_with_overlay_path,
                                overlay_x=calculated_geometry['x'], overlay_y=calculated_geometry['y'],
                                overlay_w=calculated_geometry['w'], overlay_h=calculated_geometry['h'],
                                job_name=job_name
                            )

                            if overlay_success and (not os.path.exists(video_with_overlay_path) or os.path.getsize(
                                    video_with_overlay_path) == 0):
                                print(
                                    f"ERROR [{job_name}]: overlay_product_video reported success, but output file missing or empty: {video_with_overlay_path}")
                                overlay_success = False
                        else:
                            print(
                                f"[{job_name}] Product keywords not found or timing invalid via ASR. Skipping FFmpeg overlay.")
                            overlay_success = False

                    except Exception as e:
                        print(f"ERROR [{job_name}]: Failed during overlay processing step (ASR/ffmpeg): {e}")
                        traceback.print_exc()
                        overlay_success = False

                    # 4. Update final path variable based on overlay success
                    if overlay_success:
                        print(f"[{job_name}] Overlay successful. Final video path updated to: {video_with_overlay_path}")
                        final_output_path = video_with_overlay_path
                        try:
                            print(f"[{job_name}] Removing intermediate video (pre-overlay): {path_before_overlay}")
                            os.remove(path_before_overlay)
                        except OSError as e:
                            print(
                                f"Warning [{job_name}]: Failed to remove intermediate video {path_before_overlay}: {e}. Both versions may exist.")
                    else:
                        print(
                            f"Warning/Info [{job_name}]: Overlay failed or skipped. Final video path remains: {final_output_path}")

                    print(
                        f"[{job_name}] Step 8 Sub-Process (Audio/ASR/FFmpeg) completed in {time.time() - overlay_step_start_time:.2f}s")
                    # --- End of block that runs only if overlay_ready is True ---

            else:  # should_overlay was False initially
                # Logging for skipping overlay
                if not path_before_overlay or not os.path.exists(path_before_overlay):
                    print(
                        f"[{job_name}] Skipping overlay because base video path is invalid or missing: {path_before_overlay}")
                elif not product_clip_path:  # Covers folder not found, no .mov files, errors, etc.
                    print(f"[{job_name}] Skipping overlay because no valid product clip could be selected.")
                elif not os.path.exists(product_clip_path):
                    print(
                        f"[{job_name}] Skipping overlay because selected product clip file does not exist: {product_clip_path}")
                elif not main_video_width or not main_video_height:
                    print(f"[{job_name}] Skipping overlay because main video dimensions could not be determined.")
                else:  # Generic fallback if none of the specific reasons matched
                    print(f"[{job_name}] Skipping overlay for an undetermined reason (should_overlay is False).")
                # General skip message was here - removed for more specific logging above
        else:
            # Product Overlay was disabled by the 'use_overlay' flag for this job
            print(f"[{job_name}] Skipping Product Overlay (use_overlay is False).")
            # 'final_output_path' correctly holds the input path already

        # --- Step 8 Block Ends --- The rest of the function continues...

        # --- Final Check (uses final_output_path which might now be the _overlay path) ---
        print(f"[{job_name}] Performing final check on path: {final_output_path}")
        if not final_output_path or not os.path.exists(final_output_path) or os.path.getsize(final_output_path) == 0: # Fail the job
            print(f"ERROR [{job_name}]: Final video output path ('{final_output_path}') is missing or empty after all steps.")
            last_error_message = f"Final video output path ('{final_output_path}') is missing or empty after all steps"
            return False, last_error_message

        # Step 9: Upload to Drive (Placeholder - uses the potentially updated final_output_path)
        # Finalizing result
        if progress_callback:
            progress_callback(step, total_steps, steps[step])
            # step += 1
        # --- Step 9: Enhanced Video Processing (TikTok-Style Enhancements) ---
        print(f"\n--- [{job_name}] Step 9: Enhanced Video Processing (TikTok-Style Enhancements) ---")
        step_start_time = time.time()
        
        # Check if enhanced processing is requested
        enhanced_settings = enhanced_video_settings
        if enhanced_settings:
            try:
                from backend.enhanced_video_processor import EnhancedVideoProcessor, TextOverlayConfig, CaptionConfig, MusicConfig
                from backend.enhanced_video_processor import TextPosition, CaptionStyle
                from backend.whisper_service import WhisperService, WhisperConfig
                from backend.music_library import MusicLibrary, MusicSelectionConfig, MusicCategory
                
                print(f"[{job_name}] Applying enhanced video processing...")
                processor = EnhancedVideoProcessor()
                
                # Setup enhanced output path
                enhanced_output_path = os.path.join(
                    os.path.dirname(final_output_path),
                    f"{os.path.splitext(os.path.basename(final_output_path))[0]}_enhanced.mp4"
                )
                
                # Parse enhancement configurations
                text_configs = []

                # Debug: Log what we received from frontend
                print(f"[{job_name}] 🎯 Backend received enhanced_settings keys: {list(enhanced_settings.keys())}")
                if 'text_overlays' in enhanced_settings:
                    print(f"[{job_name}] 🎯 text_overlays type: {type(enhanced_settings['text_overlays'])}")
                    print(f"[{job_name}] 🎯 text_overlays content: {enhanced_settings['text_overlays']}")
                if 'captions' in enhanced_settings:
                    captions_data = enhanced_settings['captions']
                    print(f"[{job_name}] 🎯 captions designWidth: {captions_data.get('designWidth')}")
                    print(f"[{job_name}] 🎯 captions designHeight: {captions_data.get('designHeight')}")

                # Check if we have the new structured format
                if 'text_overlays' in enhanced_settings and isinstance(enhanced_settings['text_overlays'], list):
                    # New structured format: enhanced_settings.text_overlays[]
                    for overlay_index, text_overlay in enumerate(enhanced_settings['text_overlays'], 1):
                        if text_overlay.get('enabled'):
                            # Handle AI-generated or random text
                            # Frontend sends 'custom_text' for user-entered text
                            text = text_overlay.get('custom_text', text_overlay.get('text', ''))
                            mode = text_overlay.get('mode', 'custom')

                            if mode == 'ai_generated' or text == 'ai_generated':
                                # Generate AI text based on script (if available)
                                whisper_service = WhisperService(WhisperConfig(api_key=openai_api_key))
                                headings = whisper_service.generate_ai_heading(
                                    script_content if 'script_content' in locals() else product,
                                    product=product,
                                    emotion=emotion
                                )
                                text = headings[0] if headings else "Amazing discovery! 🤯"
                            elif mode == 'random_from_pool' or text == 'random_from_pool':
                                from backend.enhanced_video_processor import TEXT_TEMPLATES
                                category = text_overlay.get('category', 'engagement')
                                text = random.choice(TEXT_TEMPLATES.get(category, TEXT_TEMPLATES['engagement']))

                            # Check for connected background data
                            connected_background_data = text_overlay.get('connected_background_data')
                            has_background = text_overlay.get('hasBackground', False)

                            # Only enable connected backgrounds if BOTH hasBackground is true AND valid data exists
                            connected_background_enabled = (
                                has_background and  # Must have background enabled
                                connected_background_data is not None and
                                isinstance(connected_background_data, dict) and
                                'image' in connected_background_data and
                                'metadata' in connected_background_data
                            )

                            # Debug: Log background settings received from frontend
                            has_bg_frontend = text_overlay.get('hasBackground', False)
                            bg_style_frontend = text_overlay.get('backgroundStyle', 'none')
                            print(f"[{job_name}] 🎨 Text Overlay {overlay_index} Backend Debug:")
                            print(f"  - hasBackground (frontend): {has_bg_frontend}")
                            print(f"  - backgroundStyle (frontend): {bg_style_frontend}")
                            print(f"  - connected_background_data present: {connected_background_data is not None}")
                            print(f"  - connected_background_enabled (final): {connected_background_enabled}")

                            # Add positioning data to metadata if connected background is enabled
                            if connected_background_enabled:
                                # Get x_position and y_position from text_overlay settings
                                x_pos = text_overlay.get('x_position', 50)
                                y_pos = text_overlay.get('y_position', 20)

                                # Add positioning to metadata
                                connected_background_data['metadata']['x_position'] = x_pos
                                connected_background_data['metadata']['y_position'] = y_pos

                            # Use fontSize and scale exactly like the preview (no pre-calculation)
                            base_font_size = text_overlay.get('font_size') or text_overlay.get('fontSize', 20)  # Prefer font_size, fallback to fontSize
                            # For connected backgrounds, scale is not used (always 100%), for others use form value
                            scale_percentage = text_overlay.get('scale', 100) if connected_background_enabled else text_overlay.get('scale', 60)

                            # Debug: Log font data received from frontend
                            print(f"[{job_name}] 📊 Text Overlay {overlay_index}: fontPx={text_overlay.get('fontPx')}, fontPercentage={text_overlay.get('fontPercentage')}")

                            text_config = TextOverlayConfig(
                                text=text,
                                position=TextPosition(text_overlay.get('position', 'top_center')),
                                font_family=text_overlay.get('font', 'Montserrat-Bold'),
                                font_size=base_font_size,        # Use base font size directly
                                scale=scale_percentage / 100.0,  # Pass scale as separate parameter
                                animation=text_overlay.get('animation', 'fade_in'),
                                color=text_overlay.get('color', 'white'),
                                shadow_enabled=False,  # Disable shadow by default
                                connected_background_enabled=connected_background_enabled,
                                connected_background_data=connected_background_data if connected_background_enabled else None,
                                hasBackground=text_overlay.get('hasBackground', True),
                                # Design-space fields from frontend
                                design_width=text_overlay.get('designWidth'),
                                design_height=text_overlay.get('designHeight'),
                                x_pct=text_overlay.get('xPct'),
                                y_pct=text_overlay.get('yPct'),
                                anchor=text_overlay.get('anchor'),
                                safe_margins_pct=text_overlay.get('safeMarginsPct'),
                                font_px=text_overlay.get('fontPx'),
                                font_percentage=text_overlay.get('fontPercentage'),
                                border_px=text_overlay.get('borderPx'),
                                shadow_px=text_overlay.get('shadowPx'),
                                line_spacing_px=text_overlay.get('lineSpacingPx'),
                                wrap_width_pct=text_overlay.get('wrapWidthPct')
                            )
                            text_configs.append(text_config)
                            overlay_name = f"Text {overlay_index}" if overlay_index else "Text 1"
                            bg_type = "with connected background" if connected_background_enabled else "with standard background"
                            print(f"[{job_name}] {overlay_name} overlay: '{text}' {bg_type}")

                            # Log what settings are being sent to TextOverlayConfig for non-connected backgrounds
                            if not connected_background_enabled:
                                print(f"[{job_name}] ⚠️ Text Overlay {overlay_index} using STANDARD background with settings:")
                                print(f"  - backgroundHeight: {text_overlay.get('backgroundHeight')}")
                                print(f"  - backgroundOpacity: {text_overlay.get('backgroundOpacity')}")
                                print(f"  - backgroundColor: {text_overlay.get('backgroundColor')}")
                                print(f"  - animation: {text_overlay.get('animation')}")
                                print(f"  - hasBackground (should be False): {text_overlay.get('hasBackground')}")
                                print(f"  - color: {text_overlay.get('color')}")
                                print(f"  - font: {text_overlay.get('font')}")
                                print(f"  - fontSize: {text_overlay.get('fontSize')}")
                                print(f"  - fontPercentage: {text_overlay.get('fontPercentage')}")

                                # Log what gets passed to TextOverlayConfig
                                print(f"[{job_name}] 📋 TextOverlayConfig will receive:")
                                print(f"  - text: '{text}'")
                                print(f"  - font_family: {text_overlay.get('font', 'Montserrat-Bold')}")
                                print(f"  - color: {text_overlay.get('color', 'white')}")
                                print(f"  - font_size: {base_font_size}")
                                print(f"  - animation: {text_overlay.get('animation', 'fade_in')}")
                                print(f"  - hasBackground: {text_overlay.get('hasBackground', True)}")
                
                caption_config = None
                if enhanced_settings.get('captions', {}).get('enabled'):
                    captions = enhanced_settings['captions']
                    
                    # Create caption config with all the new settings
                    from backend.enhanced_video_processor import ExtendedCaptionConfig
                    # Debug: Log caption font data received from frontend
                    print(f"[{job_name}] 📊 Captions: fontSize={captions.get('fontSize')}, fontPercentage={captions.get('fontPercentage')}")
                    print(f"[{job_name}] 🎨 Caption COLOR DEBUG: All caption keys = {list(captions.keys())}")
                    print(f"[{job_name}] 🎨 Caption color value = {captions.get('color')}")
                    print(f"[{job_name}] 🎨 Caption fontColor value = {captions.get('fontColor')}")
                    print(f"[{job_name}] 🎨 Caption backgroundColor value = {captions.get('backgroundColor')}")
                    print(f"[{job_name}] 🎨 Caption backgroundOpacity value = {captions.get('backgroundOpacity')}")
                    print(f"[{job_name}] 🎨 Caption hasBackground value = {captions.get('hasBackground')}")
                    print(f"[{job_name}] 🎨 Full captions dict = {captions}")

                    # BUGFIX: Frontend might send 'fontColor' instead of 'color'
                    caption_color = captions.get('color') or captions.get('fontColor') or '#FFFFFF'
                    
                    # BUGFIX: Ensure background color consistency - prefer non-default values
                    caption_bg_color = captions.get('backgroundColor', '#000000')
                    # If the enhanced_settings has the default black color, it might be an oversight
                    # In this case, we should keep the value from enhanced_settings as-is since it was explicitly set
                    print(f"[{job_name}] 🎨 Using background color from enhanced_settings: {caption_bg_color}")
                    
                    # DEBUG: Also log if there are any top-level caption settings that might be relevant
                    # This helps identify data consistency issues
                    if hasattr(enhanced_video_settings, 'get'):
                        top_level_bg = enhanced_video_settings.get('captions_backgroundColor')
                        if top_level_bg and top_level_bg != caption_bg_color:
                            print(f"[{job_name}] ⚠️  WARNING: Background color mismatch!")
                            print(f"[{job_name}] ⚠️  Enhanced settings: {caption_bg_color}")
                            print(f"[{job_name}] ⚠️  Top-level setting: {top_level_bg}")
                            print(f"[{job_name}] ⚠️  Using enhanced settings value: {caption_bg_color}")
                    print(f"[{job_name}] 🎨 Using caption color: {caption_color}")
                    
                    caption_config = ExtendedCaptionConfig(
                        enabled=True,
                        template=captions.get('template', 'tiktok_classic'),
                        fontSize=captions.get('fontSize', 32),
                        fontFamily=captions.get('fontFamily', 'Montserrat-Bold'),
                        x_position=captions.get('x_position', 50),
                        y_position=captions.get('y_position', 85),
                        color=caption_color,
                        hasStroke=captions.get('hasStroke', True),
                        strokeColor=captions.get('strokeColor', '#000000'),
                        strokeWidth=captions.get('strokeWidth', 2),
                        # Design-space fields from frontend
                        design_width=captions.get('designWidth'),
                        design_height=captions.get('designHeight'),
                        x_pct=captions.get('xPct'),
                        y_pct=captions.get('yPct'),
                        anchor=captions.get('anchor'),
                        safe_margins_pct=captions.get('safeMarginsPct'),
                        font_px=captions.get('fontPx'),
                        font_percentage=captions.get('fontPercentage'),
                        border_px=captions.get('borderPx'),
                        shadow_px=captions.get('shadowPx'),
                        hasBackground=captions.get('hasBackground', False),
                        backgroundColor=caption_bg_color,
                        backgroundOpacity=captions.get('backgroundOpacity', 0.8),
                        animation=captions.get('animation', 'none'),
                        highlight_keywords=captions.get('highlight_keywords', True)
                    )
                    print(f"[{job_name}] Captions enabled: template={caption_config.template}, fontSize={caption_config.fontSize}px, position=({caption_config.x_position}%, {caption_config.y_position}%)")
                
                music_config = None
                if enhanced_settings.get('music', {}).get('enabled'):
                    music = enhanced_settings['music']
                    
                    # Initialize music library
                    music_library = MusicLibrary()
                    
                    # Select track
                    track_id = music.get('track_id')
                    if track_id == 'random_upbeat':
                        selection_config = MusicSelectionConfig(category=MusicCategory.UPBEAT_ENERGY)
                        selected_track = music_library.select_track(selection_config)
                        track_path = selected_track.path if selected_track else None
                    elif track_id == 'random_chill':
                        selection_config = MusicSelectionConfig(category=MusicCategory.CHILL_VIBES)
                        selected_track = music_library.select_track(selection_config)
                        track_path = selected_track.path if selected_track else None
                    elif track_id == 'random_corporate':
                        selection_config = MusicSelectionConfig(category=MusicCategory.CORPORATE_CLEAN)
                        selected_track = music_library.select_track(selection_config)
                        track_path = selected_track.path if selected_track else None
                    else:
                        # Get track by ID and extract path from TrackMetadata object
                        selected_track = music_library.tracks.get(track_id) if track_id else None
                        track_path = selected_track.path if selected_track else None
                    
                    if track_path:
                        # Convert UI values to backend format
                        volume_ui = music.get('volume', 0.6)  # UI sends 0-2 range (0.6 = 30% = old default)
                        # New conversion: 0 = -60dB, 1 = -25dB (old 100%), 2 = -8dB (twice as loud)
                        volume_db = -60 + (volume_ui * 26)  # Convert to -60dB to -8dB range
                        
                        music_config = MusicConfig(
                            track_path=track_path,
                            volume_db=volume_db,
                            fade_in_duration=music.get('fade_in', 2.0),
                            fade_out_duration=music.get('fade_out', 2.0)
                        )
                        print(f"[{job_name}] Music track selected: {track_path}")
                    else:
                        print(f"[{job_name}] Warning: Music track not found, skipping music enhancement")
                
                # Configure output volume if enabled
                output_volume_config = None
                if enhanced_settings.get('outputVolumeEnabled'):
                    from backend.enhanced_video_processor import OutputVolumeConfig
                    output_volume_config = OutputVolumeConfig(
                        enabled=True,
                        target_level=enhanced_settings.get('outputVolumeLevel', 0.5)
                    )
                    print(f"[{job_name}] Output volume enabled: {output_volume_config.target_level * 100:.0f}%")
                
                # Extract audio from edited video for caption generation if captions are enabled
                extracted_audio_path = None
                print(f"[{job_name}] Caption config status: {caption_config is not None}")
                if caption_config is not None:
                    print(f"[{job_name}] Caption config details: template={caption_config.template}, fontSize={caption_config.fontSize}px, position=({caption_config.x_position}%, {caption_config.y_position}%)")
                    try:
                        # Create temporary audio file path
                        extracted_audio_path = os.path.join(WORKING_DIR, f"extracted_audio_{uuid.uuid4()}.wav")
                        
                        # Extract audio using ffmpeg (mono, 16kHz for optimal Whisper performance)
                        ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
                        extract_cmd = [
                            ffmpeg_path, '-i', final_output_path,
                            '-vn',  # No video
                            '-acodec', 'pcm_s16le',  # PCM 16-bit for Whisper
                            '-ar', '16000',  # 16kHz sample rate (Whisper optimal)
                            '-ac', '1',  # Mono audio
                            extracted_audio_path,
                            '-y'  # Overwrite if exists
                        ]
                        
                        print(f"[{job_name}] Extracting audio from edited video for caption generation...")
                        print(f"[{job_name}] Source video: {final_output_path}")
                        print(f"[{job_name}] Target audio: {extracted_audio_path}")
                        
                        extract_result = subprocess.run(extract_cmd, capture_output=True, text=True)
                        
                        if extract_result.returncode == 0:
                            # Verify file was created and has content
                            if os.path.exists(extracted_audio_path) and os.path.getsize(extracted_audio_path) > 0:
                                print(f"[{job_name}] ✅ Audio extracted successfully for captions: {extracted_audio_path}")
                                print(f"[{job_name}] Audio file size: {os.path.getsize(extracted_audio_path) / 1024:.2f} KB")
                            else:
                                print(f"[{job_name}] ⚠️ Audio file was not created or is empty")
                                extracted_audio_path = None
                        else:
                            print(f"[{job_name}] ⚠️ Audio extraction failed with return code: {extract_result.returncode}")
                            print(f"[{job_name}] FFmpeg stderr: {extract_result.stderr[:500]}")  # First 500 chars of error
                            extracted_audio_path = None
                            
                    except Exception as extract_error:
                        print(f"[{job_name}] ⚠️ Error extracting audio for captions: {str(extract_error)}")
                        import traceback
                        print(f"[{job_name}] Traceback: {traceback.format_exc()}")
                        extracted_audio_path = None
                
                # Process enhancements
                result = processor.process_enhanced_video(
                    video_path=final_output_path,
                    output_path=enhanced_output_path,
                    text_configs=text_configs,
                    caption_config=caption_config,
                    music_config=music_config,
                    audio_path=extracted_audio_path,  # Pass extracted audio for caption generation
                    output_volume_config=output_volume_config,
                    validate_quality=True
                )
                
                if result['success']:
                    final_output_path = enhanced_output_path
                    print(f"[{job_name}] ✅ Enhanced processing successful!")
                    print(f"[{job_name}] 🎨 Enhancements applied: {result['enhancements_applied']}")
                    print(f"[{job_name}] 📊 Processing time: {result['metrics']['processing_time']:.2f}s")
                    print(f"[{job_name}] 📁 File size: {result['metrics']['file_size_mb']:.2f} MB")
                    
                    # Clean up temp base video since enhanced version was created successfully
                    try:
                        if intended_final_path and os.path.exists(intended_final_path):
                            os.remove(intended_final_path)
                            print(f"[{job_name}] Cleaned up temp base video: {intended_final_path}")
                    except Exception as cleanup_e:
                        print(f"[{job_name}] Warning: Failed to cleanup temp base video: {cleanup_e}")
                else:
                    print(f"[{job_name}] ❌ Enhanced processing failed: {result['error']}")
                    print(f"[{job_name}] Continuing with original video...")
                
                # Clean up extracted audio file if it was created
                if extracted_audio_path and os.path.exists(extracted_audio_path):
                    try:
                        os.remove(extracted_audio_path)
                        print(f"[{job_name}] Cleaned up extracted audio file: {extracted_audio_path}")
                    except Exception as audio_cleanup_e:
                        print(f"[{job_name}] Warning: Failed to cleanup extracted audio: {audio_cleanup_e}")
                    
            except Exception as e:
                print(f"[{job_name}] ❌ Enhanced processing error: {str(e)}")
                print(f"[{job_name}] Continuing with original video...")
                import traceback
                traceback.print_exc()
        else:
            print(f"[{job_name}] No enhanced processing settings provided, skipping...")
        
        # Log completion of enhanced processing
        current_step_time = time.time() - step_start_time
        print(f"[{job_name}] Step 9 completed in {current_step_time:.2f}s")

        print(f"\n--- [{job_name}] Step 10: Upload to Google Drive ---")
        print(f"[{job_name}] (Placeholder) Upload Final Video ({final_output_path}) to Drive.")

        job_duration = time.time() - job_start_time
        print(f"\n--- Job '{job_name}' SUCCESS in {job_duration:.2f} seconds ---")
        print(f"    Final video: {final_output_path}")
        return True, final_output_path

    except Exception as e:
        # Catch errors from steps 2-7 (before overlay attempt)
        print(f"\n--- Job '{job_name}' FAILED during main processing ---")
        print(f"Error: {e}")
        traceback.print_exc()
        last_error_message = f"Job '{job_name}' FAILED during main processing {e}"
        return False, last_error_message

    finally:
        # --- Cleanup ---
        print(f"--- [{job_name}] Final Cleanup ---")
        # Delete temporary local files if they still exist
        if 'temp_audio_filename' in locals() and temp_audio_filename and os.path.exists(temp_audio_filename):
             try: os.remove(temp_audio_filename); print(f"[{job_name}] Cleaned up: {temp_audio_filename}")
             except OSError as e: print(f"Warning [{job_name}]: Failed cleanup {temp_audio_filename}: {e}")
        # Check if raw_downloaded_video_path still exists (it might have been renamed/deleted in Step 6)
        if 'raw_downloaded_video_path' in locals() and raw_downloaded_video_path and os.path.exists(raw_downloaded_video_path):
             try: os.remove(raw_downloaded_video_path); print(f"[{job_name}] Cleaned up: {raw_downloaded_video_path}")
             except OSError as e: print(f"Warning [{job_name}]: Failed cleanup {raw_downloaded_video_path}: {e}")
        # Note: Using original TTS audio directly - no temp extraction files to clean up

        # Always attempt to delete GCS files (if names were generated)
        # Check if variables exist before trying to use them in cleanup
        gcs_audio_blob_to_delete = locals().get('gcs_audio_blob_name')
        gcs_video_blob_to_delete = locals().get('gcs_video_blob_name')
        if gcs_audio_blob_to_delete:
            delete_from_gcs(gcs_bucket_name, gcs_audio_blob_to_delete)
        if gcs_video_blob_to_delete:
            delete_from_gcs(gcs_bucket_name, gcs_video_blob_to_delete)
        print(f"--- [{job_name}] Cleanup Complete ---")


# --- Randomized Video Generation Function ---
def create_randomized_video_job(
    # --- Text generation parameters ---
    product: str, 
    persona: str, 
    setting: str, 
    emotion: str, 
    hook: str,
    elevenlabs_voice_id: str,
    random_source_dir: str,
    example_script_content: str,
    # --- API keys / Config ---
    openai_api_key: str,
    elevenlabs_api_key: str,
    output_path: str,
    # --- Job Info ---
    job_name: str = "Randomized_Job",
    # --- Optional parameters ---
    language: str = "English",
    enhance_for_elevenlabs: bool = True,
    brand_name: str = "",
    remove_silence: bool = True,  # Add remove_silence parameter
    # --- Randomization parameters (same as avatar campaigns) ---
    use_randomization: bool = False,
    randomization_intensity: str = "none",
    # --- Product Overlay Parameters (NEW) ---
    use_overlay: bool = False,
    product_clip_path: str | None = None, # Product clip for overlay on top of randomized video
    trigger_keywords: list[str] | None = None,  # Accepts trigger keywords list
    overlay_settings: dict | None = None,  # Accepts overlay settings dictionary
    # --- Exact Script Feature ---
    use_exact_script: bool = False,
    # --- Randomized video parameters ---
    random_count: Optional[int] = None,
    hook_video: Optional[str] = None,
    original_volume: float = 0.6,
    voice_audio_volume: float = 1.0,
    # --- Progress callback ---
    progress_callback: Optional[Callable[[int, int, str], None]] = None
) -> tuple[bool, str]:
    """
    Generate randomized video by combining clips from a folder with AI-generated script and voice.
    
    Returns (True, output_path) on success, or (False, error_message) on failure.
    """
    
    from backend.clip_stitch_generator import build_clip_stitch_video
    
    steps = [
        "Initialization...",
        "Generating script", 
        "Synthesizing audio",
        "Building randomized video",
        "Randomization (Optional)",
        "Product Overlay",
        "Removing silence",
        "Finalizing output"
    ]
    total_steps = len(steps)
    step = 0
    last_error_message = ""
    
    print(f"\n--- Starting Randomized Video Job: {job_name} [{datetime.now().isoformat()}] ---")
    job_start_time = time.time()
    
    # Step 1: Initialization
    if progress_callback:
        progress_callback(step, total_steps, steps[step])
        step += 1
        
    # --- Validate Inputs ---
    if not all([product, persona, setting, emotion, hook, elevenlabs_voice_id, example_script_content]):
        print(f"ERROR [{job_name}]: Missing one or more required text parameters.")
        last_error_message = "Missing one or more required text parameters."
        return False, last_error_message
        
    if not all([openai_api_key, elevenlabs_api_key]):
        print(f"ERROR [{job_name}]: Missing one or more required API keys.")
        last_error_message = "Missing one or more required API keys"
        return False, last_error_message
        
    if not os.path.exists(random_source_dir):
        print(f"ERROR [{job_name}]: Random source directory not found: {random_source_dir}")
        last_error_message = f"Random source directory not found: {random_source_dir}"
        return False, last_error_message
        
    if len(example_script_content.strip()) < 50:
        print(f"Warning [{job_name}]: Example script content seems very short.")
        
    # --- API Client Initialization ---
    openai_client = None
    if not use_exact_script:
        # Only initialize OpenAI client if we're generating scripts
        try:
            openai_client = OpenAI(api_key=openai_api_key)
            print(f"[{job_name}] OpenAI client initialized.")
        except Exception as e:
            print(f"ERROR [{job_name}] initializing OpenAI client: {e}")
            traceback.print_exc()
            last_error_message = f"Failed initializing OpenAI client: {e}"
            return False, last_error_message
    else:
        print(f"[{job_name}] Exact script mode - skipping OpenAI client initialization")
        
    try:
        elevenlabs_client = ElevenLabs(api_key=elevenlabs_api_key)
        print(f"[{job_name}] ElevenLabs client initialized.")
    except Exception as e:
        print(f"ERROR [{job_name}] Failed initializing ElevenLabs client: {e}")
        traceback.print_exc()
        last_error_message = f"Failed initializing ElevenLabs client: {e}"
        return False, last_error_message
        
    # --- Unique Identifiers and Paths for this Job ---
    # Add microseconds and random suffix to prevent conflicts in rapid 10x runs
    import random
    microseconds = int(time.time() * 1000000) % 1000000  # Get microseconds part
    random_suffix = random.randint(1000, 9999)
    run_uuid = f"{uuid.uuid4().hex[:8]}_{microseconds}_{random_suffix}"
    timestamp_uuid = f"{int(time.time())}_{run_uuid}"
    temp_audio_filename = str(WORKING_DIR / f"{TEMP_AUDIO_FILENAME_BASE}_{run_uuid}.mp3")
    
    # --- Sanitize Names for Filename/Paths ---
    sanitized_product_name = re.sub(r'[^\w\-]+', '_', product).strip('_')
    if not sanitized_product_name: sanitized_product_name = "unknown_product"
        
    # --- Define Output Paths ---
    today_date_str = datetime.now().strftime('%Y-%m-%d')
    
    path = output_path if output_path and os.path.exists(output_path) else OUTPUT_BASE_DIR
    
    try:
        output_product_folder = os.path.join(path, today_date_str, sanitized_product_name)
        os.makedirs(output_product_folder, exist_ok=True)
        print(f"[{job_name}] Ensured output directory exists: {output_product_folder}")
    except OSError as e:
        print(f"ERROR [{job_name}]: Could not create output directory: {e}. Saving locally.")
        output_product_folder = "."
        
    output_file_base = os.path.join(output_product_folder, f"{job_name}_{run_uuid}")
    final_output_path = f"{output_file_base}_randomized.mp4"
    
    step_start_time = time.time()
    try:
        # Step 2: Generate Script
        if progress_callback:
            progress_callback(step, total_steps, steps[step])
            step += 1
        print(f"\n--- [{job_name}] Step 2: Generate Script ---")
        
        if use_exact_script:
            # Use exact script content instead of generating with AI
            print(f"[{job_name}] Using exact script mode - skipping OpenAI generation")
            generated_script = example_script_content.strip()
            if not generated_script:
                print(f"ERROR [{job_name}]: Exact script mode enabled but script content is empty.")
                last_error_message = "Exact script content is empty"
                return False, last_error_message
            print(f"[{job_name}] Using exact script content: {len(generated_script)} characters")
        else:
            # Generate script using OpenAI
            generated_script = generate_script(
                openai_client, product, persona, setting, emotion, hook, 
                example_script_content, language=language, 
                enhance_for_elevenlabs=enhance_for_elevenlabs, brand_name=brand_name
            )
            if not generated_script:
                print(f"ERROR [{job_name}]: Script generation failed.")
                last_error_message = "Script generation failed"
                return False, last_error_message
        
        print(f"[{job_name}] Generated Script Preview:\n---\n{generated_script[:200]}...\n---")
        print(f"[{job_name}] Step 2 completed in {time.time() - step_start_time:.2f}s")
        step_start_time = time.time()
        
        # Step 3: Generate Audio
        if progress_callback:
            progress_callback(step, total_steps, steps[step])
            step += 1
        print(f"\n--- [{job_name}] Step 3: Generate Audio ---")
        audio_success = generate_audio(
            elevenlabs_client, generated_script, elevenlabs_voice_id, temp_audio_filename
        )
        if not audio_success:
            print(f"ERROR [{job_name}]: Audio generation failed.")
            last_error_message = "Audio generation failed"
            return False, last_error_message
        print(f"[{job_name}] Step 3 completed in {time.time() - step_start_time:.2f}s")
        step_start_time = time.time()
        
        # Step 4: Build Randomized Video
        if progress_callback:
            progress_callback(step, total_steps, steps[step])
            step += 1
        print(f"\n--- [{job_name}] Step 4: Build Randomized Video ---")
        
        stitch_success, stitch_result = build_clip_stitch_video(
            random_source_dir=random_source_dir,
            tts_audio_path=temp_audio_filename,
            output_path=final_output_path,
            random_count=random_count,
            hook_video=hook_video,
            original_volume=original_volume,
            new_audio_volume=voice_audio_volume,
            trim_if_long=True,
            extend_if_short=True,
            extensions=(".mp4", ".mov", ".mkv")
        )
        
        if not stitch_success:
            print(f"ERROR [{job_name}]: Randomized video building failed: {stitch_result}")
            last_error_message = f"Randomized video building failed: {stitch_result}"
            return False, last_error_message
            
        print(f"[{job_name}] Step 4 completed in {time.time() - step_start_time:.2f}s")
        step_start_time = time.time()
        
        # Step 5: Randomization (Optional) - EXACT SAME AS AVATAR CAMPAIGNS
        print(f"\n--- [{job_name}] Step 5: Randomization (Optional) ---")
        if progress_callback:
            progress_callback(step, total_steps, steps[step])
            step += 1
        
        # The input to this step is final_output_path from Step 4
        path_before_randomization = final_output_path
        path_after_randomization = path_before_randomization  # Default to previous path if randomization skipped/fails
        applied_randomization_settings = None  # Initialize log variable

        # Check the 'use_randomization' flag passed into this function
        if use_randomization:
            print(f"[{job_name}] Randomization enabled. Attempting (Intensity: {randomization_intensity}) on: {path_before_randomization}")
            
            # Ensure the base path for output (directory part) exists
            os.makedirs(os.path.dirname(output_file_base), exist_ok=True)

            randomization_log_path = str(WORKING_DIR)
            
            # Import and call the randomize_video function (same as avatar campaigns)
            from backend.randomizer import randomize_video
            
            randomized_path_output, applied_randomization_settings = randomize_video(
                input_path=path_before_randomization,
                output_base_path=output_file_base,
                working_dir=WORKING_DIR,
                intensity=randomization_intensity,
                randomization_log_path=randomization_log_path,
            )

            # Check if randomization was successful (same logic as avatar campaigns)
            if randomized_path_output and os.path.exists(randomized_path_output) and os.path.getsize(randomized_path_output) > 0:
                print(f"[{job_name}] Randomization successful. Path is now: {randomized_path_output}")
                path_after_randomization = randomized_path_output  # Update the path for the next step

                # If successful, delete the input file to randomization (the pre-randomized version)
                if path_before_randomization != path_after_randomization:  # Safety check
                    try:
                        print(f"[{job_name}] Removing pre-randomization file: {path_before_randomization}")
                        os.remove(path_before_randomization)
                    except OSError as e:
                        print(f"Warning [{job_name}]: Failed to remove pre-randomization file {path_before_randomization}: {e}")
            else:
                # Randomization function failed or produced an empty file
                print(f"Warning [{job_name}]: Randomization failed or produced empty file.")
                # The path variable 'path_after_randomization' still holds the previous path (fallback)
                print(f"[{job_name}] Using non-randomized video path for subsequent steps: {path_after_randomization}")
                # Try to clean up the failed/empty randomized file if it exists
                if randomized_path_output and os.path.exists(randomized_path_output):
                    try:
                        os.remove(randomized_path_output)
                    except OSError:
                        pass
                # Update log status if we got a log dictionary back
                if applied_randomization_settings:
                    applied_randomization_settings["status"] = "failed_fallback"

        else:
            # Randomization was disabled by the 'use_randomization' flag for this job
            print(f"[{job_name}] Skipping randomization (use_randomization is False).")
            # 'path_after_randomization' correctly holds the input path already

        # Sanity Check (Make sure we have a valid video file before proceeding)
        if not path_after_randomization or not os.path.exists(path_after_randomization) or os.path.getsize(path_after_randomization) == 0:
            print(f"ERROR [{job_name}]: Video path is invalid after Step 5 (Randomization): '{path_after_randomization}'")
            last_error_message = f"Video path is invalid after Step 5 (Randomization): '{path_after_randomization}'"
            return False, last_error_message # Fail the entire job

        # Update final_output_path for subsequent steps
        final_output_path = path_after_randomization
        print(f"[{job_name}] Step 5 completed in {time.time() - step_start_time:.2f}s")
        step_start_time = time.time()
        
        # --- Step 6: Product Overlay (Optional) ---
        print(f"\n--- [{job_name}] Step 6: Product Overlay (Optional) ---")
        if progress_callback:
            progress_callback(step, total_steps, steps[step])
            if use_overlay:
                step += 1
            else:
                step += 2
        
        # Input path for this step is the result of Step 5 (Randomization)
        path_before_overlay = final_output_path

        # This variable will track the final path *resulting* from this step.
        video_with_overlay_path = None

        if use_overlay:
            # === Get Main Video Dimensions via OpenCV ===
            main_video_width = None
            main_video_height = None
            print(f"[{job_name}] Attempting to get dimensions for main video: {path_before_overlay}")

            if path_before_overlay and os.path.exists(path_before_overlay):
                try:
                    cap = cv2.VideoCapture(path_before_overlay)
                    if not cap.isOpened():
                        print(f"ERROR [{job_name}]: OpenCV failed to open video: {path_before_overlay}")
                    else:
                        # CAP_PROP_FRAME_WIDTH and _HEIGHT return floats
                        w = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
                        h = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
                        cap.release()

                        # Convert to int if valid
                        if w > 0 and h > 0:
                            main_video_width = int(w)
                            main_video_height = int(h)
                            print(f"[{job_name}] Found main video dimensions: {main_video_width}×{main_video_height}")
                        else:
                            print(f"WARNING [{job_name}]: OpenCV returned non-positive dimensions ({w}×{h})")
                except Exception as e:
                    print(f"ERROR [{job_name}]: Exception getting dimensions via OpenCV: {e}")
                    traceback.print_exc()
            else:
                print(f"WARNING [{job_name}]: Cannot get dimensions, invalid or missing path: {path_before_overlay}")

            # === Check if overlay is possible ===
            should_overlay = (
                    path_before_overlay and os.path.exists(path_before_overlay)
                    and product_clip_path and os.path.exists(product_clip_path)
                    and main_video_width and main_video_height  # Check we got main dimensions too
            )

            # Initialize geometry variable
            calculated_geometry = None
            overlay_ready = False  # Flag to track if we have geometry needed for overlay

            if should_overlay:
                print(f"[{job_name}] Overlay possible. Proceeding with geometry calculation.")
                overlay_duration = 5.0  # Default duration

                # --- Get Overlay Clip Aspect Ratio via OpenCV ---
                overlay_aspect_ratio = None
                print(f"[{job_name}] Getting dimensions for overlay clip: {product_clip_path}")

                if product_clip_path and os.path.exists(product_clip_path):
                    try:
                        cap = cv2.VideoCapture(product_clip_path)
                        if not cap.isOpened():
                            print(f"ERROR [{job_name}]: OpenCV failed to open overlay clip: {product_clip_path}")
                        else:
                            w = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
                            h = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
                            cap.release()

                            if h > 0:
                                overlay_aspect_ratio = w / h
                                print(
                                    f"[{job_name}] Found overlay clip dimensions: "
                                    f"{int(w)}×{int(h)}, Aspect Ratio: {overlay_aspect_ratio:.3f}"
                                )
                            else:
                                print(
                                    f"WARNING [{job_name}]: Overlay clip height is zero → "
                                    f"cannot compute aspect ratio."
                                )
                    except Exception as e:
                        print(
                            f"ERROR [{job_name}]: Exception getting overlay clip dimensions via OpenCV: {e}"
                        )
                        traceback.print_exc()
                else:
                    print(
                        f"WARNING [{job_name}]: Cannot get overlay dimensions, "
                        f"invalid or missing path: {product_clip_path}"
                    )

                # --- Determine Placement and Size ---
                if overlay_aspect_ratio:  # Only proceed if we got aspect ratio
                    # Defaults and supported placements based on constraints
                    selected_placement = "middle_left"
                    relative_size = 0.4
                    # Expand the list of supported placements to allow for more positioning options
                    supported_placements = [
                        "top_left", "top_center", "top_right",
                        "middle_left", "middle_center", "middle_right",
                        "bottom_left", "bottom_center", "bottom_right"
                    ]

                    # Check overlay_settings from job config
                    if overlay_settings and isinstance(overlay_settings, dict):
                        print(f"[{job_name}] Using overlay_settings from job config.")
                        placements_list = overlay_settings.get('placements', [])
                        valid_user_placements = [p for p in placements_list if
                                                 isinstance(p, str) and p in supported_placements]
                        size_range_list = overlay_settings.get('size_range', [])
                        overlay_duration = overlay_settings.get('maximum_overlay_duration', 5.0)

                        if valid_user_placements:
                            # Use the first placement from the list (not random choice) to ensure consistent placement
                            selected_placement = valid_user_placements[0]
                            print(f"[{job_name}] Using specified placement from config: '{selected_placement}'")
                        else:
                            print(
                                f"WARNING [{job_name}]: No supported placements ({supported_placements}) found in overlay_settings: {placements_list}. Using default '{selected_placement}'.")

                        if isinstance(size_range_list, list) and len(size_range_list) == 2 and \
                                isinstance(size_range_list[0], (int, float)) and isinstance(size_range_list[1],
                                                                                            (int, float)) and \
                                0.05 < size_range_list[0] <= size_range_list[1] <= 1.0:
                            # Use the maximum size in the range for larger overlays
                            relative_size = size_range_list[1]
                            print(
                                f"[{job_name}] Using size from job config: placement='{selected_placement}', size={relative_size:.2f}")
                        else:
                            print(
                                f"WARNING [{job_name}]: Invalid 'size_range' in overlay_settings: {size_range_list}. Using default size {relative_size:.2f}.")
                    else:
                        print(
                            f"[{job_name}] No valid 'overlay_settings' found in job config. Using defaults: placement='{selected_placement}', size={relative_size:.2f}")

                    # --- Calculate Final Geometry using Helper Function ---
                    calculated_geometry = calculate_overlay_geometry(
                        placement_str=selected_placement,
                        relative_size=relative_size,
                        main_w=main_video_width,
                        main_h=main_video_height,
                        overlay_aspect_ratio=overlay_aspect_ratio,
                        margin_percent=7  # Using 7% margin as discussed
                    )

                    if calculated_geometry:
                        overlay_ready = True
                        print(f"[{job_name}] Geometry calculated. Ready for overlay.")
                    else:
                        print(f"ERROR [{job_name}]: Failed to calculate overlay geometry. Skipping overlay.")
                else:
                    print(
                        f"WARNING [{job_name}]: Missing overlay aspect ratio. Cannot calculate geometry. Skipping overlay.")

                # --- Proceed ONLY if geometry was successfully calculated ---
                if overlay_ready:
                    overlay_step_start_time = time.time()
                    video_with_overlay_path = f"{output_file_base}_randomized_final_overlay.mp4"
                    start_time_asr = None
                    end_time_asr = None
                    overlay_success = False

                    try:
                        # Use the original ElevenLabs TTS audio file for keyword detection
                        # This provides better ASR accuracy than extracting from final video
                        print(f"[{job_name}] Using original ElevenLabs TTS audio for keyword detection: {temp_audio_filename}")
                        
                        if not os.path.exists(temp_audio_filename):
                            raise RuntimeError(f"Original TTS audio file not found: {temp_audio_filename}")

                        # Get timestamps using Whisper on the original clean TTS audio
                        keywords_to_use = trigger_keywords if trigger_keywords is not None else []
                        print(f"DEBUG [{job_name}]: Using trigger keywords for ASR from job config: {keywords_to_use}")
                        start_time_asr, end_time_asr = get_product_mention_times(
                            audio_path=temp_audio_filename, trigger_keywords=keywords_to_use,
                            language=language, job_name=job_name, desired_duration=overlay_duration
                        )

                        # Perform overlay if times were found
                        if start_time_asr is not None and end_time_asr is not None:
                            os.makedirs(os.path.dirname(video_with_overlay_path), exist_ok=True)
                            print(f"[{job_name}] Attempting FFmpeg overlay using calculated geometry...")

                            print(f"[{job_name}] Calling overlay function with geometry: {calculated_geometry}")
                            overlay_success = overlay_product_video(
                                main_video_path=path_before_overlay, product_clip_path=product_clip_path,
                                start_time=start_time_asr, end_time=end_time_asr,
                                output_path=video_with_overlay_path,
                                overlay_x=calculated_geometry['x'], overlay_y=calculated_geometry['y'],
                                overlay_w=calculated_geometry['w'], overlay_h=calculated_geometry['h'],
                                job_name=job_name
                            )

                            if overlay_success and (not os.path.exists(video_with_overlay_path) or os.path.getsize(
                                    video_with_overlay_path) == 0):
                                print(
                                    f"ERROR [{job_name}]: overlay_product_video reported success, but output file missing or empty: {video_with_overlay_path}")
                                overlay_success = False
                        else:
                            print(
                                f"[{job_name}] Product keywords not found or timing invalid via ASR. Skipping FFmpeg overlay.")
                            overlay_success = False

                    except Exception as e:
                        print(f"ERROR [{job_name}]: Failed during overlay processing step (ASR/ffmpeg): {e}")
                        traceback.print_exc()
                        overlay_success = False

                    # 4. Update final path variable based on overlay success
                    if overlay_success:
                        print(f"[{job_name}] Overlay successful. Final video path updated to: {video_with_overlay_path}")
                        final_output_path = video_with_overlay_path
                        try:
                            print(f"[{job_name}] Removing intermediate video (pre-overlay): {path_before_overlay}")
                            os.remove(path_before_overlay)
                        except OSError as e:
                            print(
                                f"Warning [{job_name}]: Failed to remove intermediate video {path_before_overlay}: {e}. Both versions may exist.")
                    else:
                        print(
                            f"Warning/Info [{job_name}]: Overlay failed or skipped. Final video path remains: {final_output_path}")

                    print(
                        f"[{job_name}] Step 6 Sub-Process (ASR/FFmpeg) completed in {time.time() - overlay_step_start_time:.2f}s")

            else:  # should_overlay was False initially
                # Logging for skipping overlay
                if not path_before_overlay or not os.path.exists(path_before_overlay):
                    print(
                        f"[{job_name}] Skipping overlay because base video path is invalid or missing: {path_before_overlay}")
                elif not product_clip_path:  # Covers folder not found, no .mov files, errors, etc.
                    print(f"[{job_name}] Skipping overlay because no valid product clip could be selected.")
                elif not os.path.exists(product_clip_path):
                    print(
                        f"[{job_name}] Skipping overlay because selected product clip file does not exist: {product_clip_path}")
                elif not main_video_width or not main_video_height:
                    print(f"[{job_name}] Skipping overlay because main video dimensions could not be determined.")
                else:  # Generic fallback if none of the specific reasons matched
                    print(f"[{job_name}] Skipping overlay for an undetermined reason (should_overlay is False).")
        else:
            # Product Overlay was disabled by the 'use_overlay' flag for this job
            print(f"[{job_name}] Skipping Product Overlay (use_overlay is False).")

        print(f"[{job_name}] Step 6 completed in {time.time() - step_start_time:.2f}s")
        step_start_time = time.time()
        
        # Step 7: Remove Silence (Optional)
        if progress_callback:
            progress_callback(step, total_steps, steps[step])
            step += 1
        print(f"\n--- [{job_name}] Step 7: Remove Silence ---")
        
        current_video_path = final_output_path
        if remove_silence:
            print(f"[{job_name}] Attempting silence removal from randomized video...")
            silence_removed_path = f"{output_file_base}_randomized_edited.mp4"
            
            edit_success = remove_silence_from_video(current_video_path, silence_removed_path)
            if edit_success and os.path.exists(silence_removed_path) and os.path.getsize(silence_removed_path) > 0:
                print(f"[{job_name}] Silence removal successful. Using edited video.")
                # Replace the original with the silence-removed version
                try:
                    os.remove(current_video_path)
                    os.rename(silence_removed_path, final_output_path)
                    print(f"[{job_name}] Replaced original with silence-removed version.")
                except OSError as e:
                    print(f"Warning [{job_name}]: Failed to replace original with edited version: {e}")
                    # If rename fails, at least we have the edited version
                    final_output_path = silence_removed_path
            else:
                print(f"[{job_name}] Silence removal failed or produced empty file. Using original video.")
                # Clean up failed silence removal file if it exists
                if os.path.exists(silence_removed_path):
                    try:
                        os.remove(silence_removed_path)
                    except OSError:
                        pass
        else:
            print(f"[{job_name}] Skipping silence removal (remove_silence is False).")
            
        print(f"[{job_name}] Step 7 completed in {time.time() - step_start_time:.2f}s")
        step_start_time = time.time()
        
        # Step 8: Finalize
        if progress_callback:
            progress_callback(step, total_steps, steps[step])
            step += 1
        print(f"\n--- [{job_name}] Step 8: Finalizing ---")
        
        if not os.path.exists(final_output_path) or os.path.getsize(final_output_path) == 0:
            print(f"ERROR [{job_name}]: Final output file missing or empty: {final_output_path}")
            last_error_message = f"Final output file missing or empty: {final_output_path}"
            return False, last_error_message
            
        job_duration = time.time() - job_start_time
        print(f"\n--- Randomized Video Job '{job_name}' SUCCESS in {job_duration:.2f} seconds ---")
        print(f"    Final video: {final_output_path}")
        return True, final_output_path
        
    except Exception as e:
        print(f"\n--- Randomized Video Job '{job_name}' FAILED during processing ---")
        print(f"Error: {e}")
        traceback.print_exc()
        last_error_message = f"Randomized video job '{job_name}' FAILED during processing: {e}"
        return False, last_error_message
        
    finally:
        # --- Cleanup ---
        print(f"--- [{job_name}] Final Cleanup ---")
        if os.path.exists(temp_audio_filename):
            try:
                os.remove(temp_audio_filename)
                print(f"[{job_name}] Cleaned up: {temp_audio_filename}")
            except OSError as e:
                print(f"Warning [{job_name}]: Failed cleanup {temp_audio_filename}: {e}")
        print(f"--- [{job_name}] Cleanup Complete ---")


# --- Main Execution Logic (for command-line usage) ---
def main():
    print(f"--- Starting AI Video Creator Script --- Version {SCRIPT_VERSION} ---")
    start_time = time.time()

    print("Loading environment variables from .env file...")
    if not load_dotenv():
        print("Warning: .env file not found or empty.")
    else:
        print("Environment variables loaded.")

    # --- Argument Parsing (Remains the same for single runs) ---
    parser = argparse.ArgumentParser(description="Generate AI Avatar Videos (Single Run).")
    parser.add_argument("--product", required=True, help="Name of the product")
    parser.add_argument("--persona", required=True, help="Description of the creator")
    parser.add_argument("--setting", required=True, help="Setting of the video")
    parser.add_argument("--emotion", required=True, help="Desired emotion")
    parser.add_argument("--hook", required=True, help="Guidance for the hook")
    parser.add_argument("--elevenlabs_voice_id", required=True, help="Voice ID from your ElevenLabs account")
    parser.add_argument("--avatar_video_path", required=True, help="Full path to the base avatar MP4 file")
    parser.add_argument("--example_script_file", required=True, help="Path to a text file containing the example script")
    parser.add_argument("--remove_silence", action='store_true', help="Enable silence removal editing using ffmpeg.")
    args = parser.parse_args()

    print("Input arguments parsed:"); print(f"  Product: {args.product}"); # ... (rest of prints) ...
    print(f"  Silence removal option: {'ENABLED' if args.remove_silence else 'DISABLED'}")

    # --- Get Config/Keys & Validate ---
    openai_api_key=os.getenv('OPENAI_API_KEY'); elevenlabs_api_key=os.getenv('ELEVENLABS_API_KEY'); dreamface_api_key=os.getenv('DREAMFACE_API_KEY'); gcs_bucket_name=os.getenv('GCS_BUCKET_NAME')
    if not all([openai_api_key, elevenlabs_api_key, dreamface_api_key, gcs_bucket_name]):
        print("Error: Required API keys/bucket name missing in environment variables or .env file."); return
    if not os.path.exists(args.avatar_video_path):
        print(f"Error: Avatar video file not found: {args.avatar_video_path}"); return
    if not os.path.exists(args.example_script_file):
        print(f"Error: Example script file not found: {args.example_script_file}"); return

    try:
        with open(args.example_script_file, 'r', encoding='utf-8') as f:
            example_script_content = f.read()
        print(f"Successfully read example script from: {args.example_script_file}")
        if len(example_script_content.strip()) < 50:
             print(f"Warning: Example script in {args.example_script_file} seems very short.")
    except Exception as e:
        print(f"Error reading example script file {args.example_script_file}: {e}")
        return

    # --- Call the Refactored Job Function ---
    # NOTE: When running via command line, product_clips_map defaults to None,
    # so the overlay step inside create_video_job will be skipped.
    success, final_path = create_video_job(
        product=args.product,
        persona=args.persona,
        setting=args.setting,
        emotion=args.emotion,
        hook=args.hook,
        elevenlabs_voice_id=args.elevenlabs_voice_id,
        avatar_video_path=args.avatar_video_path,
        example_script_content=example_script_content, # Pass content
        remove_silence=args.remove_silence,
        use_randomization=False,
        language="English",
        enhance_for_elevenlabs=False,
        brand_name="",
        openai_api_key=openai_api_key,
        elevenlabs_api_key=elevenlabs_api_key,
        dreamface_api_key=dreamface_api_key,
        gcs_bucket_name=gcs_bucket_name,
        output_path=args.output_path,
        use_overlay=False,
        enhanced_video_settings=None,
        job_name=f"SingleRun_{args.product}"
    )

    # --- Report Result ---
    total_time = time.time() - start_time
    print(f"\n--- Single Run Process finished in {total_time:.2f} seconds ---")
    if success and final_path:
        print(f"Final video is available at: {final_path}")
    else:
        print("Single run failed. Check logs above for details.")


if __name__ == "__main__":
    main()