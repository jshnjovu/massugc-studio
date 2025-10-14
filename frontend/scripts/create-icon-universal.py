#!/usr/bin/env python3
"""
Universal Icon Creation Script for MassUGC Studio
Creates platform-appropriate icons for Windows (.ico) and macOS (.icns)
"""

import os
import sys
import platform
import subprocess
from pathlib import Path
import json

# Add the backend/_internal path to sys.path for PIL imports
# This allows the script to use PIL from the embedded Python environment
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
backend_internal = os.path.join(project_root, 'ZyraData', 'backend', '_internal')

# Check if _internal exists and add it to path
if os.path.exists(backend_internal):
    # Add the _internal/lib/site-packages to path for PIL
    lib_path = os.path.join(backend_internal, 'lib', 'site-packages')
    if os.path.exists(lib_path):
        sys.path.insert(0, lib_path)
        print(f"✅ Added embedded Python path: {lib_path}")
    else:
        print(f"⚠️  Embedded Python path not found: {lib_path}")

# Now import PIL - this should work with the embedded environment
try:
    from PIL import Image, ImageDraw
    print("✅ Successfully imported PIL")
except ImportError as e:
    print(f"❌ Failed to import PIL: {e}")
    print("💡 Make sure the backend build includes PIL in hiddenimports")
    sys.exit(1)

def detect_platform():
    """Detect the current platform"""
    system = platform.system().lower()
    if system == 'darwin':
        return 'macos', '.icns'
    elif system == 'windows':
        return 'windows', '.ico'
    elif system.startswith('linux') or system == 'posix':
        return 'linux', '.png'
    else:
        return 'unknown', '.png'

def create_rounded_mask(size, corner_radius):
    """Create a rounded rectangle mask."""
    mask = Image.new('L', size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0) + size, radius=corner_radius, fill=255)
    return mask

def apply_rounded_corners(image_path, output_path, corner_radius_ratio=0.2237):
    """
    Apply rounded corners to an image following platform-specific guidelines.
    
    Args:
        image_path: Path to source square image
        output_path: Path for output rounded image
        corner_radius_ratio: Ratio of corner radius to image size
                             (macOS standard is ~22.37%, Windows is usually smaller)
    """
    # Open and ensure square
    img = Image.open(image_path).convert('RGBA')
    size = min(img.size)
    img = img.resize((size, size), Image.Resampling.LANCZOS)
    
    current_platform, _ = detect_platform()
    
    # Platform-specific corner radius adjustments
    if current_platform == 'macos':
        corner_radius_ratio = 0.2237  # macOS standard
    elif current_platform == 'windows':
        corner_radius_ratio = 0.15    # Windows typically uses smaller corners
    else:
        corner_radius_ratio = 0.2      # Generic rounded
    
    # Calculate corner radius
    corner_radius = int(size * corner_radius_ratio)
    
    # Create rounded mask
    mask = create_rounded_mask((size, size), corner_radius)
    
    # Apply mask to image
    output = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    output.paste(img, (0, 0))
    output.putalpha(mask)
    
    # Save the result
    output.save(output_path, 'PNG')
    print(f"Created rounded icon: {output_path}")
    return output_path

def create_platform_icon(source_png, platform_info, config):
    """Create platform-specific icon from source PNG"""
    platform_name, icon_ext = platform_info
    build_dir = config['build_dir']
    
    # Create icon filename
    icon_filename = f"icon{icon_ext}"
    icon_path = os.path.join(build_dir, icon_filename)
    
    print(f"🎨 Creating {platform_name} icon ({icon_ext})...")
    
    if platform_name == 'macos':
        return create_icns_file(source_png, icon_path)
    elif platform_name == 'windows':
        return create_ico_file(source_png, icon_path, config['windows_sizes'])
    else:
        # For Linux or unknown platforms, just copy the PNG
        try:
            import shutil
            shutil.copy2(source_png, icon_path)
            print(f"✅ Copied PNG icon for {platform_name}: {icon_path}")
            return True
        except Exception as e:
            print(f"❌ Failed to copy PNG: {e}")
            return False

