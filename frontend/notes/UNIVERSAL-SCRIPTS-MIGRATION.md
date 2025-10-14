
# Universal Scripts Migration Guide

## Overview
Your MassUGC Studio scripts have been converted from Mac-only to universal cross-platform support.

## New Commands
- `npm run universal:check` - Check build requirements for current platform  
- `npm run universal:icons` - Create platform-appropriate icons
- `npm run universal:sign` - Platform-aware backend signing
- `npm run universal:build` - Complete universal build process

## Platform Requirements

### macOS
- Xcode Command Line Tools
- Apple Developer Certificate  
- Keychain profile: "MassUGC-Studio"
- Optional: APPLE_API_KEY for modern authentication

### Windows  
- Windows SDK (includes signtool.exe)
- Code signing certificate
- Python 3.x with PIL/Pillow
- Optional: ImageMagick for advanced icon conversion
- Environment: WINDOWS_CERT_THUMBPRINT

### Linux
- Python 3.x with PIL/Pillow
- No code signing required

## Quick Start
1. Run: `npm run universal:check`
2. Configure environment variables as needed
3. Run: `npm run universal:build`

## Files Changed
- Created universal signing script
- Enhanced notarization with platform detection  
- Updated icon creation for all platforms
- Added build requirements checker
- Updated package.json with universal scripts

Your original platform-specific scripts are still available and working!
