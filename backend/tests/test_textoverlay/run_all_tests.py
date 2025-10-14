#!/usr/bin/env python3
"""
Test Runner for Text Overlay Integration Tests
===============================================
Runs all text overlay integration tests and provides a comprehensive report.
"""

import sys
import os
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# Import test modules
from test_text_overlay_integration import main as run_integration_tests
from test_backend_text_overlay import main as run_backend_tests
from test_helper_functions import main as run_helper_tests
from test_sample_video_generation import main as run_sample_video_tests


def print_header(title: str):
    """Print a formatted header"""
    separator = "=" * 70
    print(f"\n{separator}")
    print(f"{title:^70}")
    print(f"{separator}\n")


def main():
    """Run all test suites"""
    print_header("TEXT OVERLAY INTEGRATION TEST SUITE")
    print("Running comprehensive tests for text overlay functionality")
    print("Scope: current_bugs_workflow.md implementation")
    print("Approach: Real APIs, no mocking, actual implementation testing")
    print()
    
    # Track results
    results = {}
    
    # Run integration tests
    print_header("PHASE 1: API INTEGRATION TESTS")
    print("Testing Flask API endpoints and end-to-end flows\n")
    
    try:
        integration_exit_code = run_integration_tests()
        results['API Integration Tests'] = (integration_exit_code == 0)
    except Exception as e:
        print(f"\n❌ API Integration Tests crashed with error: {e}")
        import traceback
        traceback.print_exc()
        results['API Integration Tests'] = False
    
    # Run backend tests
    print_header("PHASE 2: BACKEND PROCESSING TESTS")
    print("Testing backend functions and video processing\n")
    
    try:
        backend_exit_code = run_backend_tests()
        results['Backend Processing Tests'] = (backend_exit_code == 0)
    except Exception as e:
        print(f"\n❌ Backend Processing Tests crashed with error: {e}")
        import traceback
        traceback.print_exc()
        results['Backend Processing Tests'] = False
    
    # Run helper function tests
    print_header("PHASE 3: HELPER FUNCTION TESTS")
    print("Testing utility and parsing functions\n")
    
    try:
        helper_exit_code = run_helper_tests()
        results['Helper Function Tests'] = (helper_exit_code == 0)
    except Exception as e:
        print(f"\n❌ Helper Function Tests crashed with error: {e}")
        import traceback
        traceback.print_exc()
        results['Helper Function Tests'] = False
    
    # Run sample video generation test
    print_header("PHASE 4: SAMPLE VIDEO GENERATION TEST")
    print("Testing complete video generation with extended captions and text overlays\n")
    
    try:
        sample_video_exit_code = run_sample_video_tests()
        results['Sample Video Generation Test'] = (sample_video_exit_code == 0)
    except Exception as e:
        print(f"\n❌ Sample Video Generation Test crashed with error: {e}")
        import traceback
        traceback.print_exc()
        results['Sample Video Generation Test'] = False
    
    # Print final summary
    print_header("FINAL TEST SUMMARY")
    
    total_suites = len(results)
    passed_suites = sum(1 for passed in results.values() if passed)
    failed_suites = total_suites - passed_suites
    
    print("Test Suite Results:")
    print()
    
    for suite_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"  {suite_name:.<50} {status}")
    
    print()
    print("=" * 70)
    print(f"TOTAL: {passed_suites}/{total_suites} test suites passed")
    print("=" * 70)
    
    if failed_suites == 0:
        print("\n🎉 SUCCESS! All test suites passed!")
        print("✅ Text overlay integration is working correctly")
        return 0
    else:
        print(f"\n⚠️  WARNING: {failed_suites} test suite(s) failed")
        print("Please review the detailed output above for specific failures")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)

