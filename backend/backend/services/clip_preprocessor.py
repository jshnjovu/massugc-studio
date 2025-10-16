"""
Clip Preprocessor Service

Intelligently normalizes video clips with minimal re-encoding.
Uses GPU acceleration and caching for professional-grade performance.
"""

import os
import subprocess
import uuid
from pathlib import Path
from typing import List, Tuple, Optional
import imageio_ffmpeg

from backend.services.clip_analyzer import ClipAnalyzer
from backend.services.gpu_detector import GPUEncoder
from backend.services.clip_cache import ClipCache


class ClipPreprocessor:
    """
    Normalizes clips to target canvas with intelligent optimization.
    
    Key Features:
    - Only processes clips that need it
    - Uses GPU acceleration when available
    - Caches results for instant re-runs
    - Stream copies compatible clips
    """
    
    WORKING_DIR = Path.home() / ".zyra-video-agent" / "working-dir"
    
    @classmethod
    def normalize_clips(
        cls,
        clips: List[str],
        canvas_width: int,
        canvas_height: int,
        crop_mode: str = 'center',
        audio_mode: str = 'keep'
    ) -> Tuple[List[str], dict]:
        """
        Normalize all clips to target canvas size with audio-aware processing.
        
        Args:
            clips: List of source clip paths
            canvas_width: Target width
            canvas_height: Target height
            crop_mode: How to crop ('center', 'fill', 'fit')
            audio_mode: Audio handling mode:
                       'keep' - Preserve/add audio for mixing
                       'strip' - Remove all audio (original_volume=0)
            
        Returns:
            Tuple of (normalized_clip_paths, processing_stats)
        """
        cls.WORKING_DIR.mkdir(parents=True, exist_ok=True)
        
        print(f"\n🎬 Normalizing {len(clips)} clips to {canvas_width}x{canvas_height}...")
        
        # Step 1: Analyze clips
        compatible, needs_resize, needs_convert = ClipAnalyzer.analyze_clips(
            clips, canvas_width, canvas_height
        )
        
        # Step 2: Detect GPU encoder
        gpu_encoder = GPUEncoder.detect_available_encoder()
        
        normalized_clips = []
        stats = {
            'total': len(clips),
            'compatible': len(compatible),
            'resized': 0,
            'converted': 0,
            'cached_hits': 0,
            'processing_time': 0
        }
        
        import time
        start_time = time.time()
        
        # Step 3: Process each category
        
        # Compatible clips - use as-is (NO processing)
        for clip in compatible:
            normalized_clips.append(clip)
        
        # Clips needing resize - fast GPU resize
        for clip in needs_resize:
            # Check cache first
            cached = ClipCache.get_cached_clip(clip, canvas_width, canvas_height, crop_mode, audio_mode)
            if cached:
                normalized_clips.append(cached)
                stats['cached_hits'] += 1
            else:
                # Resize with GPU
                normalized = cls._resize_clip(
                    clip, canvas_width, canvas_height, crop_mode, gpu_encoder, audio_mode
                )
                if normalized:
                    # Cache the result
                    cached = ClipCache.cache_clip(clip, normalized, canvas_width, canvas_height, crop_mode, audio_mode)
                    normalized_clips.append(cached)
                    stats['resized'] += 1
                else:
                    print(f"   ⚠️ Resize failed for {Path(clip).name}, using original")
                    normalized_clips.append(clip)
        
        # Clips needing full conversion
        for clip in needs_convert:
            # Check cache first
            cached = ClipCache.get_cached_clip(clip, canvas_width, canvas_height, crop_mode, audio_mode)
            if cached:
                normalized_clips.append(cached)
                stats['cached_hits'] += 1
            else:
                # Full conversion with GPU
                normalized = cls._convert_clip(
                    clip, canvas_width, canvas_height, crop_mode, gpu_encoder, audio_mode
                )
                if normalized:
                    # Cache the result
                    cached = ClipCache.cache_clip(clip, normalized, canvas_width, canvas_height, crop_mode, audio_mode)
                    normalized_clips.append(cached)
                    stats['converted'] += 1
                else:
                    print(f"   ⚠️ Conversion failed for {Path(clip).name}, using original")
                    normalized_clips.append(clip)
        
        stats['processing_time'] = time.time() - start_time
        
        print(f"\n✅ Normalization complete:")
        print(f"   ⚡ Processed in {stats['processing_time']:.1f}s")
        print(f"   💾 Cache hits: {stats['cached_hits']}")
        print(f"   🔄 Resized: {stats['resized']}")
        print(f"   🔄 Converted: {stats['converted']}\n")
        
        return normalized_clips, stats
    
    @classmethod
    def _resize_clip(
        cls,
        clip_path: str,
        canvas_w: int,
        canvas_h: int,
        crop_mode: str,
        gpu_encoder: str,
        audio_mode: str = 'keep'
    ) -> Optional[str]:
        """
        Resize clip to target canvas with audio-aware processing and PTS synchronization.
        
        Args:
            clip_path: Source clip
            canvas_w: Target width
            canvas_h: Target height
            crop_mode: Crop mode
            gpu_encoder: GPU encoder to use
            audio_mode: Audio handling mode ('keep' or 'strip')
            
        Returns:
            Path to resized clip, or None if failed
        """
        output_path = str(cls.WORKING_DIR / f"resized_{uuid.uuid4().hex[:8]}.mp4")
        
        # Build video filter with constant frame rate and PTS reset
        vf = cls._build_video_filter(canvas_w, canvas_h, crop_mode)
        vf = f"{vf},fps=30,setpts=PTS-STARTPTS"  # Lock to 30 FPS, then reset timestamps
        
        # Get GPU encoding params
        video_params = GPUEncoder.get_encode_params(gpu_encoder, quality='balanced')
        
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        
        # Build base command with clean timestamp generation
        cmd = [
            ffmpeg_exe, '-y',
            '-fflags', '+genpts',  # Generate clean presentation timestamps
            '-i', clip_path,
        ]
        
        # Handle audio based on mode
        if audio_mode == 'strip':
            # Strip all audio - user wants voiceover only (original_volume=0)
            print(f"   🔇 Stripping all audio (voiceover-only mode)")
            
        else:  # audio_mode == 'keep'
            # Check if clip has audio stream
            has_audio_stream, _ = cls._clip_has_audio(clip_path)
            
            if not has_audio_stream:
                # Add silent audio for clips without audio
                print(f"   🔇 No audio stream, adding silent track")
                cmd.extend(['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100'])
        
        # Apply video filter
        cmd.extend(['-vf', vf, *video_params])
        
        # Audio encoding based on mode
        if audio_mode == 'strip':
            # No audio in output
            cmd.extend(['-an'])
            
        elif audio_mode == 'keep':
            # Determine if we're using original or generated audio
            has_audio_stream, _ = cls._clip_has_audio(clip_path)
            
            if not has_audio_stream:
                # Map generated silent audio with PTS reset
                cmd.extend([
                    '-map', '0:v',  # Video from input 0
                    '-map', '1:a',  # Audio from input 1 (generated)
                    '-af', 'asetpts=PTS-STARTPTS',  # Reset audio timestamps
                    '-c:a', 'aac', '-b:a', '128k',
                    '-shortest'  # Stop when video ends
                ])
            else:
                # Keep original audio with PTS reset
                cmd.extend([
                    '-af', 'asetpts=PTS-STARTPTS',  # Reset audio timestamps
                    '-c:a', 'aac', '-b:a', '128k'
                ])
        
        cmd.extend(['-movflags', '+faststart', output_path])
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=300)
            
            if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                return output_path
            return None
            
        except subprocess.CalledProcessError as e:
            print(f"   ⚠️ Resize failed with exit code {e.returncode}")
            if e.stderr:
                # Show first error line only
                error_lines = [l for l in e.stderr.split('\n') if l.strip() and 'error' in l.lower()]
                if error_lines:
                    print(f"   FFmpeg error: {error_lines[0][:200]}")
            if os.path.exists(output_path):
                os.remove(output_path)
            return None
            
        except Exception as e:
            print(f"   ⚠️ Resize failed: {e}")
            if os.path.exists(output_path):
                os.remove(output_path)
            return None
    
    @classmethod
    def _convert_clip(
        cls,
        clip_path: str,
        canvas_w: int,
        canvas_h: int,
        crop_mode: str,
        gpu_encoder: str,
        audio_mode: str = 'keep'
    ) -> Optional[str]:
        """
        Full conversion of clip with audio-aware processing and PTS synchronization.
        
        Args:
            clip_path: Source clip
            canvas_w: Target width
            canvas_h: Target height
            crop_mode: Crop mode
            gpu_encoder: GPU encoder to use
            audio_mode: Audio handling mode ('keep' or 'strip')
            
        Returns:
            Path to converted clip, or None if failed
        """
        output_path = str(cls.WORKING_DIR / f"converted_{uuid.uuid4().hex[:8]}.mp4")
        
        # Build video filter with constant frame rate and PTS reset
        vf = cls._build_video_filter(canvas_w, canvas_h, crop_mode)
        vf = f"{vf},fps=30,setpts=PTS-STARTPTS"  # Lock to 30 FPS, then reset timestamps
        
        # Get GPU encoding params
        video_params = GPUEncoder.get_encode_params(gpu_encoder, quality='balanced')
        
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        
        # Build base command with clean timestamp generation
        cmd = [
            ffmpeg_exe, '-y',
            '-fflags', '+genpts',  # Generate clean presentation timestamps
            '-i', clip_path,
        ]
        
        # Handle audio based on mode
        if audio_mode == 'strip':
            # Strip all audio - user wants voiceover only (original_volume=0)
            print(f"   🔇 Stripping all audio (voiceover-only mode)")
            
        else:  # audio_mode == 'keep'
            # Check if clip has audio stream
            has_audio_stream, _ = cls._clip_has_audio(clip_path)
            
            if not has_audio_stream:
                # Add silent audio for clips without audio
                print(f"   🔇 No audio stream, adding silent track")
                cmd.extend(['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100'])
        
        # Apply video filter
        cmd.extend(['-vf', vf, *video_params])
        
        # Audio encoding based on mode
        if audio_mode == 'strip':
            # No audio in output
            cmd.extend(['-an'])
            
        elif audio_mode == 'keep':
            # Determine if we're using original or generated audio
            has_audio_stream, _ = cls._clip_has_audio(clip_path)
            
            if not has_audio_stream:
                # Map generated silent audio with PTS reset
                cmd.extend([
                    '-map', '0:v',  # Video from input 0
                    '-map', '1:a',  # Audio from input 1 (generated)
                    '-af', 'asetpts=PTS-STARTPTS',  # Reset audio timestamps
                    '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
                    '-shortest'  # Stop when video ends
                ])
            else:
                # Keep original audio with PTS reset
                cmd.extend([
                    '-af', 'asetpts=PTS-STARTPTS',  # Reset audio timestamps
                    '-c:a', 'aac', '-b:a', '128k', '-ar', '44100'
                ])
        
        cmd.extend([
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart',
            output_path
        ])
        
        try:
            # Convert with audio (tolerate AAC warnings)
            result = subprocess.run(cmd, capture_output=True, check=True, timeout=600)
            
            if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                # Verify it's actually a video (not just a single frame)
                verify_cmd = [
                    ffmpeg_exe,
                    '-v', 'error',
                    '-count_frames',
                    '-select_streams', 'v:0',
                    '-show_entries', 'stream=nb_read_frames',
                    '-of', 'default=nokey=1:noprint_wrappers=1',
                    output_path
                ]
                verify_result = subprocess.run(verify_cmd, capture_output=True, text=True, check=False)
                try:
                    frame_count = int(verify_result.stdout.strip() or 0)
                except:
                    frame_count = 999  # Assume success if can't verify
                
                if frame_count < 5 and frame_count > 0:
                    print(f"   ⚠️ Conversion produced single frame/image (only {frame_count} frames)")
                    os.remove(output_path)
                    return None
                
                print(f"   ✅ Conversion successful")
                return output_path
            return None
            
        except subprocess.CalledProcessError as e:
            print(f"   ⚠️ Conversion failed completely: {e}")
            if os.path.exists(output_path):
                os.remove(output_path)
            return None
        except Exception as e:
            print(f"   ⚠️ Conversion error: {e}")
            if os.path.exists(output_path):
                os.remove(output_path)
            return None
    
    @classmethod
    def _build_video_filter(cls, width: int, height: int, crop_mode: str) -> str:
        """
        Build FFmpeg video filter for resize/crop.
        
        Args:
            width: Target width
            height: Target height
            crop_mode: 'center', 'fill', or 'fit'
            
        Returns:
            FFmpeg video filter string
        """
        if crop_mode == 'fill':
            # Scale to cover entire canvas, then crop center
            return f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height}"
        
        elif crop_mode == 'fit':
            # Scale to fit inside canvas, add black bars if needed
            return f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2"
        
        else:  # center (default)
            # Scale and center crop
            return f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height}"
    
    @classmethod
    def _clip_has_audio(cls, clip_path: str) -> Tuple[bool, bool]:
        """
        Check if clip has an audio stream and if that audio is actually silent.
        
        Args:
            clip_path: Path to video clip
            
        Returns:
            Tuple of (has_audio_stream, is_silent)
        """
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        
        # Use ffmpeg to probe the file - audio info appears in stderr
        cmd = [
            ffmpeg_exe,
            '-i', clip_path,
            '-f', 'null',
            '-'
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=False, timeout=10)
            
            # FFmpeg outputs stream info to stderr
            stderr_output = result.stderr
            stderr_lower = stderr_output.lower()
            
            # Look specifically for "Stream #X:Y: Audio:" or "Stream #X:Y(lang): Audio:"
            import re
            audio_stream_pattern = r'stream\s+#\d+:\d+.*?:\s*audio\s*:'
            has_audio_stream = bool(re.search(audio_stream_pattern, stderr_lower))
            
            # Check if audio is completely silent by looking for very low bitrate
            # Silent/null audio typically shows as < 10 kb/s
            is_silent = False
            if has_audio_stream:
                # Look for bitrate in audio stream line
                for line in stderr_output.split('\n'):
                    if 'audio:' in line.lower() and 'stream #' in line.lower():
                        # Extract bitrate (format: "X kb/s" or "X.X kb/s")
                        bitrate_match = re.search(r'(\d+(?:\.\d+)?)\s*kb/s', line.lower())
                        if bitrate_match:
                            bitrate = float(bitrate_match.group(1))
                            # Very low bitrate suggests silent/minimal audio
                            if bitrate < 10:
                                is_silent = True
            
            # Debug logging - show relevant stream info
            print(f"   🔍 Audio detection for {Path(clip_path).name}: has_stream={has_audio_stream}, is_silent={is_silent}")
            
            # Extract and show stream lines for debugging
            stream_lines = [line.strip() for line in stderr_output.split('\n') if 'Stream #' in line]
            if stream_lines:
                for line in stream_lines[:3]:  # Show first 3 streams
                    print(f"      Stream: {line[:100]}")
            
            return has_audio_stream, is_silent
            
        except Exception as e:
            print(f"   ⚠️ Audio detection error: {e}")
            # Default to True (assume has audio) to avoid breaking existing clips
            return True, False

