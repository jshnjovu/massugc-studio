import os
import logging
import sys
import shutil
import yaml
import uuid, queue, json
import urllib.parse
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from functools import wraps
from flask import Flask, request, flash, abort
from flask import Response, jsonify
from datetime import datetime
from flask_cors import CORS
from dotenv import load_dotenv, set_key

from backend.create_video import create_video_job
from backend.create_video import create_randomized_video_job
from backend.create_video import generate_script
from backend.massugc_video_job import create_massugc_video_job
from backend.google_drive_service import GoogleDriveService
from openai import OpenAI
from massugc_api_client import (
    MassUGCApiClient, 
    MassUGCApiKeyManager, 
    MassUGCApiError,
    create_massugc_client
)

# ─── 1) Determine bundle vs. source mode ─────────────────────────────────────
if getattr(sys, "frozen", False):
    # PyInstaller bundle
    BASE_DIR = Path(sys._MEIPASS)
else:
    # Running from source
    BASE_DIR = Path(__file__).resolve().parent

# ─── 2) Prepare a user‐writable config directory ─────────────────────────────
CONFIG_DIR = Path.home() / ".zyra-video-agent"
CONFIG_DIR.mkdir(exist_ok=True)

LOG_PATH = CONFIG_DIR / "app.log"
WRITE_LOGS = True # Logs to file feature flag

# Paths for user config files
ENV_PATH       = CONFIG_DIR / ".env"
CAMPAIGNS_PATH = CONFIG_DIR / "campaigns.yaml"

WORKING_DIR    = CONFIG_DIR / "working-dir"

# ─── Avatars config ────────────────────────────────────────────
AVATARS_PATH = CONFIG_DIR / "avatars.yaml"
AVATARS_DIR  = CONFIG_DIR / "uploads" / "avatars"
# ─── Scripts config ──────────────────────────────────────────────
SCRIPTS_PATH = CONFIG_DIR / "scripts.yaml"
SCRIPTS_DIR  = CONFIG_DIR / "uploads" / "scripts"
# ─── Clips config ────────────────────────────────────────────────
CLIPS_PATH = CONFIG_DIR / "clips.yaml"
CLIPS_DIR  = CONFIG_DIR / "uploads" / "clips"

# Ensure files exist

if not ENV_PATH.exists():
    ENV_PATH.write_text("")                    # create blank .env

if not CAMPAIGNS_PATH.exists():
    CAMPAIGNS_PATH.write_text(yaml.safe_dump({"jobs": []})) # create empty campaigns.yaml

if not AVATARS_PATH.exists():
    AVATARS_PATH.write_text(yaml.safe_dump({"avatars": []}))

AVATARS_DIR.mkdir(parents=True, exist_ok=True)

if not SCRIPTS_PATH.exists():
    SCRIPTS_PATH.write_text(yaml.safe_dump({"scripts": []}))

SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)

if not CLIPS_PATH.exists():
    CLIPS_PATH.write_text(yaml.safe_dump({"clips": []}))

CLIPS_DIR.mkdir(parents=True, exist_ok=True)

# ─── MassUGC API Integration ─────────────────────────────────────────
MASSUGC_API_KEY_MANAGER = MassUGCApiKeyManager(CONFIG_DIR)

# ─── 4) Load environment variables from user .env ────────────────────────────
load_dotenv(dotenv_path=str(ENV_PATH))

if WRITE_LOGS:
    # Configure logging to both file and console
    logging.basicConfig(
        level=logging.DEBUG,
        format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        filename=str(LOG_PATH),
        filemode="w",  # overwrite on startup
    )

    # Also mirror logs to console for development
    console = logging.StreamHandler()
    console.setLevel(logging.INFO)
    console.setFormatter(logging.Formatter("%(levelname)-8s %(message)s"))
    logging.getLogger().addHandler(console)

# ─── Path Normalization Utilities ────────────────────────────────────────────
def normalize_file_path(file_path):
    """
    Normalize file paths to handle URL encoding/decoding consistently.
    Converts URL-encoded paths back to their original form for file system operations.
    
    Args:
        file_path (str or Path): The file path to normalize
        
    Returns:
        Path: Normalized Path object with URL-encoded characters decoded
    """
    if not file_path:
        return None
        
    # Convert to string if Path object
    path_str = str(file_path)
    
    # URL decode the path to handle spaces and special characters
    decoded_path = urllib.parse.unquote(path_str)
    
    # Return as Path object
    return Path(decoded_path)

def safe_file_exists(file_path):
    """
    Check if a file exists with proper path normalization.
    Tries both the original path and the URL-decoded version.
    
    Args:
        file_path (str or Path): The file path to check
        
    Returns:
        tuple: (exists: bool, resolved_path: Path or None)
    """
    if not file_path:
        return False, None
        
    # Try the original path first
    original_path = Path(file_path)
    if original_path.exists():
        return True, original_path
        
    # Try the URL-decoded version
    normalized_path = normalize_file_path(file_path)
    if normalized_path and normalized_path.exists():
        return True, normalized_path
        
    # Try URL-encoding the path (in case it's stored encoded)
    encoded_path = Path(urllib.parse.quote(str(original_path), safe='/\\:'))
    if encoded_path.exists():
        return True, encoded_path
        
    return False, None

def sanitize_filename(filename):
    """
    Sanitize a filename to avoid problematic characters while preserving readability.
    Replaces spaces with underscores and removes/replaces other problematic chars.
    
    Args:
        filename (str): The original filename
        
    Returns:
        str: Sanitized filename safe for file system operations
    """
    if not filename:
        return filename
        
    # Replace spaces with underscores
    sanitized = filename.replace(' ', '_')
    
    # Remove or replace other problematic characters
    # Keep alphanumeric, dots, dashes, underscores
    import re
    sanitized = re.sub(r'[^\w\-_\.]', '_', sanitized)
    
    # Remove multiple consecutive underscores
    sanitized = re.sub(r'_+', '_', sanitized)
    
    return sanitized

def generate_video_thumbnail(video_path, output_path):
    """
    Generate a thumbnail image from the first frame of a video using FFmpeg.

    Args:
        video_path (str): Path to the source video file
        output_path (str): Path where the thumbnail image should be saved

    Returns:
        bool: True if thumbnail was generated successfully, False otherwise
    """
    try:
        # Create thumbnail directory if it doesn't exist
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        # FFmpeg command to extract first frame as JPG
        cmd = [
            'ffmpeg',
            '-i', str(video_path),
            '-vf', 'scale=320:320:force_original_aspect_ratio=increase,crop=320:320',  # Zoom to fill square, crop excess
            '-vframes', '1',         # Extract only 1 frame
            '-f', 'image2',          # Output as image
            '-y',                    # Overwrite if exists
            str(output_path)
        ]

        # Run FFmpeg command
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

        if result.returncode == 0:
            app.logger.info(f"Generated thumbnail: {output_path}")
            return True
        else:
            app.logger.error(f"FFmpeg error: {result.stderr}")
            return False

    except subprocess.TimeoutExpired:
        app.logger.error(f"Thumbnail generation timed out for {video_path}")
        return False
    except Exception as e:
        app.logger.error(f"Failed to generate thumbnail: {str(e)}")
        return False

def _build_enhanced_settings_from_flat_properties(job):
    """
    Build enhanced video settings nested structure from flat properties (legacy method).
    Prefer a fully-formed nested enhanced_settings when present.
    """
    # Key data flow checkpoint 3: What gets loaded from YAML for job execution
    nested = job.get("enhanced_settings")
    print(f"🔍 DEBUG: nested = {nested is not None}, type = {type(nested) if nested else 'None'}")
    if nested and isinstance(nested, dict):
        has_overlays = "text_overlays" in nested
        has_captions = "captions" in nested
        print(f"🔍 DEBUG: has_overlays = {has_overlays}, has_captions = {has_captions}")
        if has_overlays:
            overlays = nested.get('text_overlays', [])
            print(f"🔍 DEBUG: text_overlays count = {len(overlays)}")
            if overlays:
                print(f"🔍 DEBUG: text_overlays[0] = {overlays[0] if overlays else 'empty'}")
                # Validate text overlay data integrity
                for i, overlay in enumerate(overlays):
                    if isinstance(overlay, dict):
                        # Check for critical fields that indicate corruption
                        font_size = overlay.get('font_size', overlay.get('fontSize'))
                        animation = overlay.get('animation')
                        background_rounded = overlay.get('backgroundRounded')
                        custom_text = overlay.get('custom_text', '')
                        
                        if font_size is None or animation is None:
                            app.logger.warning(f"⚠️ Text overlay {i+1} may be corrupted: font_size={font_size}, animation={animation}")
                        else:
                            app.logger.info(f"✅ Text overlay {i+1} validated: font={font_size}px, animation={animation}, text='{custom_text[:30]}...'")

    if nested and isinstance(nested, dict) and ("text_overlays" in nested or "captions" in nested):
        overlays = len(nested.get('text_overlays', []))
        app.logger.info(f"✅ YAML->EXECUTION: Using enhanced_settings with {overlays} overlays")
        print(f"🎯 SUCCESS: Using nested enhanced_settings with fontPercentage data!")
        
        # Validate that enhanced_settings is not corrupted
        text_overlays = nested.get('text_overlays', [])
        if text_overlays:
            # Check for common corruption patterns
            for i, overlay in enumerate(text_overlays):
                if isinstance(overlay, dict):
                    # Verify that animation is not unexpectedly changed to fade_in
                    animation = overlay.get('animation', 'none')
                    background_rounded = overlay.get('backgroundRounded', 0)
                    font_size = overlay.get('font_size', overlay.get('fontSize', 0))
                    
                    # Log potential corruption indicators
                    if animation == 'fade_in' and background_rounded == 7:
                        app.logger.warning(f"⚠️ POTENTIAL CORRUPTION DETECTED in overlay {i+1}: unexpected fade_in + rounded=7 combination")
                    
                    app.logger.info(f"📝 Overlay {i+1} settings: animation={animation}, rounded={background_rounded}, fontSize={font_size}")
        
        # Ensure output volume flags are present for parity
        nested.setdefault("outputVolumeEnabled", job.get("output_volume_enabled", False))
        nested.setdefault("outputVolumeLevel", job.get("output_volume_level", 0.5))
        return nested

    print(f"🚨 PROBLEM: Falling back to legacy format - fontPercentage will be lost!")
    app.logger.info("❌ YAML->EXECUTION: No enhanced_settings found, falling back to legacy format")

    # Legacy path (existing code)
    if not job.get("automated_video_editing_enabled"):
        return None

    enhanced_settings = {
        "enabled": job.get("automated_video_editing_enabled", False)
    }
    
    # Process all 3 text overlays
    for overlay_num in [1, 2, 3]:
        prefix = "text_overlay" if overlay_num == 1 else f"text_overlay_{overlay_num}"
        overlay_key = "text_overlay" if overlay_num == 1 else f"text_overlay_{overlay_num}"
        
        # For text 1, check text_overlay_1_enabled to match frontend
        enabled_key = "text_overlay_1_enabled" if overlay_num == 1 else f"{prefix}_enabled"
        if job.get(enabled_key):
            enhanced_settings[overlay_key] = {
                "enabled": job.get(enabled_key, False),
                "mode": job.get(f"{prefix}_mode", "custom"),
                "custom_text": job.get(f"{prefix}_custom_text", ""),
                "category": job.get(f"{prefix}_category", "engagement"),
                "font": job.get(f"{prefix}_font", "Montserrat-Bold"),
                "customFontName": job.get(f"{prefix}_customFontName"),
                "fontSize": job.get(f"{prefix}_fontSize", 24),
                "bold": job.get(f"{prefix}_bold", False),
                "underline": job.get(f"{prefix}_underline", False),
                "italic": job.get(f"{prefix}_italic", False),
                "textCase": job.get(f"{prefix}_textCase", "none"),
                "color": job.get(f"{prefix}_color", "#FFFFFF"),
                "characterSpacing": job.get(f"{prefix}_characterSpacing", 0),
                "lineSpacing": job.get(f"{prefix}_lineSpacing", 0),
                "alignment": job.get(f"{prefix}_alignment", "center"),
                "style": job.get(f"{prefix}_style", "normal"),
                "scale": job.get(f"{prefix}_scale", 100),
                "x_position": job.get(f"{prefix}_x_position", 50),
                "y_position": job.get(f"{prefix}_y_position", 20),
                "rotation": job.get(f"{prefix}_rotation", 0),
                "opacity": job.get(f"{prefix}_opacity", 100),
                "hasStroke": job.get(f"{prefix}_hasStroke", False),
                "strokeColor": job.get(f"{prefix}_strokeColor", "#000000"),
                "strokeThickness": job.get(f"{prefix}_strokeThickness", 2),
                "hasBackground": job.get(f"{prefix}_hasBackground", False),
                "backgroundColor": job.get(f"{prefix}_backgroundColor", "#000000"),
                "backgroundOpacity": job.get(f"{prefix}_backgroundOpacity", 100),
                "backgroundRounded": job.get(f"{prefix}_backgroundRounded", 15),
                "backgroundStyle": job.get(f"{prefix}_backgroundStyle", "rectangle"),
                "backgroundHeight": job.get(f"{prefix}_backgroundHeight", 50),
                "backgroundWidth": job.get(f"{prefix}_backgroundWidth", 50),
                "backgroundYOffset": job.get(f"{prefix}_backgroundYOffset", 0),
                "backgroundXOffset": job.get(f"{prefix}_backgroundXOffset", 0),
                "animation": job.get(f"{prefix}_animation", "fade_in"),
                "connected_background_data": job.get(f"{prefix}_connected_background_data")
            }
    
    # Process captions
    if job.get("captions_enabled"):
        enhanced_settings["captions"] = {
            "enabled": job.get("captions_enabled", False),
            "template": job.get("captions_template", "tiktok_classic"),
            "fontSize": job.get("captions_fontSize", 20),
            "fontFamily": job.get("captions_fontFamily", "Montserrat-Bold"),
            "x_position": job.get("captions_x_position", 50.0),
            "y_position": job.get("captions_y_position", 85.0),
            "color": job.get("captions_color", "#FFFFFF"),
            "hasStroke": job.get("captions_hasStroke", True),
            "strokeColor": job.get("captions_strokeColor", "#000000"),
            "strokeWidth": job.get("captions_strokeWidth", 0.5),
            "hasBackground": job.get("captions_hasBackground", False),
            "backgroundColor": job.get("captions_backgroundColor", "#000000"),
            "backgroundOpacity": job.get("captions_backgroundOpacity", 0.8),
            "animation": job.get("captions_animation", "none"),
            "highlight_keywords": job.get("captions_highlight_keywords", True),
            "max_words_per_segment": job.get("captions_max_words_per_segment", 4),
            "allCaps": job.get("captions_allCaps", False),
            # Keep legacy fields for backward compatibility
            "style": job.get("captions_style", "tiktok_classic"),
            "position": job.get("captions_position", "bottom_center"),
            "size": job.get("captions_size", "medium"),
            "processing_method": job.get("captions_processing_method", "whisper")
        }
    
    # Process music
    if job.get("music_enabled"):
        enhanced_settings["music"] = {
            "enabled": job.get("music_enabled", False),
            "track_id": job.get("music_track_id", "random_upbeat"),
            "volume": job.get("music_volume", 30),
            "fade_duration": job.get("music_fade_duration", 2),
            "duck_voice": job.get("music_duck_voice", True)
        }
    
    # Process output volume
    enhanced_settings["outputVolumeEnabled"] = job.get("output_volume_enabled", False)
    enhanced_settings["outputVolumeLevel"] = job.get("output_volume_level", 0.5)
    
    return enhanced_settings

if WRITE_LOGS:
    # Reduce verbosity of third-party loggers
    logging.getLogger('urllib3.connectionpool').setLevel(logging.WARNING)
    logging.getLogger('requests.packages.urllib3.connectionpool').setLevel(logging.WARNING)
    
    # Also reduce verbosity of massugc_api_client rate limit messages
    logging.getLogger('massugc_api_client').setLevel(logging.INFO)
else:
    # Even when logging is disabled, suppress verbose third-party loggers
    logging.getLogger('urllib3.connectionpool').setLevel(logging.WARNING)
    logging.getLogger('requests.packages.urllib3.connectionpool').setLevel(logging.WARNING)

# ─── 5) Initialize Flask ─────────────────────────────────────────────────────
app = Flask(__name__)
# TODO Allow your UI origins (you can also use "*" in dev)
CORS(app, resources={
  r"/*":     {"origins": "*"}
  # or simply r"/*": {"origins": "*"} for dev
})

if WRITE_LOGS:
    # Configure Flask logger to avoid duplication
    # Clear any existing handlers to prevent duplication
    app.logger.handlers.clear()
    
    # Create a new console handler specifically for Flask logger
    flask_console = logging.StreamHandler()
    flask_console.setLevel(logging.INFO)
    flask_console.setFormatter(logging.Formatter("%(levelname)-8s %(message)s"))
    
    # Add only the console handler to Flask logger (file logging is handled by root logger)
    app.logger.addHandler(flask_console)
    app.logger.setLevel(logging.DEBUG)
    
    # Prevent Flask logger from propagating to root logger to avoid duplication
    app.logger.propagate = False
    
    # Reduce verbosity of third-party loggers
    logging.getLogger('urllib3.connectionpool').setLevel(logging.WARNING)
    logging.getLogger('requests.packages.urllib3.connectionpool').setLevel(logging.WARNING)
    
    # Also reduce verbosity of massugc_api_client rate limit messages
    logging.getLogger('massugc_api_client').setLevel(logging.INFO)

app.secret_key = "secure-temporary-key"

# Initialize logger for use throughout the application
logger = app.logger

# Helper function to get environment variable settings
def get_setting(key: str, default_value: str = "") -> str:
    """Get environment variable setting with optional default"""
    return os.getenv(key, default_value)

# Initialize Google Drive service
DRIVE_SERVICE = GoogleDriveService()
DRIVE_UPLOAD_ENABLED = False  # Default to local storage

# Smart job queue system with failure pattern detection and circuit breaker
broadcast_q = queue.Queue()
active_jobs = {}  # Track running jobs: {run_id: {'status': 'processing', 'timestamp': time, 'thread_future': future}}
job_timeouts = {}  # Track job timeouts: {run_id: timeout_timestamp}

# Failure pattern tracking
failure_patterns = {}  # Track failure patterns: {pattern_key: {'count': int, 'last_failure': timestamp, 'blocked_until': timestamp}}
validation_cache = {}  # Cache validation results: {validation_key: {'valid': bool, 'cached_at': timestamp}}

# Job queue constants - EXTREMELY RELAXED FOR LONG RUNS (DAYS)
MAX_JOB_TIMEOUT = 604800  # 7 days max per job processing time
MAX_QUEUE_AGE = 604800   # 7 days max in queue before considered stale
QUEUE_CLEANUP_INTERVAL = 300  # Clean up every 5 minutes (less frequent)

# Circuit breaker constants - MUCH MORE LENIENT
CIRCUIT_BREAKER_FAILURE_THRESHOLD = 50  # Failures before circuit opens (was 10)
CIRCUIT_BREAKER_RESET_TIME = 600  # 10 minutes before trying again (was 30 minutes)
VALIDATION_CACHE_TTL = 300  # 5 minutes cache for validation results (was 10 minutes)
SIMILAR_FAILURE_WINDOW = 300  # 5 minutes to consider failures "similar" (was 3 minutes)

# helper to publish into it with error resilience
def emit_event(run_id: str, payload: dict):
    payload["run_id"] = run_id
    payload["timestamp"] = datetime.now().isoformat()
    
    try:
        # Non-blocking put with timeout to prevent queue from hanging
        broadcast_q.put(payload, timeout=5)
        print(f"[QUEUE] Emitted {payload.get('type', 'unknown')} event for job {run_id}")
    except queue.Full:
        print(f"[QUEUE] WARNING: Event queue full, dropping event for job {run_id}")
    except Exception as e:
        print(f"[QUEUE] ERROR: Failed to emit event for job {run_id}: {e}")

def validate_elevenlabs_api_real_time(api_key: str, voice_id: str = None) -> dict:
    """
    Actually test ElevenLabs API key and get real status information
    Returns detailed validation results with credits, voice status, etc.
    """
    if not api_key:
        return {
            "api_key_valid": False,
            "error": "No API key provided",
            "credits_remaining": None,
            "voice_id_valid": None
        }
    
    try:
        import requests
        
        # Test 1: Validate API key by getting user info
        headers = {"xi-api-key": api_key}
        user_response = requests.get("https://api.elevenlabs.io/v1/user", headers=headers, timeout=10)
        
        if user_response.status_code == 401:
            return {
                "api_key_valid": False,
                "error": "Invalid API key - authentication failed",
                "credits_remaining": None,
                "voice_id_valid": None,
                "http_status": 401
            }
        elif user_response.status_code != 200:
            return {
                "api_key_valid": False,
                "error": f"API returned status {user_response.status_code}: {user_response.text[:200]}",
                "credits_remaining": None,
                "voice_id_valid": None,
                "http_status": user_response.status_code
            }
        
        # API key is valid, get user info
        user_data = user_response.json()
        
        # ElevenLabs API returns character allowance info, not credits
        subscription_info = user_data.get("subscription", {})
        character_count = subscription_info.get("character_count", "Unknown")
        character_limit = subscription_info.get("character_limit", "Unknown")
        
        # Also check if there's credit info (newer API versions might have this)
        credits_remaining = subscription_info.get("credits", "Unknown")
        if credits_remaining == "Unknown":
            # Fall back to character count
            credits_remaining = character_count
        
        result = {
            "api_key_valid": True,
            "error": None,
            "credits_remaining": credits_remaining,
            "character_limit": character_limit,
            "subscription_tier": user_data.get("subscription", {}).get("tier", "Unknown"),
            "voice_id_valid": None
        }
        
        # Test 2: If voice_id provided, validate it
        if voice_id:
            voices_response = requests.get("https://api.elevenlabs.io/v1/voices", headers=headers, timeout=10)
            if voices_response.status_code == 200:
                voices_data = voices_response.json()
                voice_found = False
                voice_info = None
                
                for voice in voices_data.get("voices", []):
                    if voice.get("voice_id") == voice_id:
                        voice_found = True
                        voice_info = {
                            "name": voice.get("name"),
                            "category": voice.get("category", "Unknown"),
                            "labels": voice.get("labels", {}),
                            "available_for_tiers": voice.get("available_for_tiers", [])
                        }
                        break
                
                result["voice_id_valid"] = voice_found
                result["voice_info"] = voice_info
                if not voice_found:
                    result["voice_error"] = f"Voice ID '{voice_id}' not found in account"
            else:
                result["voice_id_valid"] = None
                result["voice_error"] = f"Could not fetch voices (status {voices_response.status_code})"
        
        return result
        
    except requests.exceptions.Timeout:
        return {
            "api_key_valid": None,
            "error": "Request timeout - ElevenLabs API not responding",
            "credits_remaining": None,
            "voice_id_valid": None
        }
    except requests.exceptions.ConnectionError:
        return {
            "api_key_valid": None, 
            "error": "Connection failed - check internet connection",
            "credits_remaining": None,
            "voice_id_valid": None
        }
    except Exception as e:
        return {
            "api_key_valid": None,
            "error": f"Validation failed: {str(e)}",
            "credits_remaining": None,
            "voice_id_valid": None
        }

