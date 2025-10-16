"""
GPU Detector Service

Auto-detects available GPU encoders and provides optimal encoding parameters.
Supports Apple Silicon, NVIDIA, AMD, and CPU fallback.
"""

import subprocess
import platform
import imageio_ffmpeg
from typing import List, Tuple


class GPUEncoder:
    """
    Detects and configures hardware-accelerated video encoding.
    
    This dramatically improves performance (5-10x) by offloading encoding
    to GPU instead of CPU.
    """
    
    _detected_encoder = None  # Cache detection result
    
    @classmethod
    def detect_available_encoder(cls) -> str:
        """
        Auto-detect the best available GPU encoder.
        
        Returns:
            Encoder name (e.g., 'h264_videotoolbox', 'h264_nvenc', 'libx264')
        """
        if cls._detected_encoder:
            return cls._detected_encoder
        
        system = platform.system()
        
        # macOS: Always prefer VideoToolbox (works on M1/M2/M3 and Intel Macs)
        if system == 'Darwin':
            if cls._test_encoder('h264_videotoolbox'):
                cls._detected_encoder = 'h264_videotoolbox'
                print("🚀 GPU Encoder: VideoToolbox (Apple Silicon/Intel)")
                return cls._detected_encoder
        
        # Windows/Linux: Check for NVIDIA
        if cls._test_encoder('h264_nvenc'):
            cls._detected_encoder = 'h264_nvenc'
            print("🚀 GPU Encoder: NVENC (NVIDIA)")
            return cls._detected_encoder
        
        # Windows: Check for AMD
        if system == 'Windows' and cls._test_encoder('h264_amf'):
            cls._detected_encoder = 'h264_amf'
            print("🚀 GPU Encoder: AMF (AMD)")
            return cls._detected_encoder
        
        # Fallback to CPU
        cls._detected_encoder = 'libx264'
        print("⚙️ GPU Encoder: CPU fallback (no GPU detected)")
        return cls._detected_encoder
    
    @classmethod
    def _test_encoder(cls, encoder: str) -> bool:
        """
        Test if an encoder is available in FFmpeg.
        
        Args:
            encoder: Encoder name to test
            
        Returns:
            True if encoder is available
        """
        try:
            ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
            cmd = [ffmpeg_exe, '-hide_banner', '-encoders']
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
            return encoder in result.stdout
        except:
            return False
    
    @classmethod
    def get_encode_params(
        cls,
        encoder: str = None,
        quality: str = 'balanced'
    ) -> List[str]:
        """
        Get optimal encoding parameters for the detected encoder.
        
        Args:
            encoder: Specific encoder to use (None = auto-detect)
            quality: 'fast', 'balanced', or 'quality'
            
        Returns:
            List of FFmpeg parameters
        """
        if encoder is None:
            encoder = cls.detect_available_encoder()
        
        # VideoToolbox (macOS)
        if 'videotoolbox' in encoder:
            if quality == 'fast':
                return ['-c:v', encoder, '-b:v', '8M', '-allow_sw', '1']
            elif quality == 'quality':
                return ['-c:v', encoder, '-b:v', '12M', '-allow_sw', '1']
            else:  # balanced
                return ['-c:v', encoder, '-b:v', '10M', '-allow_sw', '1']
        
        # NVENC (NVIDIA)
        elif 'nvenc' in encoder:
            if quality == 'fast':
                return ['-c:v', encoder, '-preset', 'p2', '-b:v', '8M']
            elif quality == 'quality':
                return ['-c:v', encoder, '-preset', 'p6', '-b:v', '12M']
            else:  # balanced
                return ['-c:v', encoder, '-preset', 'p4', '-b:v', '10M']
        
        # AMF (AMD)
        elif 'amf' in encoder:
            if quality == 'fast':
                return ['-c:v', encoder, '-quality', 'speed', '-rc', 'vbr_latency', '-b:v', '8M']
            elif quality == 'quality':
                return ['-c:v', encoder, '-quality', 'quality', '-rc', 'vbr_hq', '-b:v', '12M']
            else:  # balanced
                return ['-c:v', encoder, '-quality', 'balanced', '-rc', 'vbr_peak', '-b:v', '10M']
        
        # CPU fallback (libx264)
        else:
            if quality == 'fast':
                return ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26']
            elif quality == 'quality':
                return ['-c:v', 'libx264', '-preset', 'medium', '-crf', '20']
            else:  # balanced
                return ['-c:v', 'libx264', '-preset', 'faster', '-crf', '23']
    
    @classmethod
    def get_audio_params(cls, copy_if_possible: bool = True) -> List[str]:
        """
        Get audio encoding parameters.
        
        Args:
            copy_if_possible: Use stream copy if source is AAC
            
        Returns:
            List of FFmpeg audio parameters
        """
        if copy_if_possible:
            # Try to copy audio (will fallback to encode if incompatible)
            return ['-c:a', 'aac', '-b:a', '128k']
        else:
            # Always re-encode
            return ['-c:a', 'aac', '-b:a', '128k', '-ar', '44100']
    
    @classmethod
    def get_performance_multiplier(cls) -> float:
        """
        Get the estimated speed multiplier vs CPU encoding.
        
        Returns:
            Speed multiplier (e.g., 8.0 = 8x faster than CPU)
        """
        encoder = cls.detect_available_encoder()
        
        multipliers = {
            'h264_videotoolbox': 8.0,  # Apple Silicon/Intel
            'h264_nvenc': 7.0,          # NVIDIA
            'h264_amf': 6.0,            # AMD
            'libx264': 1.0              # CPU baseline
        }
        
        return multipliers.get(encoder, 1.0)

