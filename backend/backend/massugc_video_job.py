"""
MassUGC Video Job Integration
Handles video generation using the MassUGC API with complete workflow integration.
"""

import os
import logging
import tempfile
import shutil
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, Tuple, Callable
from elevenlabs import ElevenLabs
from openai import OpenAI

from massugc_api_client import create_massugc_client, MassUGCApiError,MassUGCApiClient, MassUGCApiKeyManager


logger = logging.getLogger(__name__)

def _log_video_generation_to_massugc_system(client: 'MassUGCApiClient', job_data: Dict[str, Any]):
    """
    Send video generation data to the other MassUGC system for tracking/logging.
    This ensures all jobs are logged and tracked properly.
    
    Args:
        client: MassUGC API client instance
        job_data: Dictionary containing job information to log
    """
    try:
        # Log the video generation to the MassUGC tracking system
        logging_payload = {
            "event_type": "video_generation",
            "job_data": job_data,
            "timestamp": datetime.now().isoformat(),
            "source": "massugc-video-service",
            "version": "1.0.0"
        }
        
        # Send to MassUGC logging endpoint
        client.log_usage_data(logging_payload)
        
        logger.info(f"Successfully logged video generation for job: {job_data.get('job_name', 'unknown')}")
        
    except Exception as e:
        logger.error(f"Failed to log video generation data: {e}")
        raise

async def create_massugc_video_job(
    job_name: str,
    product: str,
    persona: str,
    setting: str,
    emotion: str,
    hook: str,
    elevenlabs_voice_id: str,
    example_script_content: str,
    language: str = "English",
    enhance_for_elevenlabs: bool = False,
    brand_name: str = "",
    remove_silence: bool = True,
    massugc_settings: Dict[str, Any] = None,
    openai_api_key: str = None,
    elevenlabs_api_key: str = None,
    output_path: str = None,
    progress_callback: Optional[Callable] = None
) -> Tuple[bool, str]:
    """
    Create a video job using MassUGC API integration
    
    Args:
        job_name: Name of the job
        product: Product name
        persona: Creator persona
        setting: Video setting
        emotion: Emotional tone
        hook: Hook guidance
        elevenlabs_voice_id: ElevenLabs voice ID for audio generation
        example_script_content: Script content to use
        language: Language for generation
        enhance_for_elevenlabs: Whether to enhance script for ElevenLabs
        brand_name: Brand name
        remove_silence: Whether to remove silence from audio
        massugc_settings: MassUGC-specific settings
        openai_api_key: OpenAI API key
        elevenlabs_api_key: ElevenLabs API key
        output_path: Output directory path
        progress_callback: Progress callback function
    
    Returns:
        Tuple of (success, output_path_or_error_message)
    """
    
    if not massugc_settings:
        return False, "MassUGC settings are required"
    
    if not progress_callback:
        progress_callback = lambda step, total, msg: None
    
    try:
        progress_callback(1, 10, "Initializing MassUGC video generation...")
        
        # Get MassUGC API key
        config_dir = Path.home() / ".zyra-video-agent"
        api_key_manager = MassUGCApiKeyManager(config_dir)
        
        api_key = api_key_manager.get_api_key()
        if not api_key:
            return False, "No MassUGC API key configured. Please set up your API key in settings."
        
        # Initialize MassUGC client
        client = create_massugc_client(api_key)
        client.initialize()
        
        progress_callback(2, 10, "Generating audio from script...")
        
        # Generate audio using ElevenLabs
        if not elevenlabs_api_key:
            return False, "ElevenLabs API key is required for audio generation"
        
        # Initialize ElevenLabs client
        eleven_client = ElevenLabs(api_key=elevenlabs_api_key)
        
        # Use the example script content directly
        script_text = example_script_content
        
        # Generate audio
        try:
            audio = eleven_client.generate(
                text=script_text,
                voice=elevenlabs_voice_id,
                model="eleven_multilingual_v2" if language != "English" else "eleven_monolingual_v1"
            )
        except Exception as e:
            logger.error(f"Audio generation failed: {e}")
            return False, f"Audio generation failed: {str(e)}"
        
        progress_callback(3, 10, "Preparing files for MassUGC API...")
        
        # Create temporary directory for processing
        temp_dir = Path(tempfile.mkdtemp(prefix="massugc_job_"))
        
        try:
            # Save audio to temporary file
            audio_path = temp_dir / f"audio_{job_name.replace(' ', '_')}.mp3"
            with open(audio_path, 'wb') as f:
                f.write(audio)
            
            # Get avatar image from settings
            avatar_image_path = massugc_settings.get("avatar_image_path")
            if not avatar_image_path or not Path(avatar_image_path).exists():
                return False, f"Avatar image not found: {avatar_image_path}"
            
            progress_callback(4, 10, "Uploading to MassUGC API...")
            
            # Prepare options for MassUGC API
            api_options = {
                "job_name": job_name,
                "product": product,
                "persona": persona,
                "setting": setting,
                "emotion": emotion,
                "hook": hook,
                "brand_name": brand_name,
                "language": language
            }
            
            # Add any additional MassUGC-specific options
            if "quality" in massugc_settings:
                api_options["quality"] = massugc_settings["quality"]
            if "style" in massugc_settings:
                api_options["style"] = massugc_settings["style"]
            
            # Generate video using MassUGC API
            generation_result = client.generate_video(
                str(audio_path),
                avatar_image_path,
                api_options
            )
            
            job_id = generation_result.get("jobId")
            if not job_id:
                return False, "Failed to get job ID from MassUGC API"
            
            progress_callback(5, 10, f"Video generation started (Job ID: {job_id})")
            
            # Poll for completion with progress updates
            def poll_progress_callback(status_data):
                job_status = status_data.get("status", "unknown")
                progress_percent = status_data.get("progress", 0)
                
                if job_status == "processing":
                    # Map MassUGC progress to our scale (50-90%)
                    mapped_progress = 5 + int(progress_percent * 0.4)  # 5-45% of our scale
                    progress_callback(mapped_progress, 10, f"Processing video... {progress_percent}%")
                elif job_status == "completed":
                    progress_callback(9, 10, "Video generation completed, downloading...")
            
            # Poll for completion
            final_status = client.poll_job_completion(
                job_id, 
                progress_callback=poll_progress_callback,
                max_wait_time=600  # 10 minutes max
            )
            
            if final_status.get("status") != "completed":
                error_msg = final_status.get("error", "Video generation failed")
                return False, f"MassUGC generation failed: {error_msg}"
            
            progress_callback(9, 10, "Downloading generated video...")
            
            # Download the generated video
            output_url = final_status.get("outputUrl")
            if not output_url:
                return False, "No output URL provided by MassUGC API"
            
            # Download the video file
            import requests
            response = requests.get(output_url, timeout=60)
            response.raise_for_status()
            
            # Determine output path
            if not output_path:
                output_path = str(Path.home() / "Downloads")
            
            output_dir = Path(output_path)
            output_dir.mkdir(parents=True, exist_ok=True)
            
            # Create unique filename
            timestamp = int(asyncio.get_event_loop().time())
            output_filename = f"massugc_{job_name.replace(' ', '_')}_{timestamp}.mp4"
            final_output_path = output_dir / output_filename
            
            # Save the video file
            with open(final_output_path, 'wb') as f:
                f.write(response.content)
            
            progress_callback(10, 10, f"Video saved successfully: {final_output_path}")
            
            # Send usage data to the other MassUGC system for tracking/logging
            try:
                _log_video_generation_to_massugc_system(
                    client=client,
                    job_data={
                        "job_name": job_name,
                        "product": product,
                        "persona": persona,
                        "setting": setting,
                        "emotion": emotion,
                        "hook": hook,
                        "brand_name": brand_name,
                        "language": language,
                        "job_id": job_id,
                        "output_path": str(final_output_path),
                        "success": True,
                        "generation_time": datetime.now().isoformat(),
                        "file_size": final_output_path.stat().st_size
                    }
                )
            except Exception as logging_error:
                # Don't fail the job if logging fails, just log the error
                logger.warning(f"Failed to send usage data to MassUGC system: {logging_error}")
            
            logger.info(f"MassUGC video generation completed: {final_output_path}")
            return True, str(final_output_path)
            
        finally:
            # Clean up temporary directory
            try:
                shutil.rmtree(temp_dir)
            except Exception as cleanup_error:
                logger.warning(f"Failed to clean up temp directory {temp_dir}: {cleanup_error}")
    
    except MassUGCApiError as e:
        error_msg = f"MassUGC API error: {e.message}"
        logger.error(error_msg)
        
        # Provide user-friendly error messages
        if e.error_code == "invalid_api_key":
            error_msg = "Invalid MassUGC API key. Please check your key in settings."
        elif e.error_code == "insufficient_credits":
            error_msg = "Insufficient credits for video generation. Please upgrade your MassUGC plan."
        elif e.error_code == "rate_limit_exceeded":
            error_msg = "Rate limit exceeded. Please wait before trying again."
        elif e.error_code == "device_mismatch":
            error_msg = "This API key is already in use on another device."
        
        return False, error_msg
    
    except Exception as e:
        error_msg = f"MassUGC video generation failed: {str(e)}"
        logger.error(error_msg)
        return False, error_msg


