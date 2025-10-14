#!/usr/bin/env python3
"""
Script to create properly rounded macOS app icons from square source images.
This applies the standard macOS rounded rectangle shape with proper corner radius.
"""

import os
import sys
import subprocess

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

def create_rounded_mask(size, corner_radius):
    """Create a rounded rectangle mask."""
    mask = Image.new('L', size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0) + size, radius=corner_radius, fill=255)
    return mask

def apply_rounded_corners(image_path, output_path, corner_radius_ratio=0.2237):
    """
    Apply rounded corners to an image following macOS design guidelines.
    
    Args:
        image_path: Path to source square image
        output_path: Path for output rounded image
        corner_radius_ratio: Ratio of corner radius to image size (macOS standard is ~22.37%)
    """
    # Open and ensure square
    img = Image.open(image_path).convert('RGBA')
    size = min(img.size)
    img = img.resize((size, size), Image.Resampling.LANCZOS)
    
    # Calculate corner radius (macOS uses ~22.37% of the size)
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

def create_icns_file(png_path, icns_path):
    """Create .icns file from PNG using sips (macOS) or iconutil."""
    try:
        # Try using sips first (available on macOS)
        subprocess.run(['sips', '-s', 'format', 'icns', png_path, '--out', icns_path], 
                      check=True, capture_output=True)
        print(f"Created .icns file: {icns_path}")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("sips not available (not on macOS). You'll need to manually convert the PNG to .icns")
        print(f"Use an online converter or macOS to convert {png_path} to {icns_path}")
        return False

def main():
    # Paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    source_icon = os.path.join(project_root, 'icon.png')
    build_dir = os.path.join(project_root, 'build')
    
    # Ensure build directory exists
    os.makedirs(build_dir, exist_ok=True)
    
    # Output paths
    rounded_png = os.path.join(build_dir, 'icon.png')
    icns_file = os.path.join(build_dir, 'icon.icns')
    
    if not os.path.exists(source_icon):
        print(f"Error: Source icon not found at {source_icon}")
        return 1
    
    print(f"Processing icon: {source_icon}")
    print(f"Applying macOS rounded corners...")
    
    # Create rounded version
    apply_rounded_corners(source_icon, rounded_png)
    
    # Try to create .icns file
    create_icns_file(rounded_png, icns_file)
    
    print("\nDone! Your icon now has proper macOS rounded corners.")
    print(f"Rounded PNG: {rounded_png}")
    print(f"For .icns: {icns_file}")
    print("\nNext steps:")
    print("1. Rebuild your app to use the new icon")
    print("2. The new icon will have proper rounded corners on macOS")
    
    return 0

if __name__ == '__main__':
    sys.exit(main()) 