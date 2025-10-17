"""
Complete Pipeline Debugger - Tracks entire video processing flow in ONE place
"""

import time
from pathlib import Path
from typing import Dict, List, Any, Optional
import os


class PipelineDebugger:
    """
    Master debugger that logs EVERYTHING that happens in video processing.
    One simple block showing the complete flow.
    """
    
    def __init__(self, job_name: str):
        self.job_name = job_name
        self.start_time = time.time()
        self.stages = []
        self.current_stage = None
        
    def start_stage(self, stage_name: str, details: Dict[str, Any] = None):
        """Start a new stage in the pipeline"""
        if self.current_stage:
            self.current_stage['end_time'] = time.time()
            self.current_stage['duration'] = self.current_stage['end_time'] - self.current_stage['start_time']
        
        self.current_stage = {
            'name': stage_name,
            'start_time': time.time(),
            'details': details or {},
            'substeps': []
        }
        self.stages.append(self.current_stage)
    
    def log(self, message: str, data: Any = None):
        """Log a message in the current stage"""
        if not self.current_stage:
            return
        
        self.current_stage['substeps'].append({
            'time': time.time() - self.start_time,
            'message': message,
            'data': data
        })
    
    def print_full_report(self):
        """Print the complete pipeline report in ONE readable block"""
        if self.current_stage:
            self.current_stage['end_time'] = time.time()
            self.current_stage['duration'] = self.current_stage['end_time'] - self.current_stage['start_time']
        
        total_time = time.time() - self.start_time
        
        print("\n" + "="*100)
        print(f"COMPLETE PIPELINE DEBUG REPORT: {self.job_name}")
        print(f"Total Time: {total_time:.2f}s")
        print("="*100)
        
        for i, stage in enumerate(self.stages, 1):
            stage_time = stage.get('duration', 0)
            print(f"\n[STAGE {i}] {stage['name']} ({stage_time:.2f}s)")
            print("-" * 100)
            
            # Print stage details
            if stage['details']:
                for key, value in stage['details'].items():
                    print(f"  • {key}: {value}")
            
            # Print substeps
            for step in stage['substeps']:
                elapsed = step['time']
                msg = step['message']
                data = step['data']
                
                if data:
                    print(f"  [{elapsed:6.2f}s] {msg}")
                    if isinstance(data, dict):
                        for k, v in data.items():
                            print(f"             → {k}: {v}")
                    else:
                        print(f"             → {data}")
                else:
                    print(f"  [{elapsed:6.2f}s] {msg}")
        
        print("\n" + "="*100)
        print("END OF PIPELINE DEBUG REPORT")
        print("="*100 + "\n")


def probe_file_details(file_path: str) -> Dict[str, Any]:
    """Get detailed info about a video/audio file"""
    import subprocess
    import imageio_ffmpeg
    import cv2
    from mutagen import File as MutagenFile
    
    if not os.path.exists(file_path):
        return {'error': 'File does not exist'}
    
    details = {
        'name': Path(file_path).name,
        'size_mb': os.path.getsize(file_path) / (1024 * 1024),
        'exists': True
    }
    
    # Try to get duration
    ext = Path(file_path).suffix.lower()
    if ext in {".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg"}:
        try:
            audio = MutagenFile(file_path)
            if audio and hasattr(audio.info, "length"):
                details['duration'] = float(audio.info.length)
                details['type'] = 'audio'
        except:
            pass
    else:
        # Video file
        try:
            cap = cv2.VideoCapture(file_path)
            if cap.isOpened():
                fps = cap.get(cv2.CAP_PROP_FPS) or 0
                frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
                width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                cap.release()
                
                if fps > 0:
                    details['duration'] = frame_count / fps
                    details['fps'] = fps
                    details['frames'] = int(frame_count)
                    details['resolution'] = f"{width}x{height}"
                    details['type'] = 'video'
        except:
            pass
    
    # Get FFmpeg probe info
    try:
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        cmd = [ffmpeg_exe, '-i', file_path, '-f', 'null', '-']
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        
        # Parse for audio/video streams
        has_video = 'Video:' in result.stderr
        has_audio = 'Audio:' in result.stderr
        
        details['has_video'] = has_video
        details['has_audio'] = has_audio
        details['streams'] = f"{'V' if has_video else ''}{'A' if has_audio else ''}"
        
        # Parse codec info
        if has_video:
            for line in result.stderr.split('\n'):
                if 'Video:' in line:
                    if 'h264' in line:
                        details['video_codec'] = 'h264'
                    elif 'hevc' in line or 'h265' in line:
                        details['video_codec'] = 'hevc'
                    else:
                        details['video_codec'] = 'other'
                    break
        
        if has_audio:
            for line in result.stderr.split('\n'):
                if 'Audio:' in line:
                    if 'aac' in line:
                        details['audio_codec'] = 'aac'
                    elif 'mp3' in line:
                        details['audio_codec'] = 'mp3'
                    else:
                        details['audio_codec'] = 'other'
                    break
    except:
        pass
    
    return details