def validate_massugc_settings(settings: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Validate MassUGC settings for video generation
    
    Args:
        settings: MassUGC settings dictionary
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not settings:
        return False, "MassUGC settings are required"
    
    # Check required fields
    required_fields = ["avatar_image_path"]
    for field in required_fields:
        if field not in settings:
            return False, f"Missing required field: {field}"
        
        if field == "avatar_image_path":
            image_path = settings[field]
            if not image_path or not Path(image_path).exists():
                return False, f"Avatar image file not found: {image_path}"
    
    # Validate optional fields
    if "quality" in settings:
        valid_qualities = ["standard", "high", "premium"]
        if settings["quality"] not in valid_qualities:
            return False, f"Invalid quality setting. Must be one of: {valid_qualities}"
    
    if "style" in settings:
        valid_styles = ["natural", "animated", "professional"]
        if settings["style"] not in valid_styles:
            return False, f"Invalid style setting. Must be one of: {valid_styles}"
    
    return True, ""


# Example usage and testing
if __name__ == "__main__":
    async def test_massugc_job():
        """Test MassUGC video generation"""
        
        # Test settings
        test_settings = {
            "avatar_image_path": "/path/to/avatar.jpg",
            "quality": "high",
            "style": "professional"
        }
        
        # Validate settings
        is_valid, error = validate_massugc_settings(test_settings)
        if not is_valid:
            print(f"Invalid settings: {error}")
            return
        
        # Test job creation
        success, result = await create_massugc_video_job(
            job_name="Test MassUGC Job",
            product="Test Product",
            persona="Tech Reviewer",
            setting="Studio",
            emotion="Enthusiastic",
            hook="Check this out!",
            elevenlabs_voice_id="test_voice_id",
            example_script_content="This is a test script for MassUGC integration.",
            massugc_settings=test_settings,
            openai_api_key="test_openai_key",
            elevenlabs_api_key="test_elevenlabs_key",
            output_path="/tmp/test_output"
        )
        
        if success:
            print(f"Success! Video saved to: {result}")
        else:
            print(f"Failed: {result}")
    
    # Run test
    asyncio.run(test_massugc_job())