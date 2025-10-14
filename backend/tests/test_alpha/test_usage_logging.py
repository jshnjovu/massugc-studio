#!/usr/bin/env python3
"""
Quick test script for MassUGC usage logging
Tests the exact same code path as the real job completion
"""

import os
import sys
from pathlib import Path
from datetime import datetime

# Add the project root to Python path so we can import our modules
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from massugc_api_client import create_massugc_client, MassUGCApiKeyManager, MassUGCApiError


def test_usage_logging():
    """Test the exact usage logging flow that happens after job completion"""
    
    print("🧪 Testing MassUGC Usage Logging")
    print("=" * 50)
    
    try:
        # Step 1: Get API key (same as in app.py)
        config_dir = Path.home() / ".zyra-video-agent"
        api_key_manager = MassUGCApiKeyManager(config_dir)
        
        if not api_key_manager.has_api_key():
            print("❌ ERROR: No MassUGC API key configured")
            return False
            
        api_key = api_key_manager.get_api_key()
        if not api_key:
            print("❌ ERROR: Failed to retrieve API key")
            return False
            
        print(f"✅ API key loaded: {api_key[:20]}...")
        
        # Step 2: Create and initialize client (same as in app.py)
        print("\n📡 Creating MassUGC client...")
        client = create_massugc_client(api_key)
        client.initialize()  # This is the fix we just added
        print("✅ Client initialized successfully")
        
        # Step 3: Prepare test usage data (same format as app.py)
        print("\n📊 Preparing test usage data...")
        usage_data = {
            "event_type": "video_generation",
            "job_data": {
                "job_name": "TEST - Usage Logging Test",
                "product": "Test Product",
                "persona": "Test Persona", 
                "setting": "Test Setting",
                "emotion": "Test Emotion",
                "hook": "Test Hook",
                "brand_name": "Test Brand",
                "language": "English",
                "run_id": "test-run-id-12345",
                "output_path": "/test/path/video.mp4",
                "success": True,
                "generation_time": datetime.now().isoformat(),
                "workflow_type": "test"
            },
            "timestamp": datetime.now().isoformat(),
            "source": "massugc-video-service",
            "version": "1.0.0"
        }
        
        print("✅ Test data prepared")
        print(f"   Event type: {usage_data['event_type']}")
        print(f"   Job name: {usage_data['job_data']['job_name']}")
        print(f"   Timestamp: {usage_data['timestamp']}")
        
        # Step 4: Make the usage logging call (same as app.py)
        print("\n🚀 Sending usage data to MassUGC Cloud API...")
        print(f"   URL: https://massugc-cloud-api.onrender.com/api/desktop/usage/log")
        print(f"   Headers: X-API-Key: {api_key[:20]}...")
        
        # Add debug logging to see the actual HTTP response
        try:
            result = client.log_usage_data(usage_data)
        except MassUGCApiError as api_error:
            print(f"\n🔍 DEBUG INFO:")
            print(f"   Original error message: {api_error.message}")
            print(f"   Error code: {api_error.error_code}")
            print(f"   Status code: {api_error.status_code}")
            
            # Let's also check what the client's rate limit info shows
            if hasattr(client, 'rate_limit_info') and client.rate_limit_info:
                print(f"   Rate limit info: {client.rate_limit_info}")
            
            raise api_error
        
        print("✅ SUCCESS! Usage data sent successfully")
        print(f"   Response: {result}")
        
        return True
        
    except MassUGCApiError as e:
        print(f"❌ MassUGC API Error: {e.message}")
        print(f"   Error code: {e.error_code}")
        print(f"   Status code: {e.status_code}")
        return False
        
    except Exception as e:
        print(f"❌ Unexpected Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def test_auth_validation():
    """Test the auth validation for comparison"""
    
    print("\n🔐 Testing Auth Validation (for comparison)")
    print("-" * 30)
    
    try:
        config_dir = Path.home() / ".zyra-video-agent"
        api_key_manager = MassUGCApiKeyManager(config_dir)
        api_key = api_key_manager.get_api_key()
        
        client = create_massugc_client(api_key)
        result = client.validate_connection()
        
        print("✅ Auth validation successful")
        print(f"   User: {result.get('user', {}).get('email', 'unknown')}")
        
        return True
        
    except Exception as e:
        print(f"❌ Auth validation failed: {str(e)}")
        return False


if __name__ == "__main__":
    print("Starting MassUGC Usage Logging Test...")
    print("This tests the EXACT same code that runs after job completion\n")
    
    # First test auth validation to make sure basic connection works
    auth_success = test_auth_validation()
    
    if not auth_success:
        print("\n❌ Auth validation failed - can't proceed with usage test")
        sys.exit(1)
    
    # Now test the usage logging
    usage_success = test_usage_logging()
    
    if usage_success:
        print("\n🎉 ALL TESTS PASSED!")
        print("Usage logging should now work for real video jobs.")
        sys.exit(0)
    else:
        print("\n💥 USAGE LOGGING TEST FAILED")
        print("The issue still exists - check the error details above.")
        sys.exit(1)