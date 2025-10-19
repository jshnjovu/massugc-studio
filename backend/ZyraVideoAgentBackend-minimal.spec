# -*- mode: python ; coding: utf-8 -*-
# Alternative minimal spec file using directory mode to avoid DLL extraction issues

import os
import sys
from pathlib import Path
from PyInstaller.utils.hooks import collect_all

# Add current directory to path
sys.path.insert(0, os.getcwd())

# Collect all imageio_ffmpeg files (binaries + data)
imageio_datas, imageio_binaries, imageio_hiddenimports = collect_all('imageio_ffmpeg')

a = Analysis(
    ['app.py'],
    pathex=[os.getcwd()],
    binaries=imageio_binaries,  # FFmpeg binaries
    datas=[
        ('whisper', 'whisper'), 
        ('backend/backend', 'backend'),  # SECURITY FIX: Only bundle Python package, not docs/tests/credentials
        ('assets/fonts', 'assets/fonts'),  # SECURITY FIX: Only bundle fonts, not sample_music_library.yaml
        ('massugc_api_client.py', '.'),  # Ensure API client is included
    ] + imageio_datas,  # FFmpeg data files
    hiddenimports=[
        'imageio_ffmpeg',  # Ensure module is imported
    ] + imageio_hiddenimports + [
        'whisper',
        'backend.create_video',
        'backend.randomizer',
        'backend.clip_stitch_generator',
        'backend.merge_audio_video',
        'backend.concat_random_videos',
        'backend.whisper_service',
        'backend.music_library',
        'backend.google_drive_service',
        'backend.enhanced_video_processor',
        'backend.massugc_video_job',
        'backend.font_manager',  # Add font manager for cross-platform font support
        'numpy.core._methods',
        'numpy.lib.format',
        'pkg_resources.extern',
        'pkg_resources._vendor',
        'mutagen',
        # PIL imports for text overlay functionality
        'PIL',
        'PIL.Image',
        'PIL.ImageDraw',
        'PIL.ImageFont',
        # Torch-related imports for whisper
        'torch',
        'torch._C',
        'torch._C._onnx',
        'torch.nn',
        'torch.nn.functional',
        'torchvision',
        'torchaudio',
    ],
    hookspath=['runtime_hooks'],  # Add runtime hooks directory
    hooksconfig={
        "gi": {
            "icons": [],
            "themes": [],
            "langs": []
        },
        "torch": {
            "exclude_modules": [
                "torch.testing._internal.opinfo",
                "torch.testing._internal",
                "torch.distributed._sharding_spec",
                "torch.distributed._sharded_tensor",
                "torch.distributed._shard.checkpoint",
                "expecttest"
            ]
        }
    },
    runtime_hooks=['runtime_hooks/set_utf8_encoding.py'],  # Force UTF-8 encoding to prevent emoji crashes
    excludes=[
        'tkinter',
        'matplotlib',
        # Only exclude the specific modules that cause warnings but don't break functionality
        'torch.testing._internal.opinfo',
        'expecttest',
    ],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

# Create directory distribution instead of single file
exe = EXE(
    pyz,
    a.scripts,
    [],  # Don't include binaries and datas here for directory mode
    exclude_binaries=True,  # This creates directory mode
    name='ZyraVideoAgentBackend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

# Directory distribution
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='ZyraVideoAgentBackend'
) 