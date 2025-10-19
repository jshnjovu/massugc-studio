# Production Build Issues - MassUGC Studio
**Date:** October 19, 2025  
**Build Version:** 1.0.20  
**Platforms Tested:** Windows 11, macOS  
**Build Source:** GitHub Actions (commit cab769a)

---

## 🚨 **CRITICAL ISSUE #1: API Keys Auto-Connected on Brand New Device**

### **Severity:** CRITICAL SECURITY ISSUE

### **Problem:**
On a **brand new Windows device** (never used MassUGC before), the app **automatically connected** with production API keys:

**Auto-Configured Settings:**
- ✅ MassUGC API Key (connected to team@vandelnetwork.com)
- ✅ OpenAI API Key 
- ✅ ElevenLabs API Key
- ✅ Lipsync API Key
- ✅ GCS Bucket Name
- ✅ Google Application Credentials (path to JSON file)
- ✅ Google Drive connected
- ✅ Export path set to: `C:\Users\jonny\Downloads\MassUGC-Export-Folder`

### **Expected Behavior:**
On a fresh install, user should need to configure ALL API keys manually.

### **Security Risk:**
If distributed to users, they would have access to YOUR API keys and could:
- Use your OpenAI credits
- Use your ElevenLabs quota
- Access your Google Drive
- Upload to your GCS bucket

### **Questions:**
1. Where are these API keys being stored/bundled?
2. Are they in a config file that got bundled with PyInstaller?
3. Are they in environment variables?
4. Are they hardcoded somewhere?

### **Required Investigation:**
- Check if `.env` file is being bundled
- Check if `massugc-cd0de8ebffb2.json` (Google credentials) is bundled
- Check PyInstaller spec for what config files are included
- Search backend code for hardcoded API keys

---

## 🧪 **ISSUE #2: Test Data in Production Builds**

### **Severity:** HIGH - Poor user experience

### **Problem:**
Fresh installation comes pre-loaded with test data:
- Test avatars
- Test scripts  
- Test campaigns

### **Expected Behavior:**
Production build should start with ZERO data. Users add their own.

### **Required Investigation:**
1. Check if sample data is in `backend/assets/` and being bundled
2. Check if YAML files with test data are being included
3. Check if `ZyraData/` contains sample files that get copied
4. Verify PyInstaller spec `datas=` section

### **Files to Check:**
- `backend/assets/sample_music_library.yaml`
- Any sample avatars in `ZyraData/Avatars/`
- Any sample scripts in `ZyraData/Scripts/`

---

## 🔤 **ISSUE #3: Proxima Nova Semibold Font Not Available**

### **Severity:** HIGH - Critical font for branding

### **Problem:**
"Proxima Nova Semibold" font not available on fresh Windows/Mac installations.

