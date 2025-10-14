# Font Assets Directory

This directory contains bundled font files used by the MassUGC Video Service for text overlays and captions.

## Purpose

The font manager uses a fallback hierarchy:
1. **Primary**: OS-specific system fonts (fastest, no bundling needed)
2. **Bundled**: Fonts in this directory (portable, always available)
3. **Fallback**: Universal system fonts (guaranteed to exist)

## Recommended Fonts to Bundle

Place these font files in this directory for cross-platform compatibility:

### Required Fonts (High Priority)
- `Inter-Regular.ttf`
- `Inter-Medium.ttf`
- `Inter-Bold.ttf`
- `Montserrat-Regular.otf`
- `Montserrat-Bold.otf`
- `NotoColorEmoji.ttf` (for emoji support)

### Optional Fonts (Recommended)
- `ProximaNova-Regular.ttf`
- `ProximaNova-Semibold.ttf`
- `ProximaNova-Bold.ttf`
- `Inter-SemiBold.ttf`
- `Inter-Light.ttf`
- `Montserrat-Light.otf`

## Font Licensing

**IMPORTANT**: Only bundle fonts that you have proper licensing for.

- **Inter**: Open Font License (OFL) - Free to bundle
  - Download: https://rsms.me/inter/
- **Montserrat**: Open Font License (OFL) - Free to bundle
  - Download: https://fonts.google.com/specimen/Montserrat
- **Noto Color Emoji**: Apache License 2.0 - Free to bundle
  - Download: https://github.com/googlefonts/noto-emoji
- **Proxima Nova**: Commercial font - Requires license
  - Purchase: https://www.marksimonson.com/fonts/view/proxima-nova

## File Structure

```
assets/fonts/
├── README.md                    (this file)
├── Inter-Regular.ttf
├── Inter-Medium.ttf
├── Inter-Bold.ttf
├── Montserrat-Regular.otf
├── Montserrat-Bold.otf
├── NotoColorEmoji.ttf
└── [other font files...]
```

## Testing Font Availability

Use the font validation API endpoint to check which fonts are available:

```bash
GET /api/fonts/validate
```

This will return the status of all configured fonts across:
- System fonts (OS-specific)
- Bundled fonts (this directory)
- Fallback fonts (universal)

## Adding New Fonts

1. Place the font file in this directory
2. Add font mapping to `backend/font_manager.py`:
   - Add to `_build_macos_font_map()` for macOS
   - Add to `_build_windows_font_map()` for Windows
   - Add to `_build_linux_font_map()` for Linux
3. Set the `bundled` parameter to the filename
4. Test using the validation endpoint

## Notes

- Font files are NOT tracked in git by default (add `.gitignore` if needed)
- Total bundled font size should be kept under 50MB for reasonable app size
- The font manager automatically handles missing fonts with fallbacks
- System fonts are always preferred over bundled fonts for performance

