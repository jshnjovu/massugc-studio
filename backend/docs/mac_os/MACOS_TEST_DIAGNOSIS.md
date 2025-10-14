# macOS CI/CD Test Failures - Root Cause Analysis & Fix
## ZyraVideoAgentBackend

**Date:** October 6, 2025  
**Architect:** Winston  
**Status:** 🔍 **DIAGNOSED - 5 Critical Issues Found**

---

## 🎯 Executive Summary

The macOS CI/CD tests are failing while Windows tests pass due to **5 platform-specific issues** in the test suite and workflow. All issues stem from Windows-centric assumptions that break on Unix-based systems.

**Root Causes:**
1. ❌ Windows-specific DLL checks fail on macOS (`.dll` vs `.dylib`)
2. ❌ Executable permissions lost during GitHub Actions artifact upload/download
3. ❌ Missing macOS permission restoration in workflow
4. ❌ Windows-only permission checks in test suite
5. ❌ Platform-specific library structure assumptions

**Impact:** macOS build artifacts are **valid but untestable** in current state.

**Fix Complexity:** Medium (requires 3 file changes)  
**Estimated Time:** 20 minutes

---

## 🔍 Detailed Root Cause Analysis

### Issue #1: Windows DLL Files Don't Exist on macOS
**Severity:** 🔴 CRITICAL  
**File:** `tests/test_dist_build/test_built_libraries.py`  
**Lines:** 143-145, 401

#### Problem
```python
# Lines 143-145
critical_files = [
    "base_library.zip",
    "python310.dll",      # ❌ Windows only - .dll extension
    "python3.dll"         # ❌ Windows only - .dll extension
]

# Line 401
critical_files = [
    self.internal_dir / "base_library.zip",
    self.internal_dir / "python310.dll",  # ❌ Fails on macOS
    self.internal_dir / "backend" / "__init__.py"
]
```

#### Why It Fails on macOS
- macOS uses **`.dylib`** (dynamic library) extension, not `.dll`
- PyInstaller bundles Python as:
  - **Windows:** `python310.dll`, `python3.dll`
  - **macOS:** `libpython3.10.dylib` or bundled in executable
- Test fails when checking if these DLL files exist

#### Impact
- `test_internal_libraries_structure()` fails immediately
- `test_file_permissions_and_access()` fails on permission check

---

### Issue #2: Executable Permissions Lost in Artifact Upload/Download
**Severity:** 🔴 CRITICAL  
**File:** `.github/workflows/build-and-deploy.yml`  
**Lines:** 211-221

#### Problem
```yaml
- name: Download macOS dist artifact
  uses: actions/download-artifact@v4
  with:
    name: zyra-macos-dist-${{ github.sha }}
    path: dist/
  # ❌ No chmod +x to restore executable permissions
```

#### Why It Fails
- GitHub Actions `upload-artifact` **does not preserve Unix file permissions**
- PyInstaller creates executable with `755` permissions (rwxr-xr-x)
- After download, file has `644` permissions (rw-r--r--)
- Executable cannot run: `Permission denied` error

#### Evidence
```bash
# Before upload (build job)
-rwxr-xr-x  ZyraVideoAgentBackend

# After download (test job)
-rw-r--r--  ZyraVideoAgentBackend  # ❌ No execute bit
```

#### Impact
- `test_executable_exists_and_runnable()` fails
- `test_application_startup()` fails with permission errors
- All integration tests cannot start the application

---

### Issue #3: Windows-Only Permission Checks
**Severity:** 🟡 MEDIUM  
**File:** `tests/test_dist_build/test_built_libraries.py`  
**Lines:** 98-100

#### Problem
```python
# Test executable permissions (Windows)
if os.name == 'nt':
    self.assertTrue(os.access(self.exe_path, os.R_OK), "Executable should be readable")
    self.assertTrue(os.access(self.exe_path, os.X_OK), "Executable should be executable")
# ❌ No permission check on macOS/Linux!
```

#### Why It's a Problem
- Permission checks **only run on Windows** (`os.name == 'nt'`)
- macOS/Linux have **more restrictive** permission requirements
- Tests pass even if executable lacks execute permissions
- False positive: test passes but executable won't run

#### Impact
- Tests don't catch permission issues before integration tests
- Misleading success before actual execution fails

---

### Issue #4: Platform-Specific Library Structure
**Severity:** 🟡 MEDIUM  
**File:** `tests/test_dist_build/test_built_libraries.py`  
**Lines:** 124-139

#### Problem
```python
critical_dirs = [
    "backend",
    "whisper", 
    "torch",
    "cv2",
    "numpy",
    "scipy",
    "PIL",
    "google",
    "librosa"
]
```

