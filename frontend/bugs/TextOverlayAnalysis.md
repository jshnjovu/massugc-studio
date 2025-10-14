🏗️ **Excellent! I've completed my scan of the MassUGC Studio codebase. Let me map out the complete Text Overlay Architecture for you.**

---

# 📋 **Text Overlay Architecture Map**

## **System Overview**

MassUGC Studio implements a sophisticated text overlay system that allows users to add customizable text elements to videos. The system follows a **frontend-backend architecture** where React components handle UI and preview, while a Python backend (Flask API + FFmpeg) performs the actual video rendering.

---

## **🎯 Architecture Components**

### **1. Frontend Layer (React/Electron)**

#### **A. Component Hierarchy**

```
NewCampaignForm.jsx (Campaign Creation)
    ↓
EnhancedVideoSettings.jsx (Text Overlay Editor)
    ↓
ConnectedTextBackground.jsx (Background Effects)
    ↓
CampaignsPage.jsx (Campaign Management)
```

#### **B. Text Overlay Configuration Structure**

The system supports **3 independent text overlays** per video, each with comprehensive styling options:

**Data Structure (sent to backend):**
```javascript
enhanced_settings: {
  text_overlays: [
    {
      // Core Settings
      enabled: boolean,
      mode: 'custom' | 'random',
      custom_text: string,
      category: 'engagement' | 'hook' | 'cta',
      
      // Typography
      font: string,              // Font family
      fontSize: number,          // Pixels (scaled by video height %)
      bold: boolean,
      italic: boolean,
      underline: boolean,
      textCase: 'none' | 'uppercase' | 'lowercase',
      
      // Positioning & Transform
      x_position: number,        // 0-100% (percentage of video width)
      y_position: number,        // 0-100% (percentage of video height)
      scale: number,             // 0-200% (scale multiplier)
      rotation: number,          // -180 to 180 degrees
      opacity: number,           // 0-100%
      alignment: 'left' | 'center' | 'right',
      
      // Styling
      color: string,             // Hex color (#RRGGBB)
      characterSpacing: number,  // Letter spacing in px
      lineSpacing: number,       // Line height offset
      
      // Stroke/Outline
      hasStroke: boolean,
      strokeColor: string,
      strokeThickness: number,   // Pixel thickness
      
      // Background
      hasBackground: boolean,
      backgroundColor: string,
      backgroundOpacity: number,
      backgroundRounded: number, // Border radius
      backgroundStyle: 'full' | 'line-width' | 'connected',
      backgroundHeight: number,
      backgroundWidth: number,
      backgroundXOffset: number,
      backgroundYOffset: number,
      
      // Connected Background (Special animated backgrounds)
      connected_background_data: {
        svg_url: string,
        animated: boolean,
        wrapWidthPct: number
      }
    },
    // Text overlay 2...
    // Text overlay 3...
  ],
  
  // Captions (separate from overlays)
  captions: {
    enabled: boolean,
    template: 'tiktok_classic' | 'bold_statement' | ...,
    fontSize: number,
    fontFamily: string,
    x_position: number,
    y_position: number,
    color: string,
    hasStroke: boolean,
    strokeColor: string,
    strokeWidth: number,
    max_words_per_segment: number,
    processing_method: 'auto' | 'manual'
  }
}
```

---

### **2. Preview/Editor Layer**

**Location:** `src/renderer/src/components/EnhancedVideoSettings.jsx`

**Key Features:**
- **Live Preview Canvas**: Real-time WYSIWYG editor showing text overlays positioned on video
- **Zoom & Pan**: Canvas supports 25%-400% zoom with panning for precision editing
- **Grid System**: Optional snap-to-grid for alignment (`gridMode: 'none' | 'grid' | 'guides' | 'both'`)
- **Scaling Logic**: Height-based percentage calculation matching backend

```javascript
// Frontend preview scaling (lines 3957-3961)
const previewScale = artboardSize.height / (artboardSize.actualHeight || 1920);
const zoomScale = canvasZoom / 100;
const combinedScale = previewScale * zoomScale;
```

**Preview Rendering** (lines 1577-1619):
```jsx
<div
  style={{
    left: `${overlaySettings.x_position || 50}%`,
    top: `${overlaySettings.y_position || 50}%`,
    fontSize: `${(overlaySettings.fontSize || 20) * combinedScale}px`,
    fontWeight: overlaySettings.bold ? 'bold' : 'normal',
    color: overlaySettings.color,
    transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg)`,
    WebkitTextStroke: hasStroke ? `${thickness}px ${strokeColor}` : 'none',
    // ... additional CSS properties
  }}
