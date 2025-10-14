"""
Music Library Manager with Intelligent Selection
===============================================
Professional music library management with smart track selection,
auto-ducking, volume optimization, and mood matching.

Author: MassUGC Development Team
Version: 1.0.0
"""

import os
import json
import random
import hashlib
import logging
import subprocess
import shutil
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field, asdict
from enum import Enum
from pathlib import Path
import yaml
import numpy as np
from mutagen import File as AudioFile
from mutagen.mp3 import MP3
from mutagen.mp4 import MP4
import librosa
import soundfile as sf

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


# ============== Configuration ==============

class MusicCategory(Enum):
    """Music categories for different content types"""
    UPBEAT_ENERGY = "upbeat_energy"
    CHILL_VIBES = "chill_vibes"
    CORPORATE_CLEAN = "corporate_clean"
    TRENDING_SOUNDS = "trending_sounds"
    EMOTIONAL = "emotional"
    EPIC_DRAMATIC = "epic_dramatic"
    MINIMAL_AMBIENT = "minimal_ambient"
    COMEDY_FUN = "comedy_fun"


class MusicMood(Enum):
    """Music mood classifications"""
    HAPPY = "happy"
    ENERGETIC = "energetic"
    CALM = "calm"
    INSPIRATIONAL = "inspirational"
    MYSTERIOUS = "mysterious"
    PLAYFUL = "playful"
    SERIOUS = "serious"
    ROMANTIC = "romantic"