def validate_openai_api_real_time(api_key: str) -> dict:
    """
    Actually test OpenAI API key and get real status information
    """
    if not api_key:
        return {
            "api_key_valid": False,
            "error": "No API key provided",
            "quota_remaining": None
        }
    
    try:
        from openai import OpenAI
        
        client = OpenAI(api_key=api_key)
        
        # Test with a minimal request
        response = client.models.list()
        
        if response and response.data:
            return {
                "api_key_valid": True,
                "error": None,
                "models_available": len(response.data),
                "has_gpt_4": any("gpt-4" in model.id for model in response.data),
                "has_gpt_3": any("gpt-3.5" in model.id for model in response.data)
            }
        else:
            return {
                "api_key_valid": False,
                "error": "API key valid but no models accessible",
                "quota_remaining": None
            }
            
    except Exception as e:
        error_str = str(e).lower()
        if "invalid api key" in error_str or "incorrect api key" in error_str:
            return {
                "api_key_valid": False,
                "error": "Invalid API key - authentication failed",
                "quota_remaining": None
            }
        elif "quota" in error_str or "billing" in error_str:
            return {
                "api_key_valid": True,
                "error": f"Quota/billing issue: {str(e)}",
                "quota_remaining": 0
            }
        else:
            return {
                "api_key_valid": None,
                "error": f"API test failed: {str(e)}",
                "quota_remaining": None
            }

def validate_dreamface_api_real_time(api_key: str) -> dict:
    """
    Actually test DreamFace (Newport AI) API key and get real status information including credits
    """
    if not api_key:
        return {
            "api_key_valid": False,
            "error": "No API key provided",
            "service_status": None,
            "credits_available": None
        }
    
    try:
        import requests
        
        # Test DreamFace API by checking remaining credits
        # This validates the API key and gets useful credit information
        headers = {
            "Authorization": f"Bearer {api_key}", 
            "Content-Type": "application/x-www-form-urlencoded"
        }
        credits_url = "http://api.newportai.com/api/remaining_credits"
        
        response = requests.post(credits_url, headers=headers, timeout=10)
        
        if response.status_code == 401:
            return {
                "api_key_valid": False,
                "error": "Invalid API key - authentication failed",
                "service_status": None,
                "credits_available": None
            }
        elif response.status_code == 200:
            try:
                data = response.json()
                if data.get("code") == 0 and data.get("message") == "success":
                    # Successful response with credits info
                    credits = data.get("data", {}).get("available_credits", "Unknown")
                    return {
                        "api_key_valid": True,
                        "error": None,
                        "service_status": "reachable",
                        "credits_available": credits,
                        "request_id": data.get("data", {}).get("requestId")
                    }
                else:
                    # API responded but with error
                    return {
                        "api_key_valid": False,
                        "error": f"API error: {data.get('message', 'Unknown error')}",
                        "service_status": "reachable",
                        "credits_available": None
                    }
            except (ValueError, KeyError) as e:
                return {
                    "api_key_valid": None,
                    "error": f"Invalid response format: {str(e)}",
                    "service_status": "reachable",
                    "credits_available": None
                }
        else:
            return {
                "api_key_valid": None,
                "error": f"API returned status {response.status_code}: {response.text[:200]}",
                "service_status": "unknown",
                "credits_available": None
            }
        
    except requests.exceptions.Timeout:
        return {
            "api_key_valid": None,
            "error": "Request timeout - DreamFace API not responding",
            "service_status": "unreachable",
            "credits_available": None
        }
    except requests.exceptions.ConnectionError:
        return {
            "api_key_valid": None, 
            "error": "Connection failed - check internet connection",
            "service_status": "unreachable",
            "credits_available": None
        }
    except Exception as e:
        return {
            "api_key_valid": None,
            "error": f"Validation failed: {str(e)}",
            "service_status": "unknown",
            "credits_available": None
        }

def get_actual_script_content(job_config: dict) -> dict:
    """
    Get the actual script content that would be used for audio generation
    """
    try:
        # Try to get script content from job config
        script_content = ""
        
        # Check if there's direct script content
        if job_config.get("example_script_content"):
            script_content = job_config["example_script_content"]
        
        # If no direct content, try to read from script file
        elif job_config.get("example_script_file"):
            script_file = job_config["example_script_file"]
            try:
                with open(script_file, 'r', encoding='utf-8') as f:
                    script_content = f.read()
            except Exception as file_error:
                return {
                    "content": "",
                    "length": 0,
                    "word_count": 0,
                    "estimated_audio_duration": 0,
                    "has_content": False,
                    "error": f"Could not read script file: {file_error}",
                    "file_path": script_file
                }
        
        # Analyze the script content
        if script_content:
            # Remove extra whitespace and count
            cleaned_content = script_content.strip()
            
            return {
                "content": cleaned_content[:500] + ("..." if len(cleaned_content) > 500 else ""),  # First 500 chars for preview
                "length": len(cleaned_content),
                "word_count": len(cleaned_content.split()) if cleaned_content else 0,
                "estimated_audio_duration": len(cleaned_content) / 150,  # Rough estimate: 150 chars per minute
                "has_content": len(cleaned_content) > 0,
                "error": None
            }
        else:
            return {
                "content": "",
                "length": 0,
                "word_count": 0,
                "estimated_audio_duration": 0,
                "has_content": False,
                "error": "No script content found"
            }
            
    except Exception as e:
        return {
            "content": "",
            "length": 0,
            "word_count": 0,
            "estimated_audio_duration": 0,
            "error": f"Script analysis failed: {str(e)}",
            "has_content": False
        }

def create_detailed_error_message(error_message: str, job_config: dict, run_id: str) -> str:
    """
    Create a detailed, actionable error message for customer support.
    Transforms generic errors into detailed diagnostic information.
    """
    import os
    import platform
    from pathlib import Path
    
    # Start with the original error
    detailed_parts = [f"ERROR: {error_message}"]
    
    # Add job context
    detailed_parts.append(f"JOB: {job_config.get('job_name', 'Unknown')} (ID: {run_id})")
    detailed_parts.append(f"WORKFLOW: {get_workflow_type(job_config)}")
    
    # Categorize and enhance the error based on content
    error_lower = error_message.lower()
    
    # === API KEY ERRORS ===
    if any(keyword in error_lower for keyword in ['api key', 'unauthorized', 'authentication', 'invalid key']):
        detailed_parts.append("CATEGORY: API Authentication")
        
        # REAL-TIME API VALIDATION
        api_validation_results = []
        
        # Test OpenAI API
        openai_key = os.getenv("OPENAI_API_KEY", "")
        if openai_key:
            openai_result = validate_openai_api_real_time(openai_key)
            if openai_result["api_key_valid"] is True:
                api_validation_results.append(f"  OpenAI: ✓ Valid ({openai_result.get('models_available', 0)} models available)")
            elif openai_result["api_key_valid"] is False:
                api_validation_results.append(f"  OpenAI: ✗ {openai_result['error']}")
            else:
                api_validation_results.append(f"  OpenAI: ? Validation failed - {openai_result['error']}")
        else:
            api_validation_results.append("  OpenAI: ✗ Missing API key")
        
        # Test ElevenLabs API with voice ID validation
        elevenlabs_key = os.getenv("ELEVENLABS_API_KEY", "")
        voice_id = job_config.get("elevenlabs_voice_id")
        if elevenlabs_key:
            elevenlabs_result = validate_elevenlabs_api_real_time(elevenlabs_key, voice_id)
            if elevenlabs_result["api_key_valid"] is True:
                credits = elevenlabs_result.get("credits_remaining", "Unknown")
                tier = elevenlabs_result.get("subscription_tier", "Unknown")
                api_validation_results.append(f"  ElevenLabs: ✓ Valid ({credits} credits, {tier} tier)")
                
                # Add voice ID validation result
                if voice_id and elevenlabs_result["voice_id_valid"] is not None:
                    if elevenlabs_result["voice_id_valid"]:
                        voice_info = elevenlabs_result.get("voice_info", {})
                        voice_name = voice_info.get("name", "Unknown")
                        api_validation_results.append(f"    Voice ID: ✓ Valid ({voice_name})")
                    else:
                        api_validation_results.append(f"    Voice ID: ✗ {elevenlabs_result.get('voice_error', 'Invalid')}")
            elif elevenlabs_result["api_key_valid"] is False:
                api_validation_results.append(f"  ElevenLabs: ✗ {elevenlabs_result['error']}")
            else:
                api_validation_results.append(f"  ElevenLabs: ? Validation failed - {elevenlabs_result['error']}")
        else:
            api_validation_results.append("  ElevenLabs: ✗ Missing API key")
        
        # Check other API keys (without real validation for now)
        dreamface_key = os.getenv("DREAMFACE_API_KEY", "")
        api_validation_results.append(f"  DreamFace: {'✓ Configured' if dreamface_key else '✗ Missing'}")
        
        massugc_status = "✓ Configured" if MASSUGC_API_KEY_MANAGER.has_api_key() else "✗ Missing"
        api_validation_results.append(f"  MassUGC: {massugc_status}")
        
        detailed_parts.append("REAL-TIME API VALIDATION:")
        detailed_parts.extend(api_validation_results)
        
        # Add script analysis for context
        script_analysis = get_actual_script_content(job_config)
        if script_analysis["has_content"]:
            detailed_parts.append(f"SCRIPT ANALYSIS:")
            detailed_parts.append(f"  Length: {script_analysis['length']} characters ({script_analysis['word_count']} words)")
            detailed_parts.append(f"  Est. Audio Duration: {script_analysis['estimated_audio_duration']:.1f} minutes")
            if script_analysis["length"] > 500:
                detailed_parts.append(f"  Preview: {script_analysis['content']}")
        elif script_analysis["error"]:
            detailed_parts.append(f"SCRIPT ANALYSIS: ✗ {script_analysis['error']}")
        
        # Provide specific solutions based on validation results
        if "openai" in error_lower or any("✗" in result and "OpenAI" in result for result in api_validation_results):
            detailed_parts.append("SOLUTION: Fix OpenAI API key - check key format and billing status")
            detailed_parts.append("DOCS: https://platform.openai.com/api-keys")
        if "elevenlabs" in error_lower or any("✗" in result and "ElevenLabs" in result for result in api_validation_results):
            detailed_parts.append("SOLUTION: Fix ElevenLabs API key - verify authentication and voice access")
            detailed_parts.append("DOCS: https://elevenlabs.io/docs/api-reference/authentication")
        if "massugc" in error_lower:
            detailed_parts.append("SOLUTION: Check MassUGC API key in Settings → MassUGC Integration")
            detailed_parts.append("CONTACT: MassUGC Support for API key issues")
    
    # === FILE/PATH ERRORS ===
    elif any(keyword in error_lower for keyword in ['file not found', 'path', 'exists', 'missing', 'directory']):
        detailed_parts.append("CATEGORY: File System")
        
        # Check specific file paths mentioned in job config
        file_checks = []
        if job_config.get('avatar_video_path'):
            path = Path(job_config['avatar_video_path'])
            exists = "✓ Exists" if path.exists() else "✗ Missing"
            size = f"({path.stat().st_size} bytes)" if path.exists() else ""
            file_checks.append(f"  Avatar: {path} {exists} {size}")
        
        if job_config.get('example_script_file'):
            path = Path(job_config['example_script_file'])
            exists = "✓ Exists" if path.exists() else "✗ Missing"
            size = f"({path.stat().st_size} bytes)" if path.exists() else ""
            file_checks.append(f"  Script: {path} {exists} {size}")
        
        if job_config.get('product_clip_path'):
            path = Path(job_config['product_clip_path'])
            exists = "✓ Exists" if path.exists() else "✗ Missing"
            size = f"({path.stat().st_size} bytes)" if path.exists() else ""
            file_checks.append(f"  Product Clip: {path} {exists} {size}")
        
        random_settings = job_config.get('random_video_settings')
        if random_settings and random_settings.get('source_directory'):
            path = Path(random_settings['source_directory'])
            exists = "✓ Exists" if path.exists() else "✗ Missing"
            count = len(list(path.glob("*.mp4"))) if path.exists() else 0
            file_checks.append(f"  Random Source Dir: {path} {exists} ({count} MP4 files)")
        
        if file_checks:
            detailed_parts.append("FILE STATUS:")
            detailed_parts.extend(file_checks)
        
        # Add disk space check
        output_path = os.getenv("OUTPUT_PATH", str(Path.home() / "Downloads"))
        try:
            import shutil
            free_space = shutil.disk_usage(output_path).free
            free_gb = free_space / (1024**3)
            detailed_parts.append(f"DISK SPACE: {free_gb:.1f} GB available in {output_path}")
        except:
            pass
        
        detailed_parts.append("SOLUTION: Verify all file paths exist and are accessible")
        detailed_parts.append("SOLUTION: Check file permissions and disk space")
    
    # === NETWORK/CONNECTION ERRORS ===
    elif any(keyword in error_lower for keyword in ['connection', 'timeout', 'network', 'failed to connect', 'request failed']):
        detailed_parts.append("CATEGORY: Network/Connectivity")
        
        # Add network diagnostics
        detailed_parts.append("NETWORK INFO:")
        try:
            import socket
            detailed_parts.append(f"  Hostname: {socket.gethostname()}")
            # Test specific service connectivity
            services_to_check = [
                ("OpenAI API", "api.openai.com", 443),
                ("ElevenLabs API", "api.elevenlabs.io", 443),
                ("MassUGC API", "massugc-cloud-api.onrender.com", 443)
            ]
            
            for service, host, port in services_to_check:
                try:
                    sock = socket.create_connection((host, port), timeout=5)
                    sock.close()
                    detailed_parts.append(f"  {service}: ✓ Reachable")
                except:
                    detailed_parts.append(f"  {service}: ✗ Unreachable")
        except:
            pass
        
        detailed_parts.append("SOLUTION: Check internet connection and firewall settings")
        detailed_parts.append("SOLUTION: Try again in a few minutes (may be temporary service issue)")
        if "timeout" in error_lower:
            detailed_parts.append("SOLUTION: Large files may need more time - check file sizes")
    
    # === AUDIO GENERATION ERRORS ===
    elif any(keyword in error_lower for keyword in ['audio generation', 'elevenlabs', 'voice', 'tts']):
        detailed_parts.append("CATEGORY: Audio Generation (ElevenLabs)")
        
        # REAL-TIME ELEVENLABS VALIDATION
        elevenlabs_key = os.getenv("ELEVENLABS_API_KEY", "")
        voice_id = job_config.get('elevenlabs_voice_id')
        language = job_config.get('language', 'English')
        
        if elevenlabs_key:
            elevenlabs_result = validate_elevenlabs_api_real_time(elevenlabs_key, voice_id)
            detailed_parts.append("ELEVENLABS REAL-TIME STATUS:")
            if elevenlabs_result["api_key_valid"] is True:
                credits = elevenlabs_result.get("credits_remaining", "Unknown")
                tier = elevenlabs_result.get("subscription_tier", "Unknown")
                detailed_parts.append(f"  API Key: ✓ Valid ({credits} credits remaining, {tier} tier)")
                
                if voice_id and elevenlabs_result["voice_id_valid"] is not None:
                    if elevenlabs_result["voice_id_valid"]:
                        voice_info = elevenlabs_result.get("voice_info", {})
                        voice_name = voice_info.get("name", "Unknown")
                        category = voice_info.get("category", "Unknown")
                        detailed_parts.append(f"  Voice ID: ✓ Valid ({voice_name}, {category})")
                    else:
                        detailed_parts.append(f"  Voice ID: ✗ {elevenlabs_result.get('voice_error', 'Invalid voice ID')}")
                else:
                    detailed_parts.append(f"  Voice ID: Not validated (ID: {voice_id})")
            elif elevenlabs_result["api_key_valid"] is False:
                detailed_parts.append(f"  API Key: ✗ {elevenlabs_result['error']}")
            else:
                detailed_parts.append(f"  API Key: ? {elevenlabs_result['error']}")
        else:
            detailed_parts.append("ELEVENLABS STATUS: ✗ No API key configured")
        
        # REAL SCRIPT ANALYSIS
        script_analysis = get_actual_script_content(job_config)
        detailed_parts.append("SCRIPT ANALYSIS:")
        if script_analysis["has_content"]:
            detailed_parts.append(f"  Length: {script_analysis['length']} characters ({script_analysis['word_count']} words)")
            detailed_parts.append(f"  Est. Audio Duration: {script_analysis['estimated_audio_duration']:.1f} minutes")
            detailed_parts.append(f"  Language: {language}")
            if script_analysis["length"] > 2500:
                detailed_parts.append("  ⚠️  Script may be too long for ElevenLabs (recommended < 2500 chars)")
        else:
            detailed_parts.append(f"  ✗ {script_analysis['error']}")
        
        # Real solutions based on actual validation
        if elevenlabs_key and elevenlabs_result.get("api_key_valid") is False:
            detailed_parts.append("SOLUTION: Fix ElevenLabs API key - authentication is failing")
        if voice_id and elevenlabs_result.get("voice_id_valid") is False:
            detailed_parts.append("SOLUTION: Change voice ID - current voice not accessible")
        if script_analysis.get("length", 0) > 2500:
            detailed_parts.append("SOLUTION: Reduce script length to under 2500 characters")
        if not elevenlabs_key:
            detailed_parts.append("SOLUTION: Add ElevenLabs API key in Settings → API Keys")
        detailed_parts.append("CONTACT: Check ElevenLabs account dashboard for quotas and billing")
    
    # === VIDEO GENERATION ERRORS ===
    elif any(keyword in error_lower for keyword in ['dreamface', 'lipsync', 'video generation', 'ffmpeg']):
        detailed_parts.append("CATEGORY: Video Generation")
        
        # Add video settings info
        workflow_type = get_workflow_type(job_config)
        detailed_parts.append(f"WORKFLOW TYPE: {workflow_type}")
        
        if "dreamface" in error_lower:
            detailed_parts.append("SERVICE: DreamFace API")
            detailed_parts.append("SOLUTION: Check DreamFace API key and service status")
            detailed_parts.append("SOLUTION: Verify avatar video format (MP4 recommended)")
        elif "massugc" in error_lower:
            detailed_parts.append("SERVICE: MassUGC API")
            detailed_parts.append("SOLUTION: Check MassUGC API key and credits")
            detailed_parts.append("SOLUTION: Verify avatar image format (JPG/PNG)")
        elif "ffmpeg" in error_lower:
            detailed_parts.append("SERVICE: FFmpeg (Local Processing)")
            detailed_parts.append("SOLUTION: Check video file formats and codecs")
            detailed_parts.append("SOLUTION: Verify sufficient disk space for processing")
    
    # === CLOUD STORAGE ERRORS ===
    elif any(keyword in error_lower for keyword in ['gcs', 'upload', 'bucket', 'storage', 'signed url']):
        detailed_parts.append("CATEGORY: Google Cloud Storage")
        
        # Add GCS configuration info
        bucket_name = os.getenv("GCS_BUCKET_NAME", "Not configured")
        credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "Not configured")
        
        detailed_parts.append(f"BUCKET: {bucket_name}")
        detailed_parts.append(f"CREDENTIALS: {credentials_path}")
        
        if credentials_path != "Not configured":
            file_exists, _ = safe_file_exists(credentials_path)
            creds_exists = "✓ Found" if file_exists else "✗ Missing"
            detailed_parts.append(f"CREDENTIALS FILE: {creds_exists}")
        
        detailed_parts.append("SOLUTION: Verify GCS bucket name and permissions")
        detailed_parts.append("SOLUTION: Check Google Cloud credentials file")
        detailed_parts.append("SOLUTION: Ensure service account has Storage Object Admin role")
    
    # === SCRIPT GENERATION ERRORS ===
    elif any(keyword in error_lower for keyword in ['script generation', 'openai', 'gpt']):
        detailed_parts.append("CATEGORY: Script Generation (OpenAI)")
        
        # Add prompt info
        product = job_config.get('product', 'Unknown')
        persona = job_config.get('persona', 'Unknown')
        language = job_config.get('language', 'English')
        
        detailed_parts.append(f"PRODUCT: {product}")
        detailed_parts.append(f"PERSONA: {persona}")
        detailed_parts.append(f"LANGUAGE: {language}")
        
        detailed_parts.append("SOLUTION: Check OpenAI API key and quota")
        detailed_parts.append("SOLUTION: Verify product/persona descriptions are appropriate")
        detailed_parts.append("SOLUTION: Try with simpler or shorter prompts")
    
    # === SYSTEM ERRORS ===
    elif any(keyword in error_lower for keyword in ['memory', 'disk', 'permission', 'system']):
        detailed_parts.append("CATEGORY: System Resources")
        
        # Add system info
        try:
            import psutil
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            detailed_parts.append(f"MEMORY: {memory.percent}% used ({memory.available / (1024**3):.1f} GB available)")
            detailed_parts.append(f"DISK: {(disk.used / disk.total) * 100:.1f}% used ({disk.free / (1024**3):.1f} GB free)")
        except:
            pass
        
        detailed_parts.append("SOLUTION: Close other applications to free memory")
        detailed_parts.append("SOLUTION: Clear disk space and temporary files")
        detailed_parts.append("SOLUTION: Restart the application if memory issues persist")
    
    # === UNIVERSAL REAL-TIME VALIDATION FOR ALL ERRORS ===
    # Always add comprehensive validation regardless of error category
    detailed_parts.append("")  # Blank line
    detailed_parts.append("🔍 COMPREHENSIVE REAL-TIME DIAGNOSTICS:")
    
    # Always validate ALL API keys for every error
    api_validation_results = []
    
    # OpenAI validation
    openai_key = os.getenv("OPENAI_API_KEY", "")
    if openai_key:
        openai_result = validate_openai_api_real_time(openai_key)
        if openai_result["api_key_valid"] is True:
            api_validation_results.append(f"  OpenAI: ✓ Valid ({openai_result.get('models_available', 0)} models)")
        elif openai_result["api_key_valid"] is False:
            api_validation_results.append(f"  OpenAI: ✗ {openai_result['error']}")
        else:
            api_validation_results.append(f"  OpenAI: ? {openai_result['error']}")
    else:
        api_validation_results.append("  OpenAI: ✗ Missing API key")
    
    # ElevenLabs validation with voice ID
    elevenlabs_key = os.getenv("ELEVENLABS_API_KEY", "")
    voice_id = job_config.get("elevenlabs_voice_id")
    if elevenlabs_key:
        elevenlabs_result = validate_elevenlabs_api_real_time(elevenlabs_key, voice_id)
        if elevenlabs_result["api_key_valid"] is True:
            credits = elevenlabs_result.get("credits_remaining", "Unknown")
            tier = elevenlabs_result.get("subscription_tier", "Unknown")
            api_validation_results.append(f"  ElevenLabs: ✓ Valid ({credits} credits, {tier})")
            
            if voice_id and elevenlabs_result["voice_id_valid"] is not None:
                if elevenlabs_result["voice_id_valid"]:
                    voice_info = elevenlabs_result.get("voice_info", {})
                    voice_name = voice_info.get("name", "Unknown")
                    api_validation_results.append(f"    Voice '{voice_id}': ✓ Valid ({voice_name})")
                else:
                    api_validation_results.append(f"    Voice '{voice_id}': ✗ {elevenlabs_result.get('voice_error', 'Invalid')}")
        elif elevenlabs_result["api_key_valid"] is False:
            api_validation_results.append(f"  ElevenLabs: ✗ {elevenlabs_result['error']}")
        else:
            api_validation_results.append(f"  ElevenLabs: ? {elevenlabs_result['error']}")
    else:
        api_validation_results.append("  ElevenLabs: ✗ Missing API key")
    
    # Other API keys
    dreamface_key = os.getenv("DREAMFACE_API_KEY", "")
    api_validation_results.append(f"  DreamFace: {'✓ Configured' if dreamface_key else '✗ Missing'}")
    
    massugc_status = "✓ Configured" if MASSUGC_API_KEY_MANAGER.has_api_key() else "✗ Missing"
    api_validation_results.append(f"  MassUGC: {massugc_status}")
    
    detailed_parts.extend(api_validation_results)
    
    # Always analyze script content for every error
    script_analysis = get_actual_script_content(job_config)
    detailed_parts.append("")
    detailed_parts.append("📝 SCRIPT ANALYSIS:")
    
    # Check if exact script mode is enabled
    if job_config.get("useExactScript", False):
        detailed_parts.append("  Mode: EXACT SCRIPT (OpenAI generation skipped)")
    else:
        detailed_parts.append("  Mode: AI Generated (OpenAI)")
    
    if script_analysis["has_content"]:
        detailed_parts.append(f"  Length: {script_analysis['length']} characters ({script_analysis['word_count']} words)")
        detailed_parts.append(f"  Est. Duration: {script_analysis['estimated_audio_duration']:.1f} minutes")
        detailed_parts.append(f"  Language: {job_config.get('language', 'English')}")
        if script_analysis["length"] > 500:
            detailed_parts.append(f"  Preview: {script_analysis['content']}")
    elif script_analysis["error"]:
        detailed_parts.append(f"  ✗ {script_analysis['error']}")
    
    # Always check file system status
    detailed_parts.append("")
    detailed_parts.append("📁 FILE SYSTEM STATUS:")
    file_checks = []
    
    if job_config.get('avatar_video_path'):
        path = Path(job_config['avatar_video_path'])
        exists = "✓ Exists" if path.exists() else "✗ Missing"
        size = f"({path.stat().st_size:,} bytes)" if path.exists() else ""
        file_checks.append(f"  Avatar: {exists} {size}")
    
    if job_config.get('example_script_file'):
        path = Path(job_config['example_script_file'])
        exists = "✓ Exists" if path.exists() else "✗ Missing"
        size = f"({path.stat().st_size:,} bytes)" if path.exists() else ""
        file_checks.append(f"  Script: {exists} {size}")
    
    if job_config.get('product_clip_path'):
        path = Path(job_config['product_clip_path'])
        exists = "✓ Exists" if path.exists() else "✗ Missing"
        size = f"({path.stat().st_size:,} bytes)" if path.exists() else ""
        file_checks.append(f"  Product Clip: {exists} {size}")
    
    if file_checks:
        detailed_parts.extend(file_checks)
    else:
        detailed_parts.append("  No specific files to check")
    
    # Always check system resources
    detailed_parts.append("")
    detailed_parts.append("💻 SYSTEM RESOURCES:")
    try:
        import psutil
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        detailed_parts.append(f"  Memory: {memory.percent}% used ({memory.available / (1024**3):.1f} GB available)")
        detailed_parts.append(f"  Disk: {(disk.used / disk.total) * 100:.1f}% used ({disk.free / (1024**3):.1f} GB free)")
    except:
        detailed_parts.append("  System resource info unavailable")
    
    # Always check network connectivity
    detailed_parts.append("")
    detailed_parts.append("🌐 NETWORK CONNECTIVITY:")
    try:
        import socket
        services_to_check = [
            ("OpenAI API", "api.openai.com", 443),
            ("ElevenLabs API", "api.elevenlabs.io", 443),
            ("MassUGC API", "massugc-cloud-api.onrender.com", 443)
        ]
        
        for service, host, port in services_to_check:
            try:
                sock = socket.create_connection((host, port), timeout=3)
                sock.close()
                detailed_parts.append(f"  {service}: ✓ Reachable")
            except:
                detailed_parts.append(f"  {service}: ✗ Unreachable")
    except:
        detailed_parts.append("  Network connectivity check failed")
    
    # === ADD GENERAL CONTEXT ===
    detailed_parts.append("")
    detailed_parts.append("SYSTEM INFO:")
    detailed_parts.append(f"  Platform: {platform.system()} {platform.release()}")
    detailed_parts.append(f"  Architecture: {platform.machine()}")
    detailed_parts.append(f"  App Version: 1.0.20")
    detailed_parts.append(f"  Timestamp: {datetime.now().isoformat()}")
    
    # Join all parts with newlines
    return "\n".join(detailed_parts)

