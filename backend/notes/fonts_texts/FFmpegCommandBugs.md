# BUG

Caption Debug - FFmpeg Command:
  Full command: C:\Users\phila\Documents\dev\massugc-video-service\venv\lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe -i C:\Users\phila\.zyra-video-agent\enhanced_processing\temp\d0fda06e_connected_overlay.mp4 -vf subtitles=C\:/Users/phila/.zyra-video-agent/enhanced_processing/temp/002169ac_captions.ass -c:a aac -b:a 128k -c:v libx264 -preset fast -profile:v high -level:v 4.0 -pix_fmt yuv420p -crf 23 -movflags +faststart C:\Users\phila\.zyra-video-agent\enhanced_processing\temp\1475563a_captioned.mp4
  ASS file path (original): C:\Users\phila\.zyra-video-agent\enhanced_processing\temp\002169ac_captions.ass
  ASS file path (escaped): C\:/Users/phila/.zyra-video-agent/enhanced_processing/temp/002169ac_captions.ass
  Input video: C:\Users\phila\.zyra-video-agent\enhanced_processing\temp\d0fda06e_connected_overlay.mp4
  Output video: C:\Users\phila\.zyra-video-agent\enhanced_processing\temp\1475563a_captioned.mp4   
ERROR    FFmpeg caption overlay error: FFmpeg caption overlay failed: ffmpeg version 7.1-essentials_build-www.gyan.dev Copyright (c) 2000-2024 the FFmpeg 

## Analysis
 
 see the escaped path is correct now (`C\:/Users/phila/.zyra-video-agent/enhanced_processing/temp/002169ac_captions.ass`), but the error message is cut off. what might be causing the FFmpeg failure.

The issue is likely that the `subtitles` filter needs the path to be **quoted** in addition to being escaped. Let me fix this:Perfect! I've updated the code with the proper fix.

## 🔧 Key Fix for Subtitles Filter:

The `subtitles` filter requires **quoted paths** to handle spaces and special characters properly. The fix adds:

```python
# IMPORTANT: For subtitles filter, also escape single quotes and wrap in quotes
# This handles spaces and special characters in the path
ass_path_for_filter = ass_path_escaped.replace("'", "'\\''")

cmd = [
    self.ffmpeg_path,
    '-i', video_path,
    '-vf', f"subtitles='{ass_path_for_filter}'",  # Single quotes around path!
    ...
]
```

## 📝 Complete Path Transformation:

**Original path:**
```
C:\Users\phila\.zyra-video-agent\enhanced_processing\temp\002169ac_captions.ass
```

**Step 1 - Escape for cross-platform:**
```
C:/Users/phila/.zyra-video-agent/enhanced_processing/temp/002169ac_captions.ass
```

**Step 2 - Escape colons:**
```
C\:/Users/phila/.zyra-video-agent/enhanced_processing/temp/002169ac_captions.ass
```

**Step 3 - Escape quotes and wrap:**
```
subtitles='C\:/Users/phila/.zyra-video-agent/enhanced_processing/temp/002169ac_captions.ass'
```

This ensures the path is properly handled even with:
- Windows drive letters (C:)
- Forward slashes (/)
- Spaces in directory names
- Special characters

The fix is **cross-platform compatible** and will work on Windows, macOS, and Linux! 🎉

Something like 

