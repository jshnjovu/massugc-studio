"""
Audio Service

Handles audio processing operations including silence removal and audio manipulation.
"""

import os
import re
import shutil
import subprocess
import traceback
import imageio_ffmpeg


class AudioService:
    """Manages audio processing operations."""
    
    SILENCE_THRESHOLD_DB = "-35dB"
    SILENCE_MIN_DURATION_S = "0.4"
    
    @classmethod
    def remove_silence(cls, input_path: str, output_path: str) -> tuple[bool, str]:
        """
        Remove silence from video using FFmpeg silencedetect and apply audio fades.
        
        Args:
            input_path: Path to input video file
            output_path: Path to save processed video
            
        Returns:
            Tuple of (success, error_message_if_failed)
        """
        print(f"\n--- Starting Silence Removal ---")
        print(f"Input: {input_path}")
        print(f"Output: {output_path}")
        
        if not os.path.exists(input_path):
            return False, f"Input video not found: {input_path}"
        
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        if not ffmpeg_exe:
            return False, "FFmpeg not found. Please install ffmpeg."
        
        try:
            # Detect silence intervals
            silence_detect_cmd = [
                ffmpeg_exe, '-nostdin', '-i', input_path,
                '-af', f'silencedetect=noise={cls.SILENCE_THRESHOLD_DB}:d={cls.SILENCE_MIN_DURATION_S}',
                '-f', 'null', '-'
            ]
            
            process = subprocess.run(
                silence_detect_cmd,
                capture_output=True,
                text=True,
                check=False,
                encoding='utf-8',
                errors='ignore',
                timeout=600
            )
            
            stderr_output = process.stderr
            
            # Parse silence timestamps
            silence_starts = [float(t) for t in re.findall(r"silence_start:\s*([\d\.]+)", stderr_output)]
            silence_ends = [float(t) for t in re.findall(r"silence_end:\s*([\d\.]+)", stderr_output)]
            
            # Parse video duration
            duration_match = re.search(r"Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d+)", stderr_output)
            
            # If no silence detected, copy original file
            if not silence_starts or not silence_ends:
                if "error" in stderr_output.lower() or process.returncode != 0:
                    return False, "FFmpeg silencedetect encountered an error"
                
                print("No silence detected, copying original file")
                shutil.copy(input_path, output_path)
                return True, ""
            
            # Reconcile mismatched start/end counts
            if len(silence_starts) != len(silence_ends):
                if len(silence_starts) > len(silence_ends):
                    silence_starts.pop()
                elif len(silence_ends) > len(silence_starts):
                    silence_ends.pop(0)
                
                if len(silence_starts) != len(silence_ends) or not silence_starts:
                    print("Could not reconcile silence intervals, copying original")
                    shutil.copy(input_path, output_path)
                    return True, ""
            
            # Calculate video duration
            video_duration = 0
            if duration_match:
                h, m, s, ms_str = duration_match.groups()
                ms = float(f"0.{ms_str}")
                video_duration = int(h) * 3600 + int(m) * 60 + int(s) + ms
            elif silence_ends:
                video_duration = max(silence_ends) + 1.0
            
            if video_duration <= 0:
                return False, "Could not determine video duration"
            
            # Build segments to keep
            segments = cls._build_segments(silence_starts, silence_ends, video_duration)
            
            if not segments:
                print("No non-silent segments found, copying original")
                shutil.copy(input_path, output_path)
                return True, ""
            
            # Build and execute filter complex
            success, error = cls._apply_silence_removal(
                ffmpeg_exe,
                input_path,
                output_path,
                segments,
                video_duration
            )
            
            if not success:
                # Fallback to copying original
                shutil.copy(input_path, output_path)
                return True, ""
            
            print("Silence removal completed successfully")
            return True, ""
            
        except subprocess.TimeoutExpired:
            return False, "FFmpeg silencedetect timed out"
        except Exception as e:
            error_msg = f"Silence removal failed: {str(e)}"
            print(f"Error: {error_msg}")
            traceback.print_exc()
            
            # Fallback to copying original
            try:
                shutil.copy(input_path, output_path)
                return True, ""
            except:
                return False, error_msg
    
    @classmethod
    def _build_segments(cls, silence_starts: list, silence_ends: list, video_duration: float) -> list:
        """Build list of non-silent segments to keep."""
        segments = []
        min_segment_len = 0.1
        last_end_time = 0.0
        
        for i in range(len(silence_starts)):
            start_segment = last_end_time
            end_segment = silence_starts[i]
            
            if start_segment >= 0 and end_segment > start_segment and (end_segment - start_segment) >= min_segment_len:
                segments.append((start_segment, end_segment))
            
            last_end_time = silence_ends[i]
            if last_end_time < 0:
                last_end_time = 0
        
        # Add final segment
        if last_end_time < video_duration and (video_duration - last_end_time) >= min_segment_len:
            segments.append((last_end_time, video_duration))
        
        return segments
    
    @classmethod
    def _apply_silence_removal(
        cls,
        ffmpeg_exe: str,
        input_path: str,
        output_path: str,
        segments: list,
        video_duration: float
    ) -> tuple[bool, str]:
        """Apply silence removal using FFmpeg filter complex."""
        fade_duration = 0.05
        min_segment_len = 0.1
        
        video_select_parts = []
        audio_filter_chains = []
        valid_segment_count = 0
        
        for i, (start, end) in enumerate(segments):
            clamped_start = max(0.0, start)
            clamped_end = min(video_duration, end)
            segment_duration = clamped_end - clamped_start
            
            if segment_duration < min_segment_len / 2.0:
                continue
            
            # Video selection
            v_select = f"between(t,{clamped_start},{clamped_end})"
            video_select_parts.append(v_select)
            
            # Audio chain for this segment
            trim_label = f"[a_trimmed_{valid_segment_count}]"
            fade_label = f"[a_faded_{valid_segment_count}]"
            
            trim_filter = f"[0:a]atrim={clamped_start}:{clamped_end},asetpts=PTS-STARTPTS{trim_label}"
            
            # Apply fades
            fade_filters = []
            effective_fade_duration = min(fade_duration, segment_duration / 2.0)
            
            if valid_segment_count > 0:
                fade_filters.append(f"afade=t=in:st=0:d={effective_fade_duration}")
            
            # Check if there's a next valid segment for fade out
            next_valid_exists = False
            for k in range(i + 1, len(segments)):
                next_start, next_end = segments[k]
                next_clamped_start = max(0.0, next_start)
                next_clamped_end = min(video_duration, next_end)
                if (next_clamped_end - next_clamped_start) >= min_segment_len / 2.0:
                    next_valid_exists = True
                    break
            
            if next_valid_exists:
                fade_out_start = max(0.0, segment_duration - effective_fade_duration)
                fade_filters.append(f"afade=t=out:st={fade_out_start:.3f}:d={effective_fade_duration}")
            
            if fade_filters:
                fade_chain = f"{trim_label}{','.join(fade_filters)}{fade_label}"
            else:
                fade_chain = f"{trim_label}anull{fade_label}"
            
            audio_filter_chains.append(trim_filter + ";" + fade_chain)
            valid_segment_count += 1
        
        if valid_segment_count == 0:
            return False, "No valid segments after processing"
        
        # Build filter complex
        video_filtergraph = f"select='{'+'.join(video_select_parts)}',setpts=N/(FRAME_RATE*TB)[outv]"
        
        if valid_segment_count == 1:
            full_audio_filtergraph = audio_filter_chains[0].replace('[a_faded_0]', '[outa]')
        else:
            concat_inputs = "".join([f"[a_faded_{j}]" for j in range(valid_segment_count)])
            audio_concat_filter = f"{concat_inputs}concat=n={valid_segment_count}:v=0:a=1[outa]"
            full_audio_filtergraph = ";".join(audio_filter_chains) + ";" + audio_concat_filter
        
        filter_complex_string = f"{full_audio_filtergraph};{video_filtergraph}"
        
        # Execute FFmpeg command
        final_cmd = [
            ffmpeg_exe, '-hide_banner', '-loglevel', 'warning',
            '-i', input_path,
            '-filter_complex', filter_complex_string,
            '-map', '[outv]',
            '-map', '[outa]',
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
            '-c:a', 'aac', '-b:a', '128k',
            '-movflags', '+faststart',
            '-y', output_path
        ]
        
        try:
            process = subprocess.run(
                final_cmd,
                capture_output=True,
                text=True,
                check=True,
                encoding='utf-8',
                errors='ignore',
                timeout=1800
            )
            
            if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
                return False, "Output file is missing or empty"
            
            return True, ""
            
        except subprocess.TimeoutExpired:
            return False, "FFmpeg command timed out"
        except subprocess.CalledProcessError as e:
            return False, f"FFmpeg failed with return code {e.returncode}"
        except Exception as e:
            return False, f"Unexpected error: {str(e)}"
    
    @classmethod
    def calculate_timeout(cls, base_timeout: int = 1800, operation_type: str = "encoding") -> int:
        """
        Calculate appropriate timeout for FFmpeg operations.
        
        Args:
            base_timeout: Base timeout in seconds (default 30 minutes)
            operation_type: Type of operation for logging
            
        Returns:
            Timeout in seconds, capped at maximum
        """
        max_timeout = min(base_timeout * 3, 10800)  # Cap at 3 hours
        print(f"FFmpeg {operation_type} timeout set to {max_timeout} seconds ({max_timeout/60:.1f} minutes)")
        return max_timeout

