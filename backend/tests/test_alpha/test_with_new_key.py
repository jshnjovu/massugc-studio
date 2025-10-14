#!/usr/bin/env python3
"""
Test script with specific API key
"""

import os
import sys
from pathlib import Path
from datetime import datetime

# Add the project root to Python path so we can import our modules
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from massugc_api_client import create_massugc_client, MassUGCApiError


def test_with_specific_key():
    """Test with the specific API key provided"""
    
    print("🧪 Testing MassUGC Usage Logging with New API Key")
    print("=" * 60)
    
    # Use the specific API key provided
    api_key = "massugc_test1234567890abcdef1234567890ab"
    
    try:
        print(f"✅ Using API key: {api_key[:20]}...")
        
        # Step 1: Create and initialize client
        print("\n📡 Creating MassUGC client...")
        client = create_massugc_client(api_key)
        client.initialize()
        print("✅ Client initialized successfully")
        
        # Step 2: Test auth validation first
        print("\n🔐 Testing Auth Validation...")
        try:
            auth_result = client.validate_connection()
            print("✅ Auth validation successful")
            print(f"   User: {auth_result.get('user', {}).get('email', 'unknown')}")
        except Exception as e:
            print(f"❌ Auth validation failed: {str(e)}")
            return False
        
        # Step 3: Prepare test usage data
        print("\n📊 Preparing test usage data...")
        usage_data = {
            "event_type": "video_generation",
            "job_data": {
                "job_name": "TEST - New API Key Test",
                "product": "Test Product",
                "persona": "Test Persona", 
                "setting": "Test Setting",
                "emotion": "Test Emotion",
                "hook": "Test Hook",
                "brand_name": "Test Brand",
                "language": "English",
                "run_id": "test-new-key-12345",
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
        
        # Step 4: Test usage logging
        print("\n🚀 Sending usage data to MassUGC Cloud API...")
        print(f"   URL: https://massugc-cloud-api.onrender.com/api/desktop/usage/log")
        print(f"   Headers: X-API-Key: {api_key[:20]}...")
        
        try:
            result = client.log_usage_data(usage_data)
            print("✅ SUCCESS! Usage data sent successfully")
            print(f"   Response: {result}")
            return True
            
        except MassUGCApiError as api_error:
            print(f"\n🔍 DEBUG INFO:")
            print(f"   Original error message: {api_error.message}")
            print(f"   Error code: {api_error.error_code}")
            print(f"   Status code: {api_error.status_code}")
            
            if hasattr(client, 'rate_limit_info') and client.rate_limit_info:
                print(f"   Rate limit info: {client.rate_limit_info}")
            
            return False
        
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


if __name__ == "__main__":
    print("Starting MassUGC Test with New API Key...")
    print("Testing with: massugc_test1234567890abcdef1234567890ab\n")
    
    success = test_with_specific_key()
    
    if success:
        print("\n🎉 ALL TESTS PASSED with new API key!")
        print("The new API key works perfectly for usage logging.")
        sys.exit(0)
    else:
        print("\n💥 TEST FAILED with new API key")
        print("Check the error details above.")
        sys.exit(1)