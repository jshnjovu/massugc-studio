"""
Splice Campaign Processor

Handles video generation for Splice campaigns by stitching together clips from
a source directory with AI-generated scripts and voiceovers.
"""

import os
import time
from datetime import datetime
from typing import Callable, Optional
from pathlib import Path

from .base_processor import BaseCampaignProcessor
from backend.services import FileService, TTSService, ScriptService, AudioService
from backend.clip_stitch_generator import build_clip_stitch_video


class SpliceCampaignProcessor(BaseCampaignProcessor):
    """
    Processes Splice campaigns: stitches video clips with AI voiceover.
    
    Splice campaigns combine random video clips from a source directory with
    generated scripts and TTS audio to create engaging content.
    """
    
    def get_required_fields(self) -> list[str]:
        """Get required configuration fields for Splice campaigns."""
        return [
            'product', 'persona', 'setting', 'emotion', 'hook',
            'elevenlabs_voice_id', 'example_script_file',
            'openai_api_key', 'elevenlabs_api_key', 'output_path'
        ]
    
    def validate_config(self, job_config: dict) -> tuple[bool, str]:
        """
        Validate Splice campaign configuration.
        
        Args:
            job_config: Campaign configuration dictionary
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Validate required fields
        is_valid, error = self._validate_required_fields(job_config)
        if not is_valid:
            return False, error
        
        # Validate splice-specific settings
        splice_settings = job_config.get('random_video_settings') or {}
        source_dir = splice_settings.get('source_directory', '')
        
        if not source_dir:
            return False, "Splice source directory is required"
        
        is_valid, error = FileService.validate_directory_exists(source_dir, "Splice source directory")
        if not is_valid:
            return False, error
        
        # Validate script file if provided
        script_file = job_config.get('example_script_file')
        if script_file:
            is_valid, error = FileService.validate_file_exists(script_file, "Script file")
            if not is_valid:
                return False, error
        
        return True, ""
    
    def process(
        self,
        job_config: dict,
        progress_callback: Optional[Callable[[int, int, str], None]] = None
    ) -> tuple[bool, str]:
        """
        Process Splice campaign and generate video.
        
        Args:
            job_config: Campaign configuration dictionary
            progress_callback: Optional callback for progress updates
            
        Returns:
            Tuple of (success, output_path_or_error_message)
        """
        job_name = job_config.get('job_name', 'Splice_Job')
        
        steps = [
            "Initialization",
            "Reading script",
            "Generating script with AI",
            "Generating voiceover audio",
            "Stitching video clips",
            "Applying video effects",
            "Adding product overlay",
            "Finalizing output"
        ]
        total_steps = len(steps)
        step = 0
        
        if not progress_callback:
            progress_callback = lambda s, t, m: None
        
        print(f"\n=== Starting Splice Campaign: {job_name} [{datetime.now().isoformat()}] ===")
        job_start = time.time()
        
        temp_audio_path = None
        
        try:
            # Step 1: Initialization
            progress_callback(step, total_steps, steps[step])
            step += 1
            
            # Extract configuration
            product = job_config['product']
            persona = job_config['persona']
            setting = job_config['setting']
            emotion = job_config['emotion']
            hook = job_config['hook']
            voice_id = job_config['elevenlabs_voice_id']
            
            openai_key = job_config['openai_api_key']
            elevenlabs_key = job_config['elevenlabs_api_key']
            output_dir = job_config['output_path']
            
            language = job_config.get('language', 'English')
            enhance_for_elevenlabs = job_config.get('enhance_for_elevenlabs', True)
            brand_name = job_config.get('brand_name', '')
            use_exact_script = job_config.get('useExactScript', False)
            
            # Splice-specific settings
            splice_settings = job_config.get('random_video_settings') or {}
            source_dir = splice_settings.get('source_directory', '')
            total_clips = splice_settings.get('total_clips')
            hook_video = splice_settings.get('hook_video')
            original_volume = splice_settings.get('original_volume', 0.6)
            voice_volume = splice_settings.get('voice_audio_volume', 1.0)
            
            print(f"[{job_name}] Configuration loaded")
            print(f"  Source directory: {source_dir}")
            print(f"  Total clips: {total_clips or 'All'}")
            print(f"  Hook video: {hook_video or 'None'}")
            
            # Step 2: Read script file
            progress_callback(step, total_steps, steps[step])
            step += 1
            
            script_file = job_config['example_script_file']
            success, script_content = ScriptService.read_script_file(script_file)
            if not success:
                return False, script_content
            
            print(f"[{job_name}] Script file loaded ({len(script_content)} characters)")
            
            # Step 3: Generate or use exact script
            progress_callback(step, total_steps, steps[step])
            step += 1
            
            if use_exact_script:
                print(f"[{job_name}] Using exact script mode")
                final_script = script_content
            else:
                print(f"[{job_name}] Generating script with AI")
                success, final_script = ScriptService.generate_script(
                    api_key=openai_key,
                    product=product,
                    persona=persona,
                    setting=setting,
                    emotion=emotion,
                    hook_guidance=hook,
                    example_script=script_content,
                    language=language,
                    enhance_for_elevenlabs=enhance_for_elevenlabs,
                    brand_name=brand_name
                )
                if not success:
                    return False, final_script
            
            print(f"[{job_name}] Script ready: {final_script[:100]}...")
            
            # Step 4: Generate audio
            progress_callback(step, total_steps, steps[step])
            step += 1
            
            print(f"[{job_name}] Generating voiceover audio")
            temp_audio_path = FileService.get_temp_audio_path(job_name)
            
            success, error = TTSService.generate_audio(
                api_key=elevenlabs_key,
                script_text=final_script,
                voice_id=voice_id,
                output_path=temp_audio_path,
                language=language
            )
            if not success:
                return False, error
            
            print(f"[{job_name}] Audio generated: {temp_audio_path}")
            
            # Step 5: Stitch video clips
            progress_callback(step, total_steps, steps[step])
            step += 1
            
            print(f"[{job_name}] Stitching video clips")
            output_path = FileService.get_output_path(product, job_name, output_dir)
            
            success, result = build_clip_stitch_video(
                random_source_dir=source_dir,
                tts_audio_path=temp_audio_path,
                output_path=output_path,
                random_count=total_clips,
                hook_video=hook_video,
                original_volume=original_volume,
                new_audio_volume=voice_volume,
                trim_if_long=True,
                extend_if_short=True,
                extensions=(".mp4", ".mov", ".mkv")
            )
            
            if not success:
                return False, f"Video stitching failed: {result}"
            
            print(f"[{job_name}] Video stitched successfully")
            
            # Step 6: Apply video effects (randomization)
            progress_callback(step, total_steps, steps[step])
            step += 1
            
            use_randomization = job_config.get('use_randomization', False)
            if use_randomization:
                print(f"[{job_name}] Applying video randomization effects")
                randomization_intensity = job_config.get('randomization_intensity', 'medium')
                
                from backend.randomizer import randomize_video
                
                randomized_path, settings = randomize_video(
                    input_path=output_path,
                    output_base_path=output_path.replace('.mp4', ''),
                    working_dir=FileService.WORKING_DIR,
                    intensity=randomization_intensity,
                    randomization_log_path=str(FileService.WORKING_DIR)
                )
                
                if randomized_path and os.path.exists(randomized_path):
                    # Replace with randomized version
                    if output_path != randomized_path:
                        try:
                            os.remove(output_path)
                        except:
                            pass
                    output_path = randomized_path
                    print(f"[{job_name}] Randomization applied")
                else:
                    print(f"[{job_name}] Randomization skipped (failed)")
            else:
                print(f"[{job_name}] Randomization not enabled")
            
            # Step 7: Add product overlay (if enabled)
            progress_callback(step, total_steps, steps[step])
            step += 1
            
            use_overlay = job_config.get('use_overlay', False)
            if use_overlay and job_config.get('product_clip_path'):
                print(f"[{job_name}] Adding product overlay")
                # TODO: Implement product overlay for Splice
                # For now, skip to avoid breakage
                print(f"[{job_name}] Product overlay not yet implemented for Splice")
            else:
                print(f"[{job_name}] Product overlay not enabled")
            
            # Step 8: Finalize
            progress_callback(step, total_steps, steps[step])
            
            duration = time.time() - job_start
            print(f"\n=== Splice Campaign Completed: {job_name} ===")
            print(f"  Duration: {duration:.2f}s")
            print(f"  Output: {output_path}")
            
            return True, output_path
            
        except Exception as e:
            error_msg = f"Splice processing failed: {str(e)}"
            print(f"ERROR [{job_name}]: {error_msg}")
            import traceback
            traceback.print_exc()
            return False, error_msg
            
        finally:
            # Cleanup temporary files
            if temp_audio_path:
                FileService.cleanup_temp_file(temp_audio_path)

