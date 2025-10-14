"""
Color Utilities - Robust color conversion for video processing
==============================================================
Handles conversion between hex, RGB, and ASS color formats.
"""

import re
from typing import Optional, Tuple


class ColorConverter:
    """Handles color conversions for various video formats"""
    
    # Standard color name mappings
    COLOR_NAMES = {
        'white': '#FFFFFF',
        'black': '#000000',
        'red': '#FF0000',
        'green': '#00FF00',
        'blue': '#0000FF',
        'yellow': '#FFFF00',
        'cyan': '#00FFFF',
        'magenta': '#FF00FF',
        'orange': '#FFA500',
        'purple': '#800080',
        'pink': '#FFC0CB',
        'gray': '#808080',
        'grey': '#808080',
    }
    
    @staticmethod
    def normalize_hex(color: str) -> str:
        """
        Normalize color to standard hex format (#RRGGBB).
        
        Args:
            color: Color string (hex, name, or rgb)
        
        Returns:
            Normalized hex color string
        """
        if not color:
            print(f"[COLOR] ⚠️ WARNING: normalize_hex received empty/None color, returning white")
            return '#FFFFFF'
        
        # Remove whitespace
        color = color.strip()
        print(f"[COLOR] 🎨 Normalizing color: '{color}'")
        
        # Check if it's a color name
        if color.lower() in ColorConverter.COLOR_NAMES:
            normalized = ColorConverter.COLOR_NAMES[color.lower()]
            print(f"[COLOR] ✅ Color name '{color}' → {normalized}")
            return normalized
        
        # If already hex, normalize it
        if color.startswith('#'):
            hex_part = color[1:]
            
            # Handle short form (#RGB -> #RRGGBB)
            if len(hex_part) == 3:
                normalized = f"#{hex_part[0]*2}{hex_part[1]*2}{hex_part[2]*2}".upper()
                print(f"[COLOR] ✅ Short hex '{color}' → {normalized}")
                return normalized
            
            # Handle full form
            if len(hex_part) == 6:
                normalized = f"#{hex_part}".upper()
                print(f"[COLOR] ✅ Full hex '{color}' → {normalized}")
                return normalized
            
            # Handle with alpha (#RRGGBBAA -> #RRGGBB)
            if len(hex_part) == 8:
                normalized = f"#{hex_part[:6]}".upper()
                print(f"[COLOR] ✅ Hex with alpha '{color}' → {normalized}")
                return normalized
        
        # Try to parse RGB format
        rgb_match = re.match(r'rgb\((\d+),\s*(\d+),\s*(\d+)\)', color.lower())
        if rgb_match:
            r, g, b = [int(x) for x in rgb_match.groups()]
            normalized = f"#{r:02X}{g:02X}{b:02X}"
            print(f"[COLOR] ✅ RGB '{color}' → {normalized}")
            return normalized
        
        # Default fallback
        print(f"[COLOR] ❌ WARNING: Could not parse color '{color}', using white fallback")
        return '#FFFFFF'
    
    @staticmethod
    def hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
        """Convert hex color to RGB tuple"""
        hex_color = ColorConverter.normalize_hex(hex_color)
        hex_part = hex_color.lstrip('#')
        
        r = int(hex_part[0:2], 16)
        g = int(hex_part[2:4], 16)
        b = int(hex_part[4:6], 16)
        
        return r, g, b
    
    @staticmethod
    def hex_to_ass(hex_color: str) -> str:
        """
        Convert hex color to ASS subtitle format (BGR).
        
        ASS format uses BGR order: &HBBGGRR&
        
        Args:
            hex_color: Hex color string
        
        Returns:
            ASS format color string
        """
        print(f"[COLOR] 🔄 hex_to_ass input: '{hex_color}'")
        r, g, b = ColorConverter.hex_to_rgb(hex_color)
        
        # ASS uses BGR order
        ass_color = f"{b:02X}{g:02X}{r:02X}"
        
        print(f"[COLOR] 🎬 RGB({r},{g},{b}) → ASS &H{ass_color}& (BGR format)")
        
        return ass_color
    
    @staticmethod
    def hex_to_ffmpeg(hex_color: str) -> str:
        """
        Convert hex color to FFmpeg color format.
        
        Args:
            hex_color: Hex color string
        
        Returns:
            FFmpeg color string (can be hex or name)
        """
        normalized = ColorConverter.normalize_hex(hex_color)
        
        # Check if it matches a standard color name for cleaner output
        for name, hex_val in ColorConverter.COLOR_NAMES.items():
            if normalized.upper() == hex_val.upper():
                return name
        
        # Return as 0xRRGGBB format for FFmpeg
        return f"0x{normalized.lstrip('#')}"
    
    @staticmethod
    def add_opacity_to_ass(ass_color: str, opacity: float) -> str:
        """
        Add opacity to ASS color.
        
        Args:
            ass_color: ASS color string (BBGGRR format, 6 characters)
            opacity: Opacity value (0.0 to 1.0)
        
        Returns:
            ASS color with alpha: &HAABBGGRR&
        """
        # Ensure ass_color is exactly 6 characters (no & or H prefix)
        if ass_color.startswith('&H'):
            ass_color = ass_color[2:]
        if ass_color.endswith('&'):
            ass_color = ass_color[:-1]
        
        # Pad to 6 characters if needed
        ass_color = ass_color.zfill(6)
        
        # Convert opacity to ASS alpha (inverted: 0=opaque, 255=transparent)
        alpha = int((1.0 - opacity) * 255)
        alpha_hex = f"{alpha:02X}"
        
        return f"{alpha_hex}{ass_color}"
    
    @staticmethod
    def validate_color(color: str) -> bool:
        """Validate if color string can be parsed"""
        try:
            ColorConverter.normalize_hex(color)
            return True
        except:
            return False


class FFmpegColorBuilder:
    """Build FFmpeg color strings with proper formatting"""
    
    @staticmethod
    def build_text_color(color: str) -> str:
        """Build fontcolor parameter for FFmpeg drawtext"""
        return ColorConverter.hex_to_ffmpeg(color)
    
    @staticmethod
    def build_box_color(color: str, opacity: float = 1.0) -> str:
        """
        Build boxcolor parameter for FFmpeg drawtext.
        
        Format: color@opacity
        
        Args:
            color: Hex color string
            opacity: Opacity value (0.0 to 1.0)
        
        Returns:
            FFmpeg boxcolor string
        """
        ffmpeg_color = ColorConverter.hex_to_ffmpeg(color)
        
        if opacity >= 1.0:
            return ffmpeg_color
        
        return f"{ffmpeg_color}@{opacity:.2f}"
    
    @staticmethod
    def build_border_color(color: str) -> str:
        """Build bordercolor parameter for FFmpeg drawtext"""
        return ColorConverter.hex_to_ffmpeg(color)


class ASSColorBuilder:
    """Build ASS subtitle color strings"""
    
    @staticmethod
    def build_primary_color(color: str) -> str:
        """Build PrimaryColour for ASS Style"""
        ass_hex = ColorConverter.hex_to_ass(color)
        return f"&H{ass_hex}&"
    
    @staticmethod
    def build_outline_color(color: str) -> str:
        """Build OutlineColour for ASS Style"""
        ass_hex = ColorConverter.hex_to_ass(color)
        return f"&H{ass_hex}&"
    
    @staticmethod
    def build_back_color(color: str, opacity: float = 1.0) -> str:
        """
        Build BackColour for ASS Style with opacity.
        
        Format: &HAABBGGRR& where AA is alpha channel
        
        Args:
            color: Hex color string
            opacity: Opacity value (0.0 to 1.0)
        
        Returns:
            ASS BackColour string with alpha
        """
        ass_hex = ColorConverter.hex_to_ass(color)
        ass_with_alpha = ColorConverter.add_opacity_to_ass(ass_hex, opacity)
        return f"&H{ass_with_alpha}&"


# Example usage and tests
if __name__ == "__main__":
    print("=== Color Conversion Tests ===\n")
    
    test_colors = [
        "#FFFFFF",
        "#000000",
        "#FF0000",
        "#00FF00",
        "#0000FF",
        "white",
        "black",
        "yellow",
        "#FFF",  # Short form
        "rgb(255, 0, 0)"
    ]
    
    for color in test_colors:
        print(f"Input: {color}")
        normalized = ColorConverter.normalize_hex(color)
        print(f"  Normalized: {normalized}")
        
        r, g, b = ColorConverter.hex_to_rgb(color)
        print(f"  RGB: ({r}, {g}, {b})")
        
        ass = ASSColorBuilder.build_primary_color(color)
        print(f"  ASS Primary: {ass}")
        
        ffmpeg = FFmpegColorBuilder.build_text_color(color)
        print(f"  FFmpeg: {ffmpeg}")
        
        box = FFmpegColorBuilder.build_box_color(color, 0.8)
        print(f"  FFmpeg Box (80% opacity): {box}")
        
        print()