def get_workflow_type(job_config: dict) -> str:
    """Determine the workflow type from job configuration"""
    if job_config.get("massugc_settings"):
        return "MassUGC API"
    elif job_config.get("random_video_settings"):
        return "Randomized Video"
    else:
        return "Avatar-based"

def cleanup_stale_jobs():
    """Clean up jobs that have been running too long or stuck in queue"""
    current_time = datetime.now().timestamp()
    jobs_to_clean = []
    
    for run_id, job_info in active_jobs.items():
        job_age = current_time - job_info.get('start_time', current_time)
        
        # Check for processing timeout (only count processing time, not queue time)
        if job_info.get('status') == 'processing':
            processing_start = job_info.get('processing_start', job_info.get('start_time', current_time))
            processing_time = current_time - processing_start
            if processing_time > MAX_JOB_TIMEOUT:
                print(f"[QUEUE] Job {run_id} processing timed out after {processing_time:.1f}s")
                jobs_to_clean.append((run_id, "Job processing timed out"))
        # Check for stuck jobs in queue (much more lenient)
        elif job_info.get('status') == 'queued' and job_age > MAX_QUEUE_AGE:
            print(f"[QUEUE] Job {run_id} stuck in queue for {job_age:.1f}s")
            jobs_to_clean.append((run_id, "Job stuck in queue"))
    
    # Clean up stale jobs
    for run_id, reason in jobs_to_clean:
        job_info = active_jobs.pop(run_id, {})
        
        # Cancel the thread if it exists
        thread_future = job_info.get('thread_future')
        if thread_future and not thread_future.done():
            thread_future.cancel()
        
        # Emit failure event
        emit_event(run_id, {
            "type": "error",
            "message": f"{reason}. Job cleaned up automatically."
        })
    
    # Clean up stale validation cache entries
    stale_cache_keys = []
    for key, cached in validation_cache.items():
        cache_age = current_time - cached.get('cached_at', current_time)
        if cache_age > VALIDATION_CACHE_TTL:
            stale_cache_keys.append(key)
    
    for key in stale_cache_keys:
        validation_cache.pop(key, None)
    
    if stale_cache_keys:
        print(f"[CLEANUP] Cleaned up {len(stale_cache_keys)} stale validation cache entries")
    
    # Clean up old failure patterns (keep patterns that are still within reset window)
    old_pattern_keys = []
    for pattern_key, pattern in failure_patterns.items():
        # Remove patterns that haven't failed recently and aren't currently blocked
        time_since_failure = current_time - pattern.get('last_failure', 0)
        is_blocked = current_time < pattern.get('blocked_until', 0)
        
        # Keep patterns for 1 hour after last failure or until unblocked
        if time_since_failure > 3600 and not is_blocked:
            old_pattern_keys.append(pattern_key)
    
    for key in old_pattern_keys:
        failure_patterns.pop(key, None)
    
    if old_pattern_keys:
        print(f"[CLEANUP] Cleaned up {len(old_pattern_keys)} old failure patterns")

def get_failure_pattern_key(job_config):
    """Generate a key to identify similar job configurations for failure pattern tracking"""
    # Create a pattern key based on critical job parameters that might cause systematic failures
    key_parts = [
        job_config.get("elevenlabs_voice_id", "unknown"),
        job_config.get("avatar_video_path", "unknown").split("/")[-1] if job_config.get("avatar_video_path") else "unknown",
        job_config.get("example_script_file", "unknown").split("/")[-1] if job_config.get("example_script_file") else "unknown",
        "randomized" if job_config.get("random_video_settings") else "avatar"
    ]
    return "|".join(key_parts)

def record_job_failure(job_config, error_message):
    """Record a job failure and update failure patterns - RELAXED VERSION"""
    current_time = datetime.now().timestamp()
    pattern_key = get_failure_pattern_key(job_config)
    
    # Skip circuit breaker for timeout failures - these are normal for long jobs
    if "timed out" in error_message.lower() or "timeout" in error_message.lower():
        print(f"[CIRCUIT BREAKER] Skipping timeout failure for circuit breaker: {error_message[:100]}")
        return
    
    if pattern_key not in failure_patterns:
        failure_patterns[pattern_key] = {
            "count": 0,
            "last_failure": 0,
            "blocked_until": 0,
            "sample_error": ""
        }
    
    pattern = failure_patterns[pattern_key]
    
    # If this failure is within the similar failure window, increment count
    if current_time - pattern["last_failure"] <= SIMILAR_FAILURE_WINDOW:
        pattern["count"] += 1
    else:
        # Reset count if enough time has passed
        pattern["count"] = 1
    
    pattern["last_failure"] = current_time
    pattern["sample_error"] = error_message[:200]  # Store truncated error
    
    # If we've hit the threshold, activate circuit breaker
    if pattern["count"] >= CIRCUIT_BREAKER_FAILURE_THRESHOLD:
        pattern["blocked_until"] = current_time + CIRCUIT_BREAKER_RESET_TIME
        print(f"[CIRCUIT BREAKER] Pattern '{pattern_key}' blocked until {datetime.fromtimestamp(pattern['blocked_until']).isoformat()}")
        print(f"[CIRCUIT BREAKER] Sample error: {pattern['sample_error']}")

def is_job_pattern_blocked(job_config):
    """Check if a job pattern is currently blocked by circuit breaker"""
    pattern_key = get_failure_pattern_key(job_config)
    
    if pattern_key not in failure_patterns:
        return False, None
    
    pattern = failure_patterns[pattern_key]
    current_time = datetime.now().timestamp()
    
    if current_time < pattern["blocked_until"]:
        time_remaining = int(pattern["blocked_until"] - current_time)
        return True, f"Job pattern blocked due to {pattern['count']} recent failures. Retry in {time_remaining}s. Sample error: {pattern['sample_error']}"
    
    return False, None

def validate_job_prerequisites(job_config):
    """Validate all job prerequisites before starting expensive operations"""
    validation_key = get_failure_pattern_key(job_config)
    current_time = datetime.now().timestamp()
    
    # Check validation cache first
    if validation_key in validation_cache:
        cached = validation_cache[validation_key]
        if current_time - cached["cached_at"] < VALIDATION_CACHE_TTL:
            if not cached["valid"]:
                return False, cached["error"]
            # Valid cached result, but still do quick checks for files that might have been deleted
    
    errors = []
    
    # 1. Check script file exists and is readable
    script_file_path = job_config.get("example_script_file")
    if not script_file_path:
        errors.append("No script file specified")
    else:
        original = Path(script_file_path)
        if not original.exists():
            # Try alternative paths
            script_name = original.name
            alt_path = SCRIPTS_DIR / script_name
            if alt_path.exists():
                job_config["example_script_file"] = str(alt_path)  # Update config with working path
            else:
                # Try scripts registry
                scripts = load_scripts()
                script_found = False
                for s in scripts:
                    file_exists, resolved_path = safe_file_exists(s["file_path"])
                    if s.get("name") == script_name and file_exists:
                        job_config["example_script_file"] = str(resolved_path)
                        script_found = True
                        break
                
                if not script_found:
                    available_scripts = [s["name"] for s in scripts]
                    errors.append(f"Script file not found: {script_file_path}. Available: {available_scripts}")
    
    # 2. Check avatar video file exists (for avatar-based jobs)
    if not job_config.get("random_video_settings"):  # Avatar-based job
        avatar_path = job_config.get("avatar_video_path")
        if not avatar_path:
            errors.append("No avatar video path specified")
        else:
            file_exists, resolved_path = safe_file_exists(avatar_path)
            if not file_exists:
                errors.append(f"Avatar video file not found: {avatar_path}")
            else:
                # Update config with resolved path to ensure consistency
                job_config["avatar_video_path"] = str(resolved_path)
    
    # 3. Check API keys are present (don't validate them here to avoid API calls)
    # For exact script mode, we don't need OpenAI API key
    use_exact_script = job_config.get("useExactScript", False)
    required_env_vars = ["ELEVENLABS_API_KEY"]
    if not use_exact_script:
        required_env_vars.append("OPENAI_API_KEY")
    
    for var in required_env_vars:
        if not os.getenv(var):
            errors.append(f"Missing environment variable: {var}")
    
    # 4. For randomized jobs, check source directory
    random_settings = job_config.get("random_video_settings")
    if random_settings:
        source_dir = random_settings.get("source_directory")
        if not source_dir:
            errors.append("No random video source directory specified")
        else:
            file_exists, resolved_path = safe_file_exists(source_dir)
            if not file_exists:
                errors.append(f"Random video source directory not found: {source_dir}")
            else:
                # Update config with resolved path
                random_settings["source_directory"] = str(resolved_path)
                
                # Case-insensitive search for supported video files (mp4, mov, mkv)
                supported_patterns = ["*.[mM][pP]4", "*.[mM][oO][vV]", "*.[mM][kK][vV]"]
                video_files = []
                
                for pattern in supported_patterns:
                    video_files.extend(list(resolved_path.glob(pattern)))
                
                if not video_files:
                    errors.append(f"No supported video files (MP4, MOV, MKV) found in source directory: {resolved_path}")
                    # Add debug info to help troubleshoot
                    try:
                        all_files = list(resolved_path.glob("*"))
                        errors.append(f"Debug: Found {len(all_files)} total files in directory")
                    except Exception as e:
                        errors.append(f"Debug: Error reading directory - {str(e)}")
    
    # 5. Check product clip exists if overlay is enabled
    if job_config.get("use_overlay") and job_config.get("product_clip_path"):
        clip_path = job_config.get("product_clip_path")
        file_exists, resolved_path = safe_file_exists(clip_path)
        if not file_exists:
            errors.append(f"Product clip file not found: {clip_path}")
        else:
            # Update config with resolved path
            job_config["product_clip_path"] = str(resolved_path)
    
    # Cache the validation result
    is_valid = len(errors) == 0
    error_message = "; ".join(errors) if errors else None
    
    validation_cache[validation_key] = {
        "valid": is_valid,
        "error": error_message,
        "cached_at": current_time
    }
    
    return is_valid, error_message

def get_job_queue_status():
    """Get current queue status for monitoring"""
    current_time = datetime.now().timestamp()
    
    # Count blocked patterns
    blocked_patterns = 0
    for pattern_key, pattern in failure_patterns.items():
        if current_time < pattern["blocked_until"]:
            blocked_patterns += 1
    
    return {
        "active_jobs": len(active_jobs),
        "queue_size": broadcast_q.qsize(),
        "jobs": {run_id: info['status'] for run_id, info in active_jobs.items()},
        "blocked_patterns": blocked_patterns,
        "total_failure_patterns": len(failure_patterns),
        "validation_cache_size": len(validation_cache)
    }

job_executor = ThreadPoolExecutor(max_workers=2)  # Limit to 2 concurrent jobs to manage resource usage

# Start a background thread for queue cleanup
import threading
import time

def queue_cleanup_worker():
    """Background worker to clean up stale jobs"""
    while True:
        try:
            cleanup_stale_jobs()
            time.sleep(QUEUE_CLEANUP_INTERVAL)
        except Exception as e:
            print(f"[QUEUE] Cleanup worker error: {e}")
            time.sleep(QUEUE_CLEANUP_INTERVAL)

cleanup_thread = threading.Thread(target=queue_cleanup_worker, daemon=True)
cleanup_thread.start()