>
  {overlayText}
</div>
```

---

### **3. Data Transmission Layer**

**Location:** `src/renderer/src/utils/api.js`

**API Flow:**

```
Frontend Form Submit
    ↓
NewCampaignForm.handleSubmit()
    ↓
apiPost('campaigns', formData, isFormData=true)
    ↓
HTTP POST → http://localhost:2026/campaigns
    ↓
Flask Backend (ZyraVideoAgentBackend.exe)
```

**Campaign Creation** (`src/renderer/src/pages/CampaignsPage.jsx` lines 416-648):
```javascript
const jsonData = {
  job_name: formData.name,
  avatar_id: selectedAvatar.id,
  script_id: selectedScript.id,
  enhanced_settings: formData.enhanced_settings, // ← Text overlay config
  // ... other settings
};

await addCampaign(formData, isFormData=true);
```

---

### **4. Backend Processing Layer**

**Backend Executable:** `ZyraData/backend/ZyraVideoAgentBackend.exe`

**Platform-Optimized Server:**
- **Windows**: Waitress WSGI server (20 threads)
- **Linux/macOS**: Gunicorn (auto-calculated workers)
- **Port**: `2026`
- **API Base**: `http://localhost:2026`

**Backend Workflow** (inferred from API structure):

```
1. Campaign Endpoint Receives Request
   ↓
2. Parse enhanced_settings.text_overlays
   ↓
3. Generate FFmpeg Filter Chain
   ↓
4. Apply Text Overlays to Video
   ↓
5. Render Final Video with Overlays
   ↓
6. Return Job Status via SSE (Server-Sent Events)
```

**FFmpeg Integration** (backend uses FFmpeg `drawtext` filter):

```bash
# Pseudo-command generated by backend:
ffmpeg -i input_video.mp4 \
  -vf "drawtext=text='Overlay Text':
       fontfile=/path/to/font.ttf:
       fontsize=58:
       fontcolor=#FF0000:
       x=(w-text_w)/2:  # Center horizontally (50%)
       y=h*0.18:        # 18% from top
       borderw=2:       # Stroke thickness
       bordercolor=black:
       alpha=1.0" \      # Opacity
  output_video.mp4
```

---

### **5. State Management & Persistence**

**Campaign Storage** (`CampaignsPage.jsx` lines 91-200):

When loading a campaign, all text overlay settings are flattened and stored:

```javascript
// Flat properties for legacy compatibility
text_overlay_enabled: campaign.text_overlay_enabled,
text_overlay_mode: campaign.text_overlay_mode,
text_overlay_custom_text: campaign.text_overlay_custom_text,
text_overlay_font: campaign.text_overlay_font,
text_overlay_fontSize: campaign.text_overlay_fontSize,
text_overlay_x_position: campaign.text_overlay_x_position,
text_overlay_y_position: campaign.text_overlay_y_position,
// ... 50+ more properties for all 3 text overlays
```

---

## **📊 Data Flow Diagram**

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE (React)                    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  EnhancedVideoSettings.jsx                            │  │
│  │  • Text Overlay Editor                                │  │
│  │  • Live Preview Canvas (9:16 aspect ratio)            │  │
│  │  • Zoom/Pan Controls                                   │  │
│  │  • Template System                                     │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                         │
│  ┌─────────────────▼────────────────────────────────────┐  │
│  │  NewCampaignForm.jsx                                  │  │
│  │  • Collect all settings                                │  │
│  │  • Build enhanced_settings object                      │  │
│  │  • Convert pixel sizes to % of video height            │  │
│  └──────────────────┬───────────────────────────────────┘  │
└────────────────────┼────────────────────────────────────────┘
                     │
                     │ HTTP POST /campaigns
                     │ FormData with enhanced_settings
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              API LAYER (api.js)                              │
│  • addCampaign(formData, isFormData=true)                    │
│  • POST http://localhost:2026/campaigns                      │
│  • 5-minute timeout for campaign operations                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│       BACKEND (ZyraVideoAgentBackend.exe - Flask/Python)    │
│                                                               │
│  1. Parse Campaign Request                                   │
│  2. Extract text_overlays from enhanced_settings             │
│  3. For each text overlay:                                   │
│     • Convert % positions to pixel coordinates               │
│     • Calculate fontSize as % of video height                │
│     • Build FFmpeg drawtext filter parameters                │
│  4. Chain multiple drawtext filters (overlay 1, 2, 3)        │
│  5. Execute FFmpeg command                                   │
│  6. Monitor progress → Send SSE updates                      │
│  7. Save rendered video → Return job status                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Server-Sent Events (SSE)
                     │ /events endpoint
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         PROGRESS MONITORING (JobProgressService.js)          │
│  • EventSource connection to /events                         │
│  • Real-time job status updates                              │
│  • Display progress in UI                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## **🔧 Key Technical Details**

