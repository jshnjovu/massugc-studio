"""
Test Suite for Built Distribution
=================================

This package contains comprehensive test suites for the built ZyraVideoAgentBackend
application and its components. The tests validate functionality in the PyInstaller
built environment.

Test Modules:
- test_built_libraries: Tests overall structure and functionality of built libraries
- test_backend_modules: Tests individual backend modules in the built environment  
- test_dependencies: Tests critical dependencies bundled in the build
- test_integration: End-to-end integration tests of the complete application
- run_all_tests: Comprehensive test runner for all test suites

Author: MassUGC Development Team
Version: 1.0.0
"""

import sys
import os
from pathlib import Path

# Add project root to Python path for imports
PROJECT_ROOT = Path(__file__).parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Add built application internal directory to path
DIST_DIR = PROJECT_ROOT / "dist"
INTERNAL_DIR = DIST_DIR / "ZyraVideoAgentBackend" / "_internal"
if INTERNAL_DIR.exists() and str(INTERNAL_DIR) not in sys.path:
    sys.path.insert(0, str(INTERNAL_DIR))

__version__ = "1.0.0"
__author__ = "MassUGC Development Team"

# Export commonly used paths
__all__ = [
    'PROJECT_ROOT',
    'DIST_DIR', 
    'INTERNAL_DIR',
    '__version__',
    '__author__'
]
