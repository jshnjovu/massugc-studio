"""
Clip Analyzer Service

Intelligently analyzes video clips to determine optimal processing strategy.
Categorizes clips to minimize unnecessary re-encoding (CapCut/Premiere approach).
"""

import subprocess
import json
from pathlib import Path
from typing import Tuple, List, Dict, Any
import imageio_ffmpeg


class ClipAnalyzer:
    """
    Analyzes video clips and categorizes them by required processing.
    
    This is the foundation of our performance optimization - by knowing
    exactly what each clip needs, we can avoid unnecessary re-encoding.
    """
    
    @staticmethod
    def probe_clip(clip_path: str) -> Dict[str, Any]:
        """
        Use FFmpeg to extract clip metadata (fallback if FFprobe missing).
        
        Args:
            clip_path: Path to video clip
            
        Returns:
            Dictionary with codec, width, height, fps, duration
        """
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        
        # Use FFmpeg to probe (works even without FFprobe)
        cmd = [
            ffmpeg_exe,
            '-i', clip_path,
            '-f', 'null',
            '-'
        ]
        
        try:
            # FFmpeg outputs metadata to stderr
            result = subprocess.run(cmd, capture_output=True, text=True, check=False)
            stderr = result.stderr
            
            # Parse video stream info from stderr
            # Extract codec
            codec_match = subprocess.run(
                [ffmpeg_exe, '-v', 'error', '-select_streams', 'v:0', '-show_entries', 
                 'stream=codec_name,width,height,r_frame_rate,duration', '-of', 'default=noprint_wrappers=1', clip_path],
                capture_output=True, text=True, check=False
            )
            
            # Parse the output
            codec = 'unknown'
            width = 0
            height = 0
            fps = 30.0
            duration = 0.0
            
            for line in codec_match.stdout.split('\n'):
                if 'codec_name=' in line:
                    codec = line.split('=')[1].strip()
                elif 'width=' in line:
                    width = int(line.split('=')[1].strip())
                elif 'height=' in line:
                    height = int(line.split('=')[1].strip())
                elif 'r_frame_rate=' in line:
                    fps_str = line.split('=')[1].strip()
                    if '/' in fps_str:
                        num, denom = map(int, fps_str.split('/'))
                        fps = num / denom if denom != 0 else 30.0
                elif 'duration=' in line:
                    try:
                        duration = float(line.split('=')[1].strip())
                    except:
                        pass
            
            # If duration not found in stream, try format duration
            if duration == 0:
                format_result = subprocess.run(
                    [ffmpeg_exe, '-v', 'error', '-show_entries', 'format=duration', 
                     '-of', 'default=noprint_wrappers=1:nokey=1', clip_path],
                    capture_output=True, text=True, check=False
                )
                try:
                    duration = float(format_result.stdout.strip())
                except:
                    pass
            
            # Parse from stderr output as fallback
            import re
            if not codec or codec == 'unknown':
                codec_pattern = r'Video: (\w+)'
                codec_match_obj = re.search(codec_pattern, stderr)
                if codec_match_obj:
                    codec = codec_match_obj.group(1).lower()
            
            if width == 0 or height == 0:
                dim_pattern = r'(\d+)x(\d+)'
                dim_match = re.search(dim_pattern, stderr)
                if dim_match:
                    width = int(dim_match.group(1))
                    height = int(dim_match.group(2))
            
            data = {
                'streams': [{'codec_name': codec, 'width': width, 'height': height, 'codec_type': 'video'}],
                'format': {'duration': str(duration)}
            }
            
            # Extract video stream info
            video_stream = next((s for s in data['streams'] if s['codec_type'] == 'video'), None)
            audio_stream = next((s for s in data['streams'] if s['codec_type'] == 'audio'), None)
            
            if not video_stream:
                raise ValueError(f"No video stream found in {clip_path}")
            
            # Parse framerate
            fps_str = video_stream.get('r_frame_rate', '30/1')
            num, denom = map(int, fps_str.split('/'))
            fps = num / denom if denom != 0 else 30.0
            
            return {
                'codec': video_stream.get('codec_name', 'unknown'),
                'width': int(video_stream.get('width', 0)),
                'height': int(video_stream.get('height', 0)),
                'fps': round(fps, 2),
                'duration': float(data['format'].get('duration', 0)),
                'has_audio': audio_stream is not None,
                'audio_codec': audio_stream.get('codec_name', 'none') if audio_stream else 'none',
                'pixel_format': video_stream.get('pix_fmt', 'unknown')
            }
            
        except Exception as e:
            print(f"Warning: Could not probe {clip_path}: {e}")
            # Return conservative defaults
            return {
                'codec': 'unknown',
                'width': 0,
                'height': 0,
                'fps': 30.0,
                'duration': 0,
                'has_audio': True,
                'audio_codec': 'unknown',
                'pixel_format': 'unknown'
            }
    
    @classmethod
    def analyze_clips(
        cls,
        clips: List[str],
        target_width: int,
        target_height: int
    ) -> Tuple[List[str], List[str], List[str]]:
        """
        Categorize clips by required processing level.
        
        Args:
            clips: List of clip file paths
            target_width: Target canvas width
            target_height: Target canvas height
            
        Returns:
            Tuple of (compatible, needs_resize, needs_convert) clip lists
        """
        compatible = []      # Perfect match - NO encoding needed
        needs_resize = []    # Right codec, wrong size - fast resize
        needs_convert = []   # Different codec/format - full conversion
        
        print(f"\n🔍 Analyzing {len(clips)} clips for optimal processing...")
        print(f"   Target canvas: {target_width}x{target_height}")
        
        for clip in clips:
            try:
                info = cls.probe_clip(clip)
                clip_name = Path(clip).name
                
                # Check if clip is already perfect
                is_compatible = (
                    info['codec'] == 'h264' and
                    info['width'] == target_width and
                    info['height'] == target_height and
                    info['fps'] in [23.98, 24, 25, 29.97, 30, 50, 59.94, 60] and
                    info['pixel_format'] == 'yuv420p'
                )
                
                if is_compatible:
                    compatible.append(clip)
                    print(f"   ✓ {clip_name}: Compatible (no encoding)")
                    
                elif info['codec'] in ['h264', 'hevc', 'h265']:
                    needs_resize.append(clip)
                    print(f"   ⚡ {clip_name}: Resize only ({info['width']}x{info['height']} → {target_width}x{target_height})")
                    
                else:
                    needs_convert.append(clip)
                    print(f"   🔄 {clip_name}: Full conversion ({info['codec']} → h264)")
                    
            except Exception as e:
                print(f"   ⚠️ {Path(clip).name}: Analysis failed, marking for conversion")
                needs_convert.append(clip)
        
        print(f"\n📊 Analysis Results:")
        print(f"   ✓ {len(compatible)} compatible (stream copy)")
        print(f"   ⚡ {len(needs_resize)} need resize (fast)")
        print(f"   🔄 {len(needs_convert)} need conversion (full)\n")
        
        return compatible, needs_resize, needs_convert
    
    @classmethod
    def estimate_processing_time(
        cls,
        compatible_count: int,
        resize_count: int,
        convert_count: int,
        total_duration: float
    ) -> float:
        """
        Estimate total processing time based on clip categories.
        
        Args:
            compatible_count: Number of compatible clips
            resize_count: Number of clips needing resize
            convert_count: Number of clips needing conversion
            total_duration: Total duration of all clips in seconds
            
        Returns:
            Estimated processing time in seconds
        """
        # Compatible clips: instant (stream copy)
        compatible_time = 0
        
        # Resize with GPU: ~0.2x realtime (5 seconds of video = 1 second processing)
        resize_time = resize_count * 2  # Average 2 seconds per clip
        
        # Full conversion with GPU: ~0.5x realtime (5 seconds of video = 2.5 seconds)
        convert_time = convert_count * 5  # Average 5 seconds per clip
        
        # Concatenation: ~2 seconds
        concat_time = 2
        
        total = compatible_time + resize_time + convert_time + concat_time
        
        return max(total, 5)  # Minimum 5 seconds

