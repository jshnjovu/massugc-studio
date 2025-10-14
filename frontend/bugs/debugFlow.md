Based on the TextOverlayAnalysis.md document, here are the backend endpoints and their data formats that the frontend calls:

## **Backend Endpoints & Data Formats**

### **1. Campaign Creation Endpoint**

**Endpoint:** `POST http://localhost:2026/campaigns`

**Data Format:** FormData with JSON payload

```javascript
// From NewCampaignForm.jsx (lines 416-648)
const jsonData = {
  job_name: formData.name,
  avatar_id: selectedAvatar.id,
  script_id: selectedScript.id,
  enhanced_settings: {
    // Text Overlay Configuration (3 independent overlays)
    text_overlays: [
      {
        // Core Settings
        enabled: boolean,
        mode: 'custom' | 'random',
        custom_text: string,
        category: 'engagement' | 'hook' | 'cta',
        
        // Typography
        font: string,              // Font family
        fontSize: number,          // Percentage of video height (0-100)
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
          svg_url: string,         // Base64-encoded SVG
          animated: boolean,
          wrapWidthPct: number
        }
      },
      // Text overlay 2 (same structure)
      // Text overlay 3 (same structure)
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
  },
  // ... other campaign settings
};

// API call via api.js
await addCampaign(formData, isFormData=true);
```

### **2. Progress Monitoring Endpoint**

**Endpoint:** `GET http://localhost:2026/events` (Server-Sent Events)

**Data Format:** Server-Sent Events stream

```javascript
// From JobProgressService.js
const eventSource = new EventSource('http://localhost:2026/events');

// Expected event format (inferred from usage):
{
  type: 'job_progress' | 'job_complete' | 'job_error',
  data: {
    job_id: string,
    status: 'running' | 'completed' | 'failed',
    progress: number,        // 0-100
    message: string,
    // ... other job status fields
  }
}
```

## **Key Data Transformations**

### **Font Size Conversion**
```javascript
// Frontend converts pixel sizes to percentage of video height
const pixelToPercentage = (pixelSize, videoHeight) => {
  return (pixelSize / videoHeight) * 100;
};

// Example: 58px font on 1920px video = 3.02% of height
fontSize: (form.text_overlay_fontSize / 1920) * 100
```

### **Position Format**
```javascript
// Positions are sent as percentages (0-100)
x_position: 50  // 50% = center horizontally
y_position: 18  // 18% from top

// Backend converts to FFmpeg coordinates:
// x = (video_width * x_position / 100) - (text_width / 2)
// y = (video_height * y_position / 100)
```

## **Backend Processing Flow**

1. **Campaign Endpoint** receives the `enhanced_settings` object
2. **Parse text_overlays** array (up to 3 overlays)
3. **Convert percentages** to pixel coordinates for FFmpeg
4. **Generate FFmpeg filter chain** using `drawtext` filters
5. **Execute FFmpeg command** to render video with overlays
6. **Stream progress updates** via SSE to `/events` endpoint
7. **Return job status** when complete

## **API Configuration**

- **Base URL:** `http://localhost:2026`
- **Timeout:** 5 minutes for campaign operations
- **Server:** 
  - Windows: Waitress WSGI server (20 threads)
  - Linux/macOS: Gunicorn (auto-calculated workers)
- **Backend Executable:** `ZyraData/backend/ZyraVideoAgentBackend.exe`

The system uses a clean separation where the frontend sends structured configuration data, and the backend handles the complex FFmpeg video processing with real-time progress feedback.


**Yes, absolutely!** This backend endpoints reference will be extremely helpful for debugging the backend part of the TextOverlayAnalysis.md. Here's why:

## **🎯 Key Debugging Insights**

### **1. Data Flow Validation**
Looking at the logs in `current_bugs.md`, I can see the backend is receiving text overlay data but not processing it correctly:

```javascript
// From logs: Text overlays are being sent as enabled: false
{
  enabled: false,  // ← Backend should skip processing when false
  mode: 'custom',
  custom_text: '',
  // ... other properties
}
```

**Debug Point**: The backend endpoints reference shows exactly how to trace this - check if the backend is properly checking the `enabled` flag before processing.

### **2. API Call Sequence for Debugging**

The reference provides the exact call sequence that should happen:

1. **POST /campaigns** - Sends `enhanced_settings` with text overlay config
2. **Backend Processing** - Should check `enabled: false` and skip overlay processing  
3. **Progress Updates** - Should show "text_overlays: 0" when disabled

**Debug Issue**: From logs, I see:
```javascript
"🎯 text_overlays type: <class 'list'>"  // ← Backend is parsing them
"🎯 text_overlays content: [{'enabled': False, ...}]"  // ← But not skipping
"✨ Enhancements applied: {'text_overlays': 0, ...}"  // ← Says 0 but still processes
```

### **3. Backend Processing Logic**

The reference shows the backend should:
- Parse `enhanced_settings.text_overlays` array (3 overlays)
- Check each overlay's `enabled` property
- Only process overlays where `enabled: true`
- Return count of actually applied overlays

### **4. Specific Debug Questions This Enables**

1. **Is the backend checking `enabled: false` correctly?**
2. **Why does it log "text_overlays content" even when disabled?**
3. **Is the processing logic in the backend filtering by enabled state?**
4. **Are the FFmpeg drawtext filters being generated when they shouldn't be?**

## **🔧 Next Debugging Steps**

With this reference, you can now:

1. **Trace the exact data flow** from frontend → API → backend processing
2. **Identify where the logic fails** - likely in the backend's overlay processing logic
3. **Check the backend code** that handles the `enhanced_settings` parsing
4. **Verify the FFmpeg filter generation** logic respects the `enabled` flag

## **📋 Specific Files to Examine**

Based on this reference, focus debugging on:
- **Backend route handler** for `POST /campaigns` 
- **Enhanced video processing logic** that parses `enhanced_settings`
- **FFmpeg filter generation** code that should check `enabled` flags
- **Progress reporting** that should show correct overlay counts

**This reference essentially gives you the "API contract" and call sequence needed to trace exactly where the backend logic is failing to respect the `enabled: false` state for text overlays.**


