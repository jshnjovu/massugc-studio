# Alpha Test Suite - MassUGC Video Service

This directory contains the comprehensive Alpha test suite for the MassUGC Video Service, organized as a proper Python package with intelligent import handling and prioritized testing order.

## Overview

The Alpha test suite validates the complete functionality of the MassUGC Video Service, from core device identification to advanced error handling. The suite follows a strategic testing order based on dependency hierarchy and criticality, ensuring that fundamental components are validated before complex integrations.

## Test Suites by Priority

The tests are organized in a specific order of importance, where each tier builds upon the previous one:

### 1. CRITICAL FOUNDATION TESTS (Must Pass First)

#### 1.1 Device Fingerprint Test Suite (`test_device_fingerprint.py`) - **HIGHEST PRIORITY**
- **Purpose**: Tests core device identification and API client initialization
- **Why First**: All other tests depend on proper client initialization
- **Scope**:
  - Device fingerprint generation and validation
  - API client setup and configuration
  - Header creation and formatting
  - Machine ID collection and hashing
  - Platform detection and versioning
- **Assets Needed**: None (self-contained)
- **Expected Duration**: 5-10 seconds

#### 1.2 Google Cloud Storage Authentication Test Suite (`test_gcs_auth.py`) - **SECOND PRIORITY**
- **Purpose**: Validates Google Cloud Storage authentication and permissions
- **Why Early**: Video upload failures are common and hard to debug
- **Scope**:
  - Environment variable validation
  - Credentials file verification
  - Bucket access testing
  - Upload/download functionality
  - Permission validation
- **Assets Needed**: 
  - `.env` file with `GCS_BUCKET_NAME` and `GOOGLE_APPLICATION_CREDENTIALS`
  - Valid GCS service account JSON file
  - Accessible GCS bucket
- **Expected Duration**: 15-30 seconds

### 2. API INTEGRATION TESTS (Core Functionality)

#### 2.1 API Key Validation Test Suite (`test_with_new_key.py`) - **THIRD PRIORITY**
- **Purpose**: Tests API key validation and basic connectivity
- **Why Important**: Validates that API keys work before complex operations
- **Scope**:
  - API authentication validation
  - Connection testing
  - Usage logging functionality
  - Response handling
  - Error detection
- **Assets Needed**: Valid MassUGC API key
- **Expected Duration**: 10-15 seconds

#### 2.2 MassUGC Integration Test Suite (`test_massugc_integration.py`) - **FOURTH PRIORITY**
- **Purpose**: Comprehensive integration testing of all MassUGC components
- **Scope**:
  - Device fingerprinting integration
  - API key validation workflows
  - Settings validation
  - Client initialization
  - End-to-end connectivity
- **Assets Needed**: 
  - Valid MassUGC API key
  - Sample avatar image/video files
  - Configuration directory
- **Expected Duration**: 20-30 seconds

### 3. OPERATIONAL TESTS (Business Logic)

#### 3.1 Usage Logging Test Suite (`test_usage_logging.py`) - **FIFTH PRIORITY**
- **Purpose**: Tests usage data logging after job completion
- **Why Important**: Critical for billing and analytics
- **Scope**:
  - Usage data payload structure
  - API logging functionality
  - Error handling
  - Data validation
  - Response processing
- **Assets Needed**: 
  - Valid API key stored in `~/.zyra-video-agent/` config
  - Working MassUGC client
- **Expected Duration**: 10-20 seconds

#### 3.2 Failed Job Tracking Test Suite (`test_failed_job_tracking.py`) - **SIXTH PRIORITY**
- **Purpose**: Tests comprehensive job failure tracking and reporting
- **Scope**:
  - Failed job payload structure
  - Successful job payloads
  - Error handling mechanisms
  - API key management
  - Retry logic
- **Assets Needed**: 
  - Valid API keys
  - Temporary config directories for testing
- **Expected Duration**: 15-25 seconds

### 4. ENHANCEMENT TESTS (Advanced Features)

#### 4.1 Rate Limiting Test Suite (`test_rate_limit_fix.py`) - **SEVENTH PRIORITY**
- **Purpose**: Tests rate limiting detection and handling
- **Scope**:
  - Rate limit header parsing
  - Warning threshold detection
  - Custom MassUGC headers
  - Response handling
  - Logging mechanisms
- **Assets Needed**: Valid API key for real API calls
- **Expected Duration**: 10-15 seconds

#### 4.2 Enhanced Error Messages Test Suite (`test_enhanced_error_messages.py`) - **EIGHTH PRIORITY**
- **Purpose**: Tests detailed error message generation for customer support
- **Scope**:
  - Error categorization
  - Diagnostic information generation
  - Solution suggestions
  - Error formatting
  - Support data collection
- **Assets Needed**: Sample job configurations
- **Expected Duration**: 5-10 seconds

#### 4.3 Real-Time Validation Test Suite (`test_real_validation.py`) - **NINTH PRIORITY**
- **Purpose**: Tests real-time API validation and enhanced debugging
- **Scope**:
  - Live API key validation
  - Voice ID checking
  - Credit status verification
  - System diagnostics
  - Real-time error detection