def require_massugc_api_key(f):
    """
    Decorator to require and validate MassUGC API key for protected endpoints.
    Checks if a valid MassUGC API key is configured and validates the user.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            # Check if MassUGC API key is configured
            if not MASSUGC_API_KEY_MANAGER.has_api_key():
                abort(403, description="No API key configured")
            
            # Get the API key
            api_key = MASSUGC_API_KEY_MANAGER.get_api_key()
            if not api_key:
                abort(403, description="No API key configured")
            
            # Validate the API key (with caching to avoid excessive API calls)
            import time
            cache_key = f"massugc_validation_{hash(api_key)}"
            current_time = time.time()
            
            # Check validation cache (5 minute TTL)
            if cache_key in validation_cache:
                cached = validation_cache[cache_key]
                if current_time - cached.get('cached_at', 0) < 300:  # 5 minutes
                    if not cached.get('valid', False):
                        abort(403, description="Wrong API key")
                    # Cache hit - key is valid, continue
                    return f(*args, **kwargs)
            
            # Validate with MassUGC API
            try:
                client = create_massugc_client(api_key)
                validation_result = client.validate_connection()
                
                # Cache successful validation
                validation_cache[cache_key] = {
                    'valid': True,
                    'cached_at': current_time,
                    'user_info': client.user_info
                }
                
                # API key is valid, continue with request
                return f(*args, **kwargs)
                    
            except MassUGCApiError as e:
                # Cache failed validation
                validation_cache[cache_key] = {
                    'valid': False,
                    'cached_at': current_time,
                    'error': e.message
                }
                
                if e.error_code == "invalid_api_key":
                    abort(403, description="Wrong API key")
                elif e.error_code == "insufficient_credits":
                    abort(403, description="Insufficient credits")
                elif e.error_code == "device_mismatch":
                    abort(403, description="API key in use on another device")
                else:
                    abort(403, description="Wrong API key")
            
        except Exception as e:
            # Log the error but don't expose details to client
            print(f"[AUTH] MassUGC API key validation error: {e}")
            abort(403, description="Wrong API key")
    
    return decorated

# Alias for backwards compatibility during transition
require_api_key = require_massugc_api_key

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status":"ok"}), 200


# ─── Helpers to load & save data ─────────────────────────────────────────
import threading
import time

# Thread lock for YAML file operations to prevent race conditions
yaml_file_lock = threading.Lock()

def load_jobs():
    """Thread-safe loading of jobs from campaigns.yaml"""
    max_retries = 3
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            with yaml_file_lock:
                with open(CAMPAIGNS_PATH, "r") as f:
                    data = yaml.safe_load(f) or {}
                return data.get("jobs", [])
        except (yaml.YAMLError, FileNotFoundError) as e:
            app.logger.warning(f"Failed to load jobs (attempt {retry_count + 1}/{max_retries}): {e}")
            retry_count += 1
            if retry_count < max_retries:
                time.sleep(0.1)  # Brief delay before retry
            else:
                app.logger.error(f"Failed to load jobs after {max_retries} attempts, returning empty list")
                return []
    
    # Fallback return (should never reach here, but ensures we always return a list)
    return []

def save_jobs(jobs):
    """Thread-safe saving of jobs to campaigns.yaml"""
    max_retries = 3
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            with yaml_file_lock:
                # Create a backup before writing
                backup_path = CAMPAIGNS_PATH.with_suffix('.yaml.backup')
                if CAMPAIGNS_PATH.exists():
                    shutil.copy2(CAMPAIGNS_PATH, backup_path)
                
                # Write to a temporary file first, then rename for atomic operation
                temp_path = CAMPAIGNS_PATH.with_suffix('.yaml.tmp')
                with open(temp_path, "w") as f:
                    yaml.safe_dump({"jobs": jobs}, f, default_flow_style=False, sort_keys=False)
                
                # Atomic rename to replace the original file
                temp_path.replace(CAMPAIGNS_PATH)
                
                # Clean up backup if write was successful
                if backup_path.exists():
                    backup_path.unlink()
                
                app.logger.info(f"Successfully saved {len(jobs)} jobs to campaigns.yaml")
                return
                
        except (yaml.YAMLError, IOError, OSError) as e:
            app.logger.warning(f"Failed to save jobs (attempt {retry_count + 1}/{max_retries}): {e}")
            retry_count += 1
            if retry_count < max_retries:
                time.sleep(0.1)  # Brief delay before retry
            else:
                app.logger.error(f"Failed to save jobs after {max_retries} attempts")
                # Try to restore from backup if it exists
                backup_path = CAMPAIGNS_PATH.with_suffix('.yaml.backup')
                if backup_path.exists():
                    try:
                        shutil.copy2(backup_path, CAMPAIGNS_PATH)
                        app.logger.info("Restored campaigns.yaml from backup")
                    except Exception as backup_error:
                        app.logger.error(f"Failed to restore from backup: {backup_error}")
                raise e

def load_avatars():
    with open(AVATARS_PATH, "r") as f:
        data = yaml.safe_load(f) or {}
    return data.get("avatars", [])

def save_avatars(lst):
    with open(AVATARS_PATH, "w") as f:
        yaml.safe_dump({"avatars": lst}, f)

def load_scripts():
    with open(SCRIPTS_PATH, "r") as f:
        data = yaml.safe_load(f) or {}
    return data.get("scripts", [])

def save_scripts(lst):
    with open(SCRIPTS_PATH, "w") as f:
        yaml.safe_dump({"scripts": lst}, f)

def load_clips():
    with open(CLIPS_PATH, "r") as f:
        data = yaml.safe_load(f) or {}
    return data.get("clips", [])

def save_clips(lst):
    with open(CLIPS_PATH, "w") as f:
        yaml.safe_dump({"clips": lst}, f)

# ─── Campaigns Management ────────────────────────────────────
@app.route("/campaigns", methods=["GET"])
def get_campaigns():
    """
    Returns all campaigns as JSON:
    {
      "jobs": [ { job_name, product, persona, … }, … ]
    }
    """
    return jsonify({"jobs": load_jobs()})

@app.route("/campaigns", methods=["POST"])
def add_campaign():
    """
    Create a new campaign. Expects a JSON body, for example:
    {
      "job_name": "My Campaign",
      "product": "Gadget X",
      "persona": "Tech Reviewer",
      "setting": "Studio",
      "emotion": "Enthusiastic",
      "hook": "Unboxing!",
      "elevenlabs_voice_id": "voice-id-123",
      "language": "en",
      "avatar_video_path": "/full/path/to/avatar.mp4",
      "example_script_file": "/full/path/to/script.txt",
      "brand_name": "MyBrand",                 # optional
      "remove_silence": true,                  # optional
      "enhance_for_elevenlabs": false,         # optional
    }
    """

    # COMPREHENSIVE REQUEST LOGGING
    app.logger.info("=" * 80)
    app.logger.info("🚀 NEW CAMPAIGN CREATION REQUEST")
    app.logger.info("=" * 80)
    
    # Log request details
    app.logger.info(f"📡 Request Method: {request.method}")
    app.logger.info(f"📡 Request URL: {request.url}")
    app.logger.info(f"📡 Content-Type: {request.content_type}")
    app.logger.info(f"📡 Is JSON: {request.is_json}")
    app.logger.info(f"📡 Has Form Data: {bool(request.form)}")
    app.logger.info(f"📡 Has JSON Data: {bool(request.get_json(silent=True))}")
    
    # Log headers (excluding sensitive data)
    headers_to_log = {k: v for k, v in request.headers if k.lower() not in ['authorization', 'cookie']}
    app.logger.info(f"📡 Headers: {headers_to_log}")

    # Detect JSON vs form-data
    if request.is_json:
        data = request.get_json()
        app.logger.info("📡 Data Source: JSON")
    else:
        data = request.form
        app.logger.info("📡 Data Source: Form Data")
    
    # Log all received data (truncated for readability)
    if isinstance(data, dict):
        app.logger.info(f"📡 Received {len(data)} fields:")
        for key, value in data.items():
            if isinstance(value, (dict, list)):
                app.logger.info(f"   {key}: {type(value).__name__} with {len(value)} items")
            elif isinstance(value, str) and len(value) > 100:
                app.logger.info(f"   {key}: '{value[:100]}...' (truncated)")
            else:
                app.logger.info(f"   {key}: {value}")
    else:
        app.logger.info(f"📡 Received data type: {type(data)}")

    # Key data flow checkpoint 1: What frontend sent
    if 'enhanced_settings' in data:
        enhanced_settings = data['enhanced_settings']
        if isinstance(enhanced_settings, dict):
            text_overlays = enhanced_settings.get('text_overlays', [])
            captions = enhanced_settings.get('captions', {})
            music = enhanced_settings.get('music', {})
            
            app.logger.info(f"✅ FRONTEND->BACKEND: enhanced_settings received with {len(text_overlays)} text overlays")
            app.logger.info(f"   📝 Text Overlays: {len(text_overlays)}")
            app.logger.info(f"   🎬 Captions: {'enabled' if captions.get('enabled') else 'disabled'}")
            app.logger.info(f"   🎵 Music: {'enabled' if music.get('enabled') else 'disabled'}")
            
            # Log detailed text overlay info
            for i, overlay in enumerate(text_overlays):
                if isinstance(overlay, dict):
                    enabled = overlay.get('enabled', False)
                    text = overlay.get('custom_text', '')[:50] + ('...' if len(overlay.get('custom_text', '')) > 50 else '')
                    font_size = overlay.get('font_size', overlay.get('fontSize', 'unknown'))
                    app.logger.info(f"   📝 Overlay {i+1}: {'✅' if enabled else '❌'} - '{text}' (font: {font_size}px)")
        else:
            app.logger.info(f"❌ FRONTEND->BACKEND: enhanced_settings is not a dict, type: {type(enhanced_settings)}")
    else:
        app.logger.info("❌ FRONTEND->BACKEND: No enhanced_settings received")


    # 1) Required fields validation with detailed logging
    app.logger.info("🔍 VALIDATING REQUIRED FIELDS")
    app.logger.info("-" * 50)
    
    required = [
        "job_name", "product", "persona", "setting",
        "emotion", "hook", "elevenlabs_voice_id",
        "language", "avatar_video_path", "avatar_id",
        "example_script_file", "script_id", "randomization_intensity"
    ]
    
    # Log each required field status
    missing = []
    for field in required:
        value = data.get(field)
        if not value:
            missing.append(field)
            app.logger.info(f"   ❌ {field}: MISSING")
        else:
            # Truncate long values for logging
            display_value = str(value)
            if len(display_value) > 50:
                display_value = display_value[:50] + "..."
            app.logger.info(f"   ✅ {field}: {display_value}")
    
    if missing:
        app.logger.error(f"❌ VALIDATION FAILED: Missing {len(missing)} required fields: {', '.join(missing)}")
        app.logger.info("=" * 80)
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400
    
    app.logger.info("✅ All required fields present")

    # 2) Build job dict with logging
    app.logger.info("🔧 BUILDING JOB DICT")
    app.logger.info("-" * 50)
    
    job = {k: data[k] for k in required}
    job["brand_name"] = data.get("brand_name", "")
    job["use_overlay"] = bool(data.get("use_overlay"))
    job["product_clip_id"] = data.get("product_clip_id", "")
    job["product_clip_path"] = data.get("product_clip_path", "")
    job["trigger_keywords"] = data.get("trigger_keywords", [])
    job["overlay_settings"] = data.get("overlay_settings", [])
    job["random_video_settings"] = data.get("random_video_settings")
    job["massugc_settings"] = data.get("massugc_settings")
    job["remove_silence"] = bool(data.get("remove_silence"))
    job["enhance_for_elevenlabs"] = bool(data.get("enhance_for_elevenlabs"))
    job["output_volume_enabled"] = bool(data.get("output_volume_enabled"))
    job["output_volume_level"] = float(data.get("output_volume_level", 0.5))
    job["use_randomization"] = bool(data.get("use_randomization"))
    job["useExactScript"] = bool(data.get("useExactScript"))
    
    app.logger.info(f"   📋 Job name: {job.get('job_name', 'N/A')}")
    app.logger.info(f"   🎯 Campaign type: {job.get('campaignType', 'N/A')}")
    app.logger.info(f"   🎭 Avatar ID: {job.get('avatar_id', 'N/A')}")
    app.logger.info(f"   📝 Script ID: {job.get('script_id', 'N/A')}")
    app.logger.info(f"   🎬 Use overlay: {job.get('use_overlay', False)}")
    app.logger.info(f"   🎵 Use exact script: {job.get('useExactScript', False)}")
    
    # Save the nested enhanced_settings if provided (new method)
    if "enhanced_settings" in data:
        app.logger.info("💾 SAVING ENHANCED_SETTINGS (NEW METHOD)")
        job["enhanced_settings"] = data["enhanced_settings"]
        
        # Log the structure being saved
        enhanced_settings = data["enhanced_settings"]
        if isinstance(enhanced_settings, dict):
            app.logger.info(f"   📝 Text overlays: {len(enhanced_settings.get('text_overlays', []))}")
            app.logger.info(f"   🎬 Captions enabled: {enhanced_settings.get('captions', {}).get('enabled', False)}")
            app.logger.info(f"   🎵 Music enabled: {enhanced_settings.get('music', {}).get('enabled', False)}")
            
            # Log font sizes being saved
            for i, overlay in enumerate(enhanced_settings.get('text_overlays', [])):
                if isinstance(overlay, dict):
                    font_size = overlay.get('font_size', overlay.get('fontSize', 'unknown'))
                    app.logger.info(f"   📝 Overlay {i+1} font size: {font_size}px")
    else:
        app.logger.info("❌ No enhanced_settings found in request data")

    # Also copy flat properties for backward compatibility (legacy method)
    # Copy all enhanced video settings flat properties
    enhanced_settings_keys = [
        "automated_video_editing_enabled",
        "text_overlay_enabled", "text_overlay_1_enabled", "text_overlay_mode", "text_overlay_custom_text", "text_overlay_category",
        "text_overlay_font", "text_overlay_fontSize", "text_overlay_bold", "text_overlay_underline", 
        "text_overlay_italic", "text_overlay_textCase", "text_overlay_color", "text_overlay_characterSpacing",
        "text_overlay_lineSpacing", "text_overlay_alignment", "text_overlay_style", "text_overlay_scale",
        "text_overlay_x_position", "text_overlay_y_position", "text_overlay_rotation", "text_overlay_opacity",
        "text_overlay_hasStroke", "text_overlay_strokeColor", "text_overlay_strokeThickness",
        "text_overlay_hasBackground", "text_overlay_backgroundColor", "text_overlay_backgroundOpacity",
        "text_overlay_backgroundRounded", "text_overlay_backgroundStyle", "text_overlay_backgroundHeight",
        "text_overlay_backgroundWidth", "text_overlay_backgroundYOffset", "text_overlay_backgroundXOffset",
        "text_overlay_animation", "text_overlay_connected_background_data",
        "text_overlay_2_enabled", "text_overlay_2_mode", "text_overlay_2_custom_text", "text_overlay_2_category",
        "text_overlay_2_font", "text_overlay_2_customFontName", "text_overlay_2_fontSize", "text_overlay_2_bold",
        "text_overlay_2_underline", "text_overlay_2_italic", "text_overlay_2_textCase", "text_overlay_2_color",
        "text_overlay_2_characterSpacing", "text_overlay_2_lineSpacing", "text_overlay_2_alignment",
        "text_overlay_2_style", "text_overlay_2_scale", "text_overlay_2_x_position", "text_overlay_2_y_position",
        "text_overlay_2_rotation", "text_overlay_2_opacity", "text_overlay_2_hasStroke", "text_overlay_2_strokeColor",
        "text_overlay_2_strokeThickness", "text_overlay_2_hasBackground", "text_overlay_2_backgroundColor",
        "text_overlay_2_backgroundOpacity", "text_overlay_2_backgroundRounded", "text_overlay_2_backgroundStyle",
        "text_overlay_2_backgroundHeight", "text_overlay_2_backgroundWidth", "text_overlay_2_backgroundYOffset",
        "text_overlay_2_backgroundXOffset", "text_overlay_2_animation", "text_overlay_2_connected_background_data",
        "text_overlay_3_enabled", "text_overlay_3_mode", "text_overlay_3_custom_text", "text_overlay_3_category",
        "text_overlay_3_font", "text_overlay_3_customFontName", "text_overlay_3_fontSize", "text_overlay_3_bold",
        "text_overlay_3_underline", "text_overlay_3_italic", "text_overlay_3_textCase", "text_overlay_3_color",
        "text_overlay_3_characterSpacing", "text_overlay_3_lineSpacing", "text_overlay_3_alignment",
        "text_overlay_3_style", "text_overlay_3_scale", "text_overlay_3_x_position", "text_overlay_3_y_position",
        "text_overlay_3_rotation", "text_overlay_3_opacity", "text_overlay_3_hasStroke", "text_overlay_3_strokeColor",
        "text_overlay_3_strokeThickness", "text_overlay_3_hasBackground", "text_overlay_3_backgroundColor",
        "text_overlay_3_backgroundOpacity", "text_overlay_3_backgroundRounded", "text_overlay_3_backgroundStyle",
        "text_overlay_3_backgroundHeight", "text_overlay_3_backgroundWidth", "text_overlay_3_backgroundYOffset",
        "text_overlay_3_backgroundXOffset", "text_overlay_3_animation", "text_overlay_3_connected_background_data",
        "captions_enabled", "captions_style", "captions_position", "captions_size", 
        "captions_highlight_keywords", "captions_processing_method",
        # New extended caption fields
        "captions_template", "captions_fontSize", "captions_fontFamily",
        "captions_x_position", "captions_y_position", "captions_color",
        "captions_hasStroke", "captions_strokeColor", "captions_strokeWidth",
        "captions_hasBackground", "captions_backgroundColor", "captions_backgroundOpacity",
        "captions_animation", "captions_max_words_per_segment", "captions_allCaps",
        "music_enabled", "music_track_id", "music_volume", "music_fade_duration", "music_duck_voice"
    ]
    
    # Copy enhanced video settings if they exist in the request
    
    for key in enhanced_settings_keys:
        if key in data:
            job[key] = data[key]
    
    
    job["enabled"] = True

    # 3) Metadata
    job["id"] = uuid.uuid4().hex
    job["created_at"] = datetime.now().isoformat()

    app.logger.info("📝 FINAL JOB PREPARATION")
    app.logger.info("-" * 50)
    app.logger.info(f"   🆔 Generated ID: {job['id']}")
    app.logger.info(f"   📅 Created at: {job['created_at']}")
    app.logger.info(f"   ✅ Enabled: {job['enabled']}")

    # Key data flow checkpoint 2: What gets saved to YAML
    if 'enhanced_settings' in job:
        overlays = len(job['enhanced_settings'].get('text_overlays', []))
        app.logger.info(f"✅ BACKEND->YAML: Saving enhanced_settings with {overlays} overlays to YAML")
        
        # Log final enhanced_settings structure
        enhanced_settings = job['enhanced_settings']
        if isinstance(enhanced_settings, dict):
            app.logger.info("   📋 Final enhanced_settings structure:")
            app.logger.info(f"      📝 Text overlays: {len(enhanced_settings.get('text_overlays', []))}")
            app.logger.info(f"      🎬 Captions: {enhanced_settings.get('captions', {})}")
            app.logger.info(f"      🎵 Music: {enhanced_settings.get('music', {})}")
    else:
        app.logger.info("❌ BACKEND->YAML: No enhanced_settings being saved to YAML")

    # 4) Log complete campaign data object before saving
    app.logger.info("📊 CAMPAIGN DATA OBJECT BEFORE SAVE")
    app.logger.info("=" * 80)
    try:
        # Convert job to JSON string for clean logging
        job_json = json.dumps(job, indent=2, default=str)
        app.logger.info(f"🗂️  Complete Campaign Data Object:\n{job_json}")
    except Exception as e:
        app.logger.error(f"❌ Failed to serialize campaign data for logging: {e}")
        # Fallback to basic dict logging
        app.logger.info(f"🗂️  Campaign Data Object (fallback): {job}")
    app.logger.info("=" * 80)

    # 5) Save to YAML with validation
    app.logger.info("💾 SAVING TO YAML")
    app.logger.info("-" * 50)
    
    # Load current jobs with thread safety
    jobs = load_jobs()
    app.logger.info(f"   📚 Current jobs count: {len(jobs)}")
    
    # Validate that we're not corrupting existing jobs
    original_jobs_count = len(jobs)
    
    # Check for duplicate IDs before adding
    existing_ids = [existing_job.get("id") for existing_job in jobs]
    if job["id"] in existing_ids:
        app.logger.error(f"❌ DUPLICATE ID DETECTED: {job['id']} already exists!")
        return jsonify({"error": "Campaign ID already exists"}), 409
    
    jobs.append(job)
    
    # Final validation before save
    if len(jobs) != original_jobs_count + 1:
        app.logger.error(f"❌ JOBS COUNT MISMATCH: Expected {original_jobs_count + 1}, got {len(jobs)}")
        return jsonify({"error": "Internal error during campaign creation"}), 500
    
    # Validate the job we're about to save
    if 'enhanced_settings' in job:
        enhanced_settings = job['enhanced_settings']
        if isinstance(enhanced_settings, dict) and 'text_overlays' in enhanced_settings:
            overlays = enhanced_settings['text_overlays']
            for i, overlay in enumerate(overlays):
                if isinstance(overlay, dict):
                    # Verify critical fields are not corrupted
                    font_size = overlay.get('font_size', overlay.get('fontSize'))
                    animation = overlay.get('animation')
                    if font_size is None or animation is None:
                        app.logger.error(f"❌ CORRUPTION DETECTED in overlay {i+1} before save: font_size={font_size}, animation={animation}")
                        return jsonify({"error": "Campaign data corruption detected"}), 500
    
    save_jobs(jobs)
    
    app.logger.info(f"   ✅ Job saved successfully. New count: {len(jobs)}")
    app.logger.info("=" * 80)
    app.logger.info("🎉 CAMPAIGN CREATION COMPLETED SUCCESSFULLY")
    app.logger.info("=" * 80)

    # 5) Return the new object
    return jsonify(job), 201

@app.route("/campaigns/<campaign_id>", methods=["PUT"])
def edit_campaign(campaign_id):
    """
    Update fields of the campaign with the given id.
    Accepts JSON body with any of:
      - job_name
      - product
      - persona
      - setting
      - emotion
      - hook
      - elevenlabs_voice_id
      - language
      - brand_name
      - remove_silence (boolean)
      - enhance_for_elevenlabs (boolean)
      - enabled (boolean)
    """
    # 1) Load existing campaigns
    jobs = load_jobs()

    # 2) Find the one to update
    for i, job in enumerate(jobs):
        if job.get("id") == campaign_id:
            data = request.get_json(force=True)
            if not data:
                return jsonify({"error": "Invalid JSON payload"}), 400

            # 3) Apply allowed updates
            # Define basic fields that can be updated
            basic_fields = [
                "job_name", "product", "persona", "setting", "emotion", "hook",
                "elevenlabs_voice_id", "language", "brand_name",
                "remove_silence", "enhance_for_elevenlabs",
                "output_volume_enabled", "output_volume_level",
                "use_randomization", "randomization_intensity",
                "avatar_video_path", "avatar_id",
                "example_script_file", "script_id",
                "use_overlay", "product_clip_id", "product_clip_path",
                "overlay_settings", "trigger_keywords", "random_video_settings",
                "massugc_settings", "useExactScript", "enabled", "enhancedVideoSettings"
            ]
            
            # Enhanced video settings fields (text overlays, captions, music)
            enhanced_settings_fields = [
                "automated_video_editing_enabled",
                "text_overlay_enabled", "text_overlay_1_enabled", "text_overlay_mode", "text_overlay_custom_text", "text_overlay_category",
                "text_overlay_font", "text_overlay_fontSize", "text_overlay_bold", "text_overlay_underline", 
                "text_overlay_italic", "text_overlay_textCase", "text_overlay_color", "text_overlay_characterSpacing",
                "text_overlay_lineSpacing", "text_overlay_alignment", "text_overlay_style", "text_overlay_scale",
                "text_overlay_x_position", "text_overlay_y_position", "text_overlay_rotation", "text_overlay_opacity",
                "text_overlay_hasStroke", "text_overlay_strokeColor", "text_overlay_strokeThickness",
                "text_overlay_hasBackground", "text_overlay_backgroundColor", "text_overlay_backgroundOpacity",
                "text_overlay_backgroundRounded", "text_overlay_backgroundStyle", "text_overlay_backgroundHeight",
                "text_overlay_backgroundWidth", "text_overlay_backgroundYOffset", "text_overlay_backgroundXOffset",
                "text_overlay_animation", "text_overlay_connected_background_data",
                "text_overlay_2_enabled", "text_overlay_2_mode", "text_overlay_2_custom_text", "text_overlay_2_category",
                "text_overlay_2_font", "text_overlay_2_customFontName", "text_overlay_2_fontSize", "text_overlay_2_bold",
                "text_overlay_2_underline", "text_overlay_2_italic", "text_overlay_2_textCase", "text_overlay_2_color",
                "text_overlay_2_characterSpacing", "text_overlay_2_lineSpacing", "text_overlay_2_alignment",
                "text_overlay_2_style", "text_overlay_2_scale", "text_overlay_2_x_position", "text_overlay_2_y_position",
                "text_overlay_2_rotation", "text_overlay_2_opacity", "text_overlay_2_hasStroke", "text_overlay_2_strokeColor",
                "text_overlay_2_strokeThickness", "text_overlay_2_hasBackground", "text_overlay_2_backgroundColor",
                "text_overlay_2_backgroundOpacity", "text_overlay_2_backgroundRounded", "text_overlay_2_backgroundStyle",
                "text_overlay_2_backgroundHeight", "text_overlay_2_backgroundWidth", "text_overlay_2_backgroundYOffset",
                "text_overlay_2_backgroundXOffset", "text_overlay_2_animation", "text_overlay_2_connected_background_data",
                "text_overlay_3_enabled", "text_overlay_3_mode", "text_overlay_3_custom_text", "text_overlay_3_category",
                "text_overlay_3_font", "text_overlay_3_customFontName", "text_overlay_3_fontSize", "text_overlay_3_bold",
                "text_overlay_3_underline", "text_overlay_3_italic", "text_overlay_3_textCase", "text_overlay_3_color",
                "text_overlay_3_characterSpacing", "text_overlay_3_lineSpacing", "text_overlay_3_alignment",
                "text_overlay_3_style", "text_overlay_3_scale", "text_overlay_3_x_position", "text_overlay_3_y_position",
                "text_overlay_3_rotation", "text_overlay_3_opacity", "text_overlay_3_hasStroke", "text_overlay_3_strokeColor",
                "text_overlay_3_strokeThickness", "text_overlay_3_hasBackground", "text_overlay_3_backgroundColor",
                "text_overlay_3_backgroundOpacity", "text_overlay_3_backgroundRounded", "text_overlay_3_backgroundStyle",
                "text_overlay_3_backgroundHeight", "text_overlay_3_backgroundWidth", "text_overlay_3_backgroundYOffset",
                "text_overlay_3_backgroundXOffset", "text_overlay_3_animation", "text_overlay_3_connected_background_data",
                "captions_enabled", "captions_style", "captions_position", "captions_size", 
                "captions_highlight_keywords", "captions_processing_method",
                # New extended caption fields
                "captions_template", "captions_fontSize", "captions_fontFamily",
                "captions_x_position", "captions_y_position", "captions_color",
                "captions_hasStroke", "captions_strokeColor", "captions_strokeWidth",
                "captions_hasBackground", "captions_backgroundColor", "captions_backgroundOpacity",
                "captions_animation", "captions_max_words_per_segment", "captions_allCaps",
                "music_enabled", "music_track_id", "music_volume", "music_fade_duration", "music_duck_voice"
            ]
            
            # Combine all allowed fields
            all_allowed_fields = basic_fields + enhanced_settings_fields
            
            
            for field in all_allowed_fields:
                if field in data:
                    job[field] = data[field]
            

            # 4) Save back to campaigns.yaml
            jobs[i] = job
            save_jobs(jobs)

            # 5) Return the updated object
            return jsonify(job), 200

    # 6) If not found
    abort(404, description=f"Campaign ID '{campaign_id}' not found")

@app.route("/campaigns/<campaign_id>", methods=["DELETE"])
def delete_campaign(campaign_id):
    """
    Delete the campaign with the given id from campaigns.yaml.
    """
    # 1) Load all jobs
    jobs = load_jobs()

    # 2) Filter out the one to delete by id
    new_jobs = [j for j in jobs if j.get("id") != campaign_id]
    if len(new_jobs) == len(jobs):
        # No campaign had that id
        abort(404, description=f"Campaign ID '{campaign_id}' not found")

    # 3) Persist updated list
    save_jobs(new_jobs)

    # 4) Return HTTP 204 No Content
    return "", 204


@app.route("/campaigns/<campaign_id>/duplicate", methods=["POST"])
def duplicate_campaign(campaign_id):
    """
    SERVER-SIDE duplication with validation and deep copying.
    This ensures clean, validated duplication even if source campaign is running.
    """
    import copy
    
    app.logger.info("=" * 80)
    app.logger.info(f"🔄 CAMPAIGN DUPLICATION REQUEST: {campaign_id}")
    app.logger.info("=" * 80)
    
    # 1) Thread-safe load
    jobs = load_jobs()
    
    # 2) Find source campaign
    source_campaign = next((j for j in jobs if j["id"] == campaign_id), None)
    if not source_campaign:
        app.logger.error(f"❌ Source campaign not found: {campaign_id}")
        return jsonify({"error": "Campaign not found"}), 404
    
    app.logger.info(f"✅ Found source campaign: {source_campaign.get('job_name', 'UNNAMED')}")
    
    # 3) DEEP COPY to prevent any reference sharing
    new_campaign = copy.deepcopy(source_campaign)
    app.logger.info("✅ Deep copy created")
    
    # 4) Generate new identity
    new_id = uuid.uuid4().hex
    new_campaign["id"] = new_id
    new_campaign["created_at"] = datetime.now().isoformat()
    
    # Get new name from request or auto-generate
    data = request.get_json() or {}
    new_name = data.get("job_name", f"{source_campaign.get('job_name', 'Campaign')} (Copy)")
    new_campaign["job_name"] = new_name
    
    app.logger.info(f"✅ New ID: {new_id}")
    app.logger.info(f"✅ New name: {new_name}")
    
    # 5) VALIDATE enhanced_settings from source before duplicating
    if 'enhanced_settings' in new_campaign:
        app.logger.info("🔍 Validating enhanced_settings from source...")
        enhanced_settings = new_campaign['enhanced_settings']
        
        if isinstance(enhanced_settings, dict):
            # Validate text overlays
            if 'text_overlays' in enhanced_settings:
                text_overlays = enhanced_settings['text_overlays']
                
                for i, overlay in enumerate(text_overlays):
                    if not isinstance(overlay, dict):
                        continue
                    
                    if not overlay.get('enabled', False):
                        continue  # Skip disabled overlays
                    
                    # Validate critical fields
                    font_size = overlay.get('font_size', overlay.get('fontSize'))
                    animation = overlay.get('animation')
                    
                    if font_size is None or animation is None:
                        app.logger.error(f"❌ SOURCE DATA CORRUPTED: Overlay {i+1} has null values")
                        return jsonify({
                            "error": f"Cannot duplicate: Source campaign has corrupted data in text overlay {i+1}",
                            "details": f"font_size={font_size}, animation={animation}"
                        }), 400
                    
                    if not isinstance(font_size, (int, float)) or font_size <= 0:
                        app.logger.error(f"❌ SOURCE DATA INVALID: Overlay {i+1} font_size={font_size}")
                        return jsonify({
                            "error": f"Cannot duplicate: Invalid font size in overlay {i+1}",
                            "details": f"font_size must be positive number, got {font_size}"
                        }), 400
                    
                    app.logger.info(f"✅ Overlay {i+1} validated: font={font_size}px, animation={animation}")
            
            # Validate captions
            if 'captions' in enhanced_settings:
                captions = enhanced_settings['captions']
                if isinstance(captions, dict) and captions.get('enabled', False):
                    font_size = captions.get('fontSize', captions.get('fontPx'))
                    if font_size is None or (isinstance(font_size, (int, float)) and font_size <= 0):
                        return jsonify({
                            "error": "Cannot duplicate: Invalid captions font size",
                            "details": f"fontSize={font_size}"
                        }), 400
                    app.logger.info(f"✅ Captions validated: font={font_size}px")
    
    # 6) SANITIZE any runtime state (if any exists)
    # Remove any fields that shouldn't be copied
    runtime_fields = ['last_run', 'last_status', 'run_count', 'last_error']
    for field in runtime_fields:
        if field in new_campaign:
            del new_campaign[field]
            app.logger.info(f"🧹 Removed runtime field: {field}")
    
    # 7) Check for duplicate ID (shouldn't happen with UUID but safety check)
    existing_ids = [j.get("id") for j in jobs]
    if new_id in existing_ids:
        app.logger.error(f"❌ COLLISION: Generated ID already exists: {new_id}")
        return jsonify({"error": "ID collision - please try again"}), 500
    
    # 8) Thread-safe save
    jobs.append(new_campaign)
    save_jobs(jobs)
    
    app.logger.info(f"✅ Duplicate saved successfully")
    app.logger.info("=" * 80)
    app.logger.info("🎉 DUPLICATION COMPLETED")
    app.logger.info("=" * 80)
    
    return jsonify({
        "success": True,
        "original_id": campaign_id,
        "duplicate_id": new_id,
        "duplicate": new_campaign
    }), 201

# ─── Route: Application Settings (API keys, bucket, secret) ──────────────────
@app.route("/api/settings", methods=["GET"])
def get_settings():
    keys = [
        "OPENAI_API_KEY",
        "ELEVENLABS_API_KEY",
        "DREAMFACE_API_KEY",
        "GCS_BUCKET_NAME",
        "GOOGLE_APPLICATION_CREDENTIALS",
        "OUTPUT_PATH"
    ]
    current = {k: os.getenv(k, "") for k in keys}
    
    # Add MassUGC API key status (don't expose the actual key)
    current["MASSUGC_API_KEY_CONFIGURED"] = MASSUGC_API_KEY_MANAGER.has_api_key()
    
    # Add Google Drive status
    current["DRIVE_CONNECTED"] = DRIVE_SERVICE.is_connected()
    current["DRIVE_UPLOAD_ENABLED"] = DRIVE_UPLOAD_ENABLED
    if DRIVE_SERVICE.is_connected():
        user_info = DRIVE_SERVICE.get_user_info()
        if user_info:
            current["DRIVE_USER_EMAIL"] = user_info.get('email', '')
    
    return jsonify(current)

@app.route("/api/settings", methods=["POST"])
def save_settings():
    keys = [
        "OPENAI_API_KEY",
        "ELEVENLABS_API_KEY",
        "DREAMFACE_API_KEY",
        "GCS_BUCKET_NAME",
        "GOOGLE_APPLICATION_CREDENTIALS",
        "OUTPUT_PATH"
    ]
    for k in keys:
        val = request.form.get(k, "").strip()
        set_key(str(ENV_PATH), k, val)
    # Reload updated vars immediately
    load_dotenv(dotenv_path=str(ENV_PATH), override=True)
    flash("Settings saved.", "success")
    return jsonify({"success": True})

# ─── MassUGC API Management Endpoints ────────────────────────────────────────
@app.route("/api/massugc/api-key", methods=["POST"])
def set_massugc_api_key():
    """Store MassUGC API key securely"""
    try:
        data = request.get_json()
        if not data or 'api_key' not in data:
            return jsonify({"error": "API key is required"}), 400
        
        api_key = data['api_key'].strip()
        if not api_key:
            return jsonify({"error": "API key cannot be empty"}), 400
        
        # Validate API key format
        import re
        if not re.match(r'^massugc_[A-Za-z0-9_-]{32}$', api_key):
            return jsonify({"error": "Wrong API key format"}), 400
        
        # Test the API key by trying to validate it
        try:
            client = create_massugc_client(api_key)
            validation_result = client.validate_connection()
            
            # Store the API key if validation succeeds
            MASSUGC_API_KEY_MANAGER.store_api_key(api_key)
            
            return jsonify({
                "success": True,
                "message": "MassUGC API key saved successfully",
                "user_info": client.user_info,
                "rate_limit": validation_result.get('rateLimit', {})
            })
                
        except MassUGCApiError as e:
            return jsonify({
                "error": f"API key validation failed: {e.message}",
                "error_code": e.error_code
            }), 400
        except Exception as e:
            return jsonify({"error": "Wrong API key"}), 500
        
    except Exception as e:
        return jsonify({"error": "Failed to save API key"}), 500

@app.route("/api/massugc/api-key", methods=["GET"])
def get_massugc_api_key_status():
    """Get MassUGC API key status without exposing the key"""
    try:
        has_key = MASSUGC_API_KEY_MANAGER.has_api_key()
        
        if not has_key:
            return jsonify({
                "configured": False,
                "message": "No MassUGC API key configured"
            })
        
        # Test the stored key
        api_key = MASSUGC_API_KEY_MANAGER.get_api_key()
        if not api_key:
            return jsonify({
                "configured": False,
                "message": "Failed to retrieve stored API key"
            })
        
        try:
            client = create_massugc_client(api_key)
            validation_result = client.validate_connection()
            return jsonify({
                "configured": True,
                "valid": True,
                "user_info": client.user_info,
                "rate_limit": validation_result.get('rateLimit', {})
            })
                
        except MassUGCApiError as e:
            return jsonify({
                "configured": True,
                "valid": False,
                "error": e.message,
                "error_code": e.error_code
            })
        except Exception as e:
            return jsonify({
                "configured": True,
                "valid": False,
                "error": f"Failed to validate stored key: {str(e)}"
            })
            
    except Exception as e:
        return jsonify({"error": f"Failed to check API key status: {str(e)}"}), 500

@app.route("/api/massugc/api-key", methods=["DELETE"])
def remove_massugc_api_key():
    """Remove stored MassUGC API key"""
    try:
        MASSUGC_API_KEY_MANAGER.remove_api_key()
        return jsonify({"success": True, "message": "MassUGC API key removed successfully"})
    except Exception as e:
        return jsonify({"error": f"Failed to remove API key: {str(e)}"}), 500

@app.route("/api/massugc/usage", methods=["GET"])
def get_massugc_usage():
    """Get MassUGC usage statistics"""
    try:
        api_key = MASSUGC_API_KEY_MANAGER.get_api_key()
        if not api_key:
            return jsonify({"error": "No API key configured"}), 400
        
        client = create_massugc_client(api_key)
        usage_stats = client.get_usage_stats()
        return jsonify(usage_stats)
            
    except MassUGCApiError as e:
        return jsonify({"error": e.message, "error_code": e.error_code}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to get usage stats: {str(e)}"}), 500

@app.route("/api/massugc/generate-video", methods=["POST"])
def generate_massugc_video():
    """Generate video using MassUGC API"""
    try:
        api_key = MASSUGC_API_KEY_MANAGER.get_api_key()
        if not api_key:
            return jsonify({"error": "No API key configured"}), 400
        
        # Check if files are provided
        if 'audio' not in request.files or 'image' not in request.files:
            return jsonify({"error": "Both audio and image files are required"}), 400
        
        audio_file = request.files['audio']
        image_file = request.files['image']
        
        if audio_file.filename == '' or image_file.filename == '':
            return jsonify({"error": "Both audio and image files must be selected"}), 400
        
        # Save uploaded files temporarily
        import tempfile
        temp_dir = Path(tempfile.mkdtemp())
        
        audio_path = temp_dir / f"audio_{uuid.uuid4().hex}.{audio_file.filename.split('.')[-1]}"
        image_path = temp_dir / f"image_{uuid.uuid4().hex}.{image_file.filename.split('.')[-1]}"
        
        audio_file.save(str(audio_path))
        image_file.save(str(image_path))
        
        try:
            # Parse options if provided
            options = {}
            if 'options' in request.form:
                import json
                options = json.loads(request.form['options'])
            
            # Generate video using MassUGC API
            client = create_massugc_client(api_key)
            result = client.generate_video(
                str(audio_path), str(image_path), options
            )
            
            return jsonify(result)
                
        finally:
            # Clean up temporary files
            try:
                audio_path.unlink(missing_ok=True)
                image_path.unlink(missing_ok=True)
                temp_dir.rmdir()
            except Exception as cleanup_error:
                print(f"Failed to clean up temp files: {cleanup_error}")
        
    except MassUGCApiError as e:
        return jsonify({"error": e.message, "error_code": e.error_code}), 400
    except Exception as e:
        return jsonify({"error": f"Video generation failed: {str(e)}"}), 500

@app.route("/api/massugc/job-status/<job_id>", methods=["GET"])
def get_massugc_job_status(job_id):
    """Get MassUGC job status"""
    try:
        api_key = MASSUGC_API_KEY_MANAGER.get_api_key()
        if not api_key:
            return jsonify({"error": "No API key configured"}), 400
        
        client = create_massugc_client(api_key)
        status = client.get_job_status(job_id)
        return jsonify(status)
            
    except MassUGCApiError as e:
        return jsonify({"error": e.message, "error_code": e.error_code}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to get job status: {str(e)}"}), 500

# ─── Google Drive Integration Endpoints ────────────────────────────────────
@app.route("/api/drive/connect", methods=["GET"])
def initiate_drive_connection():
    """Get Google Drive OAuth authorization URL"""
    try:
        auth_url = DRIVE_SERVICE.get_authorization_url()
        return jsonify({"auth_url": auth_url})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/drive/callback", methods=["GET"])
def handle_drive_callback():
    """Handle OAuth callback from Google"""
    code = request.args.get('code')
    if not code:
        return jsonify({"error": "No authorization code provided"}), 400
    
    try:
        success = DRIVE_SERVICE.handle_oauth_callback(code)
        if success:
            # Redirect to success page or close window
            return """
            <html>
            <body>
            <h2>Google Drive Connected Successfully!</h2>
            <p>You can close this window and return to MassUGC Studio.</p>
            <script>
                // Send message to Electron app if possible
                if (window.opener) {
                    window.opener.postMessage({type: 'drive-connected'}, '*');
                }
                // Auto-close after 3 seconds
                setTimeout(() => window.close(), 3000);
            </script>
            </body>
            </html>
            """
        else:
            return jsonify({"error": "Failed to authenticate"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/drive/disconnect", methods=["POST"])
def disconnect_drive():
    """Disconnect Google Drive"""
    try:
        DRIVE_SERVICE.disconnect()
        global DRIVE_UPLOAD_ENABLED
        DRIVE_UPLOAD_ENABLED = False
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/drive/status", methods=["GET"])
def get_drive_status():
    """Get Google Drive connection status"""
    try:
        connected = DRIVE_SERVICE.is_connected()
        response = {
            "connected": connected,
            "upload_enabled": DRIVE_UPLOAD_ENABLED
        }
        
        if connected:
            user_info = DRIVE_SERVICE.get_user_info()
            if user_info:
                response["user"] = user_info
        
        return jsonify(response)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/drive/toggle-upload", methods=["POST"])
def toggle_drive_upload():
    """Toggle Google Drive upload on/off"""
    try:
        data = request.get_json()
        enabled = data.get('enabled', False)
        
        if enabled and not DRIVE_SERVICE.is_connected():
            return jsonify({"error": "Google Drive not connected"}), 400
        
        global DRIVE_UPLOAD_ENABLED
        DRIVE_UPLOAD_ENABLED = enabled
        
        return jsonify({
            "success": True,
            "upload_enabled": DRIVE_UPLOAD_ENABLED
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ─── Route: Run Campaign ───────────────────────────────────────────
@app.route("/run-job", methods=["POST"])
@require_massugc_api_key
def run_job():
    # COMPREHENSIVE LOGGING FOR RUN-JOB ENDPOINT
    app.logger.info("=" * 80)
    app.logger.info("🚀 RUN-JOB REQUEST RECEIVED")
    app.logger.info("=" * 80)
    
    # 1) Read the campaign's ID
    campaign_id = request.form.get("campaign_id") or request.form.get("id")
    app.logger.info(f"📋 Campaign ID from request: {campaign_id}")
    
    if not campaign_id or campaign_id == 'undefined':
        app.logger.error(f"❌ Invalid campaign ID: {campaign_id}")
        return jsonify({"error": "campaign id is required"}), 400

    # 2) Lookup job and create a deep copy to avoid shared state issues
    app.logger.info(f"🔍 Looking up campaign with ID: {campaign_id}")
    all_jobs = load_jobs()
    app.logger.info(f"📚 Total campaigns in database: {len(all_jobs)}")
    
    job_template = next((j for j in all_jobs if j["id"] == campaign_id), None)
    if not job_template:
        app.logger.error(f"❌ Campaign not found with ID: {campaign_id}")
        available_ids = [j.get("id", "NO_ID") for j in all_jobs]
        app.logger.error(f"📋 Available campaign IDs: {available_ids}")
        return jsonify({"error": "Campaign not found"}), 404
    
    # Create a deep copy of the job configuration to prevent shared state issues
    import copy
    job = copy.deepcopy(job_template)
    app.logger.info(f"✅ Campaign found and deep copied: {job.get('job_name', 'UNNAMED')}")
    
    # Validate that the deep copy preserved enhanced_settings structure
    if 'enhanced_settings' in job:
        enhanced_settings = job['enhanced_settings']
        if isinstance(enhanced_settings, dict) and 'text_overlays' in enhanced_settings:
            overlays_count = len(enhanced_settings['text_overlays'])
            app.logger.info(f"✅ Deep copy preserved {overlays_count} text overlays")
            
            # Log each overlay to verify data integrity
            for i, overlay in enumerate(enhanced_settings['text_overlays']):
                if isinstance(overlay, dict):
                    font_size = overlay.get('font_size', overlay.get('fontSize', 'unknown'))
                    animation = overlay.get('animation', 'unknown')
                    rounded = overlay.get('backgroundRounded', 'unknown')
                    app.logger.info(f"   📝 Overlay {i+1}: font={font_size}px, animation={animation}, rounded={rounded}")
        else:
            app.logger.warning("⚠️ Enhanced settings structure may be corrupted in deep copy")
    else:
        app.logger.info("ℹ️ No enhanced_settings found in job configuration")
    
    # LOG CRITICAL JOB PATHS
    app.logger.info("🔍 CRITICAL PATH VALIDATION:")
    app.logger.info("-" * 50)
    
    # Check avatar video path
    avatar_path = job.get("avatar_video_path")
    app.logger.info(f"🎭 Avatar video path: {avatar_path}")
    if avatar_path:
        avatar_exists = Path(avatar_path).exists()
        app.logger.info(f"   📁 Avatar file exists: {avatar_exists}")
        if not avatar_exists:
            app.logger.error(f"   ❌ Avatar file missing: {avatar_path}")
    else:
        app.logger.error("   ❌ Avatar video path is None or empty!")
    
    # Check script file path
    script_path = job.get("example_script_file")
    app.logger.info(f"📝 Script file path: {script_path}")
    if script_path:
        script_exists = Path(script_path).exists()
        app.logger.info(f"   📁 Script file exists: {script_exists}")
        if not script_exists:
            app.logger.error(f"   ❌ Script file missing: {script_path}")
    else:
        app.logger.error("   ❌ Script file path is None or empty!")
    
    # Check product clip path (if overlay is enabled)
    product_clip_path = job.get("product_clip_path")
    use_overlay = job.get("use_overlay", False)
    app.logger.info(f"🎬 Use overlay: {use_overlay}")
    app.logger.info(f"📦 Product clip path: {product_clip_path}")
    if use_overlay and product_clip_path:
        clip_exists = Path(product_clip_path).exists()
        app.logger.info(f"   📁 Product clip exists: {clip_exists}")
        if not clip_exists:
            app.logger.error(f"   ❌ Product clip missing: {product_clip_path}")
    elif use_overlay and not product_clip_path:
        app.logger.error("   ❌ Overlay enabled but no product clip path!")
    
    # Check random video settings
    random_settings = job.get("random_video_settings")
    app.logger.info(f"🎲 Random video settings: {random_settings is not None}")
    if random_settings:
        source_dir = random_settings.get("source_directory")
        app.logger.info(f"   📁 Random source directory: {source_dir}")
        if source_dir:
            dir_exists = Path(source_dir).exists()
            app.logger.info(f"   📁 Source directory exists: {dir_exists}")
            if dir_exists:
                video_files = list(Path(source_dir).glob("*.mp4"))
                app.logger.info(f"   🎬 Found {len(video_files)} MP4 files in directory")
        else:
            app.logger.error("   ❌ Random source directory is None or empty!")
    
    # Check MassUGC settings
    massugc_settings = job.get("massugc_settings")
    app.logger.info(f"☁️ MassUGC settings: {massugc_settings is not None}")
    
    # Check enhanced settings
    enhanced_settings = job.get("enhanced_settings")
    app.logger.info(f"✨ Enhanced settings: {enhanced_settings is not None}")
    if enhanced_settings:
        text_overlays = enhanced_settings.get("text_overlays", [])
        app.logger.info(f"   📝 Text overlays count: {len(text_overlays)}")
        captions = enhanced_settings.get("captions", {})
        app.logger.info(f"   🎬 Captions enabled: {captions.get('enabled', False)}")
        music = enhanced_settings.get("music", {})
        app.logger.info(f"   🎵 Music enabled: {music.get('enabled', False)}")
    
    # Check environment variables
    app.logger.info("🔧 ENVIRONMENT VARIABLES:")
    app.logger.info("-" * 50)
    env_vars = ["OPENAI_API_KEY", "ELEVENLABS_API_KEY", "DREAMFACE_API_KEY", "OUTPUT_PATH", "GCS_BUCKET_NAME"]
    for var in env_vars:
        value = os.getenv(var)
        if value:
            if "API_KEY" in var:
                app.logger.info(f"   ✅ {var}: SET (hidden)")
            else:
                app.logger.info(f"   ✅ {var}: {value}")
        else:
            app.logger.warning(f"   ⚠️ {var}: NOT SET")
    
    app.logger.info("=" * 80)

    # 3) PRE-VALIDATION: Check if job pattern is blocked by circuit breaker
    is_blocked, block_reason = is_job_pattern_blocked(job)
    if is_blocked:
        print(f"[CIRCUIT BREAKER] Rejecting job {campaign_id}: {block_reason}")
        return jsonify({"error": f"Job blocked: {block_reason}"}), 429

    # 4) PRE-VALIDATION: Validate all prerequisites before starting
    is_valid, validation_error = validate_job_prerequisites(job)
    if not is_valid:
        print(f"[VALIDATION] Job {campaign_id} failed pre-validation: {validation_error}")
        # Record this as a configuration failure (but don't count towards circuit breaker)
        return jsonify({"error": f"Job validation failed: {validation_error}"}), 400

    # 5) Create an SSE queue
    run_id = str(uuid.uuid4())
    start_time = datetime.now().timestamp()

    # Track this job in our active jobs registry
    active_jobs[run_id] = {
        "status": "queued",
        "start_time": start_time,
        "campaign_id": campaign_id,
        "thread_future": None,
        "job_config": job  # Store job config for failure pattern tracking
    }

    emit_event(run_id, {"type": "queued"})

    # 4) Launch background thread
    def _runner():
        try:
            # Update job status to processing
            if run_id in active_jobs:
                active_jobs[run_id]["status"] = "processing"
                active_jobs[run_id]["processing_start"] = datetime.now().timestamp()
            
            app.logger.info(f"🚀 [JOB] Starting job {run_id} for campaign {campaign_id}")
            print(f"[JOB] Starting job {run_id} for campaign {campaign_id}")
            
            # progress_callback will re-publish events tagged with run_id
            def progress_cb(step, total, message):
                emit_event(run_id, {
                    "type": "progress",
                    "step": step,
                    "total": total,
                    "message": message
                })

            # DETAILED SCRIPT FILE VALIDATION AND PATH RESOLUTION
            app.logger.info("📝 SCRIPT FILE PROCESSING:")
            app.logger.info("-" * 50)
            
            script_file_path = job.get("example_script_file")
            app.logger.info(f"📋 Original script path from job: {script_file_path}")
            
            if not script_file_path:
                app.logger.error("❌ No script file specified in campaign")
                raise FileNotFoundError("No script file specified in campaign")
            
            # Check if script_file_path is None (this could be the source of the error)
            if script_file_path is None:
                app.logger.error("❌ Script file path is None - this is likely the source of the stat error!")
                raise ValueError("Script file path is None")
            
            original = Path(script_file_path)
            app.logger.info(f"📁 Path object created: {original}")
            app.logger.info(f"📁 Path exists check: {original.exists()}")
            
            # If the original path doesn't exist, try to find it in the scripts directory
            if not original.exists():
                app.logger.warning(f"⚠️ Script not found at original path: {original}")
                script_name = original.name
                app.logger.info(f"📝 Script name extracted: {script_name}")
                
                alt_path = SCRIPTS_DIR / script_name
                app.logger.info(f"🔍 Trying alternative path: {alt_path}")
                app.logger.info(f"📁 Alternative path exists: {alt_path.exists()}")
                
                if alt_path.exists():
                    app.logger.info(f"✅ Found script at alternative path: {alt_path}")
                    print(f"[JOB] Script not found at {original}, using alternative path: {alt_path}")
                    original = alt_path
                else:
                    app.logger.warning("⚠️ Alternative path also not found, checking scripts registry")
                    # Try to find by ID in scripts registry
                    scripts = load_scripts()
                    app.logger.info(f"📚 Loaded {len(scripts)} scripts from registry")
                    
                    script_record = None
                    for s in scripts:
                        app.logger.info(f"🔍 Checking script: {s.get('name', 'NO_NAME')} (ID: {s.get('id', 'NO_ID')})")
                        if s.get("name") == script_name or s.get("id") == campaign_id:
                            script_record = s
                            app.logger.info(f"✅ Found matching script record: {script_record}")
                            break
                    
                    if script_record:
                        app.logger.info(f"📁 Script record file path: {script_record.get('file_path')}")
                        file_exists, resolved_path = safe_file_exists(script_record["file_path"])
                        app.logger.info(f"📁 Safe file exists check: {file_exists}")
                        app.logger.info(f"📁 Resolved path: {resolved_path}")
                        
                        if file_exists:
                            original = resolved_path
                            app.logger.info(f"✅ Using resolved path from registry: {original}")
                            print(f"[JOB] Found script in registry: {original}")
                        else:
                            app.logger.error(f"❌ Script record found but file doesn't exist: {script_record['file_path']}")
                    else:
                        available_scripts = [s["name"] for s in scripts]
                        app.logger.error(f"❌ Script not found in registry. Available scripts: {available_scripts}")
                        raise FileNotFoundError(f"Script file not found: {script_file_path}. Available scripts: {available_scripts}")
            else:
                app.logger.info(f"✅ Script found at original path: {original}")

            # Clone the script into a unique temp file avoiding job collisions
            app.logger.info("📋 CREATING TEMPORARY SCRIPT FILE:")
            app.logger.info("-" * 50)
            
            temp_dir = WORKING_DIR  # your per-app working dir
            app.logger.info(f"📁 Working directory: {temp_dir}")
            app.logger.info(f"📁 Working directory exists: {temp_dir.exists()}")
            
            temp_dir.mkdir(parents=True, exist_ok=True)
            app.logger.info(f"📁 Working directory created/verified")
            
            tmp_script = temp_dir / f"script_{run_id}.txt"
            app.logger.info(f"📝 Temporary script path: {tmp_script}")
            
            app.logger.info(f"📋 Copying script from {original} to {tmp_script}")
            shutil.copy(original, tmp_script)
            app.logger.info(f"✅ Script copied successfully")
            print(f"[JOB] Copied script from {original} to {tmp_script}")

            # Now read only from the copy
            app.logger.info(f"📖 Reading script content from temporary file")
            example_script = tmp_script.read_text(encoding="utf-8")
            app.logger.info(f"📖 Script content length: {len(example_script)} characters")
            app.logger.info(f"📖 Script preview: {example_script[:100]}...")

            # Check if this is a MassUGC API job, randomized video job, or avatar-based job
            massugc_settings = job.get("massugc_settings")
            random_settings = job.get("random_video_settings")
            
            app.logger.info("🎯 JOB EXECUTION PATH DETERMINATION:")
            app.logger.info("-" * 50)
            app.logger.info(f"☁️ MassUGC settings present: {massugc_settings is not None}")
            app.logger.info(f"🎲 Random settings present: {random_settings is not None}")
            
            if massugc_settings:
                app.logger.info("🚀 EXECUTING: MassUGC API-based video generation")
                # MassUGC API-based video generation
                import asyncio
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    app.logger.info("📋 MassUGC job parameters:")
                    app.logger.info(f"   📝 Job name: {job['job_name']}")
                    app.logger.info(f"   🎯 Product: {job['product']}")
                    app.logger.info(f"   🎭 Persona: {job['persona']}")
                    app.logger.info(f"   🏢 Setting: {job['setting']}")
                    app.logger.info(f"   😊 Emotion: {job['emotion']}")
                    app.logger.info(f"   🎣 Hook: {job['hook']}")
                    app.logger.info(f"   🗣️ Voice ID: {job['elevenlabs_voice_id']}")
                    app.logger.info(f"   📖 Script length: {len(example_script)} chars")
                    app.logger.info(f"   🌍 Language: {job.get('language', 'English')}")
                    app.logger.info(f"   🔧 Enhance for ElevenLabs: {job.get('enhance_for_elevenlabs', False)}")
                    app.logger.info(f"   🏷️ Brand name: {job.get('brand_name', '')}")
                    app.logger.info(f"   🔇 Remove silence: {job.get('remove_silence', True)}")
                    app.logger.info(f"   📤 Output path: {os.getenv('OUTPUT_PATH')}")
                    
                    success, output_path = loop.run_until_complete(create_massugc_video_job(
                    job_name               = job["job_name"],
                    product                = job["product"],
                    persona                = job["persona"],
                    setting                = job["setting"],
                    emotion                = job["emotion"],
                    hook                   = job["hook"],
                    elevenlabs_voice_id    = job["elevenlabs_voice_id"],
                    example_script_content = example_script,
                    language               = job.get("language", "English"),
                    enhance_for_elevenlabs = job.get("enhance_for_elevenlabs", False),
                    brand_name             = job.get("brand_name", ""),
                    remove_silence         = job.get("remove_silence", True),
                    massugc_settings       = massugc_settings,
                        openai_api_key         = os.getenv("OPENAI_API_KEY"),
                        elevenlabs_api_key     = os.getenv("ELEVENLABS_API_KEY"),
                        output_path            = os.getenv("OUTPUT_PATH"),
                        progress_callback      = progress_cb
                    ))
                    app.logger.info(f"✅ MassUGC job completed: success={success}, output={output_path}")
                finally:
                    loop.close()
            elif random_settings:
                app.logger.info("🚀 EXECUTING: Randomized video generation")
                # Randomized video generation
                app.logger.info("📋 Randomized job parameters:")
                app.logger.info(f"   🎯 Product: {job['product']}")
                app.logger.info(f"   🎭 Persona: {job['persona']}")
                app.logger.info(f"   🏢 Setting: {job['setting']}")
                app.logger.info(f"   😊 Emotion: {job['emotion']}")
                app.logger.info(f"   🎣 Hook: {job['hook']}")
                app.logger.info(f"   🗣️ Voice ID: {job['elevenlabs_voice_id']}")
                app.logger.info(f"   📁 Random source dir: {random_settings.get('source_directory', '')}")
                app.logger.info(f"   📖 Script length: {len(example_script)} chars")
                app.logger.info(f"   📤 Output path: {os.getenv('OUTPUT_PATH')}")
                
                success, output_path = create_randomized_video_job(
                    product                = job["product"],
                    persona                = job["persona"],
                    setting                = job["setting"],
                    emotion                = job["emotion"],
                    hook                   = job["hook"],
                    elevenlabs_voice_id    = job["elevenlabs_voice_id"],
                    random_source_dir      = random_settings.get("source_directory", ""),
                    example_script_content = example_script,
                    openai_api_key         = os.getenv("OPENAI_API_KEY"),
                    elevenlabs_api_key     = os.getenv("ELEVENLABS_API_KEY"),
                    output_path            = os.getenv("OUTPUT_PATH"),
                    job_name               = job["job_name"],
                    language               = job.get("language", "English"),
                    enhance_for_elevenlabs = job.get("enhance_for_elevenlabs", False),
                    brand_name             = job.get("brand_name", ""),
                    remove_silence         = job.get("remove_silence", True),
                    # Randomization parameters (same as avatar campaigns)
                    use_randomization      = job.get("use_randomization", False),
                    randomization_intensity= job.get("randomization_intensity", "none"),
                    # Product Overlay Parameters (NEW - matching avatar campaigns)
                    use_overlay            = job.get("use_overlay", False),
                    product_clip_path      = job.get("product_clip_path", None),
                    trigger_keywords       = job.get("trigger_keywords", None),
                    overlay_settings       = job.get("overlay_settings", None),
                    # Exact script feature
                    use_exact_script       = job.get("useExactScript", False),
                    # Randomized video specific parameters
                    random_count           = random_settings.get("total_clips"),
                    hook_video             = random_settings.get("hook_video"),
                    original_volume        = random_settings.get("original_volume", 0.6),
                    voice_audio_volume     = random_settings.get("voice_audio_volume", 1.0),
                    progress_callback      = progress_cb
                )
                app.logger.info(f"✅ Randomized job completed: success={success}, output={output_path}")
            else:
                app.logger.info("🚀 EXECUTING: Avatar-based video generation (original)")
                # Avatar-based video generation (original)
                app.logger.info("📋 Avatar job parameters:")
                app.logger.info(f"   📝 Job name: {job['job_name']}")
                app.logger.info(f"   🎯 Product: {job['product']}")
                app.logger.info(f"   🎭 Persona: {job['persona']}")
                app.logger.info(f"   🏢 Setting: {job['setting']}")
                app.logger.info(f"   😊 Emotion: {job['emotion']}")
                app.logger.info(f"   🎣 Hook: {job['hook']}")
                app.logger.info(f"   🗣️ Voice ID: {job['elevenlabs_voice_id']}")
                app.logger.info(f"   🎭 Avatar video path: {job['avatar_video_path']}")
                app.logger.info(f"   📖 Script length: {len(example_script)} chars")
                app.logger.info(f"   🔇 Remove silence: {job.get('remove_silence', False)}")
                app.logger.info(f"   🎲 Use randomization: {job.get('use_randomization', False)}")
                app.logger.info(f"   🎯 Randomization intensity: {job.get('randomization_intensity')}")
                app.logger.info(f"   🌍 Language: {job.get('language', 'English')}")
                app.logger.info(f"   🔧 Enhance for ElevenLabs: {job.get('enhance_for_elevenlabs', False)}")
                app.logger.info(f"   🏷️ Brand name: {job.get('brand_name', '')}")
                app.logger.info(f"   🎬 Use overlay: {job.get('use_overlay', False)}")
                app.logger.info(f"   📦 Product clip path: {job.get('product_clip_path', None)}")
                app.logger.info(f"   🎯 Trigger keywords: {job.get('trigger_keywords', None)}")
                app.logger.info(f"   ⚙️ Overlay settings: {job.get('overlay_settings', None)}")
                app.logger.info(f"   📝 Use exact script: {job.get('useExactScript', False)}")
                app.logger.info(f"   📤 Output path: {os.getenv('OUTPUT_PATH')}")
                
                # Build enhanced settings with detailed logging
                app.logger.info("🔧 BUILDING ENHANCED SETTINGS:")
                enhanced_video_settings = _build_enhanced_settings_from_flat_properties(job)
                app.logger.info(f"   ✨ Enhanced settings built: {enhanced_video_settings is not None}")
                if enhanced_video_settings:
                    text_overlays = enhanced_video_settings.get('text_overlay', {})
                    app.logger.info(f"   📝 Text overlay enabled: {text_overlays.get('enabled', False)}")
                    captions = enhanced_video_settings.get('captions', {})
                    app.logger.info(f"   🎬 Captions enabled: {captions.get('enabled', False)}")
                    music = enhanced_video_settings.get('music', {})
                    app.logger.info(f"   🎵 Music enabled: {music.get('enabled', False)}")
                
                success, output_path = create_video_job(
                    job_name               = job["job_name"],
                    product                = job["product"],
                    persona                = job["persona"],
                    setting                = job["setting"],
                    emotion                = job["emotion"],
                    hook                   = job["hook"],
                    elevenlabs_voice_id    = job["elevenlabs_voice_id"],
                    avatar_video_path      = job["avatar_video_path"],
                    example_script_content = example_script,
                    remove_silence         = job.get("remove_silence", False),
                    use_randomization      = job.get("use_randomization", False),
                    randomization_intensity= job.get("randomization_intensity"),
                    language               = job.get("language", "English"),
                    enhance_for_elevenlabs = job.get("enhance_for_elevenlabs", False),
                    brand_name             = job.get("brand_name", ""),
                    use_overlay            = job.get("use_overlay", False),
                    product_clip_path      = job.get("product_clip_path", None),
                    trigger_keywords       = job.get("trigger_keywords", None),
                    overlay_settings       = job.get("overlay_settings", None),
                    use_exact_script       = job.get("useExactScript", False),
                    enhanced_video_settings= enhanced_video_settings,
                    openai_api_key         = os.getenv("OPENAI_API_KEY"),
                    elevenlabs_api_key     = os.getenv("ELEVENLABS_API_KEY"),
                    dreamface_api_key      = os.getenv("DREAMFACE_API_KEY"),
                    gcs_bucket_name        = os.getenv("GCS_BUCKET_NAME"),
                    output_path            = os.getenv("OUTPUT_PATH"),
                    progress_callback      = progress_cb
                )
                app.logger.info(f"✅ Avatar job completed: success={success}, output={output_path}")

            # c) If the function returned failure without exception
            if not success:
                # In case of error using the same string to path the error message
                error_message = output_path
                print(f"[JOB] Job {run_id} failed without exception: {error_message}")

                # Record failure for circuit breaker
                job_info = active_jobs.get(run_id, {})
                job_config = job_info.get("job_config", {})
                record_job_failure(job_config, error_message)

                emit_event(run_id, {
                    "type": "error",
                    "message": f"Job failed without exception. Last error message: {error_message}"
                })
                
                # Send failed job data to MassUGC Cloud API for debugging and user support
                try:
                    if MASSUGC_API_KEY_MANAGER.has_api_key():
                        api_key = MASSUGC_API_KEY_MANAGER.get_api_key()
                        if api_key:
                            from massugc_api_client import create_massugc_client
                            client = create_massugc_client(api_key)
                            client.initialize()  # Initialize device fingerprint
                            
                            # Create detailed error message for customer support
                            detailed_error = create_detailed_error_message(error_message, job, run_id)
                            
                            # Prepare usage data for failed job
                            usage_data = {
                                "event_type": "video_generation",
                                "job_data": {
                                    "job_name": job.get("job_name", ""),
                                    "product": job.get("product", ""),
                                    "persona": job.get("persona", ""),
                                    "setting": job.get("setting", ""),
                                    "emotion": job.get("emotion", ""),
                                    "hook": job.get("hook", ""),
                                    "brand_name": job.get("brand_name", ""),
                                    "language": job.get("language", "English"),
                                    "useExactScript": job.get("useExactScript", False),
                                    "script_generation_type": "exact" if job.get("useExactScript", False) else "ai_generated",
                                    "run_id": run_id,
                                    "output_path": None,
                                    "success": False,
                                    "error_message": detailed_error,
                                    "failure_time": datetime.now().isoformat(),
                                    "workflow_type": "avatar" if not massugc_settings and not random_settings else "massugc" if massugc_settings else "randomized"
                                },
                                "timestamp": datetime.now().isoformat(),
                                "source": "massugc-video-service",
                                "version": "1.0.0"
                            }
                            
                            # Send to MassUGC Cloud API
                            result = client.log_usage_data(usage_data)
                            if result.get('skipped'):
                                print(f"[USAGE] Skipped logging failed job data for job {run_id}: {result.get('reason', 'unknown')}")
                            else:
                                print(f"[USAGE] Successfully logged detailed failed job data for job {run_id}")
                            
                except Exception as logging_error:
                    # Don't fail the job if logging fails, just log the error
                    print(f"[USAGE] Failed to log failed job data for job {run_id}: {logging_error}")
                
                return

            # d) Upload to Google Drive if enabled
            drive_info = None
            if DRIVE_UPLOAD_ENABLED and DRIVE_SERVICE.is_connected():
                try:
                    # Extract date and product from output path
                    # Expected format: ~/.zyra-video-agent/output/YYYY-MM-DD/Product_Name/filename.mp4
                    path_parts = Path(output_path).parts
                    date_folder = None
                    product_folder = None
                    
                    # Find date and product folders in path
                    for i, part in enumerate(path_parts):
                        # Look for date pattern YYYY-MM-DD
                        if len(part) == 10 and part[4] == '-' and part[7] == '-':
                            date_folder = part
                            if i + 1 < len(path_parts):
                                product_folder = path_parts[i + 1]
                            break
                    
                    if date_folder and product_folder:
                        print(f"[DRIVE] Uploading to Google Drive: {date_folder}/{product_folder}")
                        drive_result = DRIVE_SERVICE.upload_video(
                            file_path=output_path,
                            date_folder=date_folder,
                            product_folder=product_folder,
                            job_name=job.get('name', 'Untitled')
                        )
                        
                        if drive_result:
                            drive_info = drive_result
                            output_path = drive_result['web_link']  # Update output path to Drive link
                            print(f"[DRIVE] Upload successful: {drive_result['drive_path']}")
                        else:
                            print(f"[DRIVE] Upload failed, keeping local file")
                    else:
                        print(f"[DRIVE] Could not extract folder structure from path: {output_path}")
                        
                except Exception as drive_error:
                    print(f"[DRIVE] Upload error (falling back to local): {drive_error}")
            
            # e) Signal success
            print(f"[JOB] Job {run_id} completed successfully: {output_path}")
            event_data = {
                "type": "done",
                "success": success,
                "output_path": output_path
            }
            
            # Add Drive info if available
            if drive_info:
                event_data["drive_info"] = drive_info
            
            emit_event(run_id, event_data)
            
            # e) Send usage data to MassUGC Cloud API for tracking (if API key configured)
            # Send to cloud API for both success and failure
            try:
                if MASSUGC_API_KEY_MANAGER.has_api_key():
                    api_key = MASSUGC_API_KEY_MANAGER.get_api_key()
                    if api_key:
                        from massugc_api_client import create_massugc_client
                        client = create_massugc_client(api_key)
                        client.initialize()  # Initialize device fingerprint
                        
                        # Prepare usage data for successful job
                        usage_data = {
                            "event_type": "video_generation",
                            "job_data": {
                                "job_name": job.get("job_name", ""),
                                "product": job.get("product", ""),
                                "persona": job.get("persona", ""),
                                "setting": job.get("setting", ""),
                                "emotion": job.get("emotion", ""),
                                "hook": job.get("hook", ""),
                                "brand_name": job.get("brand_name", ""),
                                "language": job.get("language", "English"),
                                "useExactScript": job.get("useExactScript", False),
                                "script_generation_type": "exact" if job.get("useExactScript", False) else "ai_generated",
                                "run_id": run_id,
                                "output_path": str(output_path),
                                "success": True,
                                "generation_time": datetime.now().isoformat(),
                                "workflow_type": "avatar" if not massugc_settings and not random_settings else "massugc" if massugc_settings else "randomized"
                            },
                            "timestamp": datetime.now().isoformat(),
                            "source": "massugc-video-service",
                            "version": "1.0.0"
                        }
                        
                        # Send to MassUGC Cloud API
                        result = client.log_usage_data(usage_data)
                        if result.get('skipped'):
                            print(f"[USAGE] Skipped logging usage data for job {run_id}: {result.get('reason', 'unknown')}")
                        else:
                            print(f"[USAGE] Successfully logged usage data for job {run_id}")
                        
            except Exception as logging_error:
                # Don't fail the job if logging fails, just log the error
                print(f"[USAGE] Failed to log usage data for job {run_id}: {logging_error}")

        except Exception as e:
            # e) Catch and emit any unexpected exception
            err = str(e)
            app.logger.error(f"💥 [JOB] Job {run_id} failed with exception: {err}")
            app.logger.error(f"💥 [JOB] Exception type: {type(e).__name__}")
            app.logger.error(f"💥 [JOB] Exception args: {e.args}")
            
            # Check if this is the specific stat error we're looking for
            if "stat: path should be string, bytes, os.PathLike or integer, not NoneType" in err:
                app.logger.error("🎯 FOUND THE STAT ERROR! This is the error we're debugging.")
                app.logger.error("🔍 Let's trace where this None path is coming from...")
                
                # Log all the paths we know about
                app.logger.error("📋 PATH ANALYSIS:")
                app.logger.error(f"   🎭 Avatar video path: {job.get('avatar_video_path')}")
                app.logger.error(f"   📝 Script file path: {job.get('example_script_file')}")
                app.logger.error(f"   📦 Product clip path: {job.get('product_clip_path')}")
                app.logger.error(f"   📤 Output path: {os.getenv('OUTPUT_PATH')}")
                app.logger.error(f"   🏗️ Working dir: {WORKING_DIR}")
                app.logger.error(f"   📁 Scripts dir: {SCRIPTS_DIR}")
                app.logger.error(f"   🎭 Avatars dir: {AVATARS_DIR}")
                app.logger.error(f"   📦 Clips dir: {CLIPS_DIR}")
                
                # Check if any of these are None
                paths_to_check = {
                    "avatar_video_path": job.get('avatar_video_path'),
                    "example_script_file": job.get('example_script_file'),
                    "product_clip_path": job.get('product_clip_path'),
                    "OUTPUT_PATH": os.getenv('OUTPUT_PATH'),
                    "WORKING_DIR": str(WORKING_DIR),
                    "SCRIPTS_DIR": str(SCRIPTS_DIR),
                    "AVATARS_DIR": str(AVATARS_DIR),
                    "CLIPS_DIR": str(CLIPS_DIR)
                }
                
                for path_name, path_value in paths_to_check.items():
                    if path_value is None:
                        app.logger.error(f"   ❌ {path_name} is None!")
                    else:
                        app.logger.error(f"   ✅ {path_name}: {path_value}")
            
            print(f"[JOB] Job {run_id} failed with exception: {err}")
            
            # Record failure for circuit breaker
            job_info = active_jobs.get(run_id, {})
            job_config = job_info.get("job_config", {})
            record_job_failure(job_config, err)

            emit_event(run_id, {
                "type": "error",
                "message": f"Job failed with exception, message {err}"
            })
            
            # Send failed job data to MassUGC Cloud API for debugging and user support
            try:
                if MASSUGC_API_KEY_MANAGER.has_api_key():
                    api_key = MASSUGC_API_KEY_MANAGER.get_api_key()
                    if api_key:
                        from massugc_api_client import create_massugc_client
                        client = create_massugc_client(api_key)
                        client.initialize()  # Initialize device fingerprint
                        
                        # Create detailed error message for customer support
                        detailed_error = create_detailed_error_message(err, job, run_id)
                        
                        # Prepare usage data for failed job
                        usage_data = {
                            "event_type": "video_generation",
                            "job_data": {
                                "job_name": job.get("job_name", ""),
                                "product": job.get("product", ""),
                                "persona": job.get("persona", ""),
                                "setting": job.get("setting", ""),
                                "emotion": job.get("emotion", ""),
                                "hook": job.get("hook", ""),
                                "brand_name": job.get("brand_name", ""),
                                "language": job.get("language", "English"),
                                "useExactScript": job.get("useExactScript", False),
                                "script_generation_type": "exact" if job.get("useExactScript", False) else "ai_generated",
                                "run_id": run_id,
                                "output_path": None,
                                "success": False,
                                "error_message": detailed_error,
                                "failure_time": datetime.now().isoformat(),
                                "workflow_type": "avatar" if not massugc_settings and not random_settings else "massugc" if massugc_settings else "randomized"
                            },
                            "timestamp": datetime.now().isoformat(),
                            "source": "massugc-video-service",
                            "version": "1.0.0"
                        }
                        
                        # Send to MassUGC Cloud API
                        result = client.log_usage_data(usage_data)
                        if result.get('skipped'):
                            print(f"[USAGE] Skipped logging failed job data for job {run_id}: {result.get('reason', 'unknown')}")
                        else:
                            print(f"[USAGE] Successfully logged detailed failed job data for job {run_id}")
                        
            except Exception as logging_error:
                # Don't fail the job if logging fails, just log the error
                print(f"[USAGE] Failed to log failed job data for job {run_id}: {logging_error}")
            
            # No re-raise: we want the thread to exit gracefully

        finally:
            # Clean up temporary script file
            if 'tmp_script' in locals() and tmp_script and tmp_script.exists():
                try:
                    tmp_script.unlink()
                    print(f"[JOB] Cleaned up temp script: {tmp_script}")
                except Exception as e:
                    print(f"[JOB] Failed to clean up temp script {tmp_script}: {e}")
            
            # Remove job from active tracking
            if run_id in active_jobs:
                active_jobs.pop(run_id)
                print(f"[JOB] Removed job {run_id} from active tracking")

    # 4) Submit to the pool and store the future for potential cancellation
    future = job_executor.submit(_runner)
    
    # Update the job tracking with the thread future
    if run_id in active_jobs:
        active_jobs[run_id]["thread_future"] = future

    # 5) Return the run ID for the client to open /progress/<run_id>
    return jsonify({"run_id": run_id}), 200

@app.route("/events")
def events():
    def event_stream():
        print("[SSE] New client connected to events stream")
        try:
            while True:
                try:
                    # Use a timeout to prevent indefinite blocking - increased for long jobs
                    msg = broadcast_q.get(timeout=300)  # 5 minute timeout (was 30s)
                    etype = msg.pop("type", "progress")
                    data = json.dumps(msg)
                    yield f"event: {etype}\ndata: {data}\n\n"
                except queue.Empty:
                    # Send heartbeat to keep connection alive
                    yield f"event: heartbeat\ndata: {json.dumps({'timestamp': datetime.now().isoformat()})}\n\n"
                except Exception as e:
                    print(f"[SSE] Error in event stream: {e}")
                    yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
                    break
        except GeneratorExit:
            print("[SSE] Client disconnected from events stream")
        except Exception as e:
            print(f"[SSE] Event stream error: {e}")

    response = Response(event_stream(), mimetype="text/event-stream")
    response.headers["Cache-Control"] = "no-cache"
    response.headers["Connection"] = "keep-alive"
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response

# ─── Queue Management Endpoints ──────────────────────────────────────
@app.route("/queue/status", methods=["GET"])
@require_massugc_api_key  
def get_queue_status():
    """Get current job queue status for monitoring"""
    return jsonify(get_job_queue_status())

@app.route("/queue/cleanup", methods=["POST"])
@require_massugc_api_key
def manual_queue_cleanup():
    """Manually trigger queue cleanup"""
    try:
        cleanup_stale_jobs()
        return jsonify({"message": "Queue cleanup completed", "status": get_job_queue_status()})
    except Exception as e:
        return jsonify({"error": f"Queue cleanup failed: {str(e)}"}), 500

@app.route("/queue/cancel/<run_id>", methods=["POST"])
@require_massugc_api_key
def cancel_job(run_id):
    """Cancel a specific job"""
    if run_id not in active_jobs:
        return jsonify({"error": "Job not found"}), 404
    
    try:
        job_info = active_jobs.pop(run_id)
        
        # Cancel the thread if it exists
        thread_future = job_info.get('thread_future')
        if thread_future and not thread_future.done():
            thread_future.cancel()
        
        # Emit cancellation event
        emit_event(run_id, {
            "type": "error", 
            "message": "Job cancelled by user"
        })
        
        return jsonify({"message": f"Job {run_id} cancelled successfully"})
    except Exception as e:
        return jsonify({"error": f"Failed to cancel job: {str(e)}"}), 500

@app.route("/queue/cancel-all", methods=["POST"])
@require_massugc_api_key
def cancel_all_jobs():
    """Cancel all active and queued jobs"""
    try:
        cancelled_jobs = []
        
        # Get all active jobs
        for run_id, job_info in list(active_jobs.items()):
            # Cancel the thread if it exists
            thread_future = job_info.get('thread_future')
            if thread_future and not thread_future.done():
                thread_future.cancel()
            
            # Emit cancellation event
            emit_event(run_id, {
                "type": "error", 
                "message": "Job cancelled by user (cancel all)"
            })
            
            cancelled_jobs.append(run_id)
        
        # Clear the active jobs dictionary
        active_jobs.clear()
        
        return jsonify({
            "message": f"Cancelled {len(cancelled_jobs)} jobs successfully",
            "cancelled_jobs": cancelled_jobs
        })
    except Exception as e:
        return jsonify({"error": f"Failed to cancel all jobs: {str(e)}"}), 500


@app.route("/queue/failure-patterns", methods=["GET"])
@require_massugc_api_key
def get_failure_patterns():
    """Get current failure patterns and circuit breaker status"""
    current_time = datetime.now().timestamp()
    
    patterns_info = {}
    for pattern_key, pattern in failure_patterns.items():
        is_blocked = current_time < pattern["blocked_until"]
        time_remaining = int(pattern["blocked_until"] - current_time) if is_blocked else 0
        
        patterns_info[pattern_key] = {
            "failure_count": pattern["count"],
            "last_failure": datetime.fromtimestamp(pattern["last_failure"]).isoformat(),
            "is_blocked": is_blocked,
            "time_remaining_seconds": time_remaining,
            "sample_error": pattern["sample_error"]
        }
    
    return jsonify({
        "failure_patterns": patterns_info,
        "circuit_breaker_config": {
            "failure_threshold": CIRCUIT_BREAKER_FAILURE_THRESHOLD,
            "reset_time_seconds": CIRCUIT_BREAKER_RESET_TIME,
            "similar_failure_window_seconds": SIMILAR_FAILURE_WINDOW
        }
    })

@app.route("/queue/reset-circuit-breaker", methods=["POST"])
@require_massugc_api_key
def reset_circuit_breaker():
    """Reset circuit breaker for specific pattern or all patterns"""
    try:
        data = request.get_json() or {}
        pattern_key = data.get("pattern_key")
        
        if pattern_key:
            # Reset specific pattern
            if pattern_key in failure_patterns:
                failure_patterns[pattern_key]["blocked_until"] = 0
                failure_patterns[pattern_key]["count"] = 0
                return jsonify({"message": f"Circuit breaker reset for pattern: {pattern_key}"})
            else:
                return jsonify({"error": "Pattern not found"}), 404
        else:
            # Reset all patterns
            reset_count = 0
            for pattern in failure_patterns.values():
                if pattern["blocked_until"] > datetime.now().timestamp():
                    pattern["blocked_until"] = 0
                    pattern["count"] = 0
                    reset_count += 1
            
            return jsonify({"message": f"Circuit breaker reset for {reset_count} patterns"})
    
    except Exception as e:
        return jsonify({"error": f"Failed to reset circuit breaker: {str(e)}"}), 500

@app.route("/queue/clear-validation-cache", methods=["POST"])
@require_massugc_api_key
def clear_validation_cache():
    """Clear the validation cache to force re-validation of job prerequisites"""
    try:
        cache_size = len(validation_cache)
        validation_cache.clear()
        return jsonify({"message": f"Cleared {cache_size} cached validation results"})
    except Exception as e:
        return jsonify({"error": f"Failed to clear validation cache: {str(e)}"}), 500

# ─── GET /avatars ───────────────────────────────────────────────
@app.route("/avatars", methods=["GET"])
def get_avatars():
    return jsonify({"avatars": load_avatars()})


# ─── GET /video-info ────────────────────────────────────────────
@app.route("/video-info", methods=["GET"])
def get_video_info():
    """Get video dimensions and metadata for a video file"""
    video_path = request.args.get('path')

    if not video_path:
        return jsonify({"error": "No video path provided"}), 400

    # Convert relative path to absolute if needed
    if not os.path.isabs(video_path):
        # Check common locations
        possible_paths = [
            os.path.join(AVATARS_DIR, video_path),
            os.path.join(CLIPS_DIR, video_path),
            video_path  # Try as-is
        ]

        for path in possible_paths:
            if os.path.exists(path):
                video_path = path
                break
        else:
            return jsonify({"error": f"Video file not found: {video_path}"}), 404

    if not os.path.exists(video_path):
        return jsonify({"error": f"Video file not found: {video_path}"}), 404

    try:
        # Use ffprobe to get video information
        import subprocess
        import json

        cmd = [
            'ffprobe',
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_streams',
            '-select_streams', 'v:0',  # Only video stream
            video_path
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            return jsonify({"error": "Failed to read video metadata"}), 500

        probe_data = json.loads(result.stdout)

        if not probe_data.get('streams'):
            return jsonify({"error": "No video stream found"}), 400

        video_stream = probe_data['streams'][0]

        # Extract key information
        info = {
            "width": int(video_stream.get('width', 0)),
            "height": int(video_stream.get('height', 0)),
            "duration": float(video_stream.get('duration', 0)),
            "fps": eval(video_stream.get('r_frame_rate', '0/1')),
            "codec": video_stream.get('codec_name', 'unknown'),
            "path": video_path,
            "aspect_ratio": round(int(video_stream.get('width', 0)) / int(video_stream.get('height', 1)), 3)
        }

        return jsonify(info)

    except Exception as e:
        print(f"Error getting video info: {e}")
        return jsonify({"error": f"Failed to get video info: {str(e)}"}), 500

# ─── POST /avatars ──────────────────────────────────────────────
@app.route("/avatars", methods=["POST"])
def add_avatar():
    # Required fields
    name               = request.form.get("name", "").strip()
    gender             = request.form.get("gender", "").strip()
    eleven_id          = request.form.get("elevenlabs_voice_id", "").strip()
    origin_language    = request.form.get("origin_language", "").strip()

    if not name or not gender:
        return jsonify({"error": "Both name and gender are required"}), 400

    # Optional file upload
    avatar_file = request.files.get("avatar_file")
    if not avatar_file or not avatar_file.filename:
        return jsonify({"error": "Please upload an avatar file"}), 400

    # Sanitize filename to avoid path issues with spaces and special characters
    sanitized_filename = sanitize_filename(avatar_file.filename)
    dest = AVATARS_DIR / sanitized_filename
    
    # Save file with sanitized name
    avatar_file.save(dest)
    app.logger.info(f"Avatar uploaded - Original: '{avatar_file.filename}' -> Sanitized: '{sanitized_filename}' -> Path: {dest}")

    # Generate thumbnail
    thumbnail_filename = f"{os.path.splitext(sanitized_filename)[0]}_thumb.jpg"
    thumbnail_path = AVATARS_DIR / "thumbnails" / thumbnail_filename

    thumbnail_generated = generate_video_thumbnail(dest, thumbnail_path)
    if thumbnail_generated:
        app.logger.info(f"Generated thumbnail: {thumbnail_path}")
    else:
        app.logger.warning(f"Failed to generate thumbnail for {dest}")

    avatar = {
        "id":                  uuid.uuid4().hex,
        "name":                name,
        "gender":              gender,
        "file_path":           str(dest),
        "thumbnail_path":      str(thumbnail_path) if thumbnail_generated else None,
        "elevenlabs_voice_id": eleven_id or None,
        "origin_language":     origin_language or None
    }

    lst = load_avatars()
    lst.append(avatar)
    save_avatars(lst)
    return jsonify(avatar), 201

# ─── DELETE /avatars/<id> ────────────────────────────────────────
@app.route("/avatars/<avatar_id>", methods=["DELETE"])
def delete_avatar(avatar_id):
    avatars = load_avatars()
    # 1) Find the avatar to delete
    avatar_to_delete = next((av for av in avatars if av["id"] == avatar_id), None)
    if not avatar_to_delete:
        abort(404, description=f"Avatar ID '{avatar_id}' not found")

    # 2) Delete the main file from disk with proper path resolution
    file_path_str = avatar_to_delete.get("file_path", "")
    file_exists, resolved_path = safe_file_exists(file_path_str)
    
    if file_exists and resolved_path:
        try:
            resolved_path.unlink()
            app.logger.info(f"Avatar file deleted: {resolved_path}")
        except Exception as e:
            app.logger.warning(f"Failed to delete avatar file '{resolved_path}': {e}")
    else:
        app.logger.warning(f"Avatar file not found for deletion: '{file_path_str}'")

    # 3) Delete the thumbnail file if it exists
    thumbnail_path_str = avatar_to_delete.get("thumbnail_path", "")
    if thumbnail_path_str:
        thumbnail_exists, resolved_thumbnail_path = safe_file_exists(thumbnail_path_str)
        
        if thumbnail_exists and resolved_thumbnail_path:
            try:
                resolved_thumbnail_path.unlink()
                app.logger.info(f"Avatar thumbnail deleted: {resolved_thumbnail_path}")
            except Exception as e:
                app.logger.warning(f"Failed to delete avatar thumbnail '{resolved_thumbnail_path}': {e}")
        else:
            app.logger.warning(f"Avatar thumbnail not found for deletion: '{thumbnail_path_str}'")

    # 4) Remove from the list and persist
    remaining = [av for av in avatars if av["id"] != avatar_id]
    save_avatars(remaining)

    return "", 204

# ─── PUT /avatars/<id> ───────────────────────────────────────────
@app.route("/avatars/<avatar_id>", methods=["PUT"])
def edit_avatar(avatar_id):
    avatars = load_avatars()
    for i, av in enumerate(avatars):
        if av["id"] == avatar_id:
            data = request.form.to_dict()  # to get form fields
            # Update text fields if present
            for fld in ["name", "gender", "elevenlabs_voice_id", "origin_language"]:
                if fld in data:
                    av[fld] = data[fld].strip()

            # Handle optional new file
            new_file = request.files.get("avatar_file")
            if new_file and new_file.filename:
                # Sanitize filename to avoid path issues
                sanitized_filename = sanitize_filename(new_file.filename)
                dest = AVATARS_DIR / sanitized_filename
                new_file.save(dest)
                av["file_path"] = str(dest)
                app.logger.info(f"Avatar updated - Original: '{new_file.filename}' -> Sanitized: '{sanitized_filename}' -> Path: {dest}")

            avatars[i] = av
            save_avatars(avatars)
            return jsonify(av), 200

    abort(404, description=f"Avatar ID '{avatar_id}' not found")

# ─── GET /scripts ─────────────────────────────────────────────────
@app.route("/scripts", methods=["GET"])
def get_scripts():
    """Return all scripts as JSON."""
    return jsonify({"scripts": load_scripts()})


# ─── POST /scripts ────────────────────────────────────────────────
@app.route("/scripts", methods=["POST"])
def add_script():
    """
    Upload a new script file and register its metadata:
      - name            (string form field)
      - script_file     (uploaded file)
    Auto-generates:
      - id              (uuid4 hex)
      - created_at      (ISO timestamp)
      - file_path       (absolute path on disk)
    """
    name = request.form.get("name", "").strip()
    if not name:
        return jsonify({"error": "Field 'name' is required"}), 400

    script_file = request.files.get("script_file")
    if not script_file or not script_file.filename:
        return jsonify({"error": "Please upload a script file"}), 400

    # Sanitize filename to avoid path issues
    sanitized_filename = sanitize_filename(script_file.filename)
    dest = SCRIPTS_DIR / sanitized_filename
    script_file.save(dest)
    app.logger.info(f"Script uploaded - Original: '{script_file.filename}' -> Sanitized: '{sanitized_filename}' -> Path: {dest}")

    record = {
        "id":         uuid.uuid4().hex,
        "name":       name,
        "created_at": datetime.now().isoformat(),
        "file_path":  str(dest)
    }
    lst = load_scripts()
    lst.append(record)
    save_scripts(lst)
    return jsonify(record), 201


# ─── DELETE /scripts/<script_id> ───────────────────────────────────
@app.route("/scripts/<script_id>", methods=["DELETE"])
def delete_script(script_id):
    """Remove the script record and delete its file from disk."""
    scripts = load_scripts()
    rec = next((s for s in scripts if s["id"] == script_id), None)
    if not rec:
        abort(404, description=f"Script ID '{script_id}' not found")

    # Delete file on disk with proper path resolution
    file_path_str = rec["file_path"]
    file_exists, resolved_path = safe_file_exists(file_path_str)
    
    if file_exists and resolved_path:
        try:
            resolved_path.unlink()
            app.logger.info(f"Script file deleted: {resolved_path}")
        except Exception as e:
            app.logger.warning(f"Failed to delete script file '{resolved_path}': {e}")
    else:
        app.logger.warning(f"Script file not found for deletion: '{file_path_str}'")

    # Remove from list and persist
    remaining = [s for s in scripts if s["id"] != script_id]
    save_scripts(remaining)
    return "", 204


# ─── PUT /scripts/<script_id> ─────────────────────────────────────
@app.route("/scripts/<script_id>", methods=["PUT"])
def edit_script(script_id):
    """
    Update a script's name or replace its file.
    Accepts multipart/form-data:
      - name (optional)
      - script_file (optional)
    """
    scripts = load_scripts()
    for i, rec in enumerate(scripts):
        if rec["id"] == script_id:
            # Update name if provided
            if "name" in request.form:
                rec["name"] = request.form["name"].strip()

            # Replace file if a new one is uploaded
            new_file = request.files.get("script_file")
            if new_file and new_file.filename:
                # Delete old file with proper path resolution
                old_path_str = rec["file_path"]
                file_exists, resolved_old_path = safe_file_exists(old_path_str)
                if file_exists and resolved_old_path:
                    try:
                        resolved_old_path.unlink()
                        app.logger.info(f"Old script file deleted: {resolved_old_path}")
                    except Exception as e:
                        app.logger.warning(f"Failed to delete old script file: {e}")
                
                # Save new file with sanitized filename
                sanitized_filename = sanitize_filename(new_file.filename)
                dest = SCRIPTS_DIR / sanitized_filename
                new_file.save(dest)
                rec["file_path"] = str(dest)
                app.logger.info(f"Script updated - Original: '{new_file.filename}' -> Sanitized: '{sanitized_filename}' -> Path: {dest}")

            scripts[i] = rec
            save_scripts(scripts)
            return jsonify(rec), 200

    abort(404, description=f"Script ID '{script_id}' not found")


# ─── POST /scripts/generate ─────────────────────────────────────
@app.route("/scripts/generate", methods=["POST"])
@require_massugc_api_key
def generate_script_endpoint():
    """
    Generate a new script using AI based on provided parameters.
    Accepts JSON:
      - product (required)
      - persona (required)
      - emotion (required)
      - hook (optional)
      - brand_name (optional)
      - language (optional, defaults to "English")
      - enhance_for_elevenlabs (optional, defaults to true)
      - setting (optional, defaults to "Studio")
      - name (optional, auto-generated if not provided)
    Returns JSON: generated script content and metadata
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "JSON body required"}), 400
        
        # Required fields
        product = data.get("product", "").strip()
        persona = data.get("persona", "").strip()
        emotion = data.get("emotion", "").strip()
        
        if not product or not persona or not emotion:
            return jsonify({"error": "Fields 'product', 'persona', and 'emotion' are required"}), 400
        
        # Optional fields with defaults
        hook = data.get("hook", "Start with something attention-grabbing").strip()
        brand_name = data.get("brand_name", "").strip()
        language = data.get("language", "English").strip()
        enhance_for_elevenlabs = data.get("enhance_for_elevenlabs", False)
        setting = data.get("setting", "Studio").strip()
        script_name = data.get("name", f"{product} Script - {datetime.now().strftime('%Y-%m-%d %H:%M')}").strip()
        
        # Default example script for template
        default_example_script = """
So here's the thing about [product name] that nobody talks about...

I've been struggling with [problem] for months. You know that feeling when you've tried everything and nothing seems to work? That was me.

Then I discovered [product name]. And honestly, I was skeptical. Another solution promising the world, right?

But here's what happened. Within the first week, I noticed [specific benefit]. By the second week, [another benefit]. 

What really sold me was [unique feature or benefit]. It's not just another [product category] - it's designed specifically for people like us who [target audience pain point].

The best part? You can try it risk-free. If it doesn't work for you like it did for me, you get your money back.

I'm sharing this because I wish someone had told me about [brand name] sooner. Check the link in my bio if you want to learn more.
        """.strip()
        
        # Initialize OpenAI client
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if not openai_api_key:
            return jsonify({"error": "OpenAI API key not configured"}), 500
        
        openai_client = OpenAI(api_key=openai_api_key)
        
        # Generate the script
        generated_script = generate_script(
            client=openai_client,
            product=product,
            persona=persona,
            setting=setting,
            emotion=emotion,
            hook_guidance=hook,
            example_script=default_example_script,
            language=language,
            enhance_for_elevenlabs=enhance_for_elevenlabs,
            brand_name=brand_name
        )
        
        if not generated_script:
            return jsonify({"error": "Failed to generate script. Please check your OpenAI API key and try again."}), 500
        
        # Save the generated script as a file
        script_filename = f"{script_name.replace(' ', '_').replace('/', '_')}.txt"
        dest = SCRIPTS_DIR / script_filename
        
        # Ensure unique filename
        counter = 1
        original_dest = dest
        while dest.exists():
            name_part = original_dest.stem
            ext_part = original_dest.suffix
            dest = SCRIPTS_DIR / f"{name_part}_{counter}{ext_part}"
            counter += 1
        
        # Write script to file
        with open(dest, 'w', encoding='utf-8') as f:
            f.write(generated_script)
        
        # Create script record
        record = {
            "id": uuid.uuid4().hex,
            "name": script_name,
            "created_at": datetime.now().isoformat(),
            "file_path": str(dest),
            "size": len(generated_script.encode('utf-8')),
            "generated": True,  # Flag to indicate this was AI-generated
            "generation_params": {
                "product": product,
                "persona": persona,
                "emotion": emotion,
                "hook": hook,
                "brand_name": brand_name,
                "language": language,
                "enhance_for_elevenlabs": enhance_for_elevenlabs,
                "setting": setting
            }
        }
        
        # Add to scripts list
        scripts = load_scripts()
        scripts.append(record)
        save_scripts(scripts)
        
        # Return both the record and the script content for immediate preview
        return jsonify({
            **record,
            "script_content": generated_script
        }), 201
        
    except Exception as e:
        print(f"Error in script generation endpoint: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Script generation failed: {str(e)}"}), 500


