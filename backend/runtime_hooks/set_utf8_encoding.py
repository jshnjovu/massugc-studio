"""
PyInstaller Runtime Hook: Force UTF-8 Encoding
================================================
This hook forces UTF-8 encoding for stdout/stderr to prevent
'charmap' codec errors when printing Unicode characters (emojis)
in PyInstaller-compiled Windows executables.

CRITICAL: This must run BEFORE any application code that prints emojis.
"""

import sys
import os
import io

def force_utf8_encoding():
    """
    Force UTF-8 encoding for all standard streams.
    This prevents crashes when printing emojis in Windows console.
    """
    try:
        # Set UTF-8 as the default encoding for the Python environment
        if sys.platform == 'win32':
            # For Windows, we need to handle console encoding specially
            import codecs
            
            # Wrap stdout and stderr with UTF-8 encoding
            # Use 'replace' error handling to avoid crashes on unsupported characters
            sys.stdout = io.TextIOWrapper(
                sys.stdout.buffer,
                encoding='utf-8',
                errors='replace',
                line_buffering=True
            )
            
            sys.stderr = io.TextIOWrapper(
                sys.stderr.buffer,
                encoding='utf-8',
                errors='replace',
                line_buffering=True
            )
            
            # Set environment variable for child processes
            os.environ['PYTHONIOENCODING'] = 'utf-8'
            
            # Attempt to set Windows console to UTF-8 mode
            try:
                # This enables UTF-8 mode in Windows 10+ consoles
                import ctypes
                kernel32 = ctypes.windll.kernel32
                kernel32.SetConsoleCP(65001)  # 65001 is UTF-8 code page
                kernel32.SetConsoleOutputCP(65001)
            except Exception:
                # If setting console code page fails, the TextIOWrapper
                # with 'replace' error handling will still prevent crashes
                pass
    
    except Exception as e:
        # If encoding setup fails, at least try to print a warning
        # (though it might fail too if encoding is broken)
        try:
            print(f"Warning: Failed to set UTF-8 encoding: {e}", file=sys.stderr)
        except:
            pass

# Execute immediately when this hook is loaded
force_utf8_encoding()

