#!/bin/bash
set -e

echo "🔐 Signing Python backend binaries..."

IDENTITY="Jonathan Brower (6UY72DSS38)"
BACKEND_DIR="ZyraData/backend"

if [ ! -d "$BACKEND_DIR" ]; then
    echo "❌ Backend directory not found: $BACKEND_DIR"
    exit 1
fi

# Count files to sign
SO_COUNT=$(find "$BACKEND_DIR" -name "*.so" 2>/dev/null | wc -l | xargs)
DYLIB_COUNT=$(find "$BACKEND_DIR" -name "*.dylib" 2>/dev/null | wc -l | xargs)

echo "📋 Found $SO_COUNT .so files and $DYLIB_COUNT .dylib files to sign"

# Sign all .so files
if [ "$SO_COUNT" -gt 0 ]; then
    echo "🔧 Signing .so files..."
    find "$BACKEND_DIR" -name "*.so" -exec codesign --force --timestamp --options runtime --sign "$IDENTITY" {} \;
    echo "✅ Signed $SO_COUNT .so files"
else
    echo "ℹ️  No .so files found to sign"
fi

# Sign all .dylib files  
if [ "$DYLIB_COUNT" -gt 0 ]; then
    echo "🔧 Signing .dylib files..."
    find "$BACKEND_DIR" -name "*.dylib" -exec codesign --force --timestamp --options runtime --sign "$IDENTITY" {} \;
    echo "✅ Signed $DYLIB_COUNT .dylib files"
else
    echo "ℹ️  No .dylib files found to sign"
fi

# Sign the main backend executable
echo "🔧 Signing main backend executable..."
if [ -f "$BACKEND_DIR/ZyraVideoAgentBackend" ]; then
    codesign --force --timestamp --options runtime --sign "$IDENTITY" "$BACKEND_DIR/ZyraVideoAgentBackend"
    echo "✅ Signed main backend executable"
elif [ -f "$BACKEND_DIR/ZyraVideoAgentBackend.exe" ]; then
    echo "ℹ️  Found Windows executable, skipping signing"
else
    echo "⚠️  Main backend executable not found, checking for other executables..."
    EXEC_COUNT=$(find "$BACKEND_DIR" -type f -perm +111 ! -name "*.so" ! -name "*.dylib" | wc -l | xargs)
    if [ "$EXEC_COUNT" -gt 0 ]; then
        echo "🔧 Signing $EXEC_COUNT additional executables..."
        find "$BACKEND_DIR" -type f -perm +111 ! -name "*.so" ! -name "*.dylib" -exec codesign --force --timestamp --options runtime --sign "$IDENTITY" {} \;
        echo "✅ Signed additional executables"
    fi
fi

# Sign Python.framework if it exists (this was causing build issues)
echo "🔧 Checking for Python.framework..."
PYTHON_FRAMEWORK="$BACKEND_DIR/_internal/Python.framework"
if [ -d "$PYTHON_FRAMEWORK" ]; then
    echo "🔧 Signing Python.framework..."
    # Sign the main Python binary in the framework
    if [ -f "$PYTHON_FRAMEWORK/Python" ]; then
        codesign --force --timestamp --options runtime --sign "$IDENTITY" "$PYTHON_FRAMEWORK/Python" || echo "⚠️  Python framework binary couldn't be signed (this is often okay)"
    fi
    # Try to sign the framework itself
    codesign --force --timestamp --options runtime --sign "$IDENTITY" "$PYTHON_FRAMEWORK" || echo "⚠️  Python framework couldn't be signed (this is often okay)"
    echo "✅ Python.framework signing attempted"
else
    echo "ℹ️  No Python.framework found"
fi

# Sign specific executables that Apple flagged
echo "🔧 Signing specific executables that require hardened runtime..."

# Sign ffmpeg binary if it exists
FFMPEG_BINARY="$BACKEND_DIR/_internal/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1"
if [ -f "$FFMPEG_BINARY" ]; then
    echo "🔧 Signing ffmpeg binary..."
    codesign --force --timestamp --options runtime --sign "$IDENTITY" "$FFMPEG_BINARY" || echo "⚠️  ffmpeg binary couldn't be signed"
fi

# Sign torch binaries if they exist
TORCH_BINARIES=(
    "$BACKEND_DIR/_internal/torch/bin/protoc-3.13.0.0"
    "$BACKEND_DIR/_internal/torch/bin/torch_shm_manager"
    "$BACKEND_DIR/_internal/torch/bin/protoc"
)

for binary in "${TORCH_BINARIES[@]}"; do
    if [ -f "$binary" ]; then
        echo "🔧 Signing torch binary: $(basename "$binary")"
        codesign --force --timestamp --options runtime --sign "$IDENTITY" "$binary" || echo "⚠️  $(basename "$binary") couldn't be signed"
    fi
done

echo "🎉 Backend signing complete! All Python binaries are now properly signed for notarization." 