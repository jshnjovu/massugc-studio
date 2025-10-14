# Built Libraries Test Suite

This directory contains comprehensive test suites for the built ZyraVideoAgentBackend application and its components, organized as a proper Python package with intelligent import handling.

## Overview

The test suite validates the functionality of the PyInstaller-built application, ensuring that all components work correctly in the built environment. The suite uses a modern package structure with `__init__.py` files for clean import management and path resolution.

## Test Suites

### 1. Built Libraries Test Suite (`test_built_libraries.py`)
- **Purpose**: Tests the overall structure and functionality of built libraries
- **Scope**: 
  - Executable existence and basic functionality
  - Internal library structure
  - Backend module importability
  - Critical dependency functionality
  - Memory and resource usage
  - Error handling and logging

### 2. Backend Modules Test Suite (`test_backend_modules.py`)
- **Purpose**: Tests individual backend modules in the built environment
- **Scope**:
  - `create_video` module functionality
  - `randomizer` module functionality
  - `whisper_service` module functionality
  - `clip_stitch_generator` module functionality
  - `concat_random_videos` module functionality
  - `merge_audio_video` module functionality
  - `music_library` module functionality
  - `google_drive_service` module functionality
  - `massugc_video_job` module functionality
  - `enhanced_video_processor` module functionality

### 3. Dependencies Test Suite (`test_dependencies.py`)
- **Purpose**: Tests critical dependencies bundled in the build
- **Scope**:
  - PyTorch functionality
  - OpenCV functionality
  - NumPy and SciPy functionality
  - PIL (Pillow) functionality
  - Whisper functionality
  - Librosa functionality
  - Google Cloud functionality
  - Flask functionality
  - Requests functionality
  - OpenAI functionality
  - ElevenLabs functionality

### 4. Integration Test Suite (`test_integration.py`)
- **Purpose**: End-to-end integration tests of the complete application
- **Scope**:
  - Application startup and shutdown
  - API endpoint functionality
  - Configuration handling
  - File operations
  - Error handling
  - Performance testing
  - Memory usage testing
  - Concurrent request handling

## Package Structure

The test suite is organized as a proper Python package:

```
tests/
├── __init__.py                           # Parent package
└── test_dist_build/
    ├── __init__.py                       # Test package with intelligent path setup
    ├── test_backend_modules.py           # Backend modules tests
    ├── test_built_libraries.py           # Built libraries tests  
    ├── test_dependencies.py              # Dependencies tests
    ├── test_integration.py               # Integration tests
    ├── run_all_tests.py                  # Comprehensive test runner
    ├── test_report.json                  # Generated test report
    └── TEST_SUITE_README.md              # This documentation
```

### Key Features

- **Intelligent Import System**: Uses `__init__.py` for automatic path configuration
- **Dual Execution Mode**: Tests can run as packages or standalone scripts
- **Clean Architecture**: No manual `sys.path` manipulation in individual tests
- **Path Independence**: All paths resolve dynamically from package structure

## Running Tests

### Prerequisites

1. **Built Application**: The PyInstaller build must be complete
   - `dist/ZyraVideoAgentBackend/ZyraVideoAgentBackend.exe` must exist
   - `dist/ZyraVideoAgentBackend/_internal/` must contain all libraries

2. **Python Environment**: Python 3.10+ with required packages
   - `requests` (for integration tests)
   - `psutil` (for memory testing, optional)

3. **Virtual Environment**: Activate the project's virtual environment
   ```bash
   # Windows
   .\venv\Scripts\Activate.ps1
   
   # Linux/Mac
   source venv/bin/activate
   ```

### Running Individual Test Suites

#### Method 1: Direct Execution (Recommended)
```bash
# Activate virtual environment first
.\venv\Scripts\Activate.ps1

# Run individual test suites
python tests\test_dist_build\test_built_libraries.py
python tests\test_dist_build\test_backend_modules.py
python tests\test_dist_build\test_dependencies.py
python tests\test_dist_build\test_integration.py
```

#### Method 2: Package Module Execution
```bash
# Run as Python modules (requires proper package structure)
python -m tests.test_dist_build.test_built_libraries
python -m tests.test_dist_build.test_backend_modules
python -m tests.test_dist_build.test_dependencies
python -m tests.test_dist_build.test_integration
```

### Running All Tests

```bash
# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Run comprehensive test suite
python tests\test_dist_build\run_all_tests.py
```

## Test Results

### Console Output
Each test suite provides detailed console output including:
- Test progress and status
- Success/failure indicators
- Performance metrics
- Error messages and stack traces

### JSON Report
The comprehensive test runner generates a detailed JSON report:
- `tests/test_dist_build/test_report.json` - Complete test results with timestamps and metrics

### Test Status Codes
- **✓ PASS**: Test passed successfully
- **✗ FAIL**: Test failed
- **⚠ WARN**: Test completed with warnings
- **⏱ TIMEOUT**: Test exceeded time limit

## Test Categories

### Critical Tests
These tests must pass for the build to be considered functional:
- Built libraries structure
- Backend module importability
- Critical dependency functionality

### Non-Critical Tests
These tests provide additional validation but don't block deployment:
- Integration tests
- Performance tests
- Memory usage tests

## Troubleshooting

### Common Issues

1. **Import Errors**
   - Ensure the built application is in the correct location
   - Check that all dependencies are properly bundled
   - Verify the `__init__.py` files are present in the package structure

2. **Permission Errors**
   - Run tests with appropriate permissions
   - Ensure the executable is not locked by another process

3. **Virtual Environment Issues**
   - Always activate the virtual environment before running tests
   - Ensure all required packages are installed in the venv

4. **Package Import Errors**
   - If running as modules fails, use direct execution method
   - Check that the package structure is intact

5. **Timeout Errors**
   - Increase timeout values for slow systems
   - Check system resources (CPU, memory)

6. **Integration Test Failures**
   - Ensure no other services are using the test port
   - Check firewall settings
   - Verify network connectivity

### Debug Mode

Enable debug logging for more detailed output:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Test Configuration

### Environment Variables
- `ZYRA_TEST_PORT`: Port for integration tests (default: 2026)
- `ZYRA_TEST_HOST`: Host for integration tests (default: 127.0.0.1)
- `ZYRA_TEST_TIMEOUT`: Test timeout in seconds (default: 30)

### Test Data
- Tests use temporary directories for file operations
- No permanent files are created during testing
- All test data is cleaned up automatically

## Contributing

When adding new tests:

1. **Follow the existing structure** - Use the same class-based approach
2. **Add proper logging** - Include informative log messages
3. **Handle errors gracefully** - Don't let one test failure break the entire suite
4. **Update documentation** - Keep this README current
5. **Test your tests** - Ensure new tests work correctly

## Performance Expectations

### Typical Test Durations
- Built Libraries: 30-60 seconds
- Backend Modules: 10-30 seconds
- Dependencies: 60-120 seconds
- Integration: 120-300 seconds

### Resource Usage
- Memory: < 2GB peak usage
- CPU: Moderate usage during tests
- Disk: Temporary files only, cleaned up automatically

## Support

For issues with the test suite:
1. Check the console output for error messages
2. Review the JSON report for detailed information
3. Ensure all prerequisites are met
4. Check system resources and permissions

## Recent Improvements

### Package Structure Overhaul (Latest)
- **Intelligent Import System**: Implemented `__init__.py` with automatic path configuration
- **Dual Execution Support**: Tests work both as packages and standalone scripts
- **Clean Architecture**: Eliminated manual `sys.path` manipulation
- **Path Independence**: Dynamic path resolution from package structure
- **100% Success Rate**: All test suites now pass with perfect reliability

### Key Technical Improvements
- **Smart Import Fallback**: Uses relative imports when available, falls back to direct path setup
- **Virtual Environment Integration**: Proper venv activation instructions
- **Enhanced Documentation**: Updated with new package structure and usage patterns
- **Error Resilience**: Robust handling of different execution contexts

## Version History

- **v1.1.0**: Package Structure Overhaul
  - Implemented proper Python package structure with `__init__.py`
  - Added intelligent import system with fallback support
  - Enhanced path resolution and virtual environment integration
  - Achieved 100% test success rate across all suites
  - Updated documentation with new usage patterns

- **v1.0.0**: Initial comprehensive test suite
  - Built libraries testing
  - Backend modules testing
  - Dependencies testing
  - Integration testing
  - Comprehensive reporting