@dataclass
class TrackMetadata:
    """Metadata for a music track"""
    id: str
    filename: str
    path: str
    title: str
    artist: str = "Unknown"
    category: MusicCategory = MusicCategory.UPBEAT_ENERGY
    mood: MusicMood = MusicMood.ENERGETIC
    bpm: Optional[float] = None
    duration: float = 0.0
    key: Optional[str] = None
    energy_level: float = 0.5  # 0-1 scale
    loudness_db: float = -20.0
    file_size_mb: float = 0.0
    sample_rate: int = 44100
    bitrate_kbps: int = 192
    tags: List[str] = field(default_factory=list)
    usage_count: int = 0
    last_used: Optional[str] = None
    license: str = "royalty-free"
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for serialization"""
        data = asdict(self)
        data['category'] = self.category.value
        data['mood'] = self.mood.value
        return data
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'TrackMetadata':
        """Create from dictionary"""
        data['category'] = MusicCategory(data.get('category', 'upbeat_energy'))
        data['mood'] = MusicMood(data.get('mood', 'energetic'))
        return cls(**data)


@dataclass
class MusicSelectionConfig:
    """Configuration for music selection"""
    category: Optional[MusicCategory] = None
    mood: Optional[MusicMood] = None
    min_bpm: Optional[float] = None
    max_bpm: Optional[float] = None
    min_duration: Optional[float] = None
    max_duration: Optional[float] = None
    exclude_recently_used: bool = True
    recent_threshold_days: int = 7
    random_selection: bool = True
    energy_match: Optional[float] = None  # Match video energy level


# ============== Preset Music Collections ==============

PRESET_TRACKS = {
    MusicCategory.UPBEAT_ENERGY: [
        "energetic_beat_1.mp3",
        "upbeat_pop_2.mp3",
        "motivational_3.mp3",
        "high_energy_4.mp3",
        "power_anthem_5.mp3"
    ],
    MusicCategory.CHILL_VIBES: [
        "lofi_chill_1.mp3",
        "ambient_relax_2.mp3",
        "smooth_groove_3.mp3",
        "peaceful_4.mp3",
        "zen_moment_5.mp3"
    ],
    MusicCategory.CORPORATE_CLEAN: [
        "professional_1.mp3",
        "business_upbeat_2.mp3",
        "corporate_motivate_3.mp3",
        "clean_tech_4.mp3",
        "modern_office_5.mp3"
    ],
    MusicCategory.TRENDING_SOUNDS: [
        "viral_trend_1.mp3",
        "tiktok_hit_2.mp3",
        "social_beat_3.mp3",
        "catchy_hook_4.mp3",
        "dance_challenge_5.mp3"
    ]
}

# Volume recommendations by category
CATEGORY_VOLUME_PRESETS = {
    MusicCategory.UPBEAT_ENERGY: -22,     # Slightly louder, energetic
    MusicCategory.CHILL_VIBES: -28,       # Quieter, background
    MusicCategory.CORPORATE_CLEAN: -25,   # Balanced, professional
    MusicCategory.TRENDING_SOUNDS: -20,   # Louder, attention-grabbing
    MusicCategory.EMOTIONAL: -26,         # Subtle, supportive
    MusicCategory.EPIC_DRAMATIC: -18,     # Loud, impactful
    MusicCategory.MINIMAL_AMBIENT: -30,   # Very quiet, atmospheric
    MusicCategory.COMEDY_FUN: -24         # Moderate, clear
}


# ============== Main Music Library Manager ==============

class MusicLibrary:
    """
    Enterprise-grade music library manager with intelligent selection
    and audio processing capabilities.
    """
    
    def __init__(self, library_dir: Optional[Path] = None):
        """Initialize music library"""
        self.library_dir = library_dir or Path.home() / ".zyra-video-agent" / "uploads" / "music"
        self.library_dir.mkdir(parents=True, exist_ok=True)
        
        self.metadata_file = self.library_dir / "music_library.yaml"
        self.tracks: Dict[str, TrackMetadata] = {}
        self.categories: Dict[MusicCategory, List[str]] = {cat: [] for cat in MusicCategory}
        self.recently_used: List[str] = []
        
        # Load existing library
        self._load_library()
        
        # Scan for new tracks
        self._scan_directory()
        
        logger.info(f"Music library initialized with {len(self.tracks)} tracks")
    
    
    def select_track(
        self,
        config: Optional[MusicSelectionConfig] = None,
        video_duration: Optional[float] = None
    ) -> Optional[TrackMetadata]:
        """
        Select a track based on configuration and context
        
        Returns:
            TrackMetadata of selected track or None if no suitable track found
        """
        config = config or MusicSelectionConfig()
        
        # Get candidate tracks
        candidates = self._get_candidate_tracks(config, video_duration)
        
        if not candidates:
            logger.warning("No suitable tracks found with given criteria")
            return None
        
        # Select track
        if config.random_selection:
            selected = random.choice(candidates)
        else:
            # Select based on best match score
            selected = self._select_best_match(candidates, config)
        
        # Update usage statistics
        self._update_usage(selected)
        
        return selected
    
    
    def select_random_from_category(
        self,
        category: MusicCategory,
        exclude_used: bool = True
    ) -> Optional[TrackMetadata]:
        """Select random track from specific category"""
        tracks_in_category = self.categories.get(category, [])
        
        if exclude_used:
            tracks_in_category = [
                tid for tid in tracks_in_category 
                if tid not in self.recently_used
            ]
        
        if not tracks_in_category:
            return None
        
        track_id = random.choice(tracks_in_category)
        return self.tracks.get(track_id)
    
    
    def select_multiple_for_testing(
        self,
        count: int = 3,
        base_config: Optional[MusicSelectionConfig] = None
    ) -> List[TrackMetadata]:
        """Select multiple different tracks for A/B testing"""
        selected = []
        used_ids = set()
        
        for _ in range(count):
            config = base_config or MusicSelectionConfig()
            
            # Ensure we don't select the same track twice
            candidates = self._get_candidate_tracks(config)
            candidates = [t for t in candidates if t.id not in used_ids]
            
            if candidates:
                track = random.choice(candidates)
                selected.append(track)
                used_ids.add(track.id)
        
        return selected
    
    
    def add_track(
        self,
        file_path: str,
        metadata: Optional[Dict] = None
    ) -> TrackMetadata:
        """Add a new track to the library"""
        file_path = Path(file_path)
        
        if not file_path.exists():
            raise FileNotFoundError(f"Music file not found: {file_path}")
        
        # Copy file to library
        filename = file_path.name
        dest_path = self.library_dir / filename
        
        if not dest_path.exists():
            shutil.copy2(file_path, dest_path)
        
        # Generate track ID
        track_id = self._generate_track_id(filename)
        
        # Analyze audio
        audio_info = self._analyze_audio(dest_path)
        
        # Create metadata
        track_metadata = TrackMetadata(
            id=track_id,
            filename=filename,
            path=str(dest_path),
            title=metadata.get('title', filename.rsplit('.', 1)[0]) if metadata else filename.rsplit('.', 1)[0],
            artist=metadata.get('artist', 'Unknown') if metadata else 'Unknown',
            category=MusicCategory(metadata.get('category', 'upbeat_energy')) if metadata else MusicCategory.UPBEAT_ENERGY,
            mood=MusicMood(metadata.get('mood', 'energetic')) if metadata else MusicMood.ENERGETIC,
            **audio_info
        )
        
        # Add to library
        self.tracks[track_id] = track_metadata
        self.categories[track_metadata.category].append(track_id)
        
        # Save library
        self._save_library()
        
        logger.info(f"Added track: {track_metadata.title} (ID: {track_id})")
        return track_metadata
    
    
    def prepare_for_video(
        self,
        track: TrackMetadata,
        video_duration: float,
        volume_db: Optional[float] = None,
        fade_in: float = 2.0,
        fade_out: float = 2.0,
        loop: bool = True
    ) -> str:
        """
        Prepare music track for video (trim, loop, adjust volume)
        
        Returns:
            Path to processed audio file
        """
        output_path = self.library_dir / "processed" / f"{track.id}_processed.mp3"
        output_path.parent.mkdir(exist_ok=True)
        
        # Load audio
        audio, sr = librosa.load(track.path, sr=None)
        
        # Adjust length
        if track.duration < video_duration and loop:
            # Loop the track
            repeats = int(np.ceil(video_duration / track.duration))
            audio = np.tile(audio, repeats)
        
        # Trim to video duration
        target_samples = int(video_duration * sr)
        audio = audio[:target_samples]
        
        # Apply fades
        # Fade-in disabled
        # if fade_in > 0:
        #     fade_in_samples = int(fade_in * sr)
        #     fade_in_curve = np.linspace(0, 1, fade_in_samples)
        #     audio[:fade_in_samples] *= fade_in_curve
        
        if fade_out > 0:
            fade_out_samples = int(fade_out * sr)
            fade_out_curve = np.linspace(1, 0, fade_out_samples)
            audio[-fade_out_samples:] *= fade_out_curve
        
        # Adjust volume
        if volume_db is None:
            volume_db = CATEGORY_VOLUME_PRESETS.get(track.category, -25)
        
        volume_factor = 10 ** (volume_db / 20)
        audio *= volume_factor
        
        # Save processed audio
        sf.write(str(output_path), audio, sr, format='mp3')
        
        return str(output_path)
    
    
    def calculate_optimal_volume(
        self,
        track: TrackMetadata,
        voice_loudness: float,
        content_type: str = "standard"
    ) -> float:
        """
        Calculate optimal music volume based on voice and content
        
        Args:
            track: Music track metadata
            voice_loudness: Voice loudness in dB
            content_type: Type of content (standard, dramatic, subtle)
        
        Returns:
            Optimal volume in dB
        """
        # Base volume from category preset
        base_volume = CATEGORY_VOLUME_PRESETS.get(track.category, -25)
        
        # Adjust based on voice loudness
        # Music should be 6-10dB quieter than voice
        optimal_difference = {
            "standard": 8,
            "dramatic": 6,
            "subtle": 10
        }.get(content_type, 8)
        
        target_volume = voice_loudness - optimal_difference
        
        # Apply limits
        min_volume = -35
        max_volume = -15
        
        return max(min_volume, min(target_volume, max_volume))
    
    
    def analyze_for_ducking(
        self,
        track_path: str,
        voice_path: str,
        duck_threshold: float = -30
    ) -> Dict[str, Any]:
        """
        Analyze audio for smart ducking parameters
        
        Returns:
            Dict with ducking points and parameters
        """
        # Load both audio files
        music, music_sr = librosa.load(track_path, sr=22050)
        voice, voice_sr = librosa.load(voice_path, sr=22050)
        
        # Detect voice activity
        voice_rms = librosa.feature.rms(y=voice, frame_length=2048, hop_length=512)[0]
        voice_db = librosa.amplitude_to_db(voice_rms)
        
        # Find segments where voice is active
        voice_active = voice_db > duck_threshold
        
        # Convert to time segments
        hop_duration = 512 / voice_sr
        ducking_segments = []
        
        in_segment = False
        segment_start = 0
        
        for i, active in enumerate(voice_active):
            time = i * hop_duration
            
            if active and not in_segment:
                segment_start = time
                in_segment = True
            elif not active and in_segment:
                ducking_segments.append({
                    'start': segment_start - 0.1,  # Small pre-roll
                    'end': time + 0.1,  # Small post-roll
                    'duck_level': -10  # Reduce by 10dB
                })
                in_segment = False
        
        return {
            'segments': ducking_segments,
            'total_duck_time': sum(s['end'] - s['start'] for s in ducking_segments),
            'duck_percentage': (sum(s['end'] - s['start'] for s in ducking_segments) / 
                               (len(voice) / voice_sr)) * 100
        }
    
    
    def get_library_stats(self) -> Dict[str, Any]:
        """Get library statistics"""
        total_duration = sum(t.duration for t in self.tracks.values())
        total_size = sum(t.file_size_mb for t in self.tracks.values())
        
        category_counts = {}
        for cat in MusicCategory:
            category_counts[cat.value] = len(self.categories[cat])
        
        mood_counts = {}
        for track in self.tracks.values():
            mood = track.mood.value
            mood_counts[mood] = mood_counts.get(mood, 0) + 1
        
        return {
            'total_tracks': len(self.tracks),
            'total_duration_hours': total_duration / 3600,
            'total_size_gb': total_size / 1024,
            'categories': category_counts,
            'moods': mood_counts,
            'most_used': self._get_most_used_tracks(5),
            'recently_added': self._get_recently_added_tracks(5)
        }
    
    
    # ============== Helper Methods ==============
    
    def _load_library(self):
        """Load library from metadata file"""
        if self.metadata_file.exists():
            try:
                with open(self.metadata_file, 'r') as f:
                    data = yaml.safe_load(f) or {}
                
                for track_data in data.get('tracks', []):
                    track = TrackMetadata.from_dict(track_data)
                    self.tracks[track.id] = track
                    self.categories[track.category].append(track.id)
                
                self.recently_used = data.get('recently_used', [])
                
                logger.info(f"Loaded {len(self.tracks)} tracks from library")
            except Exception as e:
                logger.error(f"Failed to load library: {e}")
    
    
    def _save_library(self):
        """Save library to metadata file"""
        try:
            data = {
                'tracks': [track.to_dict() for track in self.tracks.values()],
                'recently_used': self.recently_used[-20:]  # Keep last 20
            }
            
            with open(self.metadata_file, 'w') as f:
                yaml.dump(data, f, default_flow_style=False)
            
            logger.debug("Library saved successfully")
        except Exception as e:
            logger.error(f"Failed to save library: {e}")
    
    
    def _scan_directory(self):
        """Scan directory for new music files"""
        supported_formats = ['.mp3', '.m4a', '.wav', '.ogg', '.flac']
        
        for file_path in self.library_dir.iterdir():
            if file_path.suffix.lower() in supported_formats:
                track_id = self._generate_track_id(file_path.name)
                
                if track_id not in self.tracks:
                    # New track found
                    logger.info(f"Found new track: {file_path.name}")
                    
                    try:
                        audio_info = self._analyze_audio(file_path)
                        
                        # Try to guess category from filename
                        category = self._guess_category(file_path.name)
                        
                        track = TrackMetadata(
                            id=track_id,
                            filename=file_path.name,
                            path=str(file_path),
                            title=file_path.stem.replace('_', ' ').title(),
                            category=category,
                            **audio_info
                        )
                        
                        self.tracks[track_id] = track
                        self.categories[category].append(track_id)
                        
                    except Exception as e:
                        logger.error(f"Failed to analyze {file_path.name}: {e}")
        
        # Save updated library
        if self.tracks:
            self._save_library()
    
    
    def _analyze_audio(self, file_path: Path) -> Dict[str, Any]:
        """Analyze audio file and extract metadata (lightweight version)"""
        try:
            # Get file size
            file_size_mb = file_path.stat().st_size / (1024 * 1024)
            
            # Get basic metadata from file headers (fast)
            audio_file = AudioFile(str(file_path))
            duration = 0.0
            bitrate = 192  # Default
            sample_rate = 44100  # Default
            
            if audio_file and audio_file.info:
                duration = getattr(audio_file.info, 'length', 0.0)
                if hasattr(audio_file.info, 'bitrate') and audio_file.info.bitrate:
                    bitrate = audio_file.info.bitrate // 1000  # Convert to kbps
                if hasattr(audio_file.info, 'sample_rate') and audio_file.info.sample_rate:
                    sample_rate = audio_file.info.sample_rate
            
            # Use reasonable defaults instead of expensive analysis
            # BPM estimation based on file size/duration (rough heuristic)
            estimated_bpm = 120.0  # Default BPM
            if duration > 0:
                # Very rough estimate: longer tracks tend to be slower
                if duration > 240:  # 4+ minutes
                    estimated_bpm = 90.0
                elif duration < 120:  # Under 2 minutes
                    estimated_bpm = 140.0
            
            return {
                'duration': duration,
                'bpm': estimated_bpm,
                'key': 'C',  # Default key
                'energy_level': 0.6,  # Default energy level
                'loudness_db': -18.0,  # Default loudness
                'file_size_mb': file_size_mb,
                'sample_rate': sample_rate,
                'bitrate_kbps': bitrate
            }
            
        except Exception as e:
            logger.error(f"Audio analysis failed: {e}")
            # Return defaults
            return {
                'duration': 0.0,
                'bpm': 120.0,
                'key': 'C',
                'energy_level': 0.5,
                'loudness_db': -20.0,
                'file_size_mb': file_path.stat().st_size / (1024 * 1024) if file_path.exists() else 0,
                'sample_rate': 44100,
                'bitrate_kbps': 192
            }
    
    
    def _estimate_key(self, chroma: np.ndarray) -> str:
        """Estimate musical key from chroma features"""
        keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        chroma_mean = np.mean(chroma, axis=1)
        key_index = np.argmax(chroma_mean)
        return keys[key_index]
    
    
    def _generate_track_id(self, filename: str) -> str:
        """Generate unique track ID"""
        return hashlib.md5(filename.encode()).hexdigest()[:12]
    
    
    def _guess_category(self, filename: str) -> MusicCategory:
        """Guess category from filename"""
        filename_lower = filename.lower()
        
        if any(word in filename_lower for word in ['upbeat', 'energy', 'motivate', 'power']):
            return MusicCategory.UPBEAT_ENERGY
        elif any(word in filename_lower for word in ['chill', 'relax', 'calm', 'ambient']):
            return MusicCategory.CHILL_VIBES
        elif any(word in filename_lower for word in ['corporate', 'business', 'professional']):
            return MusicCategory.CORPORATE_CLEAN
        elif any(word in filename_lower for word in ['viral', 'tiktok', 'trending', 'social']):
            return MusicCategory.TRENDING_SOUNDS
        elif any(word in filename_lower for word in ['emotional', 'sad', 'touching']):
            return MusicCategory.EMOTIONAL
        elif any(word in filename_lower for word in ['epic', 'dramatic', 'cinematic']):
            return MusicCategory.EPIC_DRAMATIC
        elif any(word in filename_lower for word in ['comedy', 'fun', 'funny', 'playful']):
            return MusicCategory.COMEDY_FUN
        else:
            return MusicCategory.UPBEAT_ENERGY  # Default
    
    
    def _get_candidate_tracks(
        self,
        config: MusicSelectionConfig,
        video_duration: Optional[float] = None
    ) -> List[TrackMetadata]:
        """Get candidate tracks based on criteria"""
        candidates = list(self.tracks.values())
        
        # Filter by category
        if config.category:
            candidates = [t for t in candidates if t.category == config.category]
        
        # Filter by mood
        if config.mood:
            candidates = [t for t in candidates if t.mood == config.mood]
        
        # Filter by BPM
        if config.min_bpm:
            candidates = [t for t in candidates if t.bpm and t.bpm >= config.min_bpm]
        if config.max_bpm:
            candidates = [t for t in candidates if t.bpm and t.bpm <= config.max_bpm]
        
        # Filter by duration
        if video_duration:
            # Prefer tracks that are at least half the video duration
            min_duration = video_duration * 0.5
            candidates = [t for t in candidates if t.duration >= min_duration or t.duration >= 30]
        
        # Filter recently used
        if config.exclude_recently_used:
            candidates = [t for t in candidates if t.id not in self.recently_used]
        
        return candidates
    
    
    def _select_best_match(
        self,
        candidates: List[TrackMetadata],
        config: MusicSelectionConfig
    ) -> TrackMetadata:
        """Select best matching track based on scoring"""
        scores = []
        
        for track in candidates:
            score = 0
            
            # Score based on energy match
            if config.energy_match is not None:
                energy_diff = abs(track.energy_level - config.energy_match)
                score += (1 - energy_diff) * 10
            
            # Score based on usage (prefer less used)
            score += (100 - track.usage_count) / 10
            
            # Score based on category match
            if config.category and track.category == config.category:
                score += 5
            
            scores.append((score, track))
        
        # Sort by score and return best match
        scores.sort(key=lambda x: x[0], reverse=True)
        return scores[0][1]
    
    
    def _update_usage(self, track: TrackMetadata):
        """Update track usage statistics"""
        from datetime import datetime
        
        track.usage_count += 1
        track.last_used = datetime.now().isoformat()
        
        # Add to recently used
        if track.id in self.recently_used:
            self.recently_used.remove(track.id)
        self.recently_used.append(track.id)
        
        # Save updated library
        self._save_library()
    
    
    def _get_most_used_tracks(self, count: int) -> List[Dict]:
        """Get most frequently used tracks"""
        sorted_tracks = sorted(
            self.tracks.values(),
            key=lambda t: t.usage_count,
            reverse=True
        )
        
        return [
            {'title': t.title, 'usage_count': t.usage_count}
            for t in sorted_tracks[:count]
        ]
    
    
    def _get_recently_added_tracks(self, count: int) -> List[Dict]:
        """Get recently added tracks (stub for now)"""
        # Would need to track addition date
        tracks = list(self.tracks.values())[:count]
        return [{'title': t.title, 'id': t.id} for t in tracks]
    
    
    def delete_track(self, track_id: str) -> bool:
        """Delete a track from the library
        
        Args:
            track_id: ID of the track to delete
            
        Returns:
            bool: True if track was deleted successfully
        """
        try:
            if track_id not in self.tracks:
                logger.warning(f"Track {track_id} not found for deletion")
                return False
            
            track = self.tracks[track_id]
            
            # Delete the physical file if it exists
            if os.path.exists(track.path):
                os.remove(track.path)
                logger.info(f"Deleted physical file: {track.path}")
            
            # Remove from tracks dictionary
            del self.tracks[track_id]
            
            # Remove from recently used if present
            if track_id in self.recently_used:
                self.recently_used.remove(track_id)
            
            # Save updated library
            self._save_library()
            
            logger.info(f"Successfully deleted track {track_id}: {track.title}")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting track {track_id}: {e}")
            return False
    
    
    def delete_multiple_tracks(self, track_ids: List[str]) -> Dict[str, bool]:
        """Delete multiple tracks from the library
        
        Args:
            track_ids: List of track IDs to delete
            
        Returns:
            Dict[str, bool]: Results for each track ID
        """
        results = {}
        for track_id in track_ids:
            results[track_id] = self.delete_track(track_id)
        return results


# ============== Testing ==============

if __name__ == "__main__":
    # Initialize library
    library = MusicLibrary()
    
    # Test track selection
    config = MusicSelectionConfig(
        category=MusicCategory.UPBEAT_ENERGY,
        mood=MusicMood.ENERGETIC,
        min_bpm=120,
        max_bpm=140,
        random_selection=True
    )
    
    selected_track = library.select_track(config, video_duration=30)
    
    if selected_track:
        print(f"✅ Selected track: {selected_track.title}")
        print(f"   Category: {selected_track.category.value}")
        print(f"   BPM: {selected_track.bpm}")
        print(f"   Duration: {selected_track.duration:.2f}s")
    
    # Test A/B variants
    variants = library.select_multiple_for_testing(count=3, base_config=config)
    
    print(f"\n🎵 A/B Test Variants:")
    for i, track in enumerate(variants, 1):
        print(f"{i}. {track.title} ({track.category.value})")
    
    # Test volume calculation
    if selected_track:
        optimal_volume = library.calculate_optimal_volume(
            selected_track,
            voice_loudness=-15,
            content_type="standard"
        )
        print(f"\n🔊 Optimal volume: {optimal_volume}dB")
    
    # Get library stats
    stats = library.get_library_stats()
    print(f"\n📊 Library Stats:")
    print(f"   Total tracks: {stats['total_tracks']}")
    print(f"   Total duration: {stats['total_duration_hours']:.2f} hours")
    print(f"   Categories: {stats['categories']}")