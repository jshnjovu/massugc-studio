# 🧪 Testing Enhanced Video Features

## 🚀 Quick Start Testing Guide

### 1. Install New Dependencies
```bash
cd massugc-video-service
pip install -r requirements.txt
```

### 2. Test Backend APIs

#### Test Enhancement Settings Endpoint:
```bash
curl http://localhost:2026/api/enhancements/settings
```

#### Test Music Library:
```bash
curl http://localhost:2026/api/enhancements/music/library
```

#### Test Text Templates:
```bash
curl http://localhost:2026/api/enhancements/text/templates
```

#### Test Caption Styles:
```bash
curl http://localhost:2026/api/enhancements/captions/styles
```

### 3. Test Enhanced Video Processing

#### Sample Campaign Configuration:
Add this to your campaign settings in the frontend:

```javascript
{
  // ... existing campaign settings
  enhanced_video_settings: {
    text_overlay: {
      enabled: true,
      text: "random_from_pool",
      category: "engagement",
      position: "top_center",
      style: "tiktok_primary",
      animation: "fade_in"
    },
    captions: {
      enabled: true,
      style: "tiktok_classic",
      highlight_keywords: true,
      processing_method: "auto"
    },
    music: {
      enabled: true,
      track_id: "random_upbeat",
      volume_db: -25,
      fade_in: 2.0,
      fade_out: 2.0,
      auto_duck: true
    }
  }
}
```

### 4. Frontend Integration

#### Add to NewCampaignForm.jsx:
```javascript
import EnhancedVideoSettings from '../components/EnhancedVideoSettings';

// In the form JSX:
<EnhancedVideoSettings
  settings={formData.enhanced_video_settings || {}}
  onChange={(settings) => setFormData({...formData, enhanced_video_settings: settings})}
  disabled={isSubmitting}
/>
```

## 🎵 Adding Test Music

### Method 1: File System
```bash
# Create sample music files (you can use any royalty-free MP3s)
mkdir -p ~/.zyra-video-agent/uploads/music/upbeat/
mkdir -p ~/.zyra-video-agent/uploads/music/chill/
mkdir -p ~/.zyra-video-agent/uploads/music/corporate/

# Add your MP3 files to these directories
# They'll be auto-detected on next backend restart
```

### Method 2: Upload API
```bash
curl -X POST http://localhost:2026/api/enhancements/music/upload \
  -F "music_file=@/path/to/your/music.mp3" \
  -F "title=Test Track" \
  -F "artist=Test Artist" \
  -F "category=upbeat_energy" \
  -F "mood=energetic"
```

## 🧪 Test Scenarios

### Scenario 1: Text Overlay Only
```javascript
{
  enhanced_video_settings: {
    text_overlay: {
      enabled: true,
      text: "Wait for it... 🤯",
      position: "top_center",
      animation: "fade_in"
    },
    captions: { enabled: false },
    music: { enabled: false }
  }
}
```

### Scenario 2: Captions Only (Local Processing)
```javascript
{
  enhanced_video_settings: {
    text_overlay: { enabled: false },
    captions: {
      enabled: true,
      style: "tiktok_classic",
      processing_method: "local"
    },
    music: { enabled: false }
  }
}
```

### Scenario 3: Full Enhancement Stack
```javascript
{
  enhanced_video_settings: {
    text_overlay: {
      enabled: true,
      text: "ai_generated"
    },
    captions: {
      enabled: true,
      style: "bold_statement",
      highlight_keywords: true
    },
    music: {
      enabled: true,
      track_id: "random_upbeat",
      volume_db: -22,
      auto_duck: true
    }
  }
}
```

## 📊 Testing Checklist

### Backend Tests:
- [ ] All API endpoints return valid responses
- [ ] Music library auto-detects uploaded files
- [ ] Text templates load correctly
- [ ] Caption styles are available
- [ ] Whisper service works (both API and local)
- [ ] Enhanced video processor handles all configurations
- [ ] Error handling works for invalid inputs

### Frontend Tests:
- [ ] EnhancedVideoSettings component loads without errors
- [ ] All toggle switches work
- [ ] Music selection dropdown populates
- [ ] Text overlay options function
- [ ] Caption style selection works
- [ ] Volume sliders update values
- [ ] Form data saves enhanced settings

### Integration Tests:
- [ ] Campaign with enhanced settings submits successfully
- [ ] Video generation includes enhanced processing step
- [ ] Text overlays appear on generated videos
- [ ] Captions sync with audio
- [ ] Background music plays at correct volume
- [ ] Processing times are reasonable
- [ ] Enhanced videos save correctly

### Performance Tests:
- [ ] Processing time with text only: < 30 seconds
- [ ] Processing time with captions (local): < 120 seconds
- [ ] Processing time with captions (API): < 60 seconds
- [ ] Processing time with music: < 45 seconds
- [ ] Full enhancement stack: < 180 seconds
- [ ] Memory usage stays reasonable during processing

## 🐛 Common Issues & Solutions

### Issue: "Module not found" errors
**Solution:** Install missing dependencies:
```bash
pip install whisper Pillow pydub scipy scikit-learn matplotlib fonttools
```

### Issue: Whisper fails to load
**Solution:** Clear model cache and reinstall:
```bash
rm -rf ~/.cache/whisper
pip uninstall whisper
pip install whisper
```

### Issue: Music library empty
**Solution:** Check file permissions and formats:
```bash
ls -la ~/.zyra-video-agent/uploads/music/
# Ensure MP3/M4A files exist and are readable
```

### Issue: Text overlays not showing
**Solution:** Check font availability:
```bash
ls ~/.zyra-video-agent/assets/fonts/
# If empty, system fonts will be used as fallback
```

### Issue: FFmpeg errors during processing
**Solution:** Update FFmpeg and check paths:
```bash
ffmpeg -version
which ffmpeg
# Ensure FFmpeg supports required codecs
```

## 📈 Performance Monitoring

### Monitor Processing Times:
```javascript
// In browser console after video generation:
fetch('http://localhost:2026/api/debug-report', {method: 'POST'})
  .then(r => r.json())
  .then(data => {
    console.log('Enhanced processing metrics:', data);
  });
```

### Check Enhancement Usage:
Look for these log entries during video generation:
```
[job_name] Step 9: Enhanced Video Processing (TikTok-Style Enhancements)
[job_name] ✅ Enhanced processing successful!
[job_name] 🎨 Enhancements applied: {...}
[job_name] 📊 Processing time: X.XXs
```

## 🎯 Success Criteria

### Minimum Viable Test:
1. ✅ Backend starts without errors
2. ✅ API endpoints respond correctly
3. ✅ Frontend component loads
4. ✅ Text overlay can be enabled and configured
5. ✅ Video generation completes with enhanced settings

### Full Feature Test:
1. ✅ All three enhancement types work independently
2. ✅ All three enhancement types work together
3. ✅ AI text generation works (with API key)
4. ✅ Local caption generation works
5. ✅ API caption generation works (with API key)
6. ✅ Music selection and volume control work
7. ✅ A/B variant generation works
8. ✅ Performance is acceptable for production use

## 🚀 Ready for Production?

Check these boxes before deploying:
- [ ] All tests pass
- [ ] Error handling is robust
- [ ] Performance meets requirements
- [ ] Music library is populated
- [ ] API keys are configured (if using)
- [ ] Font assets are available
- [ ] Documentation is complete
- [ ] User training materials are ready

---

**🎉 Congratulations! You now have professional TikTok-style video enhancements in your MassUGC Studio!**