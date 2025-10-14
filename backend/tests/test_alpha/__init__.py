"""
Test Alpha Package - Comprehensive Test Suite for MassUGC Video Service

This package contains all the alpha tests for the MassUGC video service,
organized according to the testing priority order documented in test_alpha_notes.md.

The tests are organized in the following priority order:
1. Foundation Tests (test_device_fingerprint, test_gcs_auth)
2. API Integration Tests (test_with_new_key, test_massugc_integration)
3. Operational Tests (test_usage_logging, test_failed_job_tracking)
4. Enhancement Tests (test_rate_limit_fix, test_enhanced_error_messages, test_real_validation)
"""

import sys
import os
from pathlib import Path

# Add the project root directory to Python path for imports
# This allows tests to import from massugc_api_client, app, and backend modules
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# Ensure backend directory is also in path
backend_path = project_root / "backend"
sys.path.insert(0, str(backend_path))

# Import commonly used modules to make them available to all tests
try:
    # Core API client imports
    from massugc_api_client import (
        create_massugc_client,
        MassUGCApiError,
        MassUGCApiClient,
        DeviceFingerprintGenerator,
        MassUGCApiKeyManager
    )
    
    # Backend imports
    from backend.massugc_video_job import validate_massugc_settings
    
    # App imports
    from app import create_detailed_error_message
    
    # Make these available to test modules
    __all__ = [
        'create_massugc_client',
        'MassUGCApiError', 
        'MassUGCApiClient',
        'DeviceFingerprintGenerator',
        'MassUGCApiKeyManager',
        'validate_massugc_settings',
        'create_detailed_error_message'
    ]
    
except ImportError as e:
    # If imports fail, print a warning but don't crash
    print(f"Warning: Some imports failed in test_alpha/__init__.py: {e}")
    print("Tests may need to handle imports individually.")
    __all__ = []
