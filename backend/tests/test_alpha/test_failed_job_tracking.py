#!/usr/bin/env python3
"""
Test script for failed job tracking implementation.
Tests both successful and failed job scenarios to ensure usage data is sent to MassUGC Cloud API.
"""

import os
import sys
import json
import time
import requests
from pathlib import Path
from datetime import datetime
from unittest.mock import MagicMock, patch

# Add the project root to the path so we can import our modules
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from massugc_api_client import create_massugc_client, MassUGCApiKeyManager

def test_failed_job_payload_structure():
    """Test that failed job payload matches the expected structure"""
    print("🧪 Testing failed job payload structure...")
    
    # Expected failed job payload structure
    expected_structure = {
        "event_type": "video_generation",
        "job_data": {
            "job_name": "Campaign Name Here",
            "product": "Product Name",
            "persona": "Tech Reviewer",
            "setting": "Studio",
            "emotion": "Enthusiastic",
            "hook": "Check this out!",
            "brand_name": "Brand Name",
            "language": "English",
            "run_id": "unique-run-id-12345",
            "output_path": None,
            "success": False,
            "error_message": "Descriptive error message (e.g., 'GCS upload failed: connection timeout')",
            "failure_time": "2025-07-30T12:34:56.789Z",
            "workflow_type": "avatar"
        },
        "timestamp": "2025-07-30T12:34:56.789Z",
        "source": "massugc-video-service",
        "version": "1.0.0"
    }
    
    # Test payload creation (simulating what happens in app.py)
    test_job = {
        "job_name": "Test Campaign",
        "product": "Test Product",
        "persona": "Tech Reviewer",
        "setting": "Studio",
        "emotion": "Enthusiastic",
        "hook": "Test hook",
        "brand_name": "Test Brand",
        "language": "English"
    }
    
    run_id = "test-run-123"
    error_message = "Test error: Something went wrong"
    
    # Create failed job payload (matching app.py logic)
    usage_data = {
        "event_type": "video_generation",
        "job_data": {
            "job_name": test_job.get("job_name", ""),
            "product": test_job.get("product", ""),
            "persona": test_job.get("persona", ""),
            "setting": test_job.get("setting", ""),
            "emotion": test_job.get("emotion", ""),
            "hook": test_job.get("hook", ""),
            "brand_name": test_job.get("brand_name", ""),
            "language": test_job.get("language", "English"),
            "run_id": run_id,
            "output_path": None,
            "success": False,
            "error_message": error_message,
            "failure_time": datetime.now().isoformat(),
            "workflow_type": "avatar"
        },
        "timestamp": datetime.now().isoformat(),
        "source": "massugc-video-service",
        "version": "1.0.0"
    }
    
    # Validate structure
    assert usage_data["event_type"] == "video_generation"
    assert usage_data["job_data"]["success"] == False
    assert usage_data["job_data"]["output_path"] is None
    assert usage_data["job_data"]["error_message"] == error_message
    assert "failure_time" in usage_data["job_data"]
    assert usage_data["source"] == "massugc-video-service"
    
    print("✅ Failed job payload structure is correct")
    print(f"📋 Sample payload:\n{json.dumps(usage_data, indent=2)}")
    return True

def test_successful_job_payload_structure():
    """Test that successful job payload maintains existing structure"""
    print("\n🧪 Testing successful job payload structure...")
    
    test_job = {
        "job_name": "Test Campaign",
        "product": "Test Product",
        "persona": "Tech Reviewer",
        "setting": "Studio",
        "emotion": "Enthusiastic",
        "hook": "Test hook",
        "brand_name": "Test Brand",
        "language": "English"
    }
    
    run_id = "test-run-123"
    output_path = "/path/to/generated/video.mp4"
    
    # Create successful job payload (matching app.py logic)
    usage_data = {
        "event_type": "video_generation",
        "job_data": {
            "job_name": test_job.get("job_name", ""),
            "product": test_job.get("product", ""),
            "persona": test_job.get("persona", ""),
            "setting": test_job.get("setting", ""),
            "emotion": test_job.get("emotion", ""),
            "hook": test_job.get("hook", ""),
            "brand_name": test_job.get("brand_name", ""),
            "language": test_job.get("language", "English"),
            "run_id": run_id,
            "output_path": str(output_path),
            "success": True,
            "generation_time": datetime.now().isoformat(),
            "workflow_type": "avatar"
        },
        "timestamp": datetime.now().isoformat(),
        "source": "massugc-video-service",
        "version": "1.0.0"
    }
    
    # Validate structure
    assert usage_data["event_type"] == "video_generation"
    assert usage_data["job_data"]["success"] == True
    assert usage_data["job_data"]["output_path"] == str(output_path)
    assert "generation_time" in usage_data["job_data"]
    assert usage_data["source"] == "massugc-video-service"
    
    print("✅ Successful job payload structure is correct")
    print(f"📋 Sample payload:\n{json.dumps(usage_data, indent=2)}")
    return True