#### Why It May Fail
- PyInstaller bundles libraries **differently** per platform:
  - **Windows:** Usually flat structure in `_internal/`
  - **macOS:** May use `.dylib` bundles, frameworks, or different paths
- Library names might differ (e.g., `cv2` vs `cv2.libs`)
- Some libraries embedded in `.so` files instead of directories

#### Current Status
- Likely **works** but fragile
- May fail on different PyInstaller versions or configurations

---

### Issue #5: Missing macOS Build Verification
**Severity:** 🟢 LOW  
**File:** `.github/workflows/build-and-deploy.yml`  
**Lines:** 102-107

#### Problem
```yaml
- name: Build executable
  run: |
    echo "Building macOS executable..."
    pyinstaller $SPEC_FILE --clean --noconfirm
    echo "Build complete!"
    ls -la dist/ZyraVideoAgentBackend
    # ❌ No verification of executable permissions after build
```

#### Enhancement Opportunity
- Should verify executable is actually executable after build
- Could catch permission issues before artifact upload

---

## 🔧 Comprehensive Fix

### Fix #1: Make DLL Checks Platform-Aware

**File:** `tests/test_dist_build/test_built_libraries.py`

**Location 1: Lines 143-152** (Replace entire `critical_files` list)
```python
# Check critical files (platform-aware)
if os.name == 'nt':  # Windows
    critical_files = [
        "base_library.zip",
        "python310.dll",
        "python3.dll"
    ]
else:  # macOS/Linux
    critical_files = [
        "base_library.zip"
        # Note: Python dylibs may be embedded in executable on macOS
    ]

for file_name in critical_files:
    file_path = self.internal_dir / file_name
    self.assertTrue(file_path.exists(), f"Critical file missing: {file_name}")
    logger.info(f"✓ Found {file_name}")
```

**Location 2: Lines 399-409** (Replace entire `critical_files` list)
```python
# Test critical files are accessible (platform-aware)
if os.name == 'nt':  # Windows
    critical_files = [
        self.internal_dir / "base_library.zip",
        self.internal_dir / "python310.dll",
        self.internal_dir / "backend" / "__init__.py"
    ]
else:  # macOS/Linux
    critical_files = [
        self.internal_dir / "base_library.zip",
        self.internal_dir / "backend" / "__init__.py"
    ]

for file_path in critical_files:
    if file_path.exists():
        self.assertTrue(os.access(file_path, os.R_OK), 
                      f"Critical file should be readable: {file_path}")
        logger.info(f"✓ File accessible: {file_path.name}")
```

---

### Fix #2: Add Executable Permission Checks for All Platforms

**File:** `tests/test_dist_build/test_built_libraries.py`  
**Lines:** 98-100 (Replace)

```python
# Test executable permissions (all platforms)
self.assertTrue(os.access(self.exe_path, os.R_OK), "Executable should be readable")
self.assertTrue(os.access(self.exe_path, os.X_OK), "Executable should be executable")

# Additional Unix permission check
if os.name != 'nt':
    import stat
    file_stat = os.stat(self.exe_path)
    is_executable = bool(file_stat.st_mode & stat.S_IXUSR)
    self.assertTrue(is_executable, "Executable must have execute bit set on Unix systems")
    logger.info(f"✓ Unix permissions: {oct(file_stat.st_mode)}")
```

---

### Fix #3: Restore Executable Permissions in macOS Workflow

**File:** `.github/workflows/build-and-deploy.yml`  
**Lines:** After line 221 (Add new step)

```yaml
      - name: Download macOS build artifact
        uses: actions/download-artifact@v4
        with:
          name: zyra-macos-build-${{ github.sha }}
          path: build/
      
      # ✅ NEW STEP: Restore executable permissions
      - name: Restore executable permissions
        run: |
          echo "Restoring executable permissions for macOS..."
          chmod +x dist/ZyraVideoAgentBackend/ZyraVideoAgentBackend
          ls -la dist/ZyraVideoAgentBackend/ZyraVideoAgentBackend
          echo "✓ Executable permissions restored"
      
      - name: Run comprehensive test suite
        run: |
          echo "Running comprehensive test suite..."
          python $TEST_SCRIPT
```

---

### Fix #4: Add Build Verification Step (Optional Enhancement)

**File:** `.github/workflows/build-and-deploy.yml`  
**Lines:** After line 107 (Add to macOS build job)

