"""
Cross-Platform Font Management System
======================================
Provides OS-aware font path resolution for video text overlays.

Supports: macOS, Windows, Linux
Author: MassUGC Development Team
"""

import os
import sys
import platform
import logging
from pathlib import Path
from typing import Dict, Optional, List
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class FontPaths:
    """Container for font path options with priority"""
    primary: Optional[str] = None
    fallback: Optional[str] = None
    bundled: Optional[str] = None


class CrossPlatformFontManager:
    """
    Manages font resolution across macOS, Windows, and Linux.
    
    Strategy:
    1. Try OS-specific system font
    2. Try bundled font assets
    3. Fall back to universal system font
    """
    
    def __init__(self, assets_dir: Optional[Path] = None):
        """
        Initialize font manager with OS detection.
        
        Args:
            assets_dir: Optional path to bundled font assets
        """
        self.os_type = platform.system()  # 'Darwin', 'Windows', 'Linux'
        
        # PyInstaller-aware path resolution - CRITICAL FIX for production builds
        if assets_dir:
            # Explicit path provided
            self.assets_dir = assets_dir
        elif getattr(sys, 'frozen', False):
            # Running in PyInstaller bundle (production)
            # Use sys._MEIPASS to find bundled assets
            base_path = Path(sys._MEIPASS)
            self.assets_dir = base_path / "assets" / "fonts"
            logger.info(f"PyInstaller bundle detected, using bundled fonts: {self.assets_dir}")
        else:
            # Running as script (development)
            self.assets_dir = Path(__file__).parent.parent / "assets" / "fonts"
        
        # Initialize font maps
        self._font_map_macos = self._build_macos_font_map()
        self._font_map_windows = self._build_windows_font_map()
        self._font_map_linux = self._build_linux_font_map()
        
        logger.info(f"Font Manager initialized for OS: {self.os_type}, assets_dir: {self.assets_dir}")
    
    
    def get_font_path(self, font_family: str) -> str:
        """
        Get OS-appropriate font path for the requested font family.
        
        Args:
            font_family: CSS font-family string (e.g., "Montserrat-Bold, sans-serif")
        
        Returns:
            Absolute path to font file
        """
        # Parse CSS font-family to extract first font name
        first_font = self._parse_font_family(font_family)
        
        # Get OS-specific font paths
        font_paths = self._get_font_paths_for_os(first_font)
        
        # Try primary path
        if font_paths.primary and Path(font_paths.primary).exists():
            logger.debug(f"Using primary font: {font_paths.primary}")
            return font_paths.primary
        
        # Try bundled asset
        if font_paths.bundled:
            bundled_path = self.assets_dir / font_paths.bundled
            if bundled_path.exists():
                logger.info(f"Using bundled font: {bundled_path}")
                return str(bundled_path)
        
        # Fall back to universal system font
        if font_paths.fallback and Path(font_paths.fallback).exists():
            logger.warning(f"Using fallback font: {font_paths.fallback}")
            return font_paths.fallback
        
        # Ultimate fallback
        ultimate_fallback = self._get_ultimate_fallback()
        logger.error(f"Font '{first_font}' not found, using ultimate fallback: {ultimate_fallback}")
        return ultimate_fallback
    
    
    def _parse_font_family(self, font_family: str) -> str:
        """Extract first font name from CSS font-family string"""
        return font_family.split(',')[0].strip().replace('"', '').replace("'", '')
    
    
    def _get_font_paths_for_os(self, font_name: str) -> FontPaths:
        """Get font paths based on current OS"""
        if self.os_type == 'Darwin':  # macOS
            return self._get_macos_font_paths(font_name)
        elif self.os_type == 'Windows':
            return self._get_windows_font_paths(font_name)
        elif self.os_type == 'Linux':
            return self._get_linux_font_paths(font_name)
        else:
            logger.warning(f"Unknown OS: {self.os_type}, using generic fallback")
            return FontPaths(fallback=self._get_ultimate_fallback())
    
    
    # ============== macOS Font Maps ==============
    
    def _build_macos_font_map(self) -> Dict[str, FontPaths]:
        """Build macOS-specific font path mappings"""
        return {
            # Proxima Nova variants
            "Proxima Nova": FontPaths(
                primary="/System/Library/AssetsV2/com_apple_MobileAsset_Font7/9a171ef12a4ff85a7f152f3d42a583d7a82b4560.asset/AssetData/ProximaNova.ttc",
                bundled="ProximaNova-Regular.ttf",
                fallback="/System/Library/Fonts/Helvetica.ttc"
            ),
            "ProximaNova-Semibold": FontPaths(
                primary="/Library/Fonts/Proxima Nova Semibold.ttf",
                bundled="ProximaNova-Semibold.ttf",
                fallback="/System/Library/Fonts/Helvetica.ttc"
            ),
            "ProximaNova-Bold": FontPaths(
                primary="/System/Library/AssetsV2/com_apple_MobileAsset_Font7/9a171ef12a4ff85a7f152f3d42a583d7a82b4560.asset/AssetData/ProximaNova.ttc",
                bundled="ProximaNova-Bold.ttf",
                fallback="/System/Library/Fonts/Helvetica.ttc"
            ),
            
            # Inter variants
            "Inter": FontPaths(
                primary="/Library/Fonts/Inter-Regular.ttf",
                bundled="Inter-Regular.ttf",
                fallback="/System/Library/Fonts/.SFUI-Regular.otf"
            ),
            "Inter-Medium": FontPaths(
                primary="/Library/Fonts/Inter-Medium.ttf",
                bundled="Inter-Medium.ttf",
                fallback="/System/Library/Fonts/.SFUI-Medium.otf"
            ),
            "Inter-Bold": FontPaths(
                primary="/Library/Fonts/Inter-Bold.ttf",
                bundled="Inter-Bold.ttf",
                fallback="/System/Library/Fonts/.SFUI-Bold.otf"
            ),
            
            # Montserrat variants
            "Montserrat": FontPaths(
                primary="/Library/Fonts/Montserrat-Regular.otf",
                bundled="Montserrat-Regular.otf",
                fallback="/System/Library/Fonts/Helvetica.ttc"
            ),
            "Montserrat-Bold": FontPaths(
                primary="/Library/Fonts/Montserrat-Bold.otf",
                bundled="Montserrat-Bold.otf",
                fallback="/System/Library/Fonts/Helvetica.ttc"
            ),
            "Montserrat-Black": FontPaths(
                primary="/Library/Fonts/Montserrat-Black.otf",
                bundled="Montserrat-Black.otf",
                fallback="/System/Library/Fonts/Helvetica.ttc"
            ),
            
            # System fonts
            "Impact": FontPaths(
                primary="/System/Library/Fonts/Supplemental/Impact.ttf",
                bundled="Impact.ttf",
                fallback="/System/Library/Fonts/Helvetica.ttc"
            ),
            "Arial": FontPaths(
                primary="/System/Library/Fonts/Helvetica.ttc"
            ),
            "Helvetica": FontPaths(
                primary="/System/Library/Fonts/Helvetica.ttc"
            ),
            
            # Emoji support
            "NotoColorEmoji": FontPaths(
                primary="/System/Library/Fonts/Apple Color Emoji.ttc",
                bundled="NotoColorEmoji.ttf"
            ),
        }
    
    
    def _get_macos_font_paths(self, font_name: str) -> FontPaths:
        """Get macOS font paths for given font name"""
        return self._font_map_macos.get(
            font_name,
            FontPaths(fallback="/System/Library/Fonts/Helvetica.ttc")
        )
    
    
    # ============== Windows Font Maps ==============
    
    def _build_windows_font_map(self) -> Dict[str, FontPaths]:
        """Build Windows-specific font path mappings"""
        win_fonts = os.path.join(os.environ.get('WINDIR', 'C:\\Windows'), 'Fonts')
        
        return {
            # Proxima Nova variants
            "Proxima Nova": FontPaths(
                primary=os.path.join(win_fonts, "ProximaNova-Regular.ttf"),
                bundled="ProximaNova-Regular.ttf",
                fallback=os.path.join(win_fonts, "arial.ttf")
            ),
            "ProximaNova-Semibold": FontPaths(
                primary=os.path.join(win_fonts, "ProximaNova-Semibold.ttf"),
                bundled="ProximaNova-Semibold.ttf",
                fallback=os.path.join(win_fonts, "arialbd.ttf")
            ),
            "ProximaNova-Bold": FontPaths(
                primary=os.path.join(win_fonts, "ProximaNova-Bold.ttf"),
                bundled="ProximaNova-Bold.ttf",
                fallback=os.path.join(win_fonts, "arialbd.ttf")
            ),
            
            # Inter variants
            "Inter": FontPaths(
                primary=os.path.join(win_fonts, "Inter-Regular.ttf"),
                bundled="Inter-Regular.ttf",
                fallback=os.path.join(win_fonts, "segoeui.ttf")
            ),
            "Inter-Medium": FontPaths(
                primary=os.path.join(win_fonts, "Inter-Medium.ttf"),
                bundled="Inter-Medium.ttf",
                fallback=os.path.join(win_fonts, "segoeuib.ttf")
            ),
            "Inter-Bold": FontPaths(
                primary=os.path.join(win_fonts, "Inter-Bold.ttf"),
                bundled="Inter-Bold.ttf",
                fallback=os.path.join(win_fonts, "segoeuib.ttf")
            ),
            
            # Montserrat variants
            "Montserrat": FontPaths(
                primary=os.path.join(win_fonts, "Montserrat-Regular.ttf"),
                bundled="Montserrat-Regular.otf",
                fallback=os.path.join(win_fonts, "arial.ttf")
            ),
            "Montserrat-Bold": FontPaths(
                primary=os.path.join(win_fonts, "Montserrat-Bold.ttf"),
                bundled="Montserrat-Bold.otf",
                fallback=os.path.join(win_fonts, "arialbd.ttf")
            ),
            "Montserrat-Black": FontPaths(
                primary=os.path.join(win_fonts, "Montserrat-Black.ttf"),
                bundled="Montserrat-Black.otf",
                fallback=os.path.join(win_fonts, "arialbd.ttf")
            ),
            
            # System fonts
            "Impact": FontPaths(
                primary=os.path.join(win_fonts, "impact.ttf"),
                bundled="Impact.ttf",
                fallback=os.path.join(win_fonts, "arial.ttf")
            ),
            "Arial": FontPaths(
                primary=os.path.join(win_fonts, "arial.ttf")
            ),
            "Georgia": FontPaths(
                primary=os.path.join(win_fonts, "georgia.ttf")
            ),
            
            # Emoji support
            "NotoColorEmoji": FontPaths(
                primary=os.path.join(win_fonts, "seguiemj.ttf"),  # Segoe UI Emoji
                bundled="NotoColorEmoji.ttf",
                fallback=os.path.join(win_fonts, "segoeui.ttf")
            ),
        }
    
    
    def _get_windows_font_paths(self, font_name: str) -> FontPaths:
        """Get Windows font paths for given font name"""
        win_fonts = os.path.join(os.environ.get('WINDIR', 'C:\\Windows'), 'Fonts')
        return self._font_map_windows.get(
            font_name,
            FontPaths(fallback=os.path.join(win_fonts, "arial.ttf"))
        )
    
    
    # ============== Linux Font Maps ==============
    
    def _build_linux_font_map(self) -> Dict[str, FontPaths]:
        """Build Linux-specific font path mappings"""
        return {
            # Proxima Nova variants (rarely pre-installed on Linux)
            "Proxima Nova": FontPaths(
                primary="/usr/share/fonts/truetype/proxima-nova/ProximaNova-Regular.ttf",
                bundled="ProximaNova-Regular.ttf",
                fallback="/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
            ),
            "ProximaNova-Semibold": FontPaths(
                primary="/usr/share/fonts/truetype/proxima-nova/ProximaNova-Semibold.ttf",
                bundled="ProximaNova-Semibold.ttf",
                fallback="/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
            ),
            "ProximaNova-Bold": FontPaths(
                primary="/usr/share/fonts/truetype/proxima-nova/ProximaNova-Bold.ttf",
                bundled="ProximaNova-Bold.ttf",
                fallback="/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
            ),
            
            # Inter variants
            "Inter": FontPaths(
                primary="/usr/share/fonts/truetype/inter/Inter-Regular.ttf",
                bundled="Inter-Regular.ttf",
                fallback="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
            ),
            "Inter-Medium": FontPaths(
                primary="/usr/share/fonts/truetype/inter/Inter-Medium.ttf",
                bundled="Inter-Medium.ttf",
                fallback="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
            ),
            "Inter-Bold": FontPaths(
                primary="/usr/share/fonts/truetype/inter/Inter-Bold.ttf",
                bundled="Inter-Bold.ttf",
                fallback="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
            ),
            
            # Montserrat variants
            "Montserrat": FontPaths(
                primary="/usr/share/fonts/truetype/montserrat/Montserrat-Regular.ttf",
                bundled="Montserrat-Regular.otf",
                fallback="/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
            ),
            "Montserrat-Bold": FontPaths(
                primary="/usr/share/fonts/truetype/montserrat/Montserrat-Bold.ttf",
                bundled="Montserrat-Bold.otf",
                fallback="/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
            ),
            "Montserrat-Black": FontPaths(
                primary="/usr/share/fonts/truetype/montserrat/Montserrat-Black.ttf",
                bundled="Montserrat-Black.otf",
                fallback="/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
            ),
            
            # System fonts (common across distros)
            "Impact": FontPaths(
                primary="/usr/share/fonts/truetype/msttcorefonts/Impact.ttf",
                bundled="Impact.ttf",
                fallback="/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
            ),
            "Arial": FontPaths(
                primary="/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
            ),
            "Helvetica": FontPaths(
                primary="/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
            ),
            "Georgia": FontPaths(
                primary="/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf"
            ),
            
            # Emoji support
            "NotoColorEmoji": FontPaths(
                primary="/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf",
                bundled="NotoColorEmoji.ttf",
                fallback="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
            ),
        }
    
    
    def _get_linux_font_paths(self, font_name: str) -> FontPaths:
        """Get Linux font paths for given font name"""
        return self._font_map_linux.get(
            font_name,
            FontPaths(fallback="/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf")
        )
    
    
    # ============== Ultimate Fallbacks ==============
    
    def _get_ultimate_fallback(self) -> str:
        """Get the most universal fallback font for the OS"""
        if self.os_type == 'Darwin':  # macOS
            return "/System/Library/Fonts/Helvetica.ttc"
        elif self.os_type == 'Windows':
            win_fonts = os.path.join(os.environ.get('WINDIR', 'C:\\Windows'), 'Fonts')
            return os.path.join(win_fonts, "arial.ttf")
        elif self.os_type == 'Linux':
            # Try common Linux font paths in order
            fallback_options = [
                "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                "/usr/share/fonts/TTF/DejaVuSans.ttf"
            ]
            for option in fallback_options:
                if Path(option).exists():
                    return option
            return fallback_options[0]  # Return first even if doesn't exist
        else:
            return "Arial"  # FFmpeg will handle fallback
    
    
    # ============== Utility Methods ==============
    
    def list_available_fonts(self) -> Dict[str, bool]:
        """
        List all configured fonts and their availability status.
        
        Returns:
            Dict mapping font names to availability (True/False)
        """
        if self.os_type == 'Darwin':
            font_map = self._font_map_macos
        elif self.os_type == 'Windows':
            font_map = self._font_map_windows
        else:
            font_map = self._font_map_linux
        
        availability = {}
        for font_name, paths in font_map.items():
            # Check if any path exists
            available = False
            if paths.primary and Path(paths.primary).exists():
                available = True
            elif paths.bundled and (self.assets_dir / paths.bundled).exists():
                available = True
            elif paths.fallback and Path(paths.fallback).exists():
                available = True
            
            availability[font_name] = available
        
        return availability
    
    
    def validate_font_availability(self, font_families: List[str]) -> Dict[str, str]:
        """
        Validate a list of fonts and return the actual paths that will be used.
        
        Args:
            font_families: List of CSS font-family strings
        
        Returns:
            Dict mapping font families to resolved paths
        """
        results = {}
        for font_family in font_families:
            try:
                path = self.get_font_path(font_family)
                results[font_family] = path
            except Exception as e:
                logger.error(f"Error validating font '{font_family}': {e}")
                results[font_family] = f"ERROR: {str(e)}"
        
        return results


# ============== Singleton Instance ==============

_font_manager_instance = None

def get_font_manager(assets_dir: Optional[Path] = None) -> CrossPlatformFontManager:
    """Get or create singleton font manager instance"""
    global _font_manager_instance
    if _font_manager_instance is None:
        _font_manager_instance = CrossPlatformFontManager(assets_dir)
    return _font_manager_instance