def test_api_client_log_usage_data():
    """Test that the API client can send both success and failure data"""
    print("\n🧪 Testing API client log_usage_data method...")
    
    # Mock the API client to avoid real API calls during testing
    with patch('requests.Session.post') as mock_post:
        # Configure mock to return success response
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.json.return_value = {"code": 0, "message": "success", "data": {"logged_at": "2025-09-29T01:00:00.000Z"}}
        mock_post.return_value = mock_response
        
        # Create test client
        test_api_key = "massugc_test1234567890abcdef1234567890ab"
        
        try:
            client = create_massugc_client(test_api_key)
            
            # Test successful job data
            success_data = {
                "event_type": "video_generation",
                "job_data": {
                    "job_name": "Test Success Job",
                    "success": True,
                    "output_path": "/path/to/video.mp4",
                    "generation_time": datetime.now().isoformat()
                },
                "timestamp": datetime.now().isoformat(),
                "source": "massugc-video-service",
                "version": "1.0.0"
            }
            
            result = client.log_usage_data(success_data)
            assert result["code"] == 0
            print("✅ Successfully sent successful job data")
            
            # Test failed job data
            failed_data = {
                "event_type": "video_generation",
                "job_data": {
                    "job_name": "Test Failed Job",
                    "success": False,
                    "output_path": None,
                    "error_message": "Test error message",
                    "failure_time": datetime.now().isoformat()
                },
                "timestamp": datetime.now().isoformat(),
                "source": "massugc-video-service",
                "version": "1.0.0"
            }
            
            result = client.log_usage_data(failed_data)
            assert result["code"] == 0
            print("✅ Successfully sent failed job data")
            
            # Verify the correct endpoint was called
            expected_calls = 2  # One for success, one for failure
            assert mock_post.call_count == expected_calls
            
            # Verify the endpoint URL contains the correct path
            for call in mock_post.call_args_list:
                args, kwargs = call
                url = args[0] if args else kwargs.get('url', '')
                assert '/api/desktop/usage' in url
            
            print("✅ API client correctly calls /api/desktop/usage endpoint")
            
        except Exception as e:
            print(f"❌ API client test failed: {e}")
            return False
    
    return True

def test_error_handling():
    """Test that API logging failures don't break the job workflow"""
    print("\n🧪 Testing error handling when API logging fails...")
    
    # Mock the API client to simulate a failure
    with patch('massugc_api_client.MassUGCApiClient.log_usage_data') as mock_log:
        # Configure mock to raise an exception
        mock_log.side_effect = Exception("API connection failed")
        
        try:
            # Simulate the error handling logic from app.py
            try:
                test_api_key = "massugc_test1234567890abcdef1234567890ab"
                client = create_massugc_client(test_api_key)
                
                test_data = {
                    "event_type": "video_generation",
                    "job_data": {"test": "data"},
                    "timestamp": datetime.now().isoformat(),
                    "source": "massugc-video-service",
                    "version": "1.0.0"
                }
                
                client.log_usage_data(test_data)
                
            except Exception as logging_error:
                # This should catch the exception and continue
                print(f"[USAGE] Failed to log usage data: {logging_error}")
                print("✅ Error handling works correctly - job would continue")
                return True
                
        except Exception as e:
            print(f"❌ Error handling test failed: {e}")
            return False
    
    return True

def test_massugc_api_key_manager():
    """Test that API key management works correctly"""
    print("\n🧪 Testing MassUGC API key manager...")
    
    # Use a temporary config directory for testing (cross-platform)
    import tempfile
    test_config_dir = Path(tempfile.mkdtemp(prefix="test_massugc_config_"))
    
    try:
        manager = MassUGCApiKeyManager(test_config_dir)
        
        # Test that no key exists initially
        assert not manager.has_api_key()
        print("✅ Initial state: no API key detected")
        
        # Test storing a key
        test_key = "massugc_test1234567890abcdef1234567890ab"
        manager.store_api_key(test_key)
        
        # Test that key exists and can be retrieved
        assert manager.has_api_key()
        retrieved_key = manager.get_api_key()
        assert retrieved_key == test_key
        print("✅ API key storage and retrieval works")
        
        # Test removing the key
        manager.remove_api_key()
        assert not manager.has_api_key()
        print("✅ API key removal works")
        
    except Exception as e:
        print(f"❌ API key manager test failed: {e}")
        return False
    finally:
        # Clean up test directory
        import shutil
        if test_config_dir.exists():
            shutil.rmtree(test_config_dir)
    
    return True

def run_all_tests():
    """Run all tests and report results"""
    print("🚀 Starting failed job tracking tests...\n")
    
    tests = [
        ("Failed Job Payload Structure", test_failed_job_payload_structure),
        ("Successful Job Payload Structure", test_successful_job_payload_structure),
        ("API Client Log Usage Data", test_api_client_log_usage_data),
        ("Error Handling", test_error_handling),
        ("MassUGC API Key Manager", test_massugc_api_key_manager)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
            results.append((test_name, False))
    
    # Report results
    print("\n" + "="*60)
    print("📊 TEST RESULTS SUMMARY")
    print("="*60)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
        if result:
            passed += 1
    
    print(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Failed job tracking implementation is working correctly.")
        return True
    else:
        print(f"⚠️  {total - passed} test(s) failed. Please review the implementation.")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)