# ─── GET /clips ─────────────────────────────────────────────────
@app.route("/clips", methods=["GET"])
def get_clips():
    """Return all product clips as JSON."""
    return jsonify({"clips": load_clips()})


# ─── POST /clips ────────────────────────────────────────────────
@app.route("/clips", methods=["POST"])
def add_clip():
    """
    Upload a new product clip and register its metadata:
      - name      (string form field)
      - product   (string form field)
      - clip_file (uploaded .mov file)
    Returns JSON: { id, name, product, file_path }
    """
    name    = request.form.get("name", "").strip()
    product = request.form.get("product", "").strip()
    clip    = request.files.get("clip_file")

    if not name or not product:
        return jsonify({"error": "Fields 'name' and 'product' are required"}), 400
    if not clip or not clip.filename:
        return jsonify({"error": "Please upload a clip file (.mov)"}), 400

    # Save the file with sanitized filename
    sanitized_filename = sanitize_filename(clip.filename)
    dest = CLIPS_DIR / sanitized_filename
    clip.save(dest)
    app.logger.info(f"Clip uploaded - Original: '{clip.filename}' -> Sanitized: '{sanitized_filename}' -> Path: {dest}")

    record = {
        "id":        uuid.uuid4().hex,
        "name":      name,
        "product":   product,
        "file_path": str(dest)
    }

    lst = load_clips()
    lst.append(record)
    save_clips(lst)

    return jsonify(record), 201