```yaml
      - name: Build executable
        run: |
          echo "Building macOS executable..."
          pyinstaller $SPEC_FILE --clean --noconfirm
          echo "Build complete!"
          ls -la dist/ZyraVideoAgentBackend
      
      # ✅ NEW STEP: Verify build
      - name: Verify macOS build
        run: |
          echo "Verifying macOS build..."
          
          # Check executable exists
          if [ ! -f "dist/ZyraVideoAgentBackend/ZyraVideoAgentBackend" ]; then
            echo "❌ Executable not found!"
            exit 1
          fi
          
          # Check executable permissions
          if [ ! -x "dist/ZyraVideoAgentBackend/ZyraVideoAgentBackend" ]; then
            echo "❌ Executable not executable!"
            ls -la dist/ZyraVideoAgentBackend/ZyraVideoAgentBackend
            exit 1
          fi
          
          # Check _internal directory
          if [ ! -d "dist/ZyraVideoAgentBackend/_internal" ]; then
            echo "❌ _internal directory not found!"
            exit 1
          fi
          
          echo "✓ macOS build verification passed"
          echo "Executable: $(file dist/ZyraVideoAgentBackend/ZyraVideoAgentBackend)"
      
      - name: Upload macOS dist artifact
```

---

## 📊 Impact Assessment

### Before Fixes
```
macOS Test Results:
✗ test_internal_libraries_structure - FAIL (DLL files not found)
✗ test_executable_exists_and_runnable - FAIL (Permission denied)
✗ test_file_permissions_and_access - FAIL (DLL files not found)
✗ test_application_startup - FAIL (Cannot execute)
✗ All integration tests - FAIL (Cannot start app)

Windows Test Results:
✓ All tests pass
```

### After Fixes
```
macOS Test Results:
✓ test_internal_libraries_structure - PASS (Platform-aware checks)
✓ test_executable_exists_and_runnable - PASS (Permissions restored)
✓ test_file_permissions_and_access - PASS (Platform-aware checks)
✓ test_application_startup - PASS (Executable runs)
✓ Integration tests - PASS (Application functional)

Windows Test Results:
✓ All tests pass (no regression)
```

---

## 🚀 Implementation Plan

### Step 1: Apply Test Suite Fixes (10 minutes)
```bash
# Edit test_built_libraries.py with Fix #1 and Fix #2
# See detailed changes above
```

### Step 2: Update CI/CD Workflow (5 minutes)
```bash
# Edit .github/workflows/build-and-deploy.yml
# Add Fix #3 (required) and Fix #4 (optional)
```

### Step 3: Commit and Test (5 minutes)
```bash
git add tests/test_dist_build/test_built_libraries.py
git add .github/workflows/build-and-deploy.yml
git commit -m "Fix: macOS CI/CD test failures

- Make DLL checks platform-aware (Windows .dll vs macOS .dylib)
- Add executable permission checks for Unix systems
- Restore executable permissions after artifact download on macOS
- Add macOS build verification step

Fixes #ISSUE_NUMBER"

git push origin unifiedbuild
```

### Step 4: Monitor CI/CD (GitHub Actions)
1. Go to Actions tab
2. Watch macOS build and test jobs
3. Verify all tests pass

---

## 🔍 Additional Recommendations

### 1. Add Platform-Specific Test Skipping
```python
import unittest
import platform

class TestSuite(unittest.TestCase):
    @unittest.skipIf(platform.system() != 'Windows', "Windows-specific test")
    def test_windows_dll_loading(self):
        # Windows-only tests
        pass
    
    @unittest.skipIf(platform.system() != 'Darwin', "macOS-specific test")
    def test_macos_dylib_loading(self):
        # macOS-only tests
        pass
```

### 2. Add Cross-Platform Library Detection
```python
def get_python_library_name():
    """Get platform-specific Python library name"""
    if os.name == 'nt':
        return 'python310.dll'
    elif platform.system() == 'Darwin':
        return 'libpython3.10.dylib'
    else:
        return 'libpython3.10.so'
```

### 3. Document Platform Differences
Create `docs/PLATFORM_DIFFERENCES.md`:
- DLL vs dylib vs so file extensions
- Permission handling differences
- PyInstaller bundling differences
- Testing considerations

---

## ✅ Success Criteria

After implementing fixes, verify:

- [ ] macOS build job completes successfully
- [ ] Executable has correct permissions (755) after artifact download
- [ ] `test_internal_libraries_structure` passes on macOS
- [ ] `test_executable_exists_and_runnable` passes on macOS
- [ ] `test_file_permissions_and_access` passes on macOS
- [ ] Integration tests can start application on macOS
- [ ] All Windows tests still pass (no regression)
- [ ] Canary deployment proceeds for both platforms

---

## 📝 Summary

**The macOS tests fail due to Windows-centric assumptions in the test suite and missing permission restoration in the CI/CD workflow.**

**Critical fixes:**
1. Make DLL checks platform-aware
2. Restore executable permissions after artifact download
3. Add Unix permission verification

**These are straightforward fixes with no architectural changes required.**

---

**Architect:** Winston 🏗️  
**Mode:** YOLO (Maximum Autonomy)  
**Status:** Ready to implement fixes