- **Assets Needed**: 
  - Valid ElevenLabs API key
  - Valid OpenAI API key
  - Sample job configurations
- **Expected Duration**: 20-30 seconds

## Package Structure

The test suite is organized as a proper Python package:

```
tests/
├── __init__.py                           # Parent package
└── test_alpha/
    ├── __init__.py                       # Test package with intelligent path setup
    ├── test_device_fingerprint.py        # Foundation: Device identification
    ├── test_gcs_auth.py                  # Foundation: Cloud storage auth
    ├── test_with_new_key.py              # Integration: API key validation
    ├── test_massugc_integration.py       # Integration: Full MassUGC testing
    ├── test_usage_logging.py             # Operational: Usage tracking
    ├── test_failed_job_tracking.py       # Operational: Failure handling
    ├── test_rate_limit_fix.py            # Enhancement: Rate limiting
    ├── test_enhanced_error_messages.py   # Enhancement: Error handling
    ├── test_real_validation.py           # Enhancement: Real-time validation
    ├── test_alpha_notes.md               # Original analysis documentation
    └── README.md                         # This documentation
```

### Key Features

- **Intelligent Import System**: Uses `__init__.py` for automatic path configuration
- **Priority-Based Testing**: Tests ordered by dependency and criticality
- **Clean Architecture**: No manual `sys.path` manipulation in individual tests
- **Path Independence**: All paths resolve dynamically from package structure
- **Comprehensive Coverage**: From basic functionality to advanced features

## Running Tests

### Prerequisites

1. **Virtual Environment**: Activate the project's virtual environment
   ```powershell
   # Windows PowerShell
   .\venv\Scripts\Activate.ps1
   
   # Command Prompt
   .\venv\Scripts\activate.bat
   ```

2. **Environment Configuration**: Ensure required environment variables and files
   - `.env` file with API keys and GCS configuration
   - `massugc-cd0de8ebffb2.json` (GCS service account credentials)
   - Valid MassUGC API key
   - Network connectivity to external APIs

3. **System Requirements**:
   - Python 3.10+
   - All packages from `requirements.txt`
   - UTF-8 encoding support for emoji output

### Running Individual Test Suites

#### Method 1: Direct Execution (Recommended)
```powershell
# Activate virtual environment first
.\venv\Scripts\Activate.ps1

# Set UTF-8 encoding for emoji support
$env:PYTHONIOENCODING="utf-8"

# Run tests in priority order
python tests\test_alpha\test_device_fingerprint.py      # Priority 1
python tests\test_alpha\test_gcs_auth.py                # Priority 2
python tests\test_alpha\test_with_new_key.py            # Priority 3
python tests\test_alpha\test_massugc_integration.py     # Priority 4
python tests\test_alpha\test_usage_logging.py           # Priority 5
python tests\test_alpha\test_failed_job_tracking.py     # Priority 6
python tests\test_alpha\test_rate_limit_fix.py          # Priority 7
python tests\test_alpha\test_enhanced_error_messages.py # Priority 8
python tests\test_alpha\test_real_validation.py         # Priority 9
```

#### Method 2: Package Module Execution
```powershell
# Run as Python modules (requires proper package structure)
python -m tests.test_alpha.test_device_fingerprint
python -m tests.test_alpha.test_gcs_auth
python -m tests.test_alpha.test_with_new_key
# ... and so on
```

### Running Tests by Category

#### Foundation Tests Only
```powershell
python tests\test_alpha\test_device_fingerprint.py
python tests\test_alpha\test_gcs_auth.py
```

#### API Integration Tests Only
```powershell
python tests\test_alpha\test_with_new_key.py
python tests\test_alpha\test_massugc_integration.py
```

#### Operational Tests Only
```powershell
python tests\test_alpha\test_usage_logging.py
python tests\test_alpha\test_failed_job_tracking.py
```

#### Enhancement Tests Only
```powershell
python tests\test_alpha\test_rate_limit_fix.py
python tests\test_alpha\test_enhanced_error_messages.py
python tests\test_alpha\test_real_validation.py
```

## Required Assets & Configuration

### Environment Configuration
```
📁 Root Directory/
├── .env (GCS_BUCKET_NAME, GOOGLE_APPLICATION_CREDENTIALS, API keys)
├── massugc-cd0de8ebffb2.json (GCS service account credentials)
└── requirements.txt (all dependencies)
```

### Configuration Directory
```
📁 ~/.zyra-video-agent/
└── api_key.txt (MassUGC API key storage)
```

### Sample Assets (Optional)
```
📁 assets/
└── sample_music_library.yaml (music configuration)
```

### Test Assets (Create if missing)
```
📁 test_assets/ (recommended to create)
├── sample_avatar.mp4 (for avatar testing)
├── sample_script.txt (for script testing)
└── sample_product_clip.mov (for product testing)
```

## Critical Dependencies

### API Keys Required
- **MassUGC API key** (format: `massugc_xxxxx`)
- **ElevenLabs API key** (for voice validation tests)
- **OpenAI API key** (for AI integration tests)
- **Google Cloud service account JSON** (for GCS tests)