# ─── DELETE /clips/<id> ────────────────────────────────────────
@app.route("/clips/<clip_id>", methods=["DELETE"])
def delete_clip(clip_id):
    """
    Delete the clip record and remove its file from disk.
    """
    clips = load_clips()
    rec = next((c for c in clips if c["id"] == clip_id), None)
    if not rec:
        abort(404, description=f"Clip ID '{clip_id}' not found")

    # Delete file on disk with proper path resolution
    file_path_str = rec["file_path"]
    file_exists, resolved_path = safe_file_exists(file_path_str)
    
    if file_exists and resolved_path:
        try:
            resolved_path.unlink()
            app.logger.info(f"Clip file deleted: {resolved_path}")
        except Exception as e:
            app.logger.warning(f"Failed to delete clip file '{resolved_path}': {e}")
    else:
        app.logger.warning(f"Clip file not found for deletion: '{file_path_str}'")

    # remove from list and persist
    remaining = [c for c in clips if c["id"] != clip_id]
    save_clips(remaining)

    return "", 204


# ─── PUT /clips/<id> ───────────────────────────────────────────
@app.route("/clips/<clip_id>", methods=["PUT"])
def edit_clip(clip_id):
    """
    Update a clip's name, product, or replace its file.
    Accepts multipart/form-data:
      - name (optional)
      - product (optional)
      - clip_file (optional)
    Returns JSON: updated record
    """
    clips = load_clips()
    for i, rec in enumerate(clips):
        if rec["id"] == clip_id:
            data = request.form.to_dict()

            # update textual fields
            if "name" in data:
                rec["name"] = data["name"].strip()
            if "product" in data:
                rec["product"] = data["product"].strip()

            # Replace file if provided
            new_clip = request.files.get("clip_file")
            if new_clip and new_clip.filename:
                # Delete old file with proper path resolution
                old_path_str = rec["file_path"]
                file_exists, resolved_old_path = safe_file_exists(old_path_str)
                if file_exists and resolved_old_path:
                    try:
                        resolved_old_path.unlink()
                        app.logger.info(f"Old clip file deleted: {resolved_old_path}")
                    except Exception as e:
                        app.logger.warning(f"Failed to delete old clip file: {e}")

                # Save new file with sanitized filename
                sanitized_filename = sanitize_filename(new_clip.filename)
                dest = CLIPS_DIR / sanitized_filename
                new_clip.save(dest)
                rec["file_path"] = str(dest)
                app.logger.info(f"Clip updated - Original: '{new_clip.filename}' -> Sanitized: '{sanitized_filename}' -> Path: {dest}")

            clips[i] = rec
            save_clips(clips)
            return jsonify(rec), 200

    abort(404, description=f"Clip ID '{clip_id}' not found")

