"""
Enhanced Video Processor for TikTok-Style Video Enhancements
=============================================================
Enterprise-grade video processing with quality controls, A/B testing,
and professional text/caption/music overlays.

Author: MassUGC Development Team
Version: 1.0.0
"""

import os
import json
import logging
import subprocess
import tempfile
import random
import hashlib
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import cv2
from utils.design_space_utils import DesignSpaceCalculator, create_calculator_from_config
from utils.color_utils import ColorConverter, FFmpegColorBuilder, ASSColorBuilder
from backend.services.gpu_detector import GPUEncoder
# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# Feature flag for design-space scaling model
FEATURE_DESIGN_SPACE_SCALING = os.environ.get('FEATURE_DESIGN_SPACE_SCALING', '1') == '1'


# ============== Configuration Classes ==============

class TextPosition(Enum):
    """Text overlay position options"""
    TOP_LEFT = "top_left"
    TOP_CENTER = "top_center"
    TOP_RIGHT = "top_right"
    MIDDLE_LEFT = "middle_left"
    MIDDLE_CENTER = "middle_center"
    MIDDLE_RIGHT = "middle_right"
    BOTTOM_LEFT = "bottom_left"
    BOTTOM_CENTER = "bottom_center"
    BOTTOM_RIGHT = "bottom_right"


class CaptionStyle(Enum):
    """Caption style templates matching CapCut quality"""
    TIKTOK_CLASSIC = "tiktok_classic"
    BOLD_STATEMENT = "bold_statement"
    CLEAN_MINIMAL = "clean_minimal"
    EMOJI_ACCENT = "emoji_accent"
    GRADIENT_POP = "gradient_pop"


@dataclass
class TextOverlayConfig:
    """Configuration for text overlays"""
    text: str
    position: TextPosition = TextPosition.TOP_CENTER
    font_family: str = "Montserrat-Bold"
    font_size: Optional[int] = None  # Auto-calculate if None
    scale: float = 1.0  # Scale factor (1.0 = 100%, 0.6 = 60%)
    color: str = "white"
    background_color: str = "black@0.8"
    background_padding: int = 20
    shadow_enabled: bool = True
    shadow_color: str = "black@0.8"
    shadow_offset: Tuple[int, int] = (3, 3)
    animation: str = "fade_in"
    duration: Optional[float] = None  # Show for entire video if None
    start_time: float = 0.0
    
    # Connected background fields for TikTok/CapCut style backgrounds
    connected_background_enabled: bool = False
    connected_background_data: Optional[Dict[str, Any]] = None

    # Standard background control
    hasBackground: bool = True

    # Design-space fields (new unified model)
    design_width: Optional[int] = None
    design_height: Optional[int] = None
    x_pct: Optional[float] = None  # Position percentage (0-100)
    y_pct: Optional[float] = None  # Position percentage (0-100)
    anchor: Optional[str] = None  # "center", "top_left", "bottom_center", etc.
    safe_margins_pct: Optional[Dict[str, float]] = None  # {"left": 4, "right": 4, "top": 5, "bottom": 12}
    font_px: Optional[int] = None  # Font size in design space pixels
    font_percentage: Optional[float] = None  # Font size as percentage of video height
    border_px: Optional[int] = None  # Border/stroke size in design space pixels
    shadow_px: Optional[int] = None  # Shadow size in design space pixels
    line_spacing_px: Optional[int] = None  # Line spacing in design space pixels
    wrap_width_pct: Optional[float] = None  # Wrap width as percentage of design space


@dataclass
class CaptionConfig:
    """Configuration for auto-captions"""
    style: CaptionStyle = CaptionStyle.TIKTOK_CLASSIC
    highlight_keywords: bool = True
    keywords_color: str = "yellow"
    word_timing_precision: float = 0.1  # 100ms precision
    max_words_per_line: int = 8
    emoji_support: bool = True
    background_enabled: bool = True


@dataclass
class ExtendedCaptionConfig:
    """Extended configuration for auto-captions with full customization"""
    enabled: bool = True
    template: str = 'tiktok_classic'
    fontSize: int = 20  # Exact pixel size
    fontFamily: str = 'Montserrat-Bold'
    x_position: float = 50.0  # Percentage (0-100)
    y_position: float = 85.0  # Percentage (0-100)
    color: str = '#FFFFFF'
    hasStroke: bool = True
    strokeColor: str = '#000000'
    strokeWidth: float = 3
    hasBackground: bool = False
    backgroundColor: str = '#000000'
    backgroundOpacity: float = 0.8
    animation: str = 'none'
    highlight_keywords: bool = True
    max_words_per_segment: int = 4
    allCaps: bool = False
    keywords_color: str = '#FFFF00'
    max_words_per_line: int = 8
    emoji_support: bool = True

    # Design-space fields (new unified model)
    design_width: Optional[int] = None
    design_height: Optional[int] = None
    x_pct: Optional[float] = None  # Position percentage (0-100) - overrides x_position if set
    y_pct: Optional[float] = None  # Position percentage (0-100) - overrides y_position if set
    anchor: Optional[str] = None  # "center", "top_left", "bottom_center", etc.
    safe_margins_pct: Optional[Dict[str, float]] = None  # {"left": 4, "right": 4, "top": 5, "bottom": 12}
    font_px: Optional[int] = None  # Font size in design space pixels - overrides fontSize if set
    font_percentage: Optional[float] = None  # Font size as percentage of video height
    border_px: Optional[int] = None  # Border/stroke size in design space pixels
    shadow_px: Optional[int] = None  # Shadow size in design space pixels


@dataclass
class MusicConfig:
    """Configuration for background music"""
    track_path: Optional[str] = None
    track_id: Optional[str] = None
    volume_db: float = -25.0
    fade_in_duration: float = 0.0
    fade_out_duration: float = 2.0
    loop_if_shorter: bool = True

@dataclass
class OutputVolumeConfig:
    """Configuration for final output volume normalization"""
    enabled: bool = False
    target_level: float = 0.5  # 0-1 range, 0.5 = -15 LUFS target


@dataclass
class QualityMetrics:
    """Quality validation metrics"""
    text_contrast_ratio: float = 0.0
    caption_sync_accuracy: float = 0.0
    audio_balance_db: float = 0.0
    processing_time: float = 0.0
    file_size_mb: float = 0.0
    resolution: Tuple[int, int] = (0, 0)
    fps: float = 0.0
    bitrate_mbps: float = 0.0


# ============== Text Overlay Templates ==============

TEXT_TEMPLATES = {
    "engagement": [
        "Wait for it... 🤯",
        "This changes everything!",
        "You won't believe what happens next",
        "The secret they don't want you to know",
        "Watch till the end!",
        "POV: You just discovered this",
        "Nobody talks about this...",
        "I was today years old when...",
        "Game changer alert! 🚨",
        "Why is nobody talking about this?"
    ],
    "product": [
        "Transform your {product} game",
        "The {product} hack you need",
        "{product} lovers, this is for you!",
        "Level up your {product}",
        "The ultimate {product} solution"
    ],
    "educational": [
        "Here's how it works:",
        "3 things you didn't know",
        "The science behind this",
        "Expert tips inside",
        "Learn this in 30 seconds"
    ],
    "urgency": [
        "Limited time only!",
        "Don't miss out!",
        "Last chance!",
        "Ending soon!",
        "Act fast!"
    ]
}


# ============== Caption Style Definitions ==============

# Keywords that should be highlighted in captions for engagement
DEFAULT_HIGHLIGHT_WORDS = [
    "amazing", "incredible", "secret", "hack", "pro tip",
    "game changer", "must have", "exclusive", "limited",
    "free", "new", "revolutionary", "breakthrough", "wow",
    "unbelievable", "shocking", "insane", "crazy", "wild"
]

CAPTION_STYLES = {
    CaptionStyle.TIKTOK_CLASSIC: {
        "font": "Montserrat-Bold",
        "size_ratio": 0.045,
        "background": "box=1:boxcolor=black@0.8:boxborderw=15",
        "position": "x=(w-text_w)/2:y=h*0.7",
        "color": "white",
        "stroke": None
    },
    CaptionStyle.BOLD_STATEMENT: {
        "font": "Impact",
        "size_ratio": 0.06,
        "background": "box=1:boxcolor=black@0.9:boxborderw=20",
        "position": "x=(w-text_w)/2:y=h*0.65",
        "color": "yellow",
        "stroke": "bordercolor=black:borderw=3"
    },
    CaptionStyle.CLEAN_MINIMAL: {
        "font": "Inter-Medium",
        "size_ratio": 0.04,
        "background": "box=1:boxcolor=white@0.95:boxborderw=25",
        "position": "x=(w-text_w)/2:y=h*0.75",
        "color": "black",
        "stroke": None
    },
    CaptionStyle.EMOJI_ACCENT: {
        "font": "NotoColorEmoji",
        "size_ratio": 0.05,
        "background": "box=1:boxcolor=white@0.9:boxborderw=20",
        "position": "x=(w-text_w)/2:y=h*0.7",
        "color": "black",
        "stroke": None
    },
    CaptionStyle.GRADIENT_POP: {
        "font": "Montserrat-Black",
        "size_ratio": 0.055,
        "background": "box=1:boxcolor=purple@0.7:boxborderw=18",
        "position": "x=(w-text_w)/2:y=h*0.68",
        "color": "white",
        "stroke": "bordercolor=pink:borderw=2"
    }
}


# ============== Design-Space Helper Functions ==============
# Moved to utils/design_space_utils.py for better organization and reusability


# ============== Main Enhanced Video Processor ==============

