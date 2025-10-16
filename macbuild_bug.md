# macOS Build Issue - RESOLVED

## Problem
When pushing to `unifiedbuild` branch, the macOS build was failing because it was trying to code sign and notarize even when using `build:mac-no-notarize`. The error showed:

```
skipped macOS application code signing  reason=Identity name is specified, but no valid identity with this name in the keychain identity=Jonathan Brower (6UY72DSS38)
```

## Root Cause
The `build:mac-no-notarize` script still expected a valid code signing identity to be present in the keychain, which doesn't exist in the CI environment for the `unifiedbuild` branch.

## Solution Implemented

### 1. Added New Build Script
Added `build:mac-unsigned` to `frontend/package.json`:
```json
"build:mac-unsigned": "vite build && npx dotenv -e .env -- electron-builder --mac --config.mac.identity=null --config.mac.notarize=false"
```

This script completely skips code signing by setting `identity=null` and also disables notarization.

### 2. Updated CI Workflow
Modified `.github/workflows/build-and-deploy.yml` to use different build commands based on the branch:

```yaml
- name: Build macOS desktop app
  working-directory: ${{ env.FRONTEND_DIR }}
  run: |
    if [ "${{ github.ref }}" = "refs/heads/unifiedbuild" ]; then
      echo "Building macOS desktop application (unsigned build for unifiedbuild branch)..."
      npm run build:mac-unsigned
    else
      echo "Building macOS desktop application (fast build - no notarization)..."
      npm run build:mac-no-notarize
    fi
    echo "✓ macOS desktop app built"
    ls -la release-2/
```

## Result & Complete Solution
- `unifiedbuild` branch: Uses completely unsigned build (no code signing, no notarization)
- `main` branch: Uses signed build without notarization for canary, full notarization for production
- No more keychain identity errors on `unifiedbuild` branch

### 3. Script Enhancements ✅
**Additional Files Updated:**
- `frontend/scripts/platform-utils.js`
- `frontend/scripts/universal-build-helper.js`  
- `frontend/scripts/sign-backend-universal.js`
- `frontend/scripts/notarize-universal.js`

**Script Changes:**
- Added branch detection for `unifiedbuild`, `SKIP_SIGNING=true`, `NODE_ENV=development`
- Scripts gracefully skip signing when in unsigned mode
- Removed hardcoded Apple Developer identity
- Build requirements check optional for signing tools in unsigned mode

**Environment Detection Logic:**
```javascript
const isUnifiedBuild = process.env.GITHUB_REF?.includes('unifiedbuild') || 
                      process.env.SKIP_SIGNING === 'true' ||
                      process.env.NODE_ENV === 'development';
```

**Complete Script Coverage:**
- ✅ `universal-build-helper.js` - Optional signing requirements
- ✅ `sign-backend-universal.js` - Skip signing detection  
- ✅ `notarize-universal.js` - Skip notarization detection
- ✅ `platform-utils.js` - Environment-aware signing info

## Build Types Summary
- `build:mac` - Full build with signing and notarization
- `build:mac-notarize` - Full build with signing and notarization (same as above)
- `build:mac-no-notarize` - Signed build without notarization (requires valid identity)
- `build:mac-unsigned` - Completely unsigned build (no identity required) - **NEW**