### **Font Size Calculation**

**Frontend to Backend Conversion** (`NewCampaignForm.jsx` lines 22-28):

```javascript
// Convert pixel size to percentage of video height
const pixelToPercentage = (pixelSize, videoHeight) => {
  return (pixelSize / videoHeight) * 100;
};

// Example: 58px font on 1920px video = 3.02% of height
fontSize: (form.text_overlay_fontSize / 1920) * 100
```

### **Position Calculation**

```javascript
// X and Y positions are percentages (0-100)
x_position: 50  // 50% = center horizontally
y_position: 18  // 18% from top

// Backend converts to FFmpeg coordinates:
// x = (video_width * x_position / 100) - (text_width / 2)
// y = (video_height * y_position / 100)
```

### **Multi-Overlay Layering**

```javascript
// Overlays are applied in order with z-index
textOverlays.map((overlay, index) => (
  <div key={index} style={{ zIndex: index }} />
))

// Backend applies filters sequentially:
// -vf "drawtext=...[overlay1], drawtext=...[overlay2], drawtext=...[overlay3]"
```

---

## **🎨 Special Features**

### **1. Connected Backgrounds**

`ConnectedTextBackground.jsx` - Animated SVG backgrounds that follow text:

```javascript
{
  connected_background_data: {
    svg_url: 'blob:...',           // Base64-encoded SVG
    animated: true,                  // Enable animation
    wrapWidthPct: 90                // Width as % of video
  }
}
```

### **2. Template System**

Users can save/load text overlay configurations as reusable templates:

```javascript
const savedTemplates = [
  {
    name: "Bold Title",
    textOverlays: [
      { fontSize: 72, bold: true, color: '#FF0000', ... },
      { fontSize: 32, italic: true, color: '#FFFFFF', ... }
    ]
  }
];
```

### **3. Caption System (Separate from Overlays)**

Captions use ASS (Advanced SubStation Alpha) format for word-by-word timing:

```javascript
captions: {
  processing_method: 'auto',        // Auto-detect word timing
  max_words_per_segment: 4,         // Words per subtitle line
  template: 'tiktok_classic',       // Styling preset
  fontSize: 58,
  hasStroke: true                    // Black outline for readability
}
```

---

## **🔄 Video Dimensions & Aspect Ratios**

```javascript
// Default: 9:16 vertical video (TikTok/Instagram Reels)
videoDimensions: {
  width: 1080,
  height: 1920
}

// Preview artboard matches video aspect ratio
artboardSize: {
  width: 300,   // Canvas preview width
  height: 533,  // Canvas preview height (9:16 ratio)
  actualHeight: 1920  // Actual video height for scaling
}
```

---

## **⚡ Performance Optimizations**

1. **Preview Scaling**: Uses CSS transforms instead of re-rendering for smooth zoom/pan
2. **Debounced Updates**: Text input changes debounced to avoid excessive re-renders
3. **Backend Threading**: 
   - Windows: 20 threads (Waitress)
   - Linux/macOS: Auto-calculated workers (Gunicorn)
4. **FFmpeg Hardware Acceleration**: Backend likely uses GPU encoding when available

---

## **🎯 Summary**

The text overlay system follows this flow:

1. **User designs** overlays in `EnhancedVideoSettings.jsx` with live preview
2. **Form submits** structured `enhanced_settings` object with 3 text overlays
3. **API transmits** configuration to Flask backend via POST `/campaigns`
4. **Backend processes** settings and builds FFmpeg filter chain
5. **FFmpeg renders** video with text overlays applied as `drawtext` filters
6. **Progress monitoring** via Server-Sent Events shows real-time status
7. **Final video** saved with text overlays permanently burned in

The architecture cleanly separates **presentation (React)**, **transport (API)**, and **processing (Python + FFmpeg)**, making it maintainable and scalable.

---
