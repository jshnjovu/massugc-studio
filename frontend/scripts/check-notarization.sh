#!/bin/bash
set -e

echo "🔍 MassUGC Studio - Notarization Status Checker"
echo "=============================================="

# Check if keychain profile exists
echo "🔑 Checking keychain profile..."
if xcrun notarytool history --keychain-profile "MassUGC-Studio" > /dev/null 2>&1; then
    echo "✅ Keychain profile 'MassUGC-Studio' is configured"
else
    echo "❌ Keychain profile 'MassUGC-Studio' not found"
    echo "   Please set up your keychain profile first:"
    echo "   xcrun notarytool store-credentials 'MassUGC-Studio' --apple-id YOUR_APPLE_ID --team-id 6UY72DSS38"
    exit 1
fi

# Check recent submission history
echo ""
echo "📊 Recent notarization history:"
xcrun notarytool history --keychain-profile "MassUGC-Studio" | head -20

# Check if there's an in-progress submission
echo ""
echo "🔄 Checking for in-progress submissions..."
IN_PROGRESS=$(xcrun notarytool history --keychain-profile "MassUGC-Studio" | grep "In Progress" || true)

if [ ! -z "$IN_PROGRESS" ]; then
    echo "⚠️  Found in-progress submission:"
    echo "$IN_PROGRESS"
    echo ""
    echo "Options:"
    echo "1. Wait for it to complete (recommended)"
    echo "2. Check its status periodically with: xcrun notarytool info SUBMISSION_ID --keychain-profile 'MassUGC-Studio'"
    echo ""
else
    echo "✅ No in-progress submissions found"
fi

# Check if latest DMG build exists
echo ""
echo "📦 Checking for latest DMG build..."
LATEST_DMG=$(find release-3 -name "*.dmg" -type f -exec ls -t {} + 2>/dev/null | head -1 || true)

if [ ! -z "$LATEST_DMG" ]; then
    echo "✅ Found latest DMG: $LATEST_DMG"
    
    # Check if it's signed
    echo "🔍 Checking DMG signature..."
    if codesign --verify --verbose "$LATEST_DMG" 2>/dev/null; then
        echo "✅ DMG is properly signed"
    else
        echo "⚠️  DMG signature verification failed"
    fi
else
    echo "ℹ️  No DMG found in release-3 directory"
fi

# Check signing identity
echo ""
echo "🔐 Checking code signing identity..."
IDENTITY_CHECK=$(security find-identity -v -p codesigning | grep "Jonathan Brower (6UY72DSS38)" || true)
if [ ! -z "$IDENTITY_CHECK" ]; then
    echo "✅ Code signing identity found:"
    echo "$IDENTITY_CHECK"
else
    echo "❌ Code signing identity 'Jonathan Brower (6UY72DSS38)' not found"
fi

echo ""
echo "🎯 Next Steps:"
echo "1. Wait for any in-progress submissions to complete"
echo "2. Run: npm run build:mac-notarize"
echo "3. Monitor the detailed output from our enhanced notarization script"
echo ""
echo "📝 Note: The new script will:"
echo "   - Sign all backend binaries (already working)"
echo "   - Verify and fix Electron helper signatures"
echo "   - Apply appropriate entitlements to all executables"
echo "   - Submit for notarization with better error handling"
echo "   - Staple the notarization ticket" 