## Previous Error Log
```
Run echo "Building macOS desktop application (fast build - no notarization)..."
  echo "Building macOS desktop application (fast build - no notarization)..."
  npm run build:mac-no-notarize
  echo "✓ macOS desktop app built"
  ls -la release-2/
  shell: /bin/bash -e {0}
  env:
    PYTHON_VERSION: 3.10.11
    SPEC_FILE: ZyraVideoAgentBackend-minimal.spec
    TEST_SCRIPT: tests/test_dist_build/run_all_tests.py
    BACKEND_DIR: backend
    FRONTEND_DIR: frontend
    NODE_VERSION: 20
Building macOS desktop application (fast build - no notarization)...

 massugc-studio@1.0.20 build:mac-no-notarize
> vite build && npx dotenv -e .env -- electron-builder --mac --config.mac.notarize=false

vite v7.1.10 building for production...
transforming...
✓ 855 modules transformed.
rendering chunks...
computing gzip size...

../../../dist/index.html                   0.78 kB │ gzip:   0.43 kB
(!) Some chunks are larger than 500 kB after minification. Consider:
../../../dist/assets/index-DUIlO5qm.css   93.64 kB │ gzip:  13.49 kB
- Using dynamic import() to code-split the application
../../../dist/assets/index-CVcMXFGI.js   746.55 kB │ gzip: 188.78 kB
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
✓ built in 2.84s
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
  • electron-builder  version=24.13.3 os=24.6.0
  • artifacts will be published if draft release exists  reason=CI detected
  • loaded configuration  file=package.json ("build" field)
  • packaging       platform=darwin arch=arm64 electron=38.3.0 appOutDir=release-2/mac-arm64
  • downloading     url=https://github.com/electron/electron/releases/download/v38.3.0/electron-v38.3.0-darwin-arm64.zip size=112 MB parts=6
  • downloaded      url=https://github.com/electron/electron/releases/download/v38.3.0/electron-v38.3.0-darwin-arm64.zip duration=1.897s
  • skipped macOS application code signing  reason=Identity name is specified, but no valid identity with this name in the keychain identity=Jonathan Brower (6UY72DSS38) allIdentities=     0 identities found
                                                Valid identities only
     0 valid identities found
🖥️  Platform: Darwin 24.6.0
📁 Architecture: arm64
🔧 Detected OS: darwin
🍎 macOS detected - App Store signing/notarization required
[DEBUG] Starting comprehensive macOS notarization for /Users/runner/work/MassUGC/MassUGC/frontend/release-2/mac-arm64/MassUGC Studio.app
📱 Bundle ID: undefined

🔧 Step 1: Verifying and fixing executable signatures...
📍 Checking signatures in: /Users/runner/work/MassUGC/MassUGC/frontend/release-2/mac-arm64/MassUGC Studio.app
🔧 Signing (main): Contents/MacOS/MassUGC Studio
error: The specified item could not be found in the keychain.
⚠️  Could not sign Contents/MacOS/MassUGC Studio: Command failed: codesign --force --timestamp --options runtime --entitlements "/Users/runner/work/MassUGC/MassUGC/frontend/build/entitlements.mac.plist" --sign "Jonathan Brower (6UY72DSS38)" "/Users/runner/work/MassUGC/MassUGC/frontend/release-2/mac-arm64/MassUGC Studio.app/Contents/MacOS/MassUGC Studio"
🔧 Re-signing (backend): Contents/Resources/backend/ZyraVideoAgentBackend
error: The specified item could not be found in the keychain.
🔧 Signing (backend): Contents/Resources/backend/ZyraVideoAgentBackend
error: The specified item could not be found in the keychain.
⚠️  Could not sign Contents/Resources/backend/ZyraVideoAgentBackend: Command failed: codesign --force --timestamp --options runtime --entitlements "/Users/runner/work/MassUGC/MassUGC/frontend/build/entitlements.mac.plist" --sign "Jonathan Brower (6UY72DSS38)" "/Users/runner/work/MassUGC/MassUGC/frontend/release-2/mac-arm64/MassUGC Studio.app/Contents/Resources/backend/ZyraVideoAgentBackend"
🔧 Signing (helper): Contents/Frameworks/MassUGC Studio Helper.app/Contents/MacOS/MassUGC Studio Helper
error: The specified item could not be found in the keychain.
⚠️  Could not sign Contents/Frameworks/MassUGC Studio Helper.app/Contents/MacOS/MassUGC Studio Helper: Command failed: codesign --force --timestamp --options runtime --entitlements "/Users/runner/work/MassUGC/MassUGC/frontend/build/entitlements.mac.minimal.plist" --sign "Jonathan Brower (6UY72DSS38)" "/Users/runner/work/MassUGC/MassUGC/frontend/release-2/mac-arm64/MassUGC Studio.app/Contents/Frameworks/MassUGC Studio Helper.app/Contents/MacOS/MassUGC Studio Helper"
🔧 Signing (helper): Contents/Frameworks/MassUGC Studio Helper (GPU).app/Contents/MacOS/MassUGC Studio Helper (GPU)
error: The specified item could not be found in the keychain.
⚠️  Could not sign Contents/Frameworks/MassUGC Studio Helper (GPU).app/Contents/MacOS/MassUGC Studio Helper (GPU): Command failed: codesign --force --timestamp --options runtime --entitlements "/Users/runner/work/MassUGC/MassUGC/frontend/build/entitlements.mac.minimal.plist" --sign "Jonathan Brower (6UY72DSS38)" "/Users/runner/work/MassUGC/MassUGC/frontend/release-2/mac-arm64/MassUGC Studio.app/Contents/Frameworks/MassUGC Studio Helper (GPU).app/Contents/MacOS/MassUGC Studio Helper (GPU)"
🔧 Signing (helper): Contents/Frameworks/MassUGC Studio Helper (Plugin).app/Contents/MacOS/MassUGC Studio Helper (Plugin)
error: The specified item could not be found in the keychain.
⚠️  Could not sign Contents/Frameworks/MassUGC Studio Helper (Plugin).app/Contents/MacOS/MassUGC Studio Helper (Plugin): Command failed: codesign --force --timestamp --options runtime --entitlements "/Users/runner/work/MassUGC/MassUGC/frontend/build/entitlements.mac.minimal.plist" --sign "Jonathan Brower (6UY72DSS38)" "/Users/runner/work/MassUGC/MassUGC/frontend/release-2/mac-arm64/MassUGC Studio.app/Contents/Frameworks/MassUGC Studio Helper (Plugin).app/Contents/MacOS/MassUGC Studio Helper (Plugin)"
🔧 Signing (helper): Contents/Frameworks/MassUGC Studio Helper (Renderer).app/Contents/MacOS/MassUGC Studio Helper (Renderer)
error: The specified item could not be found in the keychain.
⚠️  Could not sign Contents/Frameworks/MassUGC Studio Helper (Renderer).app/Contents/MacOS/MassUGC Studio Helper (Renderer): Command failed: codesign --force --timestamp --options runtime --entitlements "/Users/runner/work/MassUGC/MassUGC/frontend/build/entitlements.mac.minimal.plist" --sign "Jonathan Brower (6UY72DSS38)" "/Users/runner/work/MassUGC/MassUGC/frontend/release-2/mac-arm64/MassUGC Studio.app/Contents/Frameworks/MassUGC Studio Helper (Renderer).app/Contents/MacOS/MassUGC Studio Helper (Renderer)"
✅ All executables already properly signed
🔑 Using keychain profile for notarization

📤 Step 2: Submitting for notarization...
⏳ This may take 10-30 minutes for large apps...

❌ macOS notarization failed: Failed to codesign your application with code: 1

MassUGC Studio.app: code has no resources but signature indicates they must be present


Executable=/Users/runner/work/MassUGC/MassUGC/frontend/release-2/mac-arm64/MassUGC Studio.app/Contents/MacOS/MassUGC Studio
Identifier=Electron
Format=app bundle with Mach-O thin (arm64)
CodeDirectory v=20400 size=392 flags=0x20002(adhoc,linker-signed) hashes=9+0 location=embedded
VersionPlatform=1
VersionMin=786432
VersionSDK=1703936
Hash type=sha256 size=32
CandidateCDHash sha256=72ea9a41f45b56086bf2c652908b9c9b2a59e2f3
CandidateCDHashFull sha256=72ea9a41f45b56086bf2c652908b9c9b2a59e2f34ce3d9764827feb3043590d9
Hash choices=sha256
CMSDigest=72ea9a41f45b56086bf2c652908b9c9b2a59e2f34ce3d9764827feb3043590d9
CMSDigestType=2
Executable Segment base=0
Executable Segment limit=16384
Executable Segment flags=0x1
Page size=4096
CDHash=72ea9a41f45b56086bf2c652908b9c9b2a59e2f3
Signature=adhoc
Info.plist=not bound
TeamIdentifier=not set
Sealed Resources=none
Internal requirements=none

  ⨯ Failed to codesign your application with code: 1

MassUGC Studio.app: code has no resources but signature indicates they must be present


Executable=/Users/runner/work/MassUGC/MassUGC/frontend/release-2/mac-arm64/MassUGC Studio.app/Contents/MacOS/MassUGC Studio
Identifier=Electron
Format=app bundle with Mach-O thin (arm64)
CodeDirectory v=20400 size=392 flags=0x20002(adhoc,linker-signed) hashes=9+0 location=embedded
VersionPlatform=1
VersionMin=786432
VersionSDK=1703936
Hash type=sha256 size=32
CandidateCDHash sha256=72ea9a41f45b56086bf2c652908b9c9b2a59e2f3
CandidateCDHashFull sha256=72ea9a41f45b56086bf2c652908b9c9b2a59e2f34ce3d9764827feb3043590d9
Hash choices=sha256
CMSDigest=72ea9a41f45b56086bf2c652908b9c9b2a59e2f34ce3d9764827feb3043590d9
CMSDigestType=2
Executable Segment base=0
Executable Segment limit=16384
Executable Segment flags=0x1
Page size=4096
CDHash=72ea9a41f45b56086bf2c652908b9c9b2a59e2f3
Signature=adhoc
Info.plist=not bound
TeamIdentifier=not set
Sealed Resources=none
Internal requirements=none
  failedTask=build stackTrace=Error: Failed to codesign your application with code: 1

Identifier=Electron
Format=app bundle with Mach-O thin (arm64)
CodeDirectory v=20400 size=392 flags=0x20002(adhoc,linker-signed) hashes=9+0 location=embedded
VersionPlatform=1
VersionMin=786432
VersionSDK=1703936
Hash type=sha256 size=32
CandidateCDHash sha256=72ea9a41f45b56086bf2c652908b9c9b2a59e2f3
CandidateCDHashFull sha256=72ea9a41f45b56086bf2c652908b9c9b2a59e2f34ce3d9764827feb3043590d9
Hash choices=sha256
CMSDigest=72ea9a41f45b56086bf2c652908b9c9b2a59e2f34ce3d9764827feb3043590d9
CMSDigestType=2
Executable Segment base=0
Executable Segment limit=16384
Executable Segment flags=0x1
Page size=4096
CDHash=72ea9a41f45b56086bf2c652908b9c9b2a59e2f3
Signature=adhoc
Info.plist=not bound
TeamIdentifier=not set
Sealed Resources=none
Internal requirements=none

    at Generator.next (<anonymous>)
    at fulfilled (/Users/runner/work/MassUGC/MassUGC/frontend/node_modules/@electron/notarize/lib/check-signature.js:28:58)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
Error: Process completed with exit code 1.
```