# ─── Quick Test Configuration Endpoint ────────────────────────────────────
@app.route("/api/test-configuration", methods=["POST"])
@require_massugc_api_key
def test_configuration():
    """
    Test all API keys and services to validate configuration.
    Accepts JSON with API keys and returns test results for each service.
    """
    try:
        data = request.get_json() or {}
        results = {}
        
        # Test OpenAI API Key
        openai_key = data.get("OPENAI_API_KEY", "").strip()
        if openai_key:
            openai_result = validate_openai_api_real_time(openai_key)
            if openai_result["api_key_valid"] is True:
                results["OPENAI_API"] = {
                    "status": "success",
                    "message": "Connected - Check Credits Here",
                    "link": "https://platform.openai.com/settings/organization/billing/overview"
                }
            elif openai_result["api_key_valid"] is False:
                results["OPENAI_API"] = {
                    "status": "error",
                    "message": openai_result["error"]
                }
            else:  # None - connection issues
                results["OPENAI_API"] = {
                    "status": "error",
                    "message": openai_result["error"]
                }
        else:
            results["OPENAI_API"] = {
                "status": "error",
                "message": "API key not provided"
            }
        
        # Test ElevenLabs API Key
        elevenlabs_key = data.get("ELEVENLABS_API_KEY", "").strip()
        if elevenlabs_key:
            elevenlabs_result = validate_elevenlabs_api_real_time(elevenlabs_key)
            if elevenlabs_result["api_key_valid"] is True:
                character_count = elevenlabs_result.get("credits_remaining", "Unknown")  # This is actually character count
                character_limit = elevenlabs_result.get("character_limit", "Unknown")
                tier = elevenlabs_result.get("subscription_tier", "Unknown")
                
                if character_count != "Unknown" and character_count is not None:
                    if isinstance(character_count, (int, float)):
                        if character_limit != "Unknown" and isinstance(character_limit, (int, float)):
                            # Calculate characters used (limit - remaining = used)
                            characters_used = character_limit - character_count
                            usage_text = f"{characters_used:,} / {character_limit:,} characters remaining"
                        else:
                            usage_text = f"{character_count:,} characters remaining"
                    else:
                        usage_text = f"{character_count} characters remaining"
                else:
                    usage_text = "Usage info not available"
                
                tier_text = f" ({tier} tier)" if tier != "Unknown" else ""
                results["ELEVENLABS_API"] = {
                    "status": "success",
                    "message": f"{usage_text}{tier_text}"
                }
            elif elevenlabs_result["api_key_valid"] is False:
                results["ELEVENLABS_API"] = {
                    "status": "error",
                    "message": elevenlabs_result["error"]
                }
            else:  # None - connection issues
                results["ELEVENLABS_API"] = {
                    "status": "error",
                    "message": elevenlabs_result["error"]
                }
        else:
            results["ELEVENLABS_API"] = {
                "status": "error",
                "message": "API key not provided"
            }
        
        # Test DreamFace API Key
        dreamface_key = data.get("DREAMFACE_API_KEY", "").strip()
        if dreamface_key:
            dreamface_result = validate_dreamface_api_real_time(dreamface_key)
            if dreamface_result["api_key_valid"] is True:
                credits = dreamface_result.get("credits_available", "Unknown")
                
                if credits != "Unknown" and credits is not None:
                    if isinstance(credits, (int, float)):
                        credits_text = f"{credits:,} credits available"
                    else:
                        credits_text = f"{credits} credits available"
                else:
                    credits_text = "Credits info not available"
                
                results["DREAMFACE_API"] = {
                    "status": "success",
                    "message": credits_text
                }
            elif dreamface_result["api_key_valid"] is False:
                results["DREAMFACE_API"] = {
                    "status": "error",
                    "message": dreamface_result["error"]
                }
            else:  # None - connection issues
                results["DREAMFACE_API"] = {
                    "status": "error",
                    "message": dreamface_result["error"]
                }
        else:
            results["DREAMFACE_API"] = {
                "status": "error",
                "message": "API key not provided"
            }
        
        # Test Google Cloud Storage
        gcs_bucket = data.get("GCS_BUCKET_NAME", "").strip()
        gcs_credentials = data.get("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
        
        if gcs_bucket and gcs_credentials:
            try:
                from google.cloud import storage
                from google.auth import exceptions as auth_exceptions
                
                # Try to create client with explicit credentials
                file_exists, resolved_path = safe_file_exists(gcs_credentials)
                if file_exists:
                    client = storage.Client.from_service_account_json(str(resolved_path))
                    bucket = client.bucket(gcs_bucket)
                    bucket.reload()  # This will fail if bucket doesn't exist or no access
                    
                    # Test if we can list objects (read permission)
                    try:
                        blobs = list(bucket.list_blobs(max_results=1))
                        permissions = "read/write access confirmed"
                    except:
                        permissions = "basic access confirmed"
                    
                    results["GOOGLE_CLOUD_STORAGE"] = {
                        "status": "success",
                        "message": f"Bucket '{gcs_bucket}' connected ({permissions})"
                    }
                else:
                    results["GOOGLE_CLOUD_STORAGE"] = {
                        "status": "error",
                        "message": f"Credentials file not found: {gcs_credentials}"
                    }
            except auth_exceptions.DefaultCredentialsError:
                results["GOOGLE_CLOUD_STORAGE"] = {
                    "status": "error",
                    "message": "Invalid or missing credentials"
                }
            except Exception as e:
                if "404" in str(e) or "Not found" in str(e):
                    results["GOOGLE_CLOUD_STORAGE"] = {
                        "status": "error",
                        "message": f"Bucket '{gcs_bucket}' not found or no access"
                    }
                elif "403" in str(e) or "Forbidden" in str(e):
                    results["GOOGLE_CLOUD_STORAGE"] = {
                        "status": "error",
                        "message": "Access denied. Check service account permissions"
                    }
                else:
                    results["GOOGLE_CLOUD_STORAGE"] = {
                        "status": "error",
                        "message": f"Connection failed: {str(e)[:100]}"
                    }
        else:
            missing_parts = []
            if not gcs_bucket:
                missing_parts.append("bucket name")
            if not gcs_credentials:
                missing_parts.append("credentials file")
            
            results["GOOGLE_CLOUD_STORAGE"] = {
                "status": "error",
                "message": f"Missing: {', '.join(missing_parts)}"
            }
        
        # Test MassUGC API Key (check if one is configured)
        if MASSUGC_API_KEY_MANAGER.has_api_key():
            try:
                api_key = MASSUGC_API_KEY_MANAGER.get_api_key()
                client = create_massugc_client(api_key)
                validation_result = client.validate_connection()
                user_email = client.user_info.get('email', 'unknown')
                subscription_tier = client.user_info.get('subscription_tier', 'unknown')
                results["MASSUGC_API_CONFIGURED"] = {
                    "status": "success",
                    "message": f"Connected as {user_email} ({subscription_tier} tier)"
                }
            except MassUGCApiError as e:
                results["MASSUGC_API_CONFIGURED"] = {
                    "status": "error",
                    "message": f"API validation failed: {e.message}"
                }
            except Exception as e:
                results["MASSUGC_API_CONFIGURED"] = {
                    "status": "error",
                    "message": f"Connection failed: {str(e)[:100]}"
                }
        else:
            results["MASSUGC_API_CONFIGURED"] = {
                "status": "error",
                "message": "No MassUGC API key configured"
            }
        
        
        return jsonify(results)
        
    except Exception as e:
        print(f"Error in test configuration endpoint: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Configuration test failed: {str(e)}"}), 500