### System Requirements
- Python 3.10+
- All packages from `requirements.txt`
- FFmpeg (for video processing)
- Network connectivity to all APIs

### Permissions
- GCS bucket read/write access
- File system write permissions for config directories
- Network access to external APIs

## Test Results & Status Codes

### Console Output
Each test suite provides detailed console output including:
- 🔍 Test progress indicators
- ✅ Success confirmations
- ❌ Failure notifications
- ⚠️ Warning messages
- 📊 Performance metrics
- 🎉 Completion celebrations

### Status Indicators
- **✅ SUCCESS**: Test passed successfully
- **❌ FAILED**: Test failed with errors
- **⚠️ WARNING**: Test completed with warnings
- **🔄 RUNNING**: Test in progress
- **⏱️ TIMEOUT**: Test exceeded time limit

## Testing Strategy

### Recommended Testing Order

1. **Start with Foundation Tests** (1-2) - If these fail, nothing else will work
   - Device fingerprinting must work for API authentication
   - GCS authentication must work for video uploads

2. **Move to API Integration** (3-4) - Validates external service connectivity
   - API key validation ensures service access
   - Full integration confirms end-to-end functionality

3. **Test Operational Features** (5-6) - Ensures business logic works
   - Usage logging is critical for billing
   - Failure tracking ensures reliability

4. **Validate Enhancements** (7-9) - Confirms advanced features
   - Rate limiting prevents service abuse
   - Enhanced errors improve user experience
   - Real-time validation provides accurate diagnostics

### Failure Handling Strategy

- **Foundation Test Failures**: Stop immediately and fix core issues
- **Integration Test Failures**: Check API keys and network connectivity
- **Operational Test Failures**: Review business logic and data handling
- **Enhancement Test Failures**: May proceed with core functionality

## Troubleshooting

### Common Issues

1. **Unicode/Emoji Errors**
   ```powershell
   # Set UTF-8 encoding before running tests
   $env:PYTHONIOENCODING="utf-8"
   ```

2. **Import Errors**
   - Ensure virtual environment is activated
   - Check that all dependencies are installed
   - Verify the `__init__.py` files are present

3. **API Key Errors**
   - Verify API keys are valid and not revoked
   - Check API key format (massugc_xxxxx)
   - Ensure network connectivity to APIs

4. **GCS Authentication Errors**
   - Verify `.env` file configuration
   - Check service account JSON file exists
   - Ensure bucket permissions are correct

5. **Permission Errors**
   - Run with appropriate file system permissions
   - Check config directory write access
   - Verify network firewall settings

### Debug Mode

Enable detailed logging for troubleshooting:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Performance Expectations

### Typical Test Durations
- **Foundation Tests**: 20-40 seconds total
- **Integration Tests**: 30-45 seconds total
- **Operational Tests**: 25-45 seconds total
- **Enhancement Tests**: 35-55 seconds total
- **Complete Suite**: 110-185 seconds total

### Resource Usage
- **Memory**: < 1GB peak usage
- **CPU**: Moderate usage during API calls
- **Network**: Multiple API requests per test
- **Disk**: Minimal temporary file usage

## Contributing

When adding new tests to the Alpha suite:

1. **Follow Priority Order**: Place tests in appropriate priority tier
2. **Use Consistent Structure**: Follow existing test patterns
3. **Add Proper Documentation**: Update this README with new tests
4. **Handle Dependencies**: Ensure proper import structure
5. **Test Your Tests**: Verify new tests work in isolation and with suite

## Support

For issues with the Alpha test suite:
1. Check console output for specific error messages
2. Verify all prerequisites are met
3. Test individual components in isolation
4. Check API key validity and network connectivity
5. Review environment configuration

## Recent Improvements

### Package Structure Migration (Latest)
- **Organized Test Structure**: Moved all tests from root to dedicated `test_alpha/` directory
- **Intelligent Import System**: Implemented `__init__.py` with automatic path configuration
- **Priority-Based Organization**: Tests ordered by dependency and criticality
- **Clean Architecture**: Eliminated manual `sys.path` manipulation
- **Path Independence**: Dynamic path resolution from package structure
- **Enhanced Documentation**: Comprehensive README with testing strategies

### Key Technical Improvements
- **Smart Import Handling**: Proper relative imports with project root resolution
- **Virtual Environment Integration**: Clear activation and usage instructions
- **UTF-8 Encoding Support**: Proper handling of emoji characters in output
- **Error Resilience**: Robust handling of different execution contexts
- **Comprehensive Coverage**: From device fingerprinting to advanced error handling

## Version History

- **v2.0.0**: Alpha Test Suite Package Migration
  - Migrated all tests from root directory to organized `test_alpha/` package
  - Implemented proper Python package structure with intelligent imports
  - Added priority-based testing order with comprehensive documentation
  - Enhanced path resolution and virtual environment integration
  - Created detailed README with testing strategies and troubleshooting
  - Achieved clean separation of concerns and improved maintainability

- **v1.0.0**: Individual test files in root directory
  - Basic test functionality
  - Manual import handling
  - Limited organization
  - Individual execution only