class EnhancedVideoProcessor:
    """
    Enterprise-grade video processor with TikTok-style enhancements.
    Handles text overlays, captions, music, and A/B testing.
    """
    
    def __init__(self, working_dir: Optional[Path] = None):
        """Initialize the enhanced video processor"""
        self.working_dir = working_dir or Path.home() / ".zyra-video-agent" / "enhanced_processing"
        self.working_dir.mkdir(parents=True, exist_ok=True)
        
        self.temp_dir = self.working_dir / "temp"
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        
        self.ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
        # Use system ffprobe since imageio-ffmpeg doesn't provide it
        import shutil
        self.ffprobe_path = shutil.which('ffprobe') or '/opt/homebrew/bin/ffprobe'
        self.metrics = QualityMetrics()
        
        # Detect and cache GPU encoder for hardware-accelerated processing
        self.gpu_encoder = GPUEncoder.detect_available_encoder()
        logger.info(f"Enhanced Video Processor initialized. Working dir: {self.working_dir}")
        logger.info(f"GPU Encoder: {self.gpu_encoder} (hardware acceleration enabled)")
    
    
    def process_enhanced_video(
        self,
        video_path: str,
        output_path: str,
        text_configs: Optional[List[TextOverlayConfig]] = None,
        caption_config: Optional[CaptionConfig] = None,
        music_config: Optional[MusicConfig] = None,
        audio_path: Optional[str] = None,
        output_volume_config: Optional[OutputVolumeConfig] = None,
        validate_quality: bool = True,
        extend_music_to_video_duration: bool = False
    ) -> Dict[str, Any]:
        """
        Main processing function that applies all enhancements
        
        Args:
            extend_music_to_video_duration: If True, music continues for full video duration
                                            (for Splice campaigns with music-duration mode).
                                            If False, music stops when voiceover ends (Avatar default).
        
        Returns:
            Dict containing output path, metrics, and processing details
        """
        try:
            logger.info(f"Starting enhanced processing for: {video_path}")
            start_time = self._get_timestamp()
            
            # Validate input
            if not os.path.exists(video_path):
                raise FileNotFoundError(f"Video file not found: {video_path}")
            
            # Get video properties
            video_info = self._get_video_info(video_path)
            self.metrics.resolution = (video_info['width'], video_info['height'])
            self.metrics.fps = video_info['fps']
            
            # Create processing pipeline
            current_video = video_path
            
            # Step 1: Add text overlays if configured
            text_overlay_success = 0
            if text_configs:
                # CONSOLIDATED BACKEND DEBUG - Show all overlays
                logger.info(f"\n🔍 BACKEND OVERLAY PROCESSING:")
                logger.info(f"  Video: {video_info['width']}x{video_info['height']}")
                logger.info(f"  Text Overlays: {len(text_configs)} configured")

                for i, text_config in enumerate(text_configs):
                    overlay_type = "Connected BG" if text_config.connected_background_enabled else "Standard"
                    if text_config.connected_background_enabled:
                        bg_size = f"{text_config.connected_background_data.get('metadata', {}).get('backgroundWidth', 'N/A')}x{text_config.connected_background_data.get('metadata', {}).get('backgroundHeight', 'N/A')}"
                    else:
                        bg_size = "N/A"
                    logger.info(f"  Text {i+1}: \"{text_config.text[:30]}\" | {overlay_type} | fontSize={text_config.font_size}px | pos={text_config.x_pct:.1f},{text_config.y_pct:.1f}% | bgSize={bg_size}")

                if caption_config and hasattr(caption_config, 'enabled') and caption_config.enabled:
                    logger.info(f"  Captions: fontSize={caption_config.fontSize}px | pos={caption_config.x_position},{caption_config.y_position}%")
                else:
                    logger.info(f"  Captions: DISABLED")
                logger.info("")

                for i, text_config in enumerate(text_configs):
                    try:
                        current_video = self.add_text_overlay(
                            current_video,
                            text_config,
                            video_info
                        )
                        text_overlay_success += 1
                    except Exception as e:
                        logger.warning(f"Text overlay {i+1} failed: {str(e)}")
                        # Continue with the next overlay or next step
                        continue
            
            # Step 2: Add captions if configured
            captions_applied = False
            if caption_config:
                if audio_path:
                    try:
                        logger.info(f"Generating and applying captions from audio: {audio_path}")
                        # Handle both CaptionConfig and ExtendedCaptionConfig
                        if isinstance(caption_config, ExtendedCaptionConfig):
                            current_video = self.add_extended_captions(
                                current_video,
                                audio_path,
                                caption_config,
                                video_info
                            )
                        else:
                            current_video = self.add_captions(
                                current_video,
                                audio_path,
                                caption_config,
                                video_info
                            )
                        captions_applied = True
                        logger.info("Captions applied successfully")
                    except Exception as e:
                        logger.warning(f"Caption processing failed: {str(e)}")
                        import traceback
                        logger.debug(traceback.format_exc())
                        # Continue without captions
                        pass
                else:
                    logger.warning("Caption config provided but no audio path available for transcription")
            
            # Step 3: Add background music if configured
            music_applied = False
            if music_config:
                try:
                    logger.info("Mixing background music...")
                    current_video = self.add_background_music(
                        current_video,
                        music_config,
                        audio_path,
                        extend_to_video_duration=extend_music_to_video_duration
                    )
                    music_applied = True
                except Exception as e:
                    logger.warning(f"Music processing failed: {str(e)}")
                    # Continue without music
                    pass
            
            # Step 4: Apply output volume normalization if configured
            output_volume_applied = False
            if output_volume_config and output_volume_config.enabled:
                try:
                    logger.info("Adjusting output volume...")
                    current_video = self.normalize_output_volume(
                        current_video,
                        output_volume_config
                    )
                    output_volume_applied = True
                except Exception as e:
                    logger.warning(f"Output volume normalization failed: {str(e)}")
                    # Continue without volume normalization
                    pass
            
            # Step 5: Quality validation if enabled
            if validate_quality:
                logger.info("Validating output quality...")
                self._validate_quality(current_video)
            
            # Step 6: Move to final output location
            self._finalize_output(current_video, output_path)
            
            # Calculate metrics
            self.metrics.processing_time = self._get_timestamp() - start_time
            self.metrics.file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
            
            # Summary of what was applied
            applied_summary = []
            if text_overlay_success > 0:
                applied_summary.append(f"{text_overlay_success} text overlay(s)")
            if captions_applied:
                applied_summary.append("captions")
            if music_applied:
                applied_summary.append("music")
            
            if applied_summary:
                logger.info(f"Enhanced processing complete. Applied: {', '.join(applied_summary)}. Time: {self.metrics.processing_time:.2f}s")
            else:
                logger.warning(f"Enhanced processing complete but no enhancements were successfully applied. Time: {self.metrics.processing_time:.2f}s")
            
            return {
                "success": True,
                "output_path": output_path,
                "metrics": self._metrics_to_dict(),
                "enhancements_applied": {
                    "text_overlays": text_overlay_success,
                    "captions": captions_applied,
                    "music": music_applied,
                    "output_volume": output_volume_applied
                },
                "enhancements_attempted": {
                    "text_overlays": len(text_configs) if text_configs else 0,
                    "captions": caption_config is not None,
                    "music": music_config is not None,
                    "output_volume": output_volume_config is not None and output_volume_config.enabled
                }
            }
            
        except Exception as e:
            logger.error(f"Enhanced processing failed: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "metrics": self._metrics_to_dict()
            }
    
    
    def add_text_overlay(
        self,
        video_path: str,
        config: TextOverlayConfig,
        video_info: Dict[str, Any]
    ) -> str:
        """
        Add professional text overlay with auto-sizing and positioning
        """
        # Log design-space mode status and config values
        if FEATURE_DESIGN_SPACE_SCALING:
            logger.info("[DESIGN-SPACE MODE] Feature flag is ON")
            logger.info(f"  design_width: {config.design_width}")
            logger.info(f"  design_height: {config.design_height}")
            logger.info(f"  x_pct: {config.x_pct}")
            logger.info(f"  y_pct: {config.y_pct}")
            logger.info(f"  anchor: {config.anchor}")
            logger.info(f"  safe_margins_pct: {config.safe_margins_pct}")
            logger.info(f"  font_px: {config.font_px}")
            logger.info(f"  border_px: {config.border_px}")
            logger.info(f"  shadow_px: {config.shadow_px}")

            # Create design space calculator with defaults if needed
            calculator = create_calculator_from_config(
                video_info['width'], video_info['height'],
                {
                    'design_width': config.design_width or 1088,
                    'design_height': config.design_height or 1904,
                    'safe_margins_pct': config.safe_margins_pct or {
                        "left": 4.0, "right": 4.0, "top": 5.0, "bottom": 12.0
                    }
                }
            )
            logger.info(f"  Design space calculator: scale={calculator.scale_factor:.3f}")

            # Map position if percentages provided
            if config.x_pct is not None and config.y_pct is not None:
                x, y = calculator.map_position(
                    config.x_pct, config.y_pct,
                    config.anchor or "center"
                )
                logger.info(f"  Mapped position: ({config.x_pct}%, {config.y_pct}%) -> ({x}, {y})")
        else:
            logger.info("[LEGACY MODE] Using current scaling behavior")

        # Check if connected background is enabled
        if config.connected_background_enabled and config.connected_background_data:
            return self._add_connected_text_overlay(video_path, config, video_info)
        
        # Fallback to standard text overlay
        output_path = self._get_temp_path("text_overlay.mp4")
        
        # Use the font size from the form - don't auto-calculate
        # Auto-calculation causes inconsistencies between preview and video
        if config.font_size is None:
            config.font_size = 20  # Default to match frontend default
        
        # Build FFmpeg filter for text overlay
        drawtext_filter = self._build_drawtext_filter(config, video_info)
        
        # Apply text overlay with FFmpeg (GPU-accelerated encoding)
        cmd = [
            self.ffmpeg_path,
            '-i', video_path,
            '-vf', drawtext_filter,
            '-c:a', 'aac',
            '-b:a', '128k',
            *GPUEncoder.get_encode_params(self.gpu_encoder, quality='balanced'),
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart',
            output_path
        ]
        
        self._run_ffmpeg(cmd, "text overlay")
        return output_path
    
    
    def _get_connected_background_scale(self, config: TextOverlayConfig, video_info: Dict) -> Tuple[int, int, int, int]:
        """
        Calculate scaled dimensions and position for connected backgrounds.
        
        Returns:
            Tuple of (scaled_width, scaled_height, bg_x, bg_y)
        """
        if not config.connected_background_enabled or not config.connected_background_data:
            return None
        
        metadata = config.connected_background_data['metadata']
        video_width = video_info['width']
        video_height = video_info['height']
        
        # Get metadata dimensions
        metadata_video_width = metadata.get('videoWidth', video_width)
        metadata_video_height = metadata.get('videoHeight', video_height)
        canvas_width = metadata['backgroundWidth']
        canvas_height = metadata['backgroundHeight']
        
        # Create calculator for consistent scaling
        config_dict = {
            'design_width': config.design_width or metadata_video_width,
            'design_height': config.design_height or metadata_video_height,
            'safe_margins_pct': config.safe_margins_pct,
            'x_pct': config.x_pct,
            'y_pct': config.y_pct,
            'anchor': config.anchor
        }
        
        calculator = create_calculator_from_config(video_width, video_height, config_dict)
        
        # Scale background dimensions
        scaled_width = calculator.scale_dimension(canvas_width)
        scaled_height = calculator.scale_dimension(canvas_height)
        
        print(f"[CONNECTED BG] Canvas: {canvas_width}x{canvas_height} → Scaled: {scaled_width}x{scaled_height}")
        
        # Calculate position using design space mapping
        if config.x_pct is not None and config.y_pct is not None:
            center_x, center_y = calculator.map_position(config.x_pct, config.y_pct, config.anchor or "center")
            
            # Center the background on the calculated position
            bg_x = max(0, min(int(center_x - scaled_width / 2), video_width - scaled_width))
            bg_y = max(0, min(int(center_y - scaled_height / 2), video_height - scaled_height))
        else:
            # Fallback to center
            bg_x = max(0, int((video_width - scaled_width) / 2))
            bg_y = max(0, int((video_height - scaled_height) / 2))
        
        print(f"[CONNECTED BG] Position: ({bg_x}, {bg_y})")
        
        return scaled_width, scaled_height, bg_x, bg_y


    def _add_connected_text_overlay(self, video_path: str, config: TextOverlayConfig, video_info: Dict[str, Any]) -> str:
        """Add connected text overlay with improved scaling and positioning"""
        
        print(f"\n[CONNECTED OVERLAY] Processing connected background for text: '{config.text[:30]}...'")
        
        output_path = self._get_temp_path("connected_overlay.mp4")
        
        # Process the connected background image
        background_path = self._process_connected_background_fast(config, video_info)
        if not background_path:
            print("[CONNECTED OVERLAY] ⚠️ Background processing failed, falling back to standard overlay")
            return self.add_text_overlay(
                video_path,
                TextOverlayConfig(
                    text=config.text,
                    position=config.position,
                    font_family=config.font_family,
                    font_size=config.font_size,
                    color=config.color,
                    connected_background_enabled=False
                ),
                video_info
            )
        
        # Get scaled dimensions and position
        scale_result = self._get_connected_background_scale(config, video_info)
        if not scale_result:
            print("[CONNECTED OVERLAY] ⚠️ Scale calculation failed")
            return video_path
        
        scaled_width, scaled_height, bg_x, bg_y = scale_result
        
        print(f"[CONNECTED OVERLAY] Final dimensions: {scaled_width}x{scaled_height} at ({bg_x}, {bg_y})")
        
        # Create FFmpeg filter for overlay
        scale_filter = f'[1:v]scale={scaled_width}:{scaled_height}[bg]'
        overlay_filter = f'[0:v][bg]overlay={bg_x}:{bg_y}:format=auto[final]'
        full_filter = f'{scale_filter};{overlay_filter}'
        
        # Build FFmpeg command with GPU-accelerated encoding
        cmd = [
            self.ffmpeg_path,
            '-i', video_path,
            '-i', background_path,
            '-filter_complex', full_filter,
            '-map', '[final]',
            '-map', '0:a',
            '-c:a', 'aac',
            '-b:a', '128k',
            *GPUEncoder.get_encode_params(self.gpu_encoder, quality='balanced'),
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart',
            output_path
        ]
        
        print(f"[CONNECTED OVERLAY] Running FFmpeg...")
        self._run_ffmpeg(cmd, "connected text overlay")
        
        # Cleanup temporary background file
        try:
            os.unlink(background_path)
            print(f"[CONNECTED OVERLAY] Cleaned up temp background")
        except:
            pass
        
        print(f"[CONNECTED OVERLAY] ✅ Complete: {output_path}")
        
        return output_path
    
    
    def _process_connected_background_fast(
        self,
        config: TextOverlayConfig,
        video_info: Dict[str, Any]
    ) -> Optional[str]:
        """High-speed background processing with caching"""
        
        if not config.connected_background_enabled or not config.connected_background_data:
            return None
        
        # Generate cache key for identical backgrounds
        cache_key = hashlib.md5(
            config.connected_background_data['image'].encode()
        ).hexdigest()
        
        temp_path = self._get_temp_path(f"bg_cache_{cache_key}.png")
        
        # Return cached version if exists
        if os.path.exists(temp_path):
            logger.debug(f"Using cached background: {temp_path}")
            return temp_path
        
        try:
            # Fast base64 decode and save
            import base64
            image_data = config.connected_background_data['image'].split(',')[1]
            decoded_data = base64.b64decode(image_data)
            
            with open(temp_path, 'wb') as f:
                f.write(decoded_data)
            
            logger.debug(f"Saved connected background to: {temp_path}")
            return temp_path
            
        except Exception as e:
            logger.error(f"Failed to process connected background: {str(e)}")
            return None
    
    
    def add_captions(
        self,
        video_path: str,
        audio_path: str,
        config: CaptionConfig,
        video_info: Dict[str, Any]
    ) -> str:
        """
        Add auto-generated captions with word-level timing
        """
        output_path = self._get_temp_path("captioned.mp4")
        
        # Generate caption file (SRT format)
        caption_file = self._generate_captions(audio_path, config)
        
        # Apply captions with style
        style_def = CAPTION_STYLES[config.style]
        
        # Build subtitle filter with styling and positioning
        subtitle_filter = self._build_extended_subtitle_filter(caption_file, config, video_info)
        
        # Apply captions with GPU-accelerated encoding
        cmd = [
            self.ffmpeg_path,
            '-i', video_path,
            '-vf', subtitle_filter,
            '-c:a', 'aac',
            '-b:a', '128k',
            *GPUEncoder.get_encode_params(self.gpu_encoder, quality='balanced'),
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart',
            output_path
        ]
        
        self._run_ffmpeg(cmd, "caption overlay")
        return output_path
    
    
    def add_background_music(
        self,
        video_path: str,
        config: MusicConfig,
        voice_audio_path: Optional[str] = None,
        extend_to_video_duration: bool = False
    ) -> str:
        """
        Add background music with smart volume and ducking
        
        Args:
            extend_to_video_duration: If True, music continues for full video duration
                                     (Splice with music-duration mode). If False, music
                                     stops when voiceover ends (Avatar default).
        """
        output_path = self._get_temp_path("with_music.mp4")
        
        # Get or select music track
        music_path = config.track_path or self._select_music_track(config.track_id)
        
        if not music_path or not os.path.exists(music_path):
            logger.warning(f"Music track not found: {music_path}")
            return video_path
        
        # Check if input video has audio stream and get video duration
        has_audio = self._video_has_audio(video_path)
        video_info = self._get_video_info(video_path)
        video_duration = video_info['duration']
        
        logger.info(f"Adding music with volume: {config.volume_db:.1f}dB")
        logger.info(f"Input video has audio: {has_audio}")
        logger.info(f"Video duration: {video_duration:.1f}s")
        
        if has_audio:
            # Video has audio - mix it with music
            base_volume = 10 ** (config.volume_db / 20)
            
            if extend_to_video_duration:
                # SPLICE MODE: Music continues for full video duration
                # Loop music, trim to video duration, then mix (prevents FFmpeg hanging)
                logger.info(f"Using extended music mode (music continues for {video_duration:.1f}s)")
                audio_filter = (
                    f"[0:a]aformat=sample_rates=44100:channel_layouts=stereo[voice];"
                    f"[1:a]aformat=sample_rates=44100:channel_layouts=stereo,volume={base_volume},"
                    f"aloop=loop=-1:size=2e+09,atrim=duration={video_duration}[music];"
                    f"[voice][music]amix=inputs=2:duration=longest:dropout_transition=2[aout]"
                )
            else:
                # AVATAR MODE: Music stops when voiceover ends
                logger.info("Using standard music mode (music stops with voiceover)")
                audio_filter = (
                    f"[0:a]aformat=sample_rates=44100:channel_layouts=stereo[voice];"
                    f"[1:a]aformat=sample_rates=44100:channel_layouts=stereo,volume={base_volume}[music];"
                    f"[voice][music]amix=inputs=2:duration=first:dropout_transition=2[aout]"
                )
            
            cmd = [
                self.ffmpeg_path,
                '-i', video_path,
                '-i', music_path,
                '-filter_complex', audio_filter,
                '-map', '0:v',
                '-map', '[aout]',
                '-c:v', 'copy',
                '-c:a', 'aac',
                '-b:a', '192k',
                output_path
            ]
        else:
            # Video has no audio - just add music as the only audio stream
            base_volume = 10 ** (config.volume_db / 20)
            
            cmd = [
                self.ffmpeg_path,
                '-i', video_path,
                '-i', music_path,
                '-filter_complex', f'[1:a]volume={base_volume}[aout]',
                '-map', '0:v',
                '-map', '[aout]',
                '-c:v', 'copy',
                '-c:a', 'aac',
                '-b:a', '192k',
                '-shortest',  # Trim music to video length
                output_path
            ]
        
        self._run_ffmpeg(cmd, "music mixing")
        return output_path
    
    def normalize_output_volume(self, video_path: str, config: OutputVolumeConfig) -> str:
        """Apply simple volume adjustment"""
        output_path = self._get_temp_path("volume_normalized.mp4")
        
        # Volume control with compensation for amix reduction
        # amix reduces volume by ~1.414x, so we compensate with higher multiplier:
        # 0% = silent (volume=0)
        # 25% = restored normal volume (volume=4, compensates for amix)
        # 50% = 2x louder than normal (volume=8)
        # 100% = 4x louder than normal (volume=16)
        volume_multiplier = config.target_level * 16  # Maps 0-1 to 0-16x volume
        
        logger.info(f"Applying volume adjustment: {volume_multiplier:.1f}x ({config.target_level * 100:.0f}%)")
        
        # Use simple volume filter for linear amplification
        cmd = [
            self.ffmpeg_path,
            '-i', video_path,
            '-af', f'volume={volume_multiplier}',
            '-c:v', 'copy',  # Don't re-encode video
            '-c:a', 'aac',
            '-b:a', '192k',
            output_path
        ]
        
        self._run_ffmpeg(cmd, "volume adjustment")
        return output_path
    
    
    def generate_variants(
        self,
        video_path: str,
        audio_path: str,
        variant_configs: List[Dict[str, Any]],
        output_dir: str
    ) -> List[Dict[str, Any]]:
        """
        Generate multiple A/B test variants with different enhancement combinations
        """
        variants = []
        
        for i, config in enumerate(variant_configs):
            variant_id = f"variant_{chr(97 + i)}"  # variant_a, variant_b, etc.
            output_path = os.path.join(output_dir, f"{variant_id}.mp4")
            
            logger.info(f"Generating {variant_id}...")
            
            # Parse variant configuration
            # Parse all text overlay configs
            text_configs = []
            for overlay_key in ['text_overlay', 'text_overlay_2', 'text_overlay_3']:
                text_config = self._parse_text_config(config.get(overlay_key))
                if text_config:
                    text_configs.append(text_config)
            
            caption_config = self._parse_caption_config(config.get('captions'))
            music_config = self._parse_music_config(config.get('music'))
            
            # Process variant
            result = self.process_enhanced_video(
                video_path,
                output_path,
                text_configs,
                caption_config,
                music_config,
                audio_path
            )
            
            if result['success']:
                variants.append({
                    'id': variant_id,
                    'path': output_path,
                    'config': config,
                    'metrics': result['metrics']
                })
        
        return variants
    
    
    # ============== Helper Methods ==============
    

    def _build_drawtext_filter(self, config: TextOverlayConfig, video_info: Dict) -> str:
        """Build FFmpeg drawtext filter string with improved scaling and positioning"""
        
        print(f"\n[DRAWTEXT] Building filter for text: '{config.text[:30]}...'")
        
        # Create design space calculator with configuration
        config_dict = {
            'design_width': config.design_width or 1088,
            'design_height': config.design_height or 1904,
            'safe_margins_pct': config.safe_margins_pct or {
                "left": 4.0, "right": 4.0, "top": 5.0, "bottom": 12.0
            },
            'font_px': config.font_px,
            'font_percentage': config.font_percentage,
            'x_pct': config.x_pct,
            'y_pct': config.y_pct,
            'anchor': config.anchor
        }
        
        calculator = create_calculator_from_config(
            video_info['width'],
            video_info['height'],
            config_dict
        )
        
        # Validate configuration
        if not calculator.validate_config():
            raise ValueError("Invalid design space configuration for text overlay")
        
        # Scale font size using unified calculator
        # Priority: font_px > font_percentage > font_size
        if config.font_px is not None:
            scaled_font_size = calculator.scale_font_size(font_px=config.font_px)
        elif config.font_percentage is not None:
            scaled_font_size = calculator.scale_font_size(font_percentage=config.font_percentage)
        elif config.font_size is not None:
            # Use font_size as design space pixels
            scaled_font_size = calculator.scale_font_size(font_px=config.font_size)
        else:
            # Fallback to default
            scaled_font_size = calculator.scale_font_size()
        
        print(f"[DRAWTEXT] Scaled font size: {scaled_font_size}px")
        
        # Get position expressions with anchor support
        x_pct = config.x_pct if config.x_pct is not None else 50.0
        y_pct = config.y_pct if config.y_pct is not None else 50.0
        anchor = config.anchor or "center"
        
        x_expr, y_expr = calculator.get_ffmpeg_position_expression(x_pct, y_pct, anchor)
        
        print(f"[DRAWTEXT] Position: ({x_pct}%, {y_pct}%) with anchor={anchor}")
        print(f"[DRAWTEXT] FFmpeg expressions: x={x_expr}, y={y_expr}")
        
        # Scale other dimensions
        shadow_x = calculator.scale_dimension(config.shadow_px or config.shadow_offset[0])
        shadow_y = calculator.scale_dimension(config.shadow_px or config.shadow_offset[1])
        bg_padding = calculator.scale_dimension(config.background_padding)
        
        # Handle border/stroke width
        if hasattr(config, 'border_px') and config.border_px:
            border_width = calculator.scale_dimension(config.border_px)
        elif hasattr(config, 'strokeWidth') and config.strokeWidth:
            border_width = calculator.scale_dimension(int(config.strokeWidth))
        else:
            border_width = 0
        
        print(f"[DRAWTEXT] Dimensions: shadow=({shadow_x},{shadow_y}), padding={bg_padding}, border={border_width}")
        
        # Get font path and escape properly for cross-platform compatibility
        font_path = self._get_font_path(config.font_family)
        font_path_escaped = font_path.replace('\\', '/').replace(':', '\\:')
        font_path_for_filter = font_path_escaped.replace("'", "'\\''")
        
        # Build filter using color utilities
        filter_parts = [
            f"drawtext=text='{self._escape_text_for_ffmpeg(config.text)}'",
            f"fontfile='{font_path_for_filter}'",
            f"fontsize={scaled_font_size}",
            f"fontcolor={FFmpegColorBuilder.build_text_color(config.color)}",
            f"text_align=center",  # Center-align multi-line text
            f"x={x_expr}:y={y_expr}"
        ]
        
        # Add background box if enabled
        if config.hasBackground:
            # Get background color and opacity
            bg_color = getattr(config, 'background_color', None) or getattr(config, 'backgroundColor', '#000000')
            bg_opacity = getattr(config, 'backgroundOpacity', 100)
            
            # Handle opacity as percentage (0-100) or decimal (0-1)
            if bg_opacity > 1.0:
                bg_opacity = bg_opacity / 100.0
            
            box_color = FFmpegColorBuilder.build_box_color(bg_color, opacity=bg_opacity)
            filter_parts.append(f"box=1:boxcolor={box_color}:boxborderw={bg_padding}")
            
            print(f"[DRAWTEXT] Background: {bg_color} with opacity {bg_opacity:.2f}")
        else:
            print(f"[DRAWTEXT] No background (hasBackground={config.hasBackground})")
        
        # Add border/stroke if enabled
        if border_width > 0:
            stroke_color = getattr(config, 'strokeColor', '#000000')
            border_color = FFmpegColorBuilder.build_border_color(stroke_color)
            filter_parts.append(f"bordercolor={border_color}:borderw={border_width}")
            
            print(f"[DRAWTEXT] Border: {stroke_color} width={border_width}px")
        
        # Add shadow if enabled
        if config.shadow_enabled and (shadow_x > 0 or shadow_y > 0):
            # Handle shadow color with opacity
            shadow_color_raw = getattr(config, 'shadow_color', 'black@0.8')
            
            # If shadow_color already has @opacity format, use as-is
            if '@' in shadow_color_raw:
                shadow_color = shadow_color_raw
            else:
                # Otherwise, add default opacity
                shadow_color = FFmpegColorBuilder.build_box_color(shadow_color_raw, opacity=0.8)
            
            filter_parts.append(f"shadowcolor={shadow_color}:shadowx={shadow_x}:shadowy={shadow_y}")
            
            print(f"[DRAWTEXT] Shadow: {shadow_color} offset=({shadow_x},{shadow_y})")
        
        # Add animation if specified
        if config.animation == "fade_in":
            filter_parts.append("alpha='if(lt(t\\,1)\\,t\\,1)'")
            print(f"[DRAWTEXT] Animation: fade_in (1 second)")
        
        final_filter = ":".join(filter_parts)
        
        print(f"[DRAWTEXT] Complete filter length: {len(final_filter)} characters")
        print(f"[DRAWTEXT] Filter preview: {final_filter[:150]}...")
        
        return final_filter
    
    
    def add_extended_captions(
        self,
        video_path: str,
        audio_path: str,
        config: ExtendedCaptionConfig,
        video_info: Dict[str, Any]
    ) -> str:
        """
        Add auto-generated captions with extended customization options using subtitles filter for text wrapping
        """
        # Log design-space mode status and config values for captions
        if FEATURE_DESIGN_SPACE_SCALING:
            logger.info("[CAPTIONS - DESIGN-SPACE MODE] Feature flag is ON")
            logger.info(f"  design_width: {config.design_width}")
            logger.info(f"  design_height: {config.design_height}")
            logger.info(f"  x_pct: {config.x_pct}")
            logger.info(f"  y_pct: {config.y_pct}")
            logger.info(f"  anchor: {config.anchor}")
            logger.info(f"  safe_margins_pct: {config.safe_margins_pct}")
            logger.info(f"  font_px: {config.font_px}")
            logger.info(f"  border_px: {config.border_px}")
            logger.info(f"  shadow_px: {config.shadow_px}")

            # Create design space calculator with defaults if needed
            calculator = create_calculator_from_config(
                video_info['width'], video_info['height'],
                {
                    'design_width': config.design_width or 1088,
                    'design_height': config.design_height or 1904,
                    'safe_margins_pct': config.safe_margins_pct or {
                        "left": 4.0, "right": 4.0, "top": 5.0, "bottom": 12.0
                    }
                }
            )
            logger.info(f"  Design space calculator for captions: scale={calculator.scale_factor:.3f}")

            # Map position if percentages provided
            if config.x_pct is not None and config.y_pct is not None:
                x, y = calculator.map_position(
                    config.x_pct, config.y_pct,
                    config.anchor or "center"
                )
                logger.info(f"  Mapped caption position: ({config.x_pct}%, {config.y_pct}%) -> ({x}, {y})")
        else:
            logger.info("[CAPTIONS - LEGACY MODE] Using current scaling with 2.5x multiplier")

        output_path = self._get_temp_path("captioned.mp4")
        
        # Generate caption segments with timing from Whisper
        caption_segments = self._generate_caption_segments(audio_path, config)
        
        # Create ASS subtitle file for proper text wrapping support
        ass_subtitle_path = self._create_ass_subtitle_file(caption_segments, config, video_info)
        
        # CRITICAL FIX: Escape ASS file path for FFmpeg (cross-platform)
        # FFmpeg accepts forward slashes on ALL platforms (Windows, macOS, Linux)
        # Convert backslashes to forward slashes for Windows compatibility
        ass_path_escaped = ass_subtitle_path.replace('\\', '/')
        # Escape colons for FFmpeg filter syntax (required on all platforms)
        ass_path_escaped = ass_path_escaped.replace(':', '\\:')
        
        # IMPORTANT: For subtitles filter, also escape single quotes and wrap in quotes
        # This handles spaces and special characters in the path
        ass_path_for_filter = ass_path_escaped.replace("'", "'\\''")
        
        # Apply extended captions with GPU-accelerated encoding
        cmd = [
            self.ffmpeg_path,
            '-i', video_path,
            '-vf', f"subtitles='{ass_path_for_filter}'",
            '-c:a', 'aac',
            '-b:a', '128k',
            *GPUEncoder.get_encode_params(self.gpu_encoder, quality='balanced'),
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart',
            output_path
        ]
        
        # DEBUG: Log FFmpeg command
        print(f"Caption Debug - FFmpeg Command:")
        print(f"  Full command: {' '.join(cmd)}")
        print(f"  ASS file path (original): {ass_subtitle_path}")
        print(f"  ASS file path (escaped): {ass_path_escaped}")
        print(f"  ASS file path (for filter): {ass_path_for_filter}")
        print(f"  Subtitles filter: subtitles='{ass_path_for_filter}'")
        print(f"  Input video: {video_path}")
        print(f"  Output video: {output_path}")
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            if result.returncode != 0:
                raise RuntimeError(f"FFmpeg caption overlay failed: {result.stderr}")
            
            return output_path
        except subprocess.TimeoutExpired:
            raise RuntimeError("Caption overlay timed out after 120 seconds")
        except Exception as e:
            logger.error(f"FFmpeg caption overlay error: {str(e)}")
            raise
    
    
    def _create_ass_subtitle_file(self, segments: List[Dict[str, Any]], config: ExtendedCaptionConfig, video_info: Dict) -> str:
        """Create ASS subtitle file with improved color handling and positioning"""
        
        print(f"\n[CAPTIONS ASS] Creating subtitle file for {len(segments)} segments")
        
        ass_path = self._get_temp_path("captions.ass")
        
        # Create design space calculator with configuration
        config_dict = {
            'design_width': config.design_width or 1088,
            'design_height': config.design_height or 1904,
            'safe_margins_pct': config.safe_margins_pct or {
                "left": 4.0, "right": 4.0, "top": 5.0, "bottom": 12.0
            },
            'font_px': config.font_px,
            'font_percentage': config.font_percentage
        }
        
        calculator = create_calculator_from_config(
            video_info.get('width', 1920),
            video_info.get('height', 1080),
            config_dict
        )
        
        # Scale font size using unified calculator
        if config.font_px is not None:
            scaled_font_size = calculator.scale_font_size(font_px=config.font_px)
        elif config.font_percentage is not None:
            scaled_font_size = calculator.scale_font_size(font_percentage=config.font_percentage)
        elif config.fontSize is not None:
            # Use fontSize as design space pixels
            scaled_font_size = calculator.scale_font_size(font_px=config.fontSize)
        else:
            scaled_font_size = calculator.scale_font_size()
        
        print(f"[CAPTIONS ASS] Scaled font size: {scaled_font_size}px")
        
        # Scale stroke width if enabled
        if config.hasStroke:
            if config.border_px is not None:
                stroke_width = calculator.scale_dimension(config.border_px)
            else:
                stroke_width = calculator.scale_dimension(int(config.strokeWidth))
        else:
            stroke_width = 0
        
        print(f"[CAPTIONS ASS] Stroke width: {stroke_width}px (enabled={config.hasStroke})")
        
        # Extract font name from CSS font-family string
        font_name = config.fontFamily.split(',')[0].strip().replace('"', '').replace("'", '')
        
        print(f"[CAPTIONS ASS] Font: {font_name}")
        
        # Convert colors using color utilities with validation
        try:
            print(f"[CAPTIONS ASS] 🎨 Input caption color from config: '{config.color}' (type: {type(config.color)})")
            
            # Validate color is not None or empty
            if not config.color:
                print(f"[CAPTIONS ASS] ⚠️ WARNING: Caption color is None or empty! Using fallback white.")
                primary_color = "&HFFFFFF&"
            else:
                primary_color = ASSColorBuilder.build_primary_color(config.color)
                print(f"[CAPTIONS ASS] ✅ Primary color: {config.color} → {primary_color}")
        except Exception as e:
            print(f"[CAPTIONS ASS] ❌ ERROR parsing primary color '{config.color}': {e}")
            import traceback
            traceback.print_exc()
            primary_color = "&HFFFFFF&"  # Fallback to white
        
        try:
            if config.hasStroke:
                outline_color = ASSColorBuilder.build_outline_color(config.strokeColor)
                print(f"[CAPTIONS ASS] Outline color: {config.strokeColor} → {outline_color}")
            else:
                outline_color = "&H000000&"  # Black outline (hidden when stroke=0)
        except Exception as e:
            print(f"[CAPTIONS ASS] ERROR parsing outline color '{config.strokeColor}': {e}")
            outline_color = "&H000000&"
        
        try:
            if config.hasBackground:
                # Handle opacity as percentage (0-100) or decimal (0-1)
                bg_opacity = config.backgroundOpacity
                if bg_opacity > 1.0:
                    bg_opacity = bg_opacity / 100.0
                
                background_color = ASSColorBuilder.build_back_color(
                    config.backgroundColor,
                    opacity=bg_opacity
                )
                print(f"[CAPTIONS ASS] Background color: {config.backgroundColor} @ {bg_opacity:.2f} → {background_color}")
            else:
                background_color = "&H00000000&"  # Transparent background
                print(f"[CAPTIONS ASS] No background")
        except Exception as e:
            print(f"[CAPTIONS ASS] ERROR parsing background color '{config.backgroundColor}': {e}")
            background_color = "&H00000000&"
        
        # Map position using design space calculator
        x_pct = config.x_pct if config.x_pct is not None else config.x_position
        y_pct = config.y_pct if config.y_pct is not None else config.y_position
        anchor = config.anchor or "center"
        
        pos_x, pos_y = calculator.map_position(x_pct, y_pct, anchor)
        
        print(f"[CAPTIONS ASS] Position: ({x_pct}%, {y_pct}%) with anchor={anchor} → ({pos_x}, {pos_y})")
        
        # Use design space dimensions for PlayRes
        play_res_x = config.design_width or 1088
        play_res_y = config.design_height or 1904
        
        print(f"[CAPTIONS ASS] PlayRes: {play_res_x}x{play_res_y}")
        
        # Calculate text wrapping width
        video_width = video_info.get('width', 1920)
        max_line_width = int(video_width * 0.8 * (scaled_font_size / 32))
        
        # Determine BorderStyle based on hasBackground and hasStroke settings
        # BorderStyle values:
        # 1 = Outline + drop shadow (no background box)
        # 3 = Opaque box (background box only)
        # 4 = Opaque box with outline (background + outline)
        if config.hasBackground:
            if config.hasStroke and stroke_width > 0:
                border_style = 4  # Background box with outline
            else:
                border_style = 3  # Background box only
            print(f"[CAPTIONS ASS] Background enabled: BorderStyle={border_style}")
        else:
            border_style = 1  # Outline only, no background
            print(f"[CAPTIONS ASS] Background disabled: BorderStyle={border_style}")
        
        # Create ASS header with all styling
        ass_content = f"""[Script Info]
Title: Auto-generated Captions
ScriptType: v4.00+
PlayResX: {play_res_x}
PlayResY: {play_res_y}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_name},{scaled_font_size},{primary_color},{primary_color},{outline_color},{background_color},0,0,0,0,100,100,0,0,{border_style},{stroke_width},0,0,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
        
        # Add caption segments with positioning
        for i, segment in enumerate(segments):
            start_time = self._seconds_to_ass_time(segment['start_time'])
            end_time = self._seconds_to_ass_time(segment['end_time'])
            
            # Apply text transformations
            original_text = segment['text']
            text = original_text.upper() if config.allCaps else original_text
            
            # Wrap text for readability
            wrapped_text = self._wrap_text_for_ass(text, max_line_width, scaled_font_size)
            
            # Add positioning tag with center alignment (\\an5)
            positioned_text = f"{{\\an5\\pos({pos_x},{pos_y})}}{wrapped_text}"
            
            ass_content += f"Dialogue: 0,{start_time},{end_time},Default,,0,0,0,,{positioned_text}\n"
            
            # Debug first segment
            if i == 0:
                print(f"[CAPTIONS ASS] First segment: '{text[:50]}...'")
                print(f"[CAPTIONS ASS] Positioning tag: \\an5\\pos({pos_x},{pos_y})")
        
        # Write ASS file
        with open(ass_path, 'w', encoding='utf-8') as f:
            f.write(ass_content)
        
        print(f"[CAPTIONS ASS] ✅ Created ASS file: {ass_path}")
        print(f"[CAPTIONS ASS] Total segments: {len(segments)}")
        print(f"[CAPTIONS ASS] File size: {len(ass_content)} bytes")
        
        return ass_path
    
    def _seconds_to_ass_time(self, seconds: float) -> str:
        """Convert seconds to ASS time format (H:MM:SS.CC)"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        seconds = seconds % 60
        return f"{hours}:{minutes:02d}:{seconds:05.2f}"
    
    def _wrap_text_for_ass(self, text: str, max_width: int, font_size: int) -> str:
        """Wrap text for ASS format with proper line breaks"""
        words = text.split()
        if not words:
            return text
        
        # Estimate characters per line based on max width and font size
        # This is approximate - ASS will handle the actual rendering
        approx_chars_per_line = max(20, max_width // (font_size // 2))
        
        lines = []
        current_line = []
        current_length = 0
        
        for word in words:
            word_length = len(word)
            
            # Check if adding this word would exceed the line limit
            if current_length + word_length + len(current_line) > approx_chars_per_line and current_line:
                lines.append(' '.join(current_line))
                current_line = [word]
                current_length = word_length
            else:
                current_line.append(word)
                current_length += word_length
        
        # Add the last line
        if current_line:
            lines.append(' '.join(current_line))
        
        # Join lines with ASS line break marker
        return '\\N'.join(lines)

    def _generate_caption_segments(self, audio_path: str, config: ExtendedCaptionConfig) -> List[Dict[str, Any]]:
        """Generate timed caption segments from audio using WhisperService"""
        try:
            # Use same WhisperService approach as existing system
            from backend.whisper_service import WhisperService, WhisperConfig
            
            # Setup Whisper configuration (same as existing extended captions)
            whisper_config = WhisperConfig(
                api_key=None,  # Force local processing
                use_api=False,  # Use local Whisper model
                model_size="base",  # Good balance of speed and accuracy
                word_timestamps=True,  # Essential for timing
                highlight_words=None,  # No highlighting needed for drawtext
                max_words_per_caption=config.max_words_per_segment,  # User configurable
                language=None  # Auto-detect language
            )
            
            # DEBUG: Log Whisper configuration
            print(f"Caption Debug - Whisper Config:")
            print(f"  config.max_words_per_segment: {config.max_words_per_segment}")
            print(f"  whisper_config.max_words_per_caption: {whisper_config.max_words_per_caption}")
            
            # Initialize Whisper service
            whisper_service = WhisperService(whisper_config)
            
            # Generate captions with proper timing
            result = whisper_service.transcribe(
                audio_path=audio_path,
                output_format='srt',  # SRT format for parsing
                template_style=config.template
            )
            
            # Debug: Check what's in the result
            print(f"Caption Debug - Whisper result keys: {result.keys() if result else 'None'}")
            print(f"Caption Debug - Whisper success: {result.get('success') if result else 'No result'}")
            
            # Parse the SRT content to extract segments with timing
            segments = []
            if result and result.get('success'):
                srt_content = None
                
                # Check if we have a caption file path to read from
                if 'caption_file' in result and result['caption_file']:
                    try:
                        with open(result['caption_file'], 'r', encoding='utf-8') as f:
                            srt_content = f.read()
                        print(f"Caption Debug - Read SRT from file: {result['caption_file']}")
                    except Exception as e:
                        print(f"Caption Debug - Error reading SRT file: {e}")
                
                # Fallback: check for direct content keys
                if not srt_content:
                    for key in ['srt_content', 'content', 'srt', 'transcription']:
                        if key in result and result[key]:
                            srt_content = result[key]
                            print(f"Caption Debug - Found SRT content in '{key}' key")
                            break
                    
                print(f"Caption Debug - SRT content found: {srt_content is not None}")
                if srt_content:
                    print(f"Caption Debug - SRT content preview: {srt_content[:200]}...")
                    segments = self._parse_srt_to_segments(srt_content)
            
            print(f"Caption Debug - Generated {len(segments)} caption segments")
            return segments
            
        except Exception as e:
            print(f"Caption segment generation failed: {str(e)}")
            import traceback
            traceback.print_exc()
            return []
    
    
    def _parse_srt_to_segments(self, srt_content: str) -> List[Dict[str, Any]]:
        """Parse SRT content into timed segments for drawtext"""
        segments = []
        
        print(f"Caption Debug - Parsing SRT content of length: {len(srt_content)}")
        
        # Split SRT into individual subtitle blocks
        blocks = srt_content.strip().split('\n\n')
        print(f"Caption Debug - Found {len(blocks)} SRT blocks")
        
        for i, block in enumerate(blocks):
            lines = block.strip().split('\n')
            print(f"Caption Debug - Block {i+1}: {len(lines)} lines - {lines}")
            
            if len(lines) >= 3:
                # Parse timing (format: 00:00:01,000 --> 00:00:03,500)
                timing_line = lines[1]
                if '-->' in timing_line:
                    try:
                        start_str, end_str = timing_line.split(' --> ')
                        start_time = self._srt_time_to_seconds(start_str.strip())
                        end_time = self._srt_time_to_seconds(end_str.strip())
                        
                        # Get text content (may be multiple lines)
                        text_lines = lines[2:]
                        text = ' '.join(text_lines).strip()
                        
                        if text:  # Only add non-empty segments
                            segment = {
                                'text': text,
                                'start_time': start_time,
                                'end_time': end_time,
                                'duration': end_time - start_time
                            }
                            segments.append(segment)
                            word_count = len(text.split())
                            print(f"Caption Debug - Added segment {len(segments)}: '{text}' ({start_time:.2f}s -> {end_time:.2f}s) [{word_count} words]")
                    except Exception as e:
                        print(f"Caption Debug - Error parsing block {i+1}: {e}")
        
        return segments
    
    
    def _srt_time_to_seconds(self, time_str: str) -> float:
        """Convert SRT time format (HH:MM:SS,mmm) to seconds"""
        try:
            # Handle both comma and dot decimal separators
            time_str = time_str.replace(',', '.')
            parts = time_str.split(':')
            hours = float(parts[0])
            minutes = float(parts[1]) 
            seconds = float(parts[2])
            return hours * 3600 + minutes * 60 + seconds
        except:
            return 0.0
    
    
    def _build_caption_drawtext_filter(self, segments: List[Dict[str, Any]], config: ExtendedCaptionConfig, video_info: Dict) -> str:
        """Build chained drawtext filters for caption segments with keyword coloring"""
        if not segments:
            return "null"  # No captions to add
        
        # CRITICAL: Match preview font sizing exactly
        base_font_size = config.fontSize if config.fontSize else 20
        scaled_font_size = int(base_font_size * 0.8)  # Scale DOWN from config value
        
        print(f"Caption Debug - Drawtext FontSize: {scaled_font_size} (from config: {base_font_size})")
        
        # Use same positioning logic as text overlays
        position_x, position_y = self._get_caption_position(config, video_info)
        
        # Build individual drawtext filters for each segment
        drawtext_filters = []
        
        for i, segment in enumerate(segments):
            # Escape text for FFmpeg (handle quotes, special characters)
            escaped_text = self._escape_text_for_ffmpeg(segment['text'])
            
            # Build drawtext filter with template styling applied consistently
            filter_parts = [
                f"drawtext=text='{escaped_text}'",
                f"fontfile={self._get_font_path(config.fontFamily)}",
                f"fontsize={scaled_font_size}",
                f"fontcolor={FFmpegColorBuilder.build_text_color(config.color)}",  # Use proper color utility
                f"x={position_x}",
                f"y={position_y}",
                f"enable='between(t,{segment['start_time']:.2f},{segment['end_time']:.2f})'"
            ]
            
            # Add stroke if enabled (same as text overlays)
            if config.hasStroke:
                try:
                    stroke_color = FFmpegColorBuilder.build_border_color(config.strokeColor)
                    filter_parts.append(f"bordercolor={stroke_color}:borderw={config.strokeWidth}")
                    print(f"[CAPTION DRAWTEXT] Stroke: {config.strokeColor} → {stroke_color}")
                except Exception as e:
                    print(f"[CAPTION DRAWTEXT] ❌ ERROR parsing stroke color '{config.strokeColor}': {e}")
                    filter_parts.append(f"bordercolor=black:borderw={config.strokeWidth}")  # Fallback
            
            # Add background box if enabled
            if config.hasBackground:
                try:
                    # Use proper FFmpeg color builder for background
                    bg_opacity = config.backgroundOpacity
                    if bg_opacity > 1.0:
                        bg_opacity = bg_opacity / 100.0
                    
                    boxcolor = FFmpegColorBuilder.build_box_color(config.backgroundColor, bg_opacity)
                    filter_parts.append(f"box=1:boxcolor={boxcolor}:boxborderw=10")
                    print(f"[CAPTION DRAWTEXT] Background: {config.backgroundColor} @ {bg_opacity:.2f} → {boxcolor}")
                except Exception as e:
                    print(f"[CAPTION DRAWTEXT] ❌ ERROR parsing background color '{config.backgroundColor}': {e}")
                    filter_parts.append("box=1:boxcolor=black@0.8:boxborderw=10")  # Fallback
            
            drawtext_filter = ":".join(filter_parts)
            drawtext_filters.append(drawtext_filter)
            print(f"Caption Debug - Filter {i+1}: {drawtext_filter}")
        
        # Chain all drawtext filters together with proper FFmpeg syntax
        if len(drawtext_filters) == 1:
            final_filter = drawtext_filters[0]
        else:
            # For multiple filters, separate them with commas (FFmpeg filter chain syntax)
            final_filter = ",".join(drawtext_filters)
        
        print(f"Caption Debug - Final chained filter: {final_filter}")
        return final_filter
    
    
    def _get_caption_position(self, config: ExtendedCaptionConfig, video_info: Dict) -> tuple:
        """Get caption position using design space calculator for consistency"""
        
        # Create calculator for position mapping
        calculator = create_calculator_from_config(
            video_info.get('width', 1920),
            video_info.get('height', 1080),
            {
                'design_width': config.design_width or 1088,
                'design_height': config.design_height or 1904,
                'safe_margins_pct': config.safe_margins_pct or {
                    "left": 4.0, "right": 4.0, "top": 5.0, "bottom": 12.0
                }
            }
        )
        
        # Use x_pct/y_pct if available, otherwise fall back to x_position/y_position
        x_pct = config.x_pct if config.x_pct is not None else config.x_position
        y_pct = config.y_pct if config.y_pct is not None else config.y_position
        anchor = config.anchor or "center"
        
        # Get FFmpeg position expressions
        x_expr, y_expr = calculator.get_ffmpeg_position_expression(x_pct, y_pct, anchor)
        
        print(f"Caption Debug - Position: x={x_expr}, y={y_expr} (for x_pct={x_pct}%, y_pct={y_pct}%, anchor={anchor})")
        return x_expr, y_expr
    
    
    def _escape_text_for_ffmpeg(self, text: str) -> str:
        """Escape text for FFmpeg drawtext filter"""
        # FFmpeg drawtext requires specific escaping for text in single quotes
        # Replace single quotes with escaped version for drawtext
        text = text.replace("\\", "\\\\")  # Escape backslashes first
        text = text.replace("'", "'\\''")  # Close quote, escaped quote, reopen quote
        text = text.replace(":", "\\:")    # Escape colons
        text = text.replace("=", "\\=")    # Escape equals
        text = text.replace(",", "\\,")    # Escape commas
        return text
    
    
    def _generate_extended_captions(self, audio_path: str, config: ExtendedCaptionConfig) -> str:
        """Generate caption file using WhisperService for extended captions"""
        from backend.whisper_service import WhisperService, WhisperConfig
        
        try:
            logger.info(f"Generating captions for audio: {audio_path}")
            
            # Setup Whisper configuration for caption generation
            # Use local Whisper for better control and no API costs
            whisper_config = WhisperConfig(
                api_key=None,  # Force local processing
                use_api=False,  # Use local Whisper model
                model_size="base",  # Good balance of speed and accuracy
                word_timestamps=True,  # Essential for word-by-word caption appearance
                highlight_words=DEFAULT_HIGHLIGHT_WORDS if config.highlight_keywords else None,
                max_words_per_caption=config.max_words_per_line,
                language=None  # Auto-detect language
            )
            
            # Initialize Whisper service
            whisper_service = WhisperService(whisper_config)
            
            # Generate captions with proper timing
            result = whisper_service.transcribe(
                audio_path=audio_path,
                output_format='srt',  # SRT format for FFmpeg compatibility
                template_style=config.template  # Use the selected caption template
            )
            
            if result['success']:
                logger.info(f"Captions generated successfully: {result['word_count']} words, "
                          f"Method: {result['method_used']}, Time: {result['processing_time']:.2f}s")
                return result['caption_file']
            else:
                logger.error(f"Caption generation failed")
                # Fallback to empty caption file
                caption_file = self._get_temp_path("captions.srt")
                with open(caption_file, 'w') as f:
                    f.write("")
                return caption_file
                
        except Exception as e:
            logger.error(f"Error generating captions: {str(e)}")
            # Create empty caption file as fallback
            caption_file = self._get_temp_path("captions.srt")
            with open(caption_file, 'w') as f:
                f.write("")
            return caption_file
    
    
    def _build_extended_subtitle_filter(self, caption_file: str, config: ExtendedCaptionConfig, video_info: Dict) -> str:
        # DEBUG: Log function entry and positioning values
        print(f"=== CAPTION DEBUG - Step 3: _build_extended_subtitle_filter called ===")
        print(f"Config X position: {config.x_position}")
        print(f"Config Y position: {config.y_position}")
        print(f"Function being used: _build_extended_subtitle_filter (CORRECT)")
        """Build FFmpeg subtitle filter with extended styling options"""
        # Use same font scaling approach as text overlays for consistency
        # Text overlays use 4x multiplier, let's use 2x for captions to be more reasonable
        base_font_size = config.fontSize * 2  # Scale up for video like text overlays
        font_size = max(16, base_font_size)  # Minimum 16px
        
        # Calculate position based on video dimensions
        video_width = video_info['width']
        video_height = video_info['height']
        
        # Convert percentage positions to pixels
        x_pos = int(video_width * (config.x_position / 100))
        y_pos = int(video_height * (config.y_position / 100))
        
        # Build force_style as a single string with all styling options
        style_options = []
        style_options.append(f"FontName={config.fontFamily}")
        style_options.append(f"FontSize={font_size}")
        
        # Debug logging to verify config values
        print(f"Caption Debug - FontFamily: {config.fontFamily}, FontSize: {font_size}")
        print(f"Caption Debug - Position: ({config.x_position}%, {config.y_position}%)")
        print(f"Caption Debug - hasBackground: {config.hasBackground}")
        print(f"Caption Debug - Stroke: {config.hasStroke}, StrokeColor: {config.strokeColor}")
        
        # Add color styling using proper color utilities
        try:
            primary_color = ASSColorBuilder.build_primary_color(config.color)
            style_options.append(f"PrimaryColour={primary_color}")
            print(f"[CAPTION FILTER] Primary color: {config.color} → {primary_color}")
        except Exception as e:
            print(f"[CAPTION FILTER] ❌ ERROR parsing primary color '{config.color}': {e}")
            style_options.append("PrimaryColour=&HFFFFFF&")  # White fallback
        
        # Add stroke if enabled
        if config.hasStroke:
            try:
                outline_color = ASSColorBuilder.build_outline_color(config.strokeColor)
                style_options.append(f"OutlineColour={outline_color}")
                style_options.append(f"Outline={config.strokeWidth}")
                print(f"[CAPTION FILTER] Outline color: {config.strokeColor} → {outline_color}")
            except Exception as e:
                print(f"[CAPTION FILTER] ❌ ERROR parsing outline color '{config.strokeColor}': {e}")
                style_options.append("OutlineColour=&H000000&")
                style_options.append(f"Outline={config.strokeWidth}")
        else:
            style_options.append("Outline=0")
        
        # Add background if enabled
        if config.hasBackground:
            style_options.append("BorderStyle=4")
            # Use proper color utility for background with opacity
            try:
                # Handle opacity as percentage (0-100) or decimal (0-1)
                bg_opacity = config.backgroundOpacity
                if bg_opacity > 1.0:
                    bg_opacity = bg_opacity / 100.0
                
                background_color = ASSColorBuilder.build_back_color(
                    config.backgroundColor,
                    opacity=bg_opacity
                )
                print(f"[CAPTION FILTER] Background color: {config.backgroundColor} @ {bg_opacity:.2f} → {background_color}")
                style_options.append(f"BackColour={background_color}")
            except Exception as e:
                print(f"[CAPTION FILTER] ❌ ERROR parsing background color '{config.backgroundColor}': {e}")
                style_options.append("BackColour=&H80000000&")  # Semi-transparent black fallback
        else:
            style_options.append("BorderStyle=1")
        
        # Use positioning logic similar to text overlays
        # Convert percentage to alignment + margin like text overlays
        print(f"=== CAPTION DEBUG - Step 3a: Positioning calculation ===")
        print(f"Y position: {config.y_position}%")
        
        if config.y_position >= 80:  # Bottom area (85% -> bottom)
            alignment = 2  # Bottom center
            # Small margin from bottom like text overlays use 50px
            margin_v = 50  # Fixed margin like text overlays
            print(f"Using BOTTOM positioning: alignment={alignment}, margin_v={margin_v}")
        elif config.y_position <= 20:  # Top area
            alignment = 8  # Top center  
            margin_v = 50  # Fixed margin from top
            print(f"Using TOP positioning: alignment={alignment}, margin_v={margin_v}")
        else:  # Middle area
            alignment = 5  # Middle center
            margin_v = 20  # Small margin
            print(f"Using MIDDLE positioning: alignment={alignment}, margin_v={margin_v}")
        
        style_options.append(f"Alignment={alignment}")
        style_options.append(f"MarginV={margin_v}")
        
        print(f"Final positioning added to style_options: Alignment={alignment}, MarginV={margin_v}")
        
        # Combine all style options into the force_style parameter
        force_style = ",".join(style_options)
        
        # CRITICAL FIX: Escape caption file path for FFmpeg (cross-platform)
        # FFmpeg accepts forward slashes on ALL platforms (Windows, macOS, Linux)
        # Convert backslashes to forward slashes for Windows compatibility
        caption_file_escaped = caption_file.replace('\\', '/')
        # Escape colons for FFmpeg filter syntax (required on all platforms)
        caption_file_escaped = caption_file_escaped.replace(':', '\\:')
        # For subtitles filter, also escape single quotes and wrap in quotes
        # This handles spaces and special characters in the path
        caption_file_for_filter = caption_file_escaped.replace("'", "'\\''")
        
        # Build the complete subtitle filter
        subtitle_filter = f"subtitles='{caption_file_for_filter}':force_style='{force_style}'"
        
        # Debug: print the complete subtitle filter command
        print(f"=== CAPTION DEBUG - Step 3b: Final filter output ===")
        print(f"Complete subtitle filter: {subtitle_filter}")
        print(f"Force style contains: {force_style}")
        print(f"Caption file path (original): {caption_file}")
        print(f"Caption file path (escaped): {caption_file_escaped}")
        print(f"Caption file path (for filter): {caption_file_for_filter}")
        
        return subtitle_filter
    
    
    def _build_subtitle_filter(self, caption_file: str, style: Dict, video_info: Dict) -> str:
        """Build FFmpeg subtitle filter with styling"""
        # Calculate font size based on video height
        font_size = int(video_info['height'] * style['size_ratio'])
        
        # Build force_style as a single string with all styling options
        style_options = []
        style_options.append(f"FontName={style['font']}")
        style_options.append(f"FontSize={font_size}")
        
        # Add color styling
        style_options.append(f"PrimaryColour=&H{self._color_to_ass(style['color'])}")
        
        # Add outline/stroke if specified
        if style.get('stroke'):
            style_options.append(f"OutlineColour=&H{self._color_to_ass('black')}")
            style_options.append("Outline=2")
        
        # Add background/box if specified
        if style.get('background'):
            style_options.append("BorderStyle=4")
            style_options.append("BackColour=&H80000000")
        
        # Add positioning (2 = bottom center)
        style_options.append("Alignment=2")
        
        # Combine all style options into the force_style parameter
        force_style = ",".join(style_options)
        
        # CRITICAL FIX: Escape caption file path for FFmpeg (cross-platform)
        # FFmpeg accepts forward slashes on ALL platforms (Windows, macOS, Linux)
        # Convert backslashes to forward slashes for Windows compatibility
        caption_file_escaped = caption_file.replace('\\', '/')
        # Escape colons for FFmpeg filter syntax (required on all platforms)
        caption_file_escaped = caption_file_escaped.replace(':', '\\:')
        # For subtitles filter, also escape single quotes and wrap in quotes
        # This handles spaces and special characters in the path
        caption_file_for_filter = caption_file_escaped.replace("'", "'\\''")
        
        # Build the complete subtitle filter
        subtitle_filter = f"subtitles='{caption_file_for_filter}':force_style='{force_style}'"
        
        return subtitle_filter
    
    
    def _build_audio_mix_filter(self, config: MusicConfig) -> str:
        """Build audio mixing filter"""
        filter_parts = []
        
        # Base volume adjustment for music
        base_volume = 10 ** (config.volume_db / 20)
        filter_parts.append(f"[1:a]volume={base_volume}[music_vol]")
        
        # Fade-in disabled - skip fade processing
        filter_parts.append("[music_vol]anull[music_fade]")
        
        # Mix original audio with processed music
        # Using amix to properly blend both audio streams
        # duration=first: Stop when video audio ends (correct for Avatar campaigns)
        filter_parts.append(f"[0:a][music_fade]amix=inputs=2:duration=first:dropout_transition=2[aout]")
        
        return ";".join(filter_parts)
    
    
    def _video_has_audio(self, video_path: str) -> bool:
        """Check if video has an audio stream"""
        try:
            cmd = [
                self.ffprobe_path,
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_streams',
                '-select_streams', 'a',
                video_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            info = json.loads(result.stdout)
            
            # Check if any audio streams exist
            has_audio = len(info.get('streams', [])) > 0
            return has_audio
            
        except Exception as e:
            logger.warning(f"Could not detect audio stream: {e}")
            return False  # Assume no audio on error
    
    def _get_video_info(self, video_path: str) -> Dict[str, Any]:
        """Extract video properties using FFprobe"""
        cmd = [
            self.ffprobe_path,
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_streams',
            video_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        info = json.loads(result.stdout)
        
        video_stream = next(s for s in info['streams'] if s['codec_type'] == 'video')
        
        return {
            'width': int(video_stream['width']),
            'height': int(video_stream['height']),
            'fps': eval(video_stream['r_frame_rate']),
            'duration': float(video_stream.get('duration', 0)),
            'codec': video_stream['codec_name']
        }
    
    
    def _run_ffmpeg(self, cmd: List[str], operation: str) -> None:
        """Run FFmpeg command with error handling"""
        logger.debug(f"Running FFmpeg for {operation}: {' '.join(cmd)}")
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            if result.returncode != 0:
                raise RuntimeError(f"FFmpeg {operation} failed: {result.stderr}")
                
        except subprocess.TimeoutExpired:
            raise TimeoutError(f"FFmpeg {operation} timed out after 5 minutes")
        except Exception as e:
            logger.error(f"FFmpeg {operation} error: {str(e)}")
            raise
    
    
    def _get_temp_path(self, filename: str) -> str:
        """Generate unique temporary file path"""
        unique_id = hashlib.md5(str(random.random()).encode()).hexdigest()[:8]
        return str(self.temp_dir / f"{unique_id}_{filename}")
    
    
    def _get_font_path(self, font_family: str) -> str:
        """
        Get path to font file with cross-platform support.
        Uses the centralized FontManager for OS-aware font resolution.
        """
        from backend.font_manager import get_font_manager
        
        # Get font manager with assets directory
        font_manager = get_font_manager(
            assets_dir=Path(__file__).parent.parent / "assets" / "fonts"
        )
        
        return font_manager.get_font_path(font_family)
    
    
    def _color_to_ass(self, color: str) -> str:
        """Convert hex color or color name to ASS subtitle format (BGR format)"""
        # Handle hex colors (e.g., #FFFFFF, #000000)
        if color.startswith('#'):
            hex_color = color[1:]  # Remove the #
            if len(hex_color) == 6:
                # Convert RGB to BGR for ASS format
                r = hex_color[0:2]
                g = hex_color[2:4]
                b = hex_color[4:6]
                return f"{b}{g}{r}"  # BGR format for ASS
            else:
                return "FFFFFF"  # Default to white if invalid hex
        
        # Handle named colors
        color_map = {
            "white": "FFFFFF",
            "black": "000000",
            "yellow": "00FFFF",
            "red": "0000FF",
            "blue": "FF0000",
            "green": "00FF00"
        }
        return color_map.get(color.lower(), "FFFFFF")
    
    
    def _get_timestamp(self) -> float:
        """Get current timestamp"""
        import time
        return time.time()
    
    
    def _metrics_to_dict(self) -> Dict[str, Any]:
        """Convert metrics to dictionary"""
        return {
            "text_contrast_ratio": self.metrics.text_contrast_ratio,
            "caption_sync_accuracy": self.metrics.caption_sync_accuracy,
            "audio_balance_db": self.metrics.audio_balance_db,
            "processing_time": self.metrics.processing_time,
            "file_size_mb": self.metrics.file_size_mb,
            "resolution": self.metrics.resolution,
            "fps": self.metrics.fps,
            "bitrate_mbps": self.metrics.bitrate_mbps
        }
    
    
    def _validate_quality(self, video_path: str) -> None:
        """Validate output video quality"""
        # Check file size
        file_size = os.path.getsize(video_path) / (1024 * 1024)
        if file_size > 500:
            logger.warning(f"Output file is large: {file_size:.2f} MB")
        
        # Check video properties
        info = self._get_video_info(video_path)
        if info['fps'] < 24:
            logger.warning(f"Low framerate detected: {info['fps']} fps")
    
    
    def _finalize_output(self, temp_path: str, final_path: str) -> None:
        """Move temporary file to final location"""
        import shutil
        os.makedirs(os.path.dirname(final_path), exist_ok=True)
        shutil.move(temp_path, final_path)
        logger.info(f"Output saved to: {final_path}")
    
    
    def _generate_captions(self, audio_path: str, config: CaptionConfig) -> str:
        """Generate caption file using WhisperService for professional captions"""
        from backend.whisper_service import WhisperService, WhisperConfig
        
        try:
            logger.info(f"Generating captions for audio: {audio_path}")
            
            # Setup Whisper configuration for caption generation
            # Use local Whisper for better control and no API costs
            whisper_config = WhisperConfig(
                api_key=None,  # Force local processing
                use_api=False,  # Use local Whisper model
                model_size="base",  # Good balance of speed and accuracy
                word_timestamps=True,  # Essential for word-by-word caption appearance
                highlight_words=DEFAULT_HIGHLIGHT_WORDS if config.highlight_keywords else None,
                max_words_per_caption=config.max_words_per_line,
                language=None  # Auto-detect language
            )
            
            # Initialize Whisper service
            whisper_service = WhisperService(whisper_config)
            
            # Generate captions with proper timing
            result = whisper_service.transcribe(
                audio_path=audio_path,
                output_format='srt',  # SRT format for FFmpeg compatibility
                template_style=config.style.value  # Use the selected caption style
            )
            
            if result['success']:
                logger.info(f"Captions generated successfully: {result['word_count']} words, "
                          f"Method: {result['method_used']}, Time: {result['processing_time']:.2f}s")
                return result['caption_file']
            else:
                logger.error(f"Caption generation failed")
                # Fallback to empty caption file
                caption_file = self._get_temp_path("captions.srt")
                with open(caption_file, 'w') as f:
                    f.write("")
                return caption_file
                
        except Exception as e:
            logger.error(f"Error generating captions: {str(e)}")
            # Create empty caption file as fallback
            caption_file = self._get_temp_path("captions.srt")
            with open(caption_file, 'w') as f:
                f.write("")
            return caption_file
    
    
    def _select_music_track(self, track_id: Optional[str]) -> Optional[str]:
        """Select music track from library using MusicLibrary service"""
        from backend.music_library import MusicLibrary, MusicSelectionConfig, MusicCategory
        
        try:
            logger.info(f"Selecting music track: {track_id}")
            
            # Initialize music library
            music_library = MusicLibrary()
            
            # Setup selection configuration based on track_id
            if track_id == 'random_upbeat':
                # Select random track from upbeat category
                config = MusicSelectionConfig(
                    category=MusicCategory.UPBEAT,
                    random_selection=True,
                    duration_range=(15, 180)  # 15 seconds to 3 minutes
                )
            elif track_id == 'random_chill':
                # Select random track from chill category
                config = MusicSelectionConfig(
                    category=MusicCategory.CHILL,
                    random_selection=True,
                    duration_range=(15, 180)
                )
            elif track_id == 'random_dramatic':
                # Select random track from dramatic category
                config = MusicSelectionConfig(
                    category=MusicCategory.DRAMATIC,
                    random_selection=True,
                    duration_range=(15, 180)
                )
            elif track_id == 'random_inspiring':
                # Select random track from inspiring category
                config = MusicSelectionConfig(
                    category=MusicCategory.INSPIRING,
                    random_selection=True,
                    duration_range=(15, 180)
                )
            elif track_id and track_id != 'none':
                # Use specific track ID - access directly from tracks dict
                track_metadata = music_library.tracks.get(track_id)
                
                if track_metadata and track_metadata.path:
                    logger.info(f"Music track selected: {track_metadata.filename} "
                              f"({track_metadata.category.value if track_metadata.category else 'Unknown'} - {track_metadata.duration:.1f}s)")
                    return str(track_metadata.path)
                else:
                    logger.warning(f"No music track found for ID: {track_id}")
                    return None
            else:
                # No music selected
                logger.info("No music track selected")
                return None
            
            # Get track from library (for random selections)
            track_info = music_library.select_track(config)
            
            if track_info and track_info.get('path'):
                track_path = track_info['path']
                logger.info(f"Music track selected: {track_info.get('name', 'Unknown')} "
                          f"({track_info.get('category', 'Unknown')} - {track_info.get('duration', 0):.1f}s)")
                return track_path
            else:
                logger.warning(f"No suitable music track found for: {track_id}")
                return None
                
        except Exception as e:
            logger.error(f"Error selecting music track: {str(e)}")
            # Fallback to direct file lookup
            music_dir = self.working_dir.parent / "uploads" / "music"
            if track_id and track_id != 'none':
                track_path = music_dir / f"{track_id}.mp3"
                if track_path.exists():
                    logger.info(f"Using fallback music file: {track_path}")
                    return str(track_path)
            return None
    
    
    def _calculate_ducking_parameters(self, voice_path: str, config: MusicConfig) -> Dict:
        """Calculate auto-ducking parameters for intelligent music volume adjustment"""
        try:
            # Return ducking parameters for sidechain compression
            params = {
                "duck_points": [],  # Could be populated with speech detection timestamps
                "duck_level": config.duck_level_db,  # How much to reduce music when voice is present
                "threshold": -35,  # Voice level that triggers ducking
                "ratio": 6,  # Compression ratio for ducking
                "attack": 0.1,  # How fast to duck (seconds)
                "release": 0.5  # How fast to restore (seconds)
            }
            
            logger.info(f"Auto-ducking configured: level={params['duck_level']}dB")
            return params
            
        except Exception as e:
            logger.error(f"Error calculating ducking parameters: {str(e)}")
            return {
                "duck_points": [],
                "duck_level": config.duck_level_db
            }
    
    def _calculate_static_volume(self, voice_path: str, config: MusicConfig) -> float:
        """Analyze voice level and calculate optimal static music volume"""
        try:
            logger.info(f"Analyzing voice file: {voice_path}")
            logger.info(f"Voice file exists: {os.path.exists(voice_path) if voice_path else False}")
            
            # Analyze voice audio to get average dB level
            cmd = [
                self.ffprobe_path,
                '-f', 'lavfi',
                '-i', f'amovie={voice_path},astats=metadata=1:reset=1',
                '-show_entries', 'frame=pkt_pts_time:frame_tags=lavfi.astats.Overall.RMS_level',
                '-of', 'csv=p=0',
                '-v', 'quiet'
            ]
            
            logger.info(f"Running voice analysis command: {' '.join(cmd)}")
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            logger.info(f"Voice analysis result: {result.stdout[:200]}...")  # First 200 chars
            
            # Parse RMS levels from output
            levels = []
            for line in result.stdout.strip().split('\n'):
                if line and ',' in line:
                    try:
                        parts = line.split(',')
                        if len(parts) >= 2 and parts[1] != 'N/A':
                            levels.append(float(parts[1]))
                    except (ValueError, IndexError):
                        continue
            
            if levels:
                avg_voice_db = sum(levels) / len(levels)
                logger.info(f"Voice analysis: average level = {avg_voice_db:.1f}dB")
                
                # Calculate optimal music volume based on voice level
                # Louder voice = quieter music, quieter voice = louder music
                if avg_voice_db > -20:  # Very loud voice
                    optimal_music_db = config.volume_db - 15  # Much quieter music
                elif avg_voice_db > -30:  # Normal voice
                    optimal_music_db = config.volume_db - 8   # Moderately quiet music
                elif avg_voice_db > -40:  # Quiet voice
                    optimal_music_db = config.volume_db - 3   # Slightly quiet music
                else:  # Very quiet voice
                    optimal_music_db = config.volume_db       # Original music volume
                
                logger.info(f"Static volume calculated: {optimal_music_db:.1f}dB (voice: {avg_voice_db:.1f}dB)")
                return optimal_music_db
            
            logger.warning("Could not analyze voice levels, using original volume")
            return config.volume_db
            
        except Exception as e:
            logger.error(f"Error analyzing voice for static volume: {str(e)}")
            return config.volume_db
    
    
    def _parse_text_config(self, config_dict: Optional[Dict]) -> Optional[TextOverlayConfig]:
        """Parse text configuration from dictionary"""
        if not config_dict or not config_dict.get('enabled'):
            return None
        
        # Handle random text selection
        text = config_dict.get('text', '')
        if text == 'random_from_pool':
            category = config_dict.get('category', 'engagement')
            text = random.choice(TEXT_TEMPLATES.get(category, TEXT_TEMPLATES['engagement']))
        
        # Check for connected background data
        connected_background_data = config_dict.get('connected_background_data')
        has_background = config_dict.get('hasBackground', False)

        # Only enable connected backgrounds if BOTH hasBackground is true AND valid data exists
        connected_background_enabled = (
            has_background and  # Must have background enabled
            connected_background_data is not None and
            isinstance(connected_background_data, dict) and
            'image' in connected_background_data and
            'metadata' in connected_background_data
        )
        
        return TextOverlayConfig(
            text=text,
            position=TextPosition(config_dict.get('position', 'top_center')),
            font_family=config_dict.get('font', 'Montserrat-Bold'),
            animation=config_dict.get('animation', 'fade_in'),
            connected_background_enabled=connected_background_enabled,
            connected_background_data=connected_background_data if connected_background_enabled else None
        )
    
    
    def _parse_caption_config(self, config_dict: Optional[Dict]) -> Optional[ExtendedCaptionConfig]:
        """Parse caption configuration from dictionary"""
        if not config_dict or not config_dict.get('enabled'):
            return None
        
        config = ExtendedCaptionConfig(
            enabled=config_dict.get('enabled', True),
            template=config_dict.get('template', 'tiktok_classic'),
            fontSize=config_dict.get('fontSize', 20),
            fontFamily=config_dict.get('fontFamily', 'Montserrat-Bold'),
            x_position=config_dict.get('x_position', 50.0),
            y_position=config_dict.get('y_position', 85.0),
            color=config_dict.get('color', '#FFFFFF'),
            hasStroke=config_dict.get('hasStroke', True),
            strokeColor=config_dict.get('strokeColor', '#000000'),
            strokeWidth=config_dict.get('strokeWidth', 3),
            hasBackground=config_dict.get('hasBackground', False),
            backgroundColor=config_dict.get('backgroundColor', '#000000'),
            backgroundOpacity=config_dict.get('backgroundOpacity', 0.8),
            animation=config_dict.get('animation', 'none'),
            highlight_keywords=config_dict.get('highlight_keywords', True),
            max_words_per_segment=config_dict.get('max_words_per_segment', 4),
            allCaps=config_dict.get('allCaps', False)
        )
        
        # DEBUG: Log the parsed caption config
        print(f"Caption Config Debug - Parsed values:")
        print(f"  hasBackground: {config.hasBackground}")
        print(f"  backgroundColor: {config.backgroundColor}")
        print(f"  backgroundOpacity: {config.backgroundOpacity}")
        print(f"  x_position: {config.x_position}")
        print(f"  y_position: {config.y_position}")
        print(f"  allCaps: {config.allCaps}")
        print(f"  max_words_per_segment: {config.max_words_per_segment}")
        print(f"  fontSize: {config.fontSize}")
        print(f"  hasStroke: {config.hasStroke}")
        print(f"  strokeColor: {config.strokeColor}")
        print(f"  Raw config_dict: {config_dict}")
        
        return config
    
    
    def _parse_music_config(self, config_dict: Optional[Dict]) -> Optional[MusicConfig]:
        """Parse music configuration from dictionary"""
        if not config_dict or not config_dict.get('enabled'):
            return None
        
        return MusicConfig(
            track_id=config_dict.get('track_id'),
            volume_db=config_dict.get('volume_db', -25),
            fade_in_duration=config_dict.get('fade_in', 0.0),
            fade_out_duration=config_dict.get('fade_out', 2.0),
            auto_duck=config_dict.get('auto_duck', True)
        )


# ============== Quality Validator ==============

class QualityValidator:
    """Validates video quality and ensures professional output"""
    
    @staticmethod
    def validate_contrast(frame: np.ndarray, text_color: str, text_position: Tuple[int, int]) -> float:
        """Calculate contrast ratio between text and background"""
        # Implementation for WCAG contrast validation
        return 5.0  # Placeholder
    
    @staticmethod
    def validate_audio_balance(voice_level: float, music_level: float) -> bool:
        """Ensure voice is properly audible over music"""
        difference = voice_level - music_level
        return 6 <= difference <= 10  # Voice should be 6-10dB louder


# ============== Testing and Examples ==============

if __name__ == "__main__":
    # Initialize processor
    processor = EnhancedVideoProcessor()
    
    # Example configuration
    text_config = TextOverlayConfig(
        text="Wait for it... 🤯",
        position=TextPosition.TOP_CENTER,
        animation="fade_in"
    )
    
    caption_config = CaptionConfig(
        style=CaptionStyle.TIKTOK_CLASSIC,
        highlight_keywords=True
    )
    
    music_config = MusicConfig(
        track_id="upbeat_energy_1",
        volume_db=-25,
        auto_duck=True
    )
    
    # Process video (example)
    result = processor.process_enhanced_video(
        video_path="/path/to/input.mp4",
        output_path="/path/to/output.mp4",
        text_config=text_config,
        caption_config=caption_config,
        music_config=music_config,
        audio_path="/path/to/audio.wav"
    )
    
    if result['success']:
        print(f"✅ Video processed successfully!")
        print(f"📊 Metrics: {result['metrics']}")
    else:
        print(f"❌ Processing failed: {result['error']}")