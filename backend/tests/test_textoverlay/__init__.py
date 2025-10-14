"""
Text Overlay Integration Test Package
======================================
Integration tests for text overlay functionality described in current_bugs_workflow.md.

Tests the actual implementation without mocking:
- API endpoints (POST /campaigns, POST /run-job, GET /video-info)
- Backend processing (create_video.py, enhanced_video_processor.py)
- Font scaling and position mapping
- Design space to video space conversion

Run all tests:
    python tests/test_textoverlay/run_all_tests.py

Run individual test files:
    python tests/test_textoverlay/test_text_overlay_integration.py
    python tests/test_textoverlay/test_backend_text_overlay.py
"""

__version__ = "1.0.0"
__all__ = [
    "test_text_overlay_integration",
    "test_backend_text_overlay",
    "run_all_tests"
]

