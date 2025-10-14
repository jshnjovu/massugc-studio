#!/usr/bin/env python3
"""
Setup Verification Script
=========================
Verifies that the test environment is properly configured.
Run this before executing the test suite.
"""

import sys
import os
from pathlib import Path

def check_python_version():
    """Check Python version"""
    print("🐍 Checking Python version...")
    version = sys.version_info
    if version.major >= 3 and version.minor >= 8:
        print(f"   ✅ Python {version.major}.{version.minor}.{version.micro} (OK)")
        return True
    else:
        print(f"   ❌ Python {version.major}.{version.minor}.{version.micro} (Need 3.8+)")
        return False

def check_ffmpeg():
    """Check if FFmpeg is installed"""
    print("\n🎬 Checking FFmpeg...")
    try:
        import subprocess
        result = subprocess.run(['ffmpeg', '-version'], 
                              capture_output=True, 
                              text=True, 
                              timeout=5)
        if result.returncode == 0:
            version_line = result.stdout.split('\n')[0]
            print(f"   ✅ {version_line}")
            return True
        else:
            print("   ❌ FFmpeg not found")
            return False
    except FileNotFoundError:
        print("   ❌ FFmpeg not installed")
        print("   Install: https://ffmpeg.org/download.html")
        return False
    except Exception as e:
        print(f"   ⚠️  Could not check FFmpeg: {e}")
        return False

def check_dependencies():
    """Check if required packages are installed"""
    print("\n📦 Checking dependencies...")
    
    required = [
        ('flask', 'Flask'),
        ('flask_cors', 'Flask-CORS'),
        ('dotenv', 'python-dotenv'),
        ('yaml', 'PyYAML'),
    ]
    
    all_found = True
    for module_name, package_name in required:
        try:
            __import__(module_name)
            print(f"   ✅ {package_name}")
        except ImportError:
            print(f"   ❌ {package_name} (not installed)")
            all_found = False
    
    if not all_found:
        print("\n   Install missing packages:")
        print("   pip install -r requirements.txt")
    
    return all_found

def check_project_structure():
    """Check if project structure is correct"""
    print("\n📁 Checking project structure...")
    
    project_root = Path(__file__).parent.parent.parent
    
    required_paths = [
        ('app.py', 'Main application'),
        ('backend/create_video.py', 'Video creation module'),
        ('backend/enhanced_video_processor.py', 'Video processor'),
        ('requirements.txt', 'Dependencies file'),
    ]
    
    all_found = True
    for path, description in required_paths:
        full_path = project_root / path
        if full_path.exists():
            print(f"   ✅ {description} ({path})")
        else:
            print(f"   ❌ {description} ({path}) - NOT FOUND")
            all_found = False
    
    return all_found

def check_import_app():
    """Check if app can be imported"""
    print("\n🔌 Checking app import...")
    
    try:
        project_root = Path(__file__).parent.parent.parent
        sys.path.insert(0, str(project_root))
        
        import app
        print("   ✅ Flask app imported successfully")
        
        # Check if test client works
        client = app.app.test_client()
        print("   ✅ Test client created successfully")
        
        return True
    except ImportError as e:
        print(f"   ❌ Could not import app: {e}")
        return False
    except Exception as e:
        print(f"   ⚠️  App imported but issue detected: {e}")
        return True  # Non-critical

def check_test_files():
    """Check if test files exist"""
    print("\n📝 Checking test files...")
    
    test_dir = Path(__file__).parent
    
    test_files = [
        'test_text_overlay_integration.py',
        'test_backend_text_overlay.py',
        'run_all_tests.py',
        'README.md',
        'QUICKSTART.md'
    ]
    
    all_found = True
    for filename in test_files:
        filepath = test_dir / filename
        if filepath.exists():
            size = filepath.stat().st_size
            print(f"   ✅ {filename} ({size:,} bytes)")
        else:
            print(f"   ❌ {filename} - NOT FOUND")
            all_found = False
    
    return all_found

def main():
    """Run all verification checks"""
    print("=" * 70)
    print("TEXT OVERLAY TEST SUITE - SETUP VERIFICATION")
    print("=" * 70)
    
    checks = [
        ("Python Version", check_python_version),
        ("FFmpeg Installation", check_ffmpeg),
        ("Required Dependencies", check_dependencies),
        ("Project Structure", check_project_structure),
        ("Flask App Import", check_import_app),
        ("Test Files", check_test_files),
    ]
    
    results = {}
    for name, check_func in checks:
        try:
            results[name] = check_func()
        except Exception as e:
            print(f"\n   ❌ Check failed with error: {e}")
            results[name] = False
    
    # Summary
    print("\n" + "=" * 70)
    print("VERIFICATION SUMMARY")
    print("=" * 70)
    
    for name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {name:.<50} {status}")
    
    print("=" * 70)
    
    passed_count = sum(1 for p in results.values() if p)
    total_count = len(results)
    
    if passed_count == total_count:
        print("\n🎉 All checks passed! You're ready to run the tests.")
        print("\nRun tests with:")
        print("  python tests/test_textoverlay/run_all_tests.py")
        return 0
    else:
        print(f"\n⚠️  {total_count - passed_count} check(s) failed.")
        print("Please resolve the issues above before running tests.")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)