### **Requirements:**
1. Font must work on **brand new devices** (users who've never used the app)
2. Should work on **Windows AND macOS**
3. Should be **default font** for text overlays
4. Must be bundled with the app (not require system installation)

### **Current State:**
- Font works on development machine (has font installed)
- Font NOT available on fresh installations

### **Required Investigation:**
1. Check if Proxima Nova Semibold is in `backend/assets/fonts/`
2. Verify PyInstaller bundles fonts directory: `('assets', 'assets')`
3. Check font loading code in backend
4. Verify font fallback if Proxima Nova not found

### **Expected Fix:**
- Bundle Proxima Nova Semibold with app
- Set as default font in config
- Proper fallback if font fails to load

---

## 📝 **ISSUE #4: Text Overlays Failing on Windows**

### **Severity:** HIGH - Core functionality broken

### **Error:**
```
[WinError 2] The system cannot find the file specified
ERROR    Enhanced processing failed: [WinError 2] The system cannot find the file specified
```

### **Context:**
```
Caption config status: False
fontPx=None, fontPercentage=None
❌ Enhanced processing failed
Continuing with original video...
```

### **Problem:**
Text overlays are configured but failing silently. Error message doesn't specify WHICH file is missing.

### **Required Investigation:**
1. Which file is missing? (Font file? Temp file? FFmpeg?)
2. Are file paths Windows-compatible? (backslashes vs forward slashes)
3. Is it a font loading issue?
4. Is it related to missing Proxima Nova?

### **Test Case:**
- Platform: Windows 11
- Text overlays configured: 3 overlays
- Background style: line-width
- Connected background enabled: True

### **Expected Behavior:**
Text overlays should render on video on both Windows and macOS.

---

## 🔴 **ISSUE #5: Console Log Confusion - Red Errors vs INFO Logs**

### **Severity:** LOW - Cosmetic/UX issue

### **Problem:**
**ALL Flask backend logs** appear in Chrome DevTools as:
- Red text
- Red X icon
- Listed in "Errors" tab

**Even SUCCESS messages** show as errors:
```
❌ [Backend stderr]: INFO ✅ Campaign saved  ← Checkmark in message but red X icon!
❌ [Backend stderr]: INFO HTTP/1.1" 200 -     ← Success code but shows as error!
```

### **User Confusion:**
Never seen INFO/SUCCESS logs show as red errors before. Makes it impossible to distinguish real errors from normal logs.

### **Root Cause (Suspected):**
```javascript
// index.js
backendProcess.stderr.on('data', (data) => {
  console.error(`[Backend stderr]: ${data}`);  ← Uses console.error for ALL stderr
});
```

Flask logs INFO to stderr → Electron forwards as console.error() → Shows red in DevTools

### **Question:**
Is this intentional/normal? If not, should we:
1. Parse log levels and use console.log() for INFO, console.error() for ERROR?
2. Redirect Flask INFO logs to stdout instead of stderr?
3. Accept this as normal Electron app behavior?

---

## 📊 **PRIORITY ORDER:**

1. **CRITICAL:** API keys auto-loading (security issue)
2. **HIGH:** Proxima Nova font missing (core feature)
3. **HIGH:** Text overlays failing on Windows (core feature)
4. **MEDIUM:** Test data in production builds (UX issue)
5. **LOW:** Console log colors (cosmetic)

---

## 🧪 **TESTING ENVIRONMENT:**

**Tested On:**
- Windows 11 (fresh device, never had MassUGC installed)
- Built from GitHub Actions (commit cab769a)
- Artifact: `massugc-studio-windows-[sha].zip`
- Installer: `MassUGC Studio Setup 1.0.20.exe`

**What Works:**
- ✅ App installs and launches
- ✅ Backend auto-starts on port 2026
- ✅ Frontend connects to backend
- ✅ Can create/edit/duplicate campaigns
- ✅ Campaigns save to YAML
- ✅ IPC communication works
- ✅ React Query caching works
- ✅ App icon displays (though square, not rounded)

**What Doesn't Work:**
- ❌ Video jobs fail (FFmpeg missing - fix pending in commit cab769a)
- ❌ Text overlays fail (file not found)
- ❌ Proxima Nova font unavailable
- ❌ Pre-loaded with test data
- ❌ Pre-configured with production API keys (SECURITY ISSUE)

---

## 📝 **FILES TO INVESTIGATE:**

### **For API Keys Issue:**
- `backend/app.py` - Check environment variable loading
- `backend/.env` - Check if bundled (SHOULD NOT BE!)
- `backend/massugc-cd0de8ebffb2.json` - Google credentials (should not bundle)
- `backend/ZyraVideoAgentBackend-minimal.spec` - Check what's in `datas=`
- `.gitignore` - Verify .env is excluded

### **For Test Data:**
- `backend/assets/` - Sample data files
- `frontend/ZyraData/` - Sample avatars/scripts
- PyInstaller spec `datas=` section

### **For Fonts:**
- `backend/assets/fonts/` - Check if Proxima Nova exists
- `backend/backend/font_manager.py` - Font loading logic
- Font fallback configuration

### **For Text Overlays:**
- `backend/backend/enhanced_video_processor.py` - Text overlay code
- Windows file path handling (backslashes)
- Font file path resolution

---

## 🔍 **NEXT STEPS:**

1. **Immediate:** Fix API key bundling (critical security issue)
2. **High Priority:** Add Proxima Nova font and fix text overlays
3. **Medium Priority:** Remove test data from builds
4. **Optional:** Improve console logging (cosmetic)
5. **Pending:** Test FFmpeg fix when new build completes

---

**All issues documented for another chat to address.**