# ─── Debug Report Generation Endpoint ─────────────────────────────────────
@app.route("/api/debug-report", methods=["POST"])
@require_massugc_api_key  
def generate_debug_report():
    """
    Generate a comprehensive debug report with system information,
    hardware stats, environment status, and application state.
    """
    try:
        import platform
        import psutil
        import socket
        
        # Get current timestamp
        current_time = datetime.now()
        
        # ─── Report Info ───────────────────────────────────
        report_info = {
            "generated_at": current_time.isoformat(),
            "app_version": "1.0.20",  # Update this to match your app version
            "backend_port": int(os.getenv("VIDEO_AGENT_PORT", 2026)),
            "backend_pid": os.getpid()
        }
        
        # ─── System Information ────────────────────────────
        system_info = {
            "platform": platform.platform(),
            "system": platform.system(),
            "release": platform.release(),
            "version": platform.version(),
            "machine": platform.machine(),
            "processor": platform.processor(),
            "architecture": platform.architecture()[0],
            "hostname": socket.gethostname(),
            "python_version": platform.python_version(),
            "python_implementation": platform.python_implementation()
        }
        
        # ─── Hardware Information ──────────────────────────
        # Get memory info
        memory = psutil.virtual_memory()
        memory_gb = memory.total / (1024**3)
        memory_available_gb = memory.available / (1024**3)
        memory_percent = memory.percent
        
        # Get disk info
        disk = psutil.disk_usage('/')
        disk_total_gb = disk.total / (1024**3)
        disk_free_gb = disk.free / (1024**3)
        disk_percent = (disk.used / disk.total) * 100
        
        # Get CPU info
        cpu_count = psutil.cpu_count()
        cpu_percent = psutil.cpu_percent(interval=1)
        
        hardware_info = {
            "cpu_count": cpu_count,
            "cpu_percent": round(cpu_percent, 1),
            "memory_total_gb": round(memory_gb, 2),
            "memory_available_gb": round(memory_available_gb, 2),
            "memory_used_gb": round((memory_gb - memory_available_gb), 2),
            "memory_percent": round(memory_percent, 1),
            "disk_total_gb": round(disk_total_gb, 2),
            "disk_free_gb": round(disk_free_gb, 2),
            "disk_used_gb": round((disk_total_gb - disk_free_gb), 2), 
            "disk_percent": round(disk_percent, 1)
        }
        
        # ─── Environment Status ────────────────────────────
        env_vars_to_check = [
            "OPENAI_API_KEY",
            "ELEVENLABS_API_KEY", 
            "DREAMFACE_API_KEY",
            "GCS_BUCKET_NAME",
            "GOOGLE_APPLICATION_CREDENTIALS",
            "OUTPUT_PATH",
            "VIDEO_AGENT_PORT"
        ]
        
        environment_status = {}
        for var in env_vars_to_check:
            value = os.getenv(var)
            if value:
                # Don't expose actual keys, just indicate if they're set
                if "API_KEY" in var:
                    environment_status[var] = "SET (hidden)"
                elif "CREDENTIALS" in var:
                    # Check if the file exists with proper path resolution
                    file_exists, resolved_path = safe_file_exists(value)
                    if file_exists:
                        environment_status[var] = f"SET - File exists: {resolved_path}"
                    else:
                        environment_status[var] = f"SET - File missing: {value}"
                else:
                    environment_status[var] = value
            else:
                environment_status[var] = "NOT SET"
        
        # ─── Job Queue Status ──────────────────────────────
        queue_status = get_job_queue_status()
        
        # ─── Active Jobs Count ─────────────────────────────
        active_jobs_count = len(active_jobs)
        
        # ─── Failure Patterns Summary ─────────────────────
        failure_summary = {
            "total_patterns": len(failure_patterns),
            "blocked_patterns": sum(1 for p in failure_patterns.values() 
                                  if datetime.now().timestamp() < p.get("blocked_until", 0)),
            "recent_failures": sum(1 for p in failure_patterns.values()
                                 if datetime.now().timestamp() - p.get("last_failure", 0) < 3600)
        }
        
        # ─── Validation Cache Info ─────────────────────────
        cache_info = {
            "total_entries": len(validation_cache),
            "cache_hit_ratio": "N/A"  # Could implement cache hit tracking
        }
        
        # ─── File System Paths ─────────────────────────────
        paths_info = {
            "config_dir": str(CONFIG_DIR),
            "working_dir": str(WORKING_DIR),
            "avatars_dir": str(AVATARS_DIR),
            "scripts_dir": str(SCRIPTS_DIR),
            "clips_dir": str(CLIPS_DIR),
            "log_path": str(LOG_PATH) if WRITE_LOGS else "Logging disabled"
        }
        
        # ─── Compile Final Report ──────────────────────────
        debug_report = {
            "report_info": report_info,
            "system_information": system_info,
            "hardware_information": hardware_info,
            "environment_status": environment_status,
            "job_queue_status": queue_status,
            "active_jobs_count": active_jobs_count,
            "failure_patterns_summary": failure_summary,
            "validation_cache_info": cache_info,
            "file_system_paths": paths_info
        }
        
        print(f"[DEBUG] Generated debug report at {current_time.isoformat()}")
        return jsonify(debug_report)
        
    except Exception as e:
        print(f"Error generating debug report: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Debug report generation failed: {str(e)}"}), 500


# ================================
# ENHANCED VIDEO PROCESSING APIs
# ================================

@app.route("/api/fonts/validate", methods=["GET"])
def validate_fonts():
    """
    Validate available fonts on the system.
    Returns font availability status for all configured fonts.
    """
    try:
        from backend.font_manager import get_font_manager
        from pathlib import Path
        
        # Initialize font manager with assets directory
        assets_dir = Path(__file__).resolve().parent / "assets" / "fonts"
        font_manager = get_font_manager(assets_dir)
        
        # Get availability status for all fonts
        availability = font_manager.list_available_fonts()
        
        # Get detailed resolution info for common fonts
        common_fonts = [
            "Inter",
            "Inter-Medium", 
            "Inter-Bold",
            "Montserrat",
            "Montserrat-Bold",
            "Proxima Nova",
            "ProximaNova-Semibold",
            "Arial",
            "Helvetica",
            "Impact",
            "NotoColorEmoji"
        ]
        
        font_paths = font_manager.validate_font_availability(common_fonts)
        
        # Count available fonts
        total_fonts = len(availability)
        available_count = sum(1 for available in availability.values() if available)
        
        return jsonify({
            "success": True,
            "os": font_manager.os_type,
            "assets_directory": str(assets_dir),
            "summary": {
                "total": total_fonts,
                "available": available_count,
                "missing": total_fonts - available_count
            },
            "fonts": {
                "availability": availability,
                "resolved_paths": font_paths
            }
        })
        
    except Exception as e:
        logger.error(f"Font validation error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": f"Font validation failed: {str(e)}"
        }), 500


@app.route("/api/fonts/test", methods=["POST"])
def test_font_resolution():
    """
    Test font resolution for a specific font family.
    Accepts JSON with 'font_family' parameter.
    """
    try:
        from backend.font_manager import get_font_manager
        from pathlib import Path
        
        data = request.get_json()
        if not data or 'font_family' not in data:
            return jsonify({
                "success": False,
                "error": "font_family parameter required"
            }), 400
        
        font_family = data['font_family']
        
        # Initialize font manager
        assets_dir = Path(__file__).resolve().parent / "assets" / "fonts"
        font_manager = get_font_manager(assets_dir)
        
        # Resolve font path
        try:
            font_path = font_manager.get_font_path(font_family)
            path_exists = Path(font_path).exists()
            
            return jsonify({
                "success": True,
                "font_family": font_family,
                "resolved_path": font_path,
                "exists": path_exists,
                "os": font_manager.os_type
            })
        except Exception as resolve_error:
            return jsonify({
                "success": False,
                "font_family": font_family,
                "error": str(resolve_error),
                "os": font_manager.os_type
            }), 400
        
    except Exception as e:
        logger.error(f"Font test error: {e}")
        return jsonify({
            "success": False,
            "error": f"Font test failed: {str(e)}"
        }), 500


@app.route("/api/enhancements/music/library", methods=["GET"])
def get_music_library():
    """Get music library tracks and statistics"""
    try:
        from backend.music_library import MusicLibrary
        
        library = MusicLibrary()
        stats = library.get_library_stats()
        
        # Get available tracks by category
        tracks_by_category = {}
        for category, track_ids in library.categories.items():
            tracks_by_category[category.value] = [
                {
                    'id': tid,
                    'title': library.tracks[tid].title,
                    'artist': library.tracks[tid].artist,
                    'duration': library.tracks[tid].duration,
                    'bpm': library.tracks[tid].bpm,
                    'mood': library.tracks[tid].mood.value,
                    'usage_count': library.tracks[tid].usage_count,
                    'file_path': library.tracks[tid].path,
                    'filename': library.tracks[tid].filename,
                    'file_size_mb': library.tracks[tid].file_size_mb,
                    'category': library.tracks[tid].category.value
                }
                for tid in track_ids if tid in library.tracks
            ]
        
        return jsonify({
            "success": True,
            "stats": stats,
            "tracks_by_category": tracks_by_category,
            "categories": [cat.value for cat in library.categories.keys()]
        })
        
    except Exception as e:
        logger.error(f"Music library API error: {e}")
        return jsonify({"error": f"Failed to get music library: {str(e)}"}), 500


@app.route("/api/enhancements/music/upload", methods=["POST"])
def upload_music_track():
    """Upload a new music track to the library"""
    try:
        from backend.music_library import MusicLibrary, MusicCategory, MusicMood
        
        if 'music_file' not in request.files:
            return jsonify({"error": "No music file provided"}), 400
        
        music_file = request.files['music_file']
        if music_file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        # Get metadata from form
        metadata = {
            'title': request.form.get('title', music_file.filename.rsplit('.', 1)[0]),
            'artist': request.form.get('artist', 'Unknown'),
            'category': request.form.get('category', 'upbeat_energy'),
            'mood': request.form.get('mood', 'energetic')
        }
        
        # Save to temporary location first
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as temp_file:
            music_file.save(temp_file.name)
            
            # Add to library
            library = MusicLibrary()
            track = library.add_track(temp_file.name, metadata)
            
            return jsonify({
                "success": True,
                "track": {
                    'id': track.id,
                    'title': track.title,
                    'artist': track.artist,
                    'category': track.category.value,
                    'mood': track.mood.value,
                    'duration': track.duration,
                    'bpm': track.bpm
                }
            })
            
    except Exception as e:
        logger.error(f"Music upload API error: {e}")
        return jsonify({"error": f"Failed to upload music: {str(e)}"}), 500


@app.route("/api/enhancements/music/delete", methods=["DELETE"])
def delete_music_tracks():
    """Delete music tracks from the library"""
    try:
        from backend.music_library import MusicLibrary
        
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        track_ids = data.get('track_ids', [])
        if not track_ids:
            return jsonify({"error": "No track IDs provided"}), 400
        
        library = MusicLibrary()
        
        # Delete multiple tracks
        if len(track_ids) > 1:
            results = library.delete_multiple_tracks(track_ids)
            
            # Count successes and failures
            successes = sum(1 for success in results.values() if success)
            failures = len(track_ids) - successes
            
            return jsonify({
                "success": failures == 0,
                "results": results,
                "summary": {
                    "total": len(track_ids),
                    "deleted": successes,
                    "failed": failures
                }
            })
        
        # Delete single track
        else:
            success = library.delete_track(track_ids[0])
            return jsonify({
                "success": success,
                "track_id": track_ids[0],
                "message": "Track deleted successfully" if success else "Failed to delete track"
            })
            
    except Exception as e:
        logger.error(f"Music delete API error: {e}")
        return jsonify({"error": f"Failed to delete music: {str(e)}"}), 500


@app.route("/api/enhancements/text/templates", methods=["GET"])
def get_text_templates():
    """Get available text overlay templates"""
    try:
        from backend.enhanced_video_processor import TEXT_TEMPLATES
        
        return jsonify({
            "success": True,
            "templates": TEXT_TEMPLATES
        })
        
    except Exception as e:
        logger.error(f"Text templates API error: {e}")
        return jsonify({"error": f"Failed to get text templates: {str(e)}"}), 500


@app.route("/api/enhancements/text/generate", methods=["POST"])
def generate_ai_text():
    """Generate AI-powered text overlay options"""
    try:
        from backend.whisper_service import WhisperService, WhisperConfig
        
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        transcript = data.get('transcript', '')
        product = data.get('product', '')
        emotion = data.get('emotion', 'engaging')
        
        # Get OpenAI API key from settings
        openai_api_key = None
        try:
            openai_api_key = get_setting("OPENAI_WHISPER_API_KEY")
        except:
            pass
        
        config = WhisperConfig(api_key=openai_api_key)
        service = WhisperService(config)
        
        headings = service.generate_ai_heading(transcript, product, emotion)
        
        return jsonify({
            "success": True,
            "headings": headings,
            "method_used": "api" if openai_api_key else "fallback"
        })
        
    except Exception as e:
        logger.error(f"AI text generation API error: {e}")
        return jsonify({"error": f"Failed to generate text: {str(e)}"}), 500


@app.route("/api/enhancements/captions/styles", methods=["GET"])
def get_caption_styles():
    """Get available caption styles"""
    try:
        from backend.enhanced_video_processor import CAPTION_STYLES, CaptionStyle
        
        styles = {}
        for style in CaptionStyle:
            style_def = CAPTION_STYLES[style]
            styles[style.value] = {
                'name': style.value.replace('_', ' ').title(),
                'font': style_def['font'],
                'description': f"Font: {style_def['font']}, Color: {style_def['color']}"
            }
        
        return jsonify({
            "success": True,
            "styles": styles
        })
        
    except Exception as e:
        logger.error(f"Caption styles API error: {e}")
        return jsonify({"error": f"Failed to get caption styles: {str(e)}"}), 500


@app.route("/api/enhancements/settings", methods=["GET"])
def get_enhancement_settings():
    """Get current enhancement settings"""
    try:
        from backend.enhanced_video_processor import TextPosition, CAPTION_STYLES
        from backend.music_library import MusicCategory
        
        # Get WhisperSettings
        whisper_api_key = get_setting("OPENAI_WHISPER_API_KEY", default_value="")
        
        settings = {
            "whisper": {
                "api_key_configured": bool(whisper_api_key),
                "api_key": whisper_api_key[:10] + "..." if whisper_api_key else "",
            },
            "text_overlay": {
                "available_positions": [pos.value for pos in TextPosition],
                "available_fonts": ["Montserrat-Bold", "Inter-Medium", "Impact", "NotoColorEmoji"],
                "available_animations": ["fade_in", "slide_up", "zoom_in"]
            },
            "captions": {
                "available_styles": [style.value for style in CAPTION_STYLES.keys()],
                "max_words_per_caption": 8,
                "word_timestamps_available": bool(whisper_api_key)
            },
            "music": {
                "available_categories": [cat.value for cat in MusicCategory],
                "volume_range": {"min": -40, "max": -10},
                "fade_range": {"min": 0, "max": 5}
            }
        }
        
        return jsonify({
            "success": True,
            "settings": settings
        })
        
    except Exception as e:
        logger.error(f"Enhancement settings API error: {e}")
        return jsonify({"error": f"Failed to get settings: {str(e)}"}), 500


@app.route("/api/enhancements/settings", methods=["POST"])
def update_enhancement_settings():
    """Update enhancement settings"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No settings provided"}), 400
        
        # Update Whisper API key if provided
        if 'whisper_api_key' in data:
            set_key(str(ENV_PATH), "OPENAI_WHISPER_API_KEY", data['whisper_api_key'])
        
        # Reload updated vars immediately (same as save_settings)
        load_dotenv(dotenv_path=str(ENV_PATH), override=True)
        
        return jsonify({
            "success": True,
            "message": "Settings updated successfully"
        })
        
    except Exception as e:
        logger.error(f"Enhancement settings update API error: {e}")
        return jsonify({"error": f"Failed to update settings: {str(e)}"}), 500


# ─── Optional: allow direct `python app.py` for debugging ────────────────────
if __name__ == "__main__":
    port = int(os.getenv("VIDEO_AGENT_PORT", 2026))
    app.run(host="localhost", port=port, debug=False, threaded=True)