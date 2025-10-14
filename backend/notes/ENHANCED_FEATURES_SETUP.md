# 🎬 Enhanced Video Features Setup Guide

## 📋 Overview

This guide explains how to set up the new TikTok-style video enhancement features including:
- ✨ Text overlays with professional styling
- 🎬 Auto-generated captions with word-level timing
- 🎵 Background music with smart volume control

## 🚀 Quick Setup

### 1. Install Dependencies

```bash
cd massugc-video-service
pip install -r requirements.txt
```

### 2. Add Music Library

Create your music library by adding MP3/M4A files to:
```
~/.zyra-video-agent/uploads/music/
├── upbeat/          # High-energy tracks
├── chill/           # Ambient, relaxed tracks
├── corporate/       # Professional background music
└── trending/        # Popular TikTok-style beats
```

**Supported formats:** MP3, M4A, WAV, OGG, FLAC

### 3. Add Custom Fonts (Optional)

Add TrueType fonts to:
```
~/.zyra-video-agent/assets/fonts/
├── Montserrat-Bold.ttf      # Primary heading font
├── Montserrat-Black.ttf     # Extra bold variant
├── Inter-Medium.ttf         # Clean, modern font
├── Impact.ttf               # Bold statement font
└── NotoColorEmoji.ttf       # Emoji support
```

### 4. Configure OpenAI Whisper API (Optional)

For faster caption generation, add your OpenAI API key in Settings:
```
Settings → Video Enhancements → OpenAI Whisper API Key
```

**Without API key:** Uses local Whisper (slower but free)
**With API key:** Uses OpenAI API (2-5 seconds, costs ~$0.006 per minute)

## 🎨 Using Enhanced Features

### In Campaign Settings:

#### 📝 Text Overlays
- **Random Text:** Auto-selects from curated templates
- **AI Generated:** Creates custom text based on your video content
- **Custom Text:** Use your own text overlay

#### 🎬 Auto Captions
- **TikTok Classic:** White text, black background
- **Bold Statement:** Yellow text with outline
- **Clean Minimal:** Transparent background
- **Emoji Accent:** Supports emoji in captions

#### 🎵 Background Music
- **Auto-Selection:** Picks music by category/mood
- **Smart Volume:** Automatically balances with voice
- **Auto-Ducking:** Reduces music volume during speech

## 📊 Performance Guide

### Fast Processing (Recommended):
- **Hardware:** Modern CPU (8+ cores) or GPU acceleration
- **API Keys:** OpenAI Whisper API configured
- **Processing Time:** +15-30 seconds per video
- **Cost:** ~$0.01-0.05 per video (API usage)

### Standard Processing:
- **Hardware:** Any system
- **API Keys:** None required
- **Processing Time:** +60-120 seconds per video
- **Cost:** Free (local processing)

## 🎵 Music Library Management

### Adding Music via Upload:
1. Go to Settings → Enhanced Features → Music Library
2. Click "Upload Music"
3. Select MP3/M4A file
4. Add metadata (title, artist, category, mood)
5. Music is automatically analyzed for BPM, key, energy level

### Adding Music via File System:
1. Copy files to `~/.zyra-video-agent/uploads/music/`
2. Organize by category folders (upbeat/, chill/, etc.)
3. Restart the backend - music is auto-detected and analyzed

### Music Categories:
- **upbeat_energy:** Product demos, energetic content
- **chill_vibes:** Educational, calm content  
- **corporate_clean:** Professional, business content
- **trending_sounds:** Viral, TikTok-style content

## 🎯 A/B Testing Variants

The system can automatically generate multiple versions of your video with different enhancement combinations for testing:

### Variant A: Engagement Focus
- Random engaging text overlay
- TikTok classic captions
- Upbeat background music

### Variant B: Professional Focus
- AI-generated text based on content
- Clean minimal captions
- Corporate background music

### Variant C: Creative Focus
- Custom text overlay
- Bold statement captions
- No background music (voice focus)

## 🛠️ Troubleshooting

### Text Overlays Not Showing:
- Check font files exist in `~/.zyra-video-agent/assets/fonts/`
- Ensure text is not empty
- Try different positions if video has overlapping content

### Captions Generation Failed:
- **Without API key:** Ensure `whisper` package is installed
- **With API key:** Check API key is valid and has credits
- **Audio quality:** Ensure clear speech in generated audio

### Music Not Playing:
- Check music files are in supported formats (MP3, M4A, WAV)
- Ensure files are not corrupted
- Check volume levels aren't muted (-40dB or lower)

### Performance Issues:
- **Slow processing:** Add OpenAI Whisper API key for faster captions
- **High CPU usage:** Reduce concurrent video processing
- **Memory issues:** Use smaller music files or reduce quality

## 📝 Best Practices

### Text Overlays:
- Keep text under 8 words for readability
- Use high contrast colors
- Position away from main subject
- Test on different screen sizes

### Captions:
- Ensure clear speech in original audio
- Use keyword highlighting for important terms
- Choose styles that match your brand
- Preview different caption styles

### Music:
- Keep background music 6-10dB quieter than voice
- Use fade in/out for professional transitions
- Match music mood to content emotion
- Avoid copyrighted music for commercial use

## 🔧 API Endpoints

### Get Enhancement Settings:
```
GET /api/enhancements/settings
```

### Get Music Library:
```
GET /api/enhancements/music/library
```

### Generate AI Text:
```
POST /api/enhancements/text/generate
{
  "transcript": "video content...",
  "product": "fitness tracker", 
  "emotion": "engaging"
}
```

### Get Caption Styles:
```
GET /api/enhancements/captions/styles
```

## 📈 Performance Monitoring

Monitor enhancement performance in the debug report:
```
POST /api/debug-report
```

Look for:
- Processing times by enhancement type
- API usage and costs
- Success/failure rates
- Memory and CPU usage

## 🎵 Music Licensing

**Important:** Ensure you have proper licensing for any music you add to the library:

- ✅ **Royalty-free music:** Safe for commercial use
- ✅ **Creative Commons:** Check specific license terms
- ✅ **Original compositions:** You own the rights
- ❌ **Copyrighted music:** Requires licensing for commercial use

## 📞 Support

For issues or questions:
1. Check the debug report (`/api/debug-report`)
2. Review the application logs
3. Test with minimal settings first
4. Report bugs with specific error messages and steps to reproduce

---

**🎉 Enjoy creating professional TikTok-style videos with your enhanced MassUGC Studio!**