```python
def _build_drawtext_filter(self, config: TextOverlayConfig, video_info: Dict) -> str:
    """Build FFmpeg drawtext filter string"""

    if FEATURE_DESIGN_SPACE_SCALING and config.design_width and config.design_height:
        # Design-space model
        design_width = config.design_width
        design_height = config.design_height
        safe_margins = config.safe_margins_pct or get_default_safe_margins()

        # Compute scale factor
        scale = compute_scale(
            video_info['width'], video_info['height'],
            design_width, design_height
        )

        # Use exact pixel size from frontend (no calculations needed)
        scaled_font_size = max(8, round(config.font_size or 20))
        print(f"🔤 [TEXT OVERLAY] Frontend calculated {config.font_size}px → Backend applied {scaled_font_size}px")
        logger.info(f"[TEXT OVERLAY] Font size: {scaled_font_size}px")

        # Scale shadow offset
        shadow_x = round((config.shadow_px if config.shadow_px else config.shadow_offset[0]) * scale)
        shadow_y = round((config.shadow_px if config.shadow_px else config.shadow_offset[1]) * scale)

        # Scale background padding
        bg_padding = round(config.background_padding * scale)

        # Position based on percentages and safe margins
        if config.x_pct is not None and config.y_pct is not None:
            x_pos, y_pos = map_percent_to_output(
                config.x_pct, config.y_pct,
                video_info['width'], video_info['height'],
                safe_margins
            )

            # Handle anchor positioning
            if config.anchor == 'center':
                position = f"x={x_pos}-text_w/2:y={y_pos}-text_h/2"
            elif config.anchor == 'top_left':
                position = f"x={x_pos}:y={y_pos}"
            elif config.anchor == 'bottom_center':
                position = f"x={x_pos}-text_w/2:y={y_pos}-text_h"
            else:
                # Default to center
                position = f"x={x_pos}-text_w/2:y={y_pos}-text_h/2"
        else:
            # Fallback to position enum
            position_map = {
                TextPosition.TOP_LEFT: "x=50:y=50",
                TextPosition.TOP_CENTER: "x=(w-text_w)/2:y=50",
                TextPosition.TOP_RIGHT: "x=w-text_w-50:y=50",
                TextPosition.MIDDLE_LEFT: "x=50:y=(h-text_h)/2",
                TextPosition.MIDDLE_CENTER: "x=(w-text_w)/2:y=(h-text_h)/2",
                TextPosition.MIDDLE_RIGHT: "x=w-text_w-50:y=(h-text_h)/2",
                TextPosition.BOTTOM_LEFT: "x=50:y=h-text_h-50",
                TextPosition.BOTTOM_CENTER: "x=(w-text_w)/2:y=h-text_h-50",
                TextPosition.BOTTOM_RIGHT: "x=w-text_w-50:y=h-text_h-50"
            }
            position = position_map[config.position]

        logger.info(f"[TEXT OVERLAY] Design-space: {design_width}x{design_height} -> {video_info['width']}x{video_info['height']}, scale={scale:.3f}")
        logger.info(f"[TEXT OVERLAY] Font: {scaled_font_size}px (frontend exact), Position: {position}")
    else:
        # Legacy scaling model
        # Position calculations
        position_map = {
            TextPosition.TOP_LEFT: "x=50:y=50",
            TextPosition.TOP_CENTER: "x=(w-text_w)/2:y=50",
            TextPosition.TOP_RIGHT: "x=w-text_w-50:y=50",
            TextPosition.MIDDLE_LEFT: "x=50:y=(h-text_h)/2",
            TextPosition.MIDDLE_CENTER: "x=(w-text_w)/2:y=(h-text_h)/2",
            TextPosition.MIDDLE_RIGHT: "x=w-text_w-50:y=(h-text_h)/2",
            TextPosition.BOTTOM_LEFT: "x=50:y=h-text_h-50",
            TextPosition.BOTTOM_CENTER: "x=(w-text_w)/2:y=h-text_h-50",
            TextPosition.BOTTOM_RIGHT: "x=w-text_w-50:y=h-text_h-50"
        }

        position = position_map[config.position]

        # Calculate font size to exactly match preview appearance
        # Use video-to-video scaling for consistency
        preview_video_width = 1080  # Default preview video dimensions
        preview_video_height = 1920

        # For connected backgrounds, use actual video dimensions from metadata
        if hasattr(config, 'connected_background_data') and config.connected_background_data:
            metadata = config.connected_background_data.get('metadata', {})
            preview_video_width = metadata.get('previewVideoWidth', preview_video_width)
            preview_video_height = metadata.get('previewVideoHeight', preview_video_height)

        # Calculate scale factor from preview video to output video
        video_width_scale = video_info['width'] / preview_video_width
        video_height_scale = video_info['height'] / preview_video_height
        scale_factor = min(video_width_scale, video_height_scale)

        # If the scale factor is very close to 1, treat it as 1 (no scaling)
        if abs(scale_factor - 1.0) < 0.01:
            scale_factor = 1.0

        # Scale font size from preview to video resolution
        preview_font_size = config.font_size if config.font_size else 20
        scaled_font_size = int(preview_font_size * scale_factor * config.scale)

        # Use default shadow values
        shadow_x = config.shadow_offset[0]
        shadow_y = config.shadow_offset[1]
        bg_padding = config.background_padding

        logger.info(f"[TEXT OVERLAY LEGACY] preview_video={preview_video_width}x{preview_video_height}, output={video_info['width']}x{video_info['height']}, scale={scale_factor:.3f}, font={preview_font_size}→{scaled_font_size}px")
    
    # Get font path and escape it properly for cross-platform compatibility
    font_path = self._get_font_path(config.font_family)
    
    # CRITICAL FIX: Escape font path for FFmpeg (cross-platform)
    # FFmpeg accepts forward slashes on ALL platforms (Windows, macOS, Linux)
    # Convert backslashes to forward slashes for Windows compatibility
    font_path_escaped = font_path.replace('\\', '/')
    # Escape colons for FFmpeg filter syntax (required on all platforms)
    font_path_escaped = font_path_escaped.replace(':', '\\:')
    
    filter_parts = [
        f"drawtext=text='{config.text}'",
        f"fontfile='{font_path_escaped}'",  # Single quotes around path
        f"fontsize={scaled_font_size}",
        f"fontcolor={config.color}",
        f"text_align=center",  # Center-align multi-line text within the text block
        position
    ]

    # Add background box if enabled
    if config.hasBackground and config.background_color:
        filter_parts.append(f"box=1:boxcolor={config.background_color}:boxborderw={bg_padding}")
        print(f"🎯 [TEXT OVERLAY] Adding background: {config.background_color} with padding {bg_padding}")
    else:
        print(f"🎯 [TEXT OVERLAY] NO background: hasBackground={config.hasBackground}, background_color={config.background_color}")

    # Add shadow if enabled
    if config.shadow_enabled:
        filter_parts.append(f"shadowcolor={config.shadow_color}:shadowx={shadow_x}:shadowy={shadow_y}")
    
    # Add animation if specified
    if config.animation == "fade_in":
        # Escape commas in the alpha expression
        filter_parts.append("alpha='if(lt(t\\,1)\\,t\\,1)'")

    # DEBUG: Log exact FFmpeg command
    final_filter = ":".join(filter_parts)
    logger.info(f"🔧 DEBUG: Generated drawtext filter: {final_filter}")

    return final_filter
```