"""
Design Space Utilities - Unified scaling and positioning
========================================================
Central module for consistent text overlay calculations.
"""

from typing import Dict, Tuple, Optional
from dataclasses import dataclass


@dataclass
class DesignSpaceConfig:
    """Configuration for design space scaling"""
    design_width: int = 1088
    design_height: int = 1904
    safe_margins_pct: Dict[str, float] = None
    
    def __post_init__(self):
        if self.safe_margins_pct is None:
            self.safe_margins_pct = {
                "left": 4.0,
                "right": 4.0,
                "top": 5.0,
                "bottom": 12.0
            }


class DesignSpaceCalculator:
    """
    Unified calculator for all design space transformations.
    Ensures consistent scaling between preview and video output.
    """
    
    def __init__(self, video_width: int, video_height: int, config: Optional[DesignSpaceConfig] = None):
        self.video_width = video_width
        self.video_height = video_height
        self.config = config or DesignSpaceConfig()
        
        # Calculate scale factor once
        self.scale_factor = self._compute_scale()
        
        # Calculate safe area bounds
        self.safe_bounds = self._compute_safe_bounds()
    
    def _compute_scale(self) -> float:
        """
        Compute scale factor from design space to video space.
        Uses minimum of width/height scales to ensure content fits.
        """
        if self.config.design_width <= 0 or self.config.design_height <= 0:
            return 1.0
        
        scale_x = self.video_width / self.config.design_width
        scale_y = self.video_height / self.config.design_height
        return min(scale_x, scale_y)
    
    def _compute_safe_bounds(self) -> Dict[str, float]:
        """Compute safe area boundaries in video space"""
        margins = self.config.safe_margins_pct
        
        left = (margins["left"] / 100.0) * self.video_width
        right = self.video_width - (margins["right"] / 100.0) * self.video_width
        top = (margins["top"] / 100.0) * self.video_height
        bottom = self.video_height - (margins["bottom"] / 100.0) * self.video_height
        
        # Ensure bounds are valid (left < right, top < bottom)
        if left >= right:
            left = 0
            right = self.video_width
        if top >= bottom:
            top = 0
            bottom = self.video_height
        
        return {
            "left": left,
            "right": right,
            "top": top,
            "bottom": bottom,
            "width": right - left,
            "height": bottom - top
        }
    
    def scale_font_size(self, font_px: Optional[int] = None, font_percentage: Optional[float] = None) -> int:
        """
        Scale font size from design space to video space.
        
        Priority:
        1. Use font_px if provided (exact pixel size in design space)
        2. Use font_percentage if provided (percentage of video height)
        3. Return default size
        
        Args:
            font_px: Font size in design space pixels
            font_percentage: Font size as percentage of video height (e.g., 5.0 for 5%)
        
        Returns:
            Scaled font size for video output
        """
        if font_px is not None:
            # Scale from design space pixels to video space
            scaled_size = int(font_px * self.scale_factor)
            print(f"[FONT SCALE] Design: {font_px}px -> Video: {scaled_size}px (scale={self.scale_factor:.3f})")
            return max(8, scaled_size)  # Minimum 8px
        
        if font_percentage is not None:
            # Calculate as percentage of video height
            scaled_size = int((font_percentage / 100.0) * self.video_height)
            print(f"[FONT SCALE] Percentage: {font_percentage}% -> Video: {scaled_size}px")
            return max(8, scaled_size)
        
        # Default fallback
        default_size = int(0.04 * self.video_height)  # 4% of video height
        print(f"[FONT SCALE] Using default: {default_size}px")
        return max(8, default_size)
    
    def map_position(
        self,
        x_pct: float,
        y_pct: float,
        anchor: str = "center",
        use_safe_margins: bool = True
    ) -> Tuple[int, int]:
        """
        Map position from design space percentage to video coordinates.

        Args:
            x_pct: X position as percentage (0-100)
            y_pct: Y position as percentage (0-100)
            anchor: Anchor point for positioning
            use_safe_margins: Whether to map to safe area (excluding margins) or full video

        Returns:
            Tuple of (x, y) coordinates in video space
        """
        # Clamp percentages to valid range
        x_pct = max(0.0, min(100.0, x_pct))
        y_pct = max(0.0, min(100.0, y_pct))

        if use_safe_margins:
            # Map percentage to safe area coordinates (original behavior)
            bounds = self.safe_bounds
            x = int(bounds["left"] + (x_pct / 100.0) * bounds["width"])
            y = int(bounds["top"] + (y_pct / 100.0) * bounds["height"])
            area_type = "safe area"
        else:
            # Map percentage directly to full video coordinates (for frontend compatibility)
            x = int((x_pct / 100.0) * self.video_width)
            y = int((y_pct / 100.0) * self.video_height)
            area_type = "full video"

        # Ensure within video bounds
        x = max(0, min(self.video_width, x))
        y = max(0, min(self.video_height, y))

        print(f"[POSITION] Design: ({x_pct}%, {y_pct}%) -> Video: ({x}, {y}) px [anchor={anchor}, {area_type}]")

        return x, y
    
    def scale_dimension(self, design_px: int) -> int:
        """Scale any dimension from design space to video space"""
        return max(1, int(design_px * self.scale_factor))
    
    def get_ffmpeg_position_expression(
        self,
        x_pct: float,
        y_pct: float,
        anchor: str = "center",
        use_safe_margins: bool = True
    ) -> Tuple[str, str]:
        """
        Generate FFmpeg position expressions with anchor support.

        Args:
            x_pct: X position as percentage (0-100)
            y_pct: Y position as percentage (0-100)
            anchor: Anchor point for positioning
            use_safe_margins: Whether to map to safe area or full video

        Returns:
            Tuple of (x_expr, y_expr) for FFmpeg drawtext filter
        """
        x, y = self.map_position(x_pct, y_pct, anchor, use_safe_margins)

        # Apply anchor offset using FFmpeg expressions
        if anchor == "center":
            x_expr = f"{x}-text_w/2"
            y_expr = f"{y}-text_h/2"
        elif anchor == "top_left" or anchor == "top-left":
            x_expr = f"{x}"
            y_expr = f"{y}"
        elif anchor == "top_center" or anchor == "top-center":
            x_expr = f"{x}-text_w/2"
            y_expr = f"{y}"
        elif anchor == "top_right" or anchor == "top-right":
            x_expr = f"{x}-text_w"
            y_expr = f"{y}"
        elif anchor == "middle_left" or anchor == "middle-left":
            x_expr = f"{x}"
            y_expr = f"{y}-text_h/2"
        elif anchor == "middle_right" or anchor == "middle-right":
            x_expr = f"{x}-text_w"
            y_expr = f"{y}-text_h/2"
        elif anchor == "bottom_left" or anchor == "bottom-left":
            x_expr = f"{x}"
            y_expr = f"{y}-text_h"
        elif anchor == "bottom_center" or anchor == "bottom-center":
            x_expr = f"{x}-text_w/2"
            y_expr = f"{y}-text_h"
        elif anchor == "bottom_right" or anchor == "bottom-right":
            x_expr = f"{x}-text_w"
            y_expr = f"{y}-text_h"
        else:
            # Default to center
            x_expr = f"{x}-text_w/2"
            y_expr = f"{y}-text_h/2"

        return x_expr, y_expr
    
    def validate_config(self) -> bool:
        """Validate design space configuration"""
        if self.video_width <= 0 or self.video_height <= 0:
            print(f"ERROR: Invalid video dimensions: {self.video_width}x{self.video_height}")
            return False
        
        if self.config.design_width <= 0 or self.config.design_height <= 0:
            print(f"ERROR: Invalid design dimensions: {self.config.design_width}x{self.config.design_height}")
            return False
        
        if self.scale_factor <= 0:
            print(f"ERROR: Invalid scale factor: {self.scale_factor}")
            return False
        
        return True


def create_calculator_from_config(
    video_width: int,
    video_height: int,
    config_dict: Dict
) -> DesignSpaceCalculator:
    """
    Create calculator from configuration dictionary.
    
    Args:
        video_width: Output video width
        video_height: Output video height
        config_dict: Configuration from TextOverlayConfig or ExtendedCaptionConfig
    
    Returns:
        Configured DesignSpaceCalculator instance
    """
    design_config = DesignSpaceConfig(
        design_width=config_dict.get('design_width') or config_dict.get('designWidth', 1088),
        design_height=config_dict.get('design_height') or config_dict.get('designHeight', 1904),
        safe_margins_pct=config_dict.get('safe_margins_pct') or config_dict.get('safeMarginsPct', {
            "left": 4.0, "right": 4.0, "top": 5.0, "bottom": 12.0
        })
    )
    
    return DesignSpaceCalculator(video_width, video_height, design_config)