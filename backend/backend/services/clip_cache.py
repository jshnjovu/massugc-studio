"""
Clip Cache Service

Caches normalized video clips to avoid re-processing on subsequent runs.
Provides instant playback for repeated campaigns with same source clips.
"""

import os
import hashlib
import shutil
import time
from pathlib import Path
from typing import Optional


class ClipCache:
    """
    Manages a disk cache of normalized video clips.
    
    This is critical for performance - second runs with same clips
    become instant (no processing required).
    """
    
    CACHE_DIR = Path.home() / ".zyra-video-agent" / "clip-cache"
    MAX_CACHE_SIZE_GB = 10  # Auto-cleanup after 10GB
    
    @classmethod
    def initialize(cls):
        """Create cache directory if it doesn't exist."""
        cls.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    
    @classmethod
    def get_cache_key(
        cls,
        clip_path: str,
        canvas_w: int,
        canvas_h: int,
        crop_mode: str = 'center',
        audio_mode: str = 'keep'
    ) -> str:
        """
        Generate unique cache key for a normalized clip.
        
        Args:
            clip_path: Original clip path
            canvas_w: Target width
            canvas_h: Target height
            crop_mode: Crop mode used
            audio_mode: Audio handling mode ('keep' or 'strip')
            
        Returns:
            MD5 hash as cache key
        """
        # Include file modification time to invalidate cache if source changes
        try:
            mtime = os.path.getmtime(clip_path)
        except:
            mtime = 0
        
        # Create unique identifier including audio mode
        # This ensures clips cached with different audio modes are separate
        identifier = f"{clip_path}_{mtime}_{canvas_w}_{canvas_h}_{crop_mode}_{audio_mode}"
        cache_key = hashlib.md5(identifier.encode()).hexdigest()
        
        return cache_key
    
    @classmethod
    def get_cached_clip(
        cls,
        clip_path: str,
        canvas_w: int,
        canvas_h: int,
        crop_mode: str = 'center',
        audio_mode: str = 'keep'
    ) -> Optional[str]:
        """
        Retrieve cached normalized clip if it exists.
        
        Args:
            clip_path: Original clip path
            canvas_w: Target width
            canvas_h: Target height
            crop_mode: Crop mode used
            audio_mode: Audio handling mode ('keep' or 'strip')
            
        Returns:
            Path to cached clip, or None if not cached
        """
        cls.initialize()
        
        cache_key = cls.get_cache_key(clip_path, canvas_w, canvas_h, crop_mode, audio_mode)
        cached_path = cls.CACHE_DIR / f"{cache_key}.mp4"
        
        if cached_path.exists():
            # Update access time for LRU tracking
            cached_path.touch()
            return str(cached_path)
        
        return None
    
    @classmethod
    def cache_clip(
        cls,
        clip_path: str,
        normalized_path: str,
        canvas_w: int,
        canvas_h: int,
        crop_mode: str = 'center',
        audio_mode: str = 'keep'
    ) -> str:
        """
        Save normalized clip to cache.
        
        Args:
            clip_path: Original clip path
            normalized_path: Path to normalized clip to cache
            canvas_w: Target width
            canvas_h: Target height
            crop_mode: Crop mode used
            audio_mode: Audio handling mode ('keep' or 'strip')
            
        Returns:
            Path to cached clip
        """
        cls.initialize()
        
        cache_key = cls.get_cache_key(clip_path, canvas_w, canvas_h, crop_mode, audio_mode)
        cached_path = cls.CACHE_DIR / f"{cache_key}.mp4"
        
        try:
            # Copy normalized clip to cache
            shutil.copy2(normalized_path, cached_path)
            
            # Check cache size and cleanup if needed
            cls._cleanup_if_needed()
            
            return str(cached_path)
            
        except Exception as e:
            print(f"   ⚠️ Cache write failed: {e}")
            return normalized_path
    
    @classmethod
    def _cleanup_if_needed(cls):
        """
        Clean up old cache files if total size exceeds limit.
        Uses LRU (Least Recently Used) strategy.
        """
        try:
            # Calculate total cache size
            cache_files = list(cls.CACHE_DIR.glob("*.mp4"))
            total_size_bytes = sum(f.stat().st_size for f in cache_files)
            total_size_gb = total_size_bytes / (1024**3)
            
            if total_size_gb > cls.MAX_CACHE_SIZE_GB:
                print(f"\n🧹 Cache size ({total_size_gb:.1f}GB) exceeds limit, cleaning up...")
                
                # Sort by last access time (oldest first)
                cache_files.sort(key=lambda f: f.stat().st_atime)
                
                # Remove oldest files until under limit
                removed_count = 0
                for cache_file in cache_files:
                    if total_size_gb <= cls.MAX_CACHE_SIZE_GB * 0.8:  # Clean to 80% of limit
                        break
                    
                    file_size = cache_file.stat().st_size
                    cache_file.unlink()
                    total_size_gb -= file_size / (1024**3)
                    removed_count += 1
                
                print(f"   Removed {removed_count} old cached clips")
                
        except Exception as e:
            print(f"   ⚠️ Cache cleanup failed: {e}")
    
    @classmethod
    def clear_cache(cls):
        """Clear entire cache (for maintenance/debugging)."""
        try:
            if cls.CACHE_DIR.exists():
                shutil.rmtree(cls.CACHE_DIR)
                cls.initialize()
                print("✓ Cache cleared")
        except Exception as e:
            print(f"⚠️ Cache clear failed: {e}")
    
    @classmethod
    def get_cache_stats(cls) -> dict:
        """
        Get cache statistics.
        
        Returns:
            Dictionary with cache size, file count, etc.
        """
        try:
            cls.initialize()
            cache_files = list(cls.CACHE_DIR.glob("*.mp4"))
            total_size_bytes = sum(f.stat().st_size for f in cache_files)
            
            return {
                'file_count': len(cache_files),
                'total_size_gb': total_size_bytes / (1024**3),
                'cache_dir': str(cls.CACHE_DIR)
            }
        except:
            return {
                'file_count': 0,
                'total_size_gb': 0,
                'cache_dir': str(cls.CACHE_DIR)
            }


# Initialize cache directory on module import
ClipCache.initialize()

