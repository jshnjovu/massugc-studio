"""
Avatar Campaign Processor

Handles video generation for Avatar campaigns using AI-powered lip-sync technology.
"""

from typing import Callable, Optional

from .base_processor import BaseCampaignProcessor
from backend.services import FileService
from backend.create_video import create_video_job


class AvatarCampaignProcessor(BaseCampaignProcessor):
    """
    Processes Avatar campaigns: generates lip-synced videos with AI avatars.
    
    Avatar campaigns use Dreamface API to create realistic lip-synced videos
    from avatar footage and generated voiceover audio.
    """
    
    def get_required_fields(self) -> list[str]:
        """Get required configuration fields for Avatar campaigns."""
        return [
            'product', 'persona', 'setting', 'emotion', 'hook',
            'elevenlabs_voice_id', 'avatar_video_path', 'example_script_file',
            'openai_api_key', 'elevenlabs_api_key', 'dreamface_api_key',
            'gcs_bucket_name', 'output_path'
        ]
    
    def validate_config(self, job_config: dict) -> tuple[bool, str]:
        """
        Validate Avatar campaign configuration.
        
        Args:
            job_config: Campaign configuration dictionary
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Validate required fields
        is_valid, error = self._validate_required_fields(job_config)
        if not is_valid:
            return False, error
        
        # Validate avatar video file
        avatar_path = job_config.get('avatar_video_path')
        if avatar_path:
            is_valid, error = FileService.validate_file_exists(avatar_path, "Avatar video")
            if not is_valid:
                return False, error
        
        # Validate script file
        script_file = job_config.get('example_script_file')
        if script_file:
            is_valid, error = FileService.validate_file_exists(script_file, "Script file")
            if not is_valid:
                return False, error
        
        # Validate API keys
        required_keys = ['openai_api_key', 'elevenlabs_api_key', 'dreamface_api_key']
        is_valid, error = self._validate_api_keys(job_config, required_keys)
        if not is_valid:
            return False, error
        
        return True, ""
    
    def process(
        self,
        job_config: dict,
        progress_callback: Optional[Callable[[int, int, str], None]] = None
    ) -> tuple[bool, str]:
        """
        Process Avatar campaign and generate video.
        
        This delegates to the existing create_video_job function which handles:
        - Script generation with OpenAI
        - Audio generation with ElevenLabs
        - GCS upload for assets
        - Dreamface lip-sync processing
        - Video randomization and effects
        - Product overlay
        - Silence removal
        
        Args:
            job_config: Campaign configuration dictionary
            progress_callback: Optional callback for progress updates
            
        Returns:
            Tuple of (success, output_path_or_error_message)
        """
        # Extract and read script file
        script_file = job_config.get('example_script_file')
        if not script_file:
            return False, "Script file is required"
        
        try:
            with open(script_file, 'r', encoding='utf-8') as f:
                script_content = f.read().strip()
        except Exception as e:
            return False, f"Failed to read script file: {str(e)}"
        
        # Call the existing create_video_job function with all parameters
        return create_video_job(
            # Core parameters
            product=job_config['product'],
            persona=job_config['persona'],
            setting=job_config['setting'],
            emotion=job_config['emotion'],
            hook=job_config['hook'],
            elevenlabs_voice_id=job_config['elevenlabs_voice_id'],
            avatar_video_path=job_config['avatar_video_path'],
            example_script_content=script_content,
            
            # Processing options
            remove_silence=job_config.get('remove_silence', False),
            use_randomization=job_config.get('use_randomization', False),
            randomization_intensity=job_config.get('randomization_intensity', 'medium'),
            language=job_config.get('language', 'English'),
            enhance_for_elevenlabs=job_config.get('enhance_for_elevenlabs', False),
            brand_name=job_config.get('brand_name', ''),
            use_exact_script=job_config.get('useExactScript', False),
            
            # API credentials
            openai_api_key=job_config['openai_api_key'],
            elevenlabs_api_key=job_config['elevenlabs_api_key'],
            dreamface_api_key=job_config['dreamface_api_key'],
            gcs_bucket_name=job_config['gcs_bucket_name'],
            output_path=job_config['output_path'],
            
            # Product overlay
            use_overlay=job_config.get('use_overlay', False),
            product_clip_path=job_config.get('product_clip_path'),
            trigger_keywords=job_config.get('trigger_keywords'),
            overlay_settings=job_config.get('overlay_settings'),
            
            # Enhanced video processing
            enhanced_video_settings=job_config.get('enhanced_settings'),
            
            # Job info
            job_name=job_config.get('job_name', 'Avatar_Job'),
            progress_callback=progress_callback
        )