def create_icns_file(png_path, icns_path):
    """Create .icns file from PNG using sips (macOS) or iconutil."""
    try:
        # Try using sips first (available on macOS)
        subprocess.run(['sips', '-s', 'format', 'icns', png_path, '--out', icns_path], 
                      check=True, capture_output=True)
        print(f"✅ Created .icns file: {icns_path}")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("⚠️  sips not available. Trying iconutil...")
        try:
            # Create iconset directory first
            iconset_dir = icns_path.replace('.icns', '.iconset')
            os.makedirs(iconset_dir, exist_ok=True)
            
            # Generate multiple sizes using PIL
            sizes = [16, 32, 64, 128, 256, 512, 1024]
            img = Image.open(png_path)
            
            for size in sizes:
                resized = img.resize((size, size), Image.Resampling.LANCZOS)
                if size == 1024:
                    resized.save(os.path.join(iconset_dir, f"icon_{size}x{size}.png"))
                else:
                    resized.save(os.path.join(iconset_dir, f"icon_{size}x{size}.png"))
                    # Also create 2x versions for Retina
                    resized.save(os.path.join(iconset_dir, f"icon_{size}x{size}@2x.png"))
            
            # Convert iconset to icns
            subprocess.run(['iconutil', '-c', 'icns', iconset_dir, '-o', icns_path], 
                          check=True, capture_output=True)
            
            # Clean up iconset directory
            import shutil
            shutil.rmtree(iconset_dir)
            
            print(f"✅ Created .icns file using iconutil: {icns_path}")
            return True
            
        except Exception as e:
            print(f"❌ iconutil failed: {e}")
            print(f"⚠️  Please manually convert {png_path} to {icns_path} using available tools")
            return False

def create_ico_file(png_path, ico_path, sizes=None):
    """Create .ico file from PNG with multiple sizes."""
    if sizes is None:
        sizes = [16, 24, 32, 48, 64, 96, 128, 256]
    
    try:
        # Check if ImageMagick is available (best option)
        subprocess.run(['magick', '-version'], check=True, capture_output=True)
        
        # Create ICO file using ImageMagick
        images = []
        for size in sizes:
            img_path = f"{png_path}.{size}x{size}.png"
            img = Image.open(png_path).resize((size, size), Image.Resampling.LANCZOS)
            img.save(img_path)
            
        # Combine all sizes into ICO file
        cmd = ['magick'] + [f"{png_path}.{size}x{size}.png" for size in sizes] + [ico_path]
        subprocess.run(cmd, check=True, capture_output=True)
        
        # Clean up temporary files
        for size in sizes:
            temp_path = f"{png_path}.{size}x{size}.png"
            if os.path.exists(temp_path):
                os.remove(temp_path)
        
        print(f"✅ Created .ico file using ImageMagick: {ico_path}")
        return True
        
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("⚠️  ImageMagick not available. Trying PIL fallback...")
        try:
            # PIL can create basic ICO files
            img = Image.open(png_path)
            
            # Create multiple sizes and save as ICO
            ic_sizes = [(32, 32), (16, 16)]  # PIL ICO supports limited sizes
            img.save(ico_path, format='ICO', sizes=ic_sizes)
            
            print(f"✅ Created .ico file using PIL: {ico_path}")
            return True
            
        except Exception as e:
            print(f"❌ PIL ICO creation failed: {e}")
            print(f"⚠️  Please manually convert {png_path} to {ico_path}")
            print("💡 Try installing ImageMagick or use an online converter")
            return False

def get_config():
    """Get configuration for icon creation"""
    return {
        'build_dir': 'build',
        'windows_sizes': [16, 24, 32, 48, 64, 96, 128, 256],
        'macos_sizes': [16, 32, 64, 128, 256, 512, 1024],
        'linux_sizes': [16, 32, 48, 64, 128, 256]
    }

def main():
    # Get script and project paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    # Paths
    source_icon = os.path.join(project_root, 'icon.png')
    build_dir = os.path.join(project_root, 'build')
    
    # Ensure build directory exists
    os.makedirs(build_dir, exist_ok=True)
    
    # Detect platform
    platform_info = detect_platform()
    platform_name, platform_ext = platform_info
    
    # Load configuration
    config = get_config()
    
    if not os.path.exists(source_icon):
        print(f"❌ Error: Source icon not found at {source_icon}")
        return 1
    
    print(f"🖥️  Platform: {platform_name}")
    print(f"📁 Processing icon: {source_icon}")
    print(f"🎯 Target format: {platform_ext}")
    
    # Create rounded PNG (universal intermediate format)
    rounded_png = os.path.join(build_dir, 'icon-rounded.png')
    apply_rounded_corners(source_icon, rounded_png)
    
    # Create platform-specific icon
    success = create_platform_icon(rounded_png, platform_info, config)
    
    if success:
        print(f"\n🎉 Universal icon creation complete!")
        print(f"📁 Rounded PNG: {rounded_png}")
        print(f"🎨 Platform icon created for {platform_name}")
        
        print(f"\n📝 Next steps:")
        print(f"1. Rebuild your app to use the new icon")
        print(f"2. The icon now has proper platform-specific formatting")
        
        if platform_name == 'macos':
            print(f"3. Make sure to use the .icns file in your app bundle")
        elif platform_name == 'windows':
            print(f"3. Make sure to use the .ico file in your app configuration")
        
        return 0
    else:
        print(f"\n❌ Icon creation failed for {platform_name}")
        print("💡 Check error messages above for manual conversion steps")
        return 1

if __name__ == '__main__':
    sys.exit(main())
