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
from backend.clip_stitch_generator import build_clip_stitch_video_smart


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
            
            # Canvas settings (NEW)
            canvas_width = splice_settings.get('canvas_width', 1080)
            canvas_height = splice_settings.get('canvas_height', 1920)
            crop_mode = splice_settings.get('crop_mode', 'center')
            
            # Voiceover settings (NEW - optional voiceover)
            use_voiceover = splice_settings.get('use_voiceover', True)
            duration_source = splice_settings.get('duration_source', 'voiceover')
            manual_target_duration = splice_settings.get('target_duration')
            
            # Per-clip duration settings (NEW)
            clip_duration_mode = splice_settings.get('clip_duration_mode', 'full')
            clip_duration_fixed = splice_settings.get('clip_duration_fixed')
            clip_duration_range = splice_settings.get('clip_duration_range')
            
            print(f"[{job_name}] Configuration loaded")
            print(f"  Source directory: {source_dir}")
            print(f"  Canvas: {canvas_width}x{canvas_height} ({crop_mode})")
            print(f"  Use voiceover: {use_voiceover}")
            print(f"  Duration source: {duration_source}")
            print(f"  Total clips: {total_clips or 'All'}")
            print(f"  Hook video: {hook_video or 'None'}")
            
            # Determine target duration based on source
            target_duration = self._determine_target_duration(
                use_voiceover, duration_source, manual_target_duration, 
                job_config.get('enhanced_settings', {})
            )
            
            # Step 2: Handle voiceover (if enabled)
            temp_audio_path = None
            
            if use_voiceover:
                # Step 2a: Read script file
                progress_callback(step, total_steps, steps[step])
                step += 1
                
                script_file = job_config['example_script_file']
                success, script_content = ScriptService.read_script_file(script_file)
                if not success:
                    return False, script_content
                
                print(f"[{job_name}] Script file loaded ({len(script_content)} characters)")
                
                # Step 2b: Generate or use exact script
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
                
                # Step 2c: Generate audio
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
            else:
                print(f"[{job_name}] Voiceover disabled - skipping script/audio generation")
                # Skip script and audio steps
                step += 3
                
                if not target_duration:
                    return False, "Manual duration required when voiceover is disabled"
            
            # Step 5: Stitch video clips with SMART processing (GPU + caching)
            progress_callback(step, total_steps, steps[step])
            step += 1
            
            print(f"[{job_name}] Stitching video clips (smart mode)")
            output_path = FileService.get_output_path(product, job_name, output_dir)
            
            success, result = build_clip_stitch_video_smart(
                random_source_dir=source_dir,
                output_path=output_path,
                canvas_width=canvas_width,
                canvas_height=canvas_height,
                crop_mode=crop_mode,
                target_duration=target_duration,  # Used if no voiceover
                tts_audio_path=temp_audio_path,  # None if voiceover disabled
                random_count=total_clips,
                hook_video=hook_video,
                original_volume=original_volume,
                new_audio_volume=voice_volume,
                clip_duration_mode=clip_duration_mode,
                clip_duration_fixed=clip_duration_fixed,
                clip_duration_range=clip_duration_range,
                extensions=(".mp4", ".mov", ".mkv", ".avi", ".hevc", ".m4v", ".webm")
            )
            
            if not success:
                return False, f"Video stitching failed: {result}"
            
            print(f"[{job_name}] Video stitched successfully (smart processing)")
            
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
            
            # Step 7: Enhanced Video Features (music, captions, text overlays)
            progress_callback(step, total_steps, "Applying enhanced features")
            step += 1
            
            enhanced_settings = job_config.get('enhanced_settings')
            if enhanced_settings:
                print(f"[{job_name}] Applying enhanced video features...")
                
                try:
                    from backend.enhanced_video_processor import EnhancedVideoProcessor, TextOverlayConfig, CaptionConfig, MusicConfig
                    from backend.enhanced_video_processor import TextPosition, CaptionStyle
                    from backend.whisper_service import WhisperService, WhisperConfig
                    from backend.music_library import MusicLibrary
                    
                    processor = EnhancedVideoProcessor()
                    
                    # Create enhanced output path
                    enhanced_output_path = output_path.replace('.mp4', '_enhanced.mp4')
                    
                    # Parse enhancement configurations (reuse Avatar logic)
                    text_configs = self._parse_text_overlays(enhanced_settings.get('text_overlays', []), job_config, openai_key)
                    caption_config = self._parse_captions(enhanced_settings.get('captions', {}))
                    music_config = self._parse_music(enhanced_settings.get('music', {}))
                    
                    # Apply enhanced video processing
                    result = processor.process_enhanced_video(
                        video_path=output_path,
                        output_path=enhanced_output_path,
                        text_configs=text_configs,
                        caption_config=caption_config,
                        music_config=music_config,
                        audio_path=temp_audio_path  # Include voiceover if exists
                    )
                    
                    if result.get('success'):
                        # Replace with enhanced version
                        os.replace(enhanced_output_path, output_path)
                        print(f"[{job_name}] Enhanced features applied successfully")
                    else:
                        error = result.get('error', 'Unknown enhanced processing error')
                        print(f"[{job_name}] Enhanced features failed: {error}")
                        # Continue with non-enhanced video
                        
                except Exception as e:
                    print(f"[{job_name}] Enhanced processing failed: {str(e)}")
                    # Continue with non-enhanced video
                    import traceback
                    traceback.print_exc()
            else:
                print(f"[{job_name}] No enhanced features configured")
            
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
    
    def _parse_text_overlays(self, text_overlays_data, job_config, openai_api_key):
        """Parse text overlay configurations from frontend format."""
        text_configs = []
        
        if not text_overlays_data or not isinstance(text_overlays_data, list):
            return text_configs
        
        for overlay_index, text_overlay in enumerate(text_overlays_data, 1):
            if not text_overlay.get('enabled'):
                continue
                
            # Handle text generation modes
            text = text_overlay.get('custom_text', text_overlay.get('text', ''))
            mode = text_overlay.get('mode', 'custom')
            
            if mode == 'ai_generated':
                try:
                    from backend.whisper_service import WhisperService, WhisperConfig
                    whisper_service = WhisperService(WhisperConfig(api_key=openai_api_key))
                    product = job_config.get('product', 'Product')
                    emotion = job_config.get('emotion', 'excited')
                    headings = whisper_service.generate_ai_heading(product, product=product, emotion=emotion)
                    text = headings[0] if headings else "Amazing discovery! 🤯"
                except Exception as e:
                    print(f"AI text generation failed: {e}")
                    text = "Amazing discovery! 🤯"
                    
            elif mode == 'random_from_pool':
                try:
                    from backend.enhanced_video_processor import TEXT_TEMPLATES
                    import random
                    category = text_overlay.get('category', 'engagement')
                    text = random.choice(TEXT_TEMPLATES.get(category, TEXT_TEMPLATES['engagement']))
                except Exception as e:
                    print(f"Random text selection failed: {e}")
                    text = "Amazing discovery! 🤯"
            
            # Import TextOverlayConfig here
            from backend.enhanced_video_processor import TextOverlayConfig, TextPosition
            
            text_config = TextOverlayConfig(
                text=text or "Text",  # Ensure text is never None
                position=TextPosition(text_overlay.get('position') or 'top_center'),
                font_family=text_overlay.get('font') or 'Montserrat-Bold',
                font_size=text_overlay.get('font_size') or 20,
                scale=(text_overlay.get('scale') or 60) / 100.0,
                color=text_overlay.get('color') or 'white',
                animation=text_overlay.get('animation') or 'fade_in',
                connected_background_enabled=bool(text_overlay.get('connected_background_data')),
                connected_background_data=text_overlay.get('connected_background_data'),
                hasBackground=text_overlay.get('hasBackground', True)
            )
            
            text_configs.append(text_config)
            
        return text_configs
    
    def _parse_captions(self, captions_data):
        """Parse caption configuration from frontend format."""
        if not captions_data or not captions_data.get('enabled'):
            return None
            
        from backend.enhanced_video_processor import CaptionConfig, CaptionStyle
        
        return CaptionConfig(
            enabled=True,
            style=CaptionStyle(captions_data.get('style', 'modern_pop')),
            fontSize=captions_data.get('fontSize', 24),
            fontFamily=captions_data.get('fontFamily', 'Montserrat-Bold'),
            color=captions_data.get('color', 'white'),
            x_position=captions_data.get('x_position', 50.0),
            y_position=captions_data.get('y_position', 85.0),
            hasStroke=captions_data.get('hasStroke', True),
            strokeColor=captions_data.get('strokeColor', 'black'),
            strokeWidth=captions_data.get('strokeWidth', 2),
            hasBackground=captions_data.get('hasBackground', False),
            backgroundColor=captions_data.get('backgroundColor', 'black@0.8'),
            backgroundOpacity=captions_data.get('backgroundOpacity', 0.8),
            animation=captions_data.get('animation', 'fade'),
            max_words_per_segment=captions_data.get('max_words_per_segment', 4),
            allCaps=captions_data.get('allCaps', False)
        )
    
    def _parse_music(self, music_data):
        """Parse music configuration from frontend format."""
        if not music_data or not music_data.get('enabled'):
            return None
            
        from backend.enhanced_video_processor import MusicConfig
        
        return MusicConfig(
            enabled=True,
            track_id=music_data.get('track_id'),
            volume=music_data.get('volume', 1.0),
            fade_duration=music_data.get('fade_duration', 2.0),
            duck_voice=music_data.get('duck_voice', True)
        )
    
    def _determine_target_duration(self, use_voiceover, duration_source, manual_duration, enhanced_settings):
        """
        Determine target video duration based on source (voiceover/music/manual).
        
        Args:
            use_voiceover: Whether voiceover is enabled
            duration_source: 'voiceover', 'music', or 'manual'
            manual_duration: Manual duration if specified
            enhanced_settings: Enhanced settings containing music config
            
        Returns:
            Target duration in seconds, or None if voiceover will determine it
        """
        if duration_source == 'music':
            # Get duration from selected music track
            music_settings = enhanced_settings.get('music', {})
            if music_settings.get('enabled') and music_settings.get('track_id'):
                try:
                    from backend.music_library import MusicLibrary
                    library = MusicLibrary()
                    track = library.get_track_by_id(music_settings['track_id'])
                    if track:
                        print(f"  Using music duration: {track['duration']}s")
                        return track['duration']
                    else:
                        print(f"  Warning: Music track not found, using manual duration")
                        return manual_duration or 30.0
                except Exception as e:
                    print(f"  Warning: Could not get music duration: {e}")
                    return manual_duration or 30.0
            else:
                print(f"  Warning: Music duration source selected but no track configured")
                return manual_duration or 30.0
        
        elif duration_source == 'voiceover' and use_voiceover:
            # Voiceover duration will be determined later when TTS is generated
            print(f"  Using voiceover duration (TBD)")
            return None  # Let TTS determine
        
        else:  # manual or fallback
            duration = manual_duration or 30.0
            print(f"  Using manual duration: {duration}s")
            return duration

