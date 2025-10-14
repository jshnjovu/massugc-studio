#!/usr/bin/env python3
"""
Test script for MassUGC API integration
Run this to validate the integration without a full API key.
"""

import sys
import asyncio
from pathlib import Path

# Add the project root to the path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from massugc_api_client import (
    MassUGCApiClient, 
    MassUGCApiKeyManager, 
    MassUGCApiError, 
    DeviceFingerprintGenerator
)
from backend.massugc_video_job import validate_massugc_settings

def test_device_fingerprinting():
    """Test device fingerprint generation"""
    print("=== Testing Device Fingerprinting ===")
    
    try:
        generator = DeviceFingerprintGenerator()
        fingerprint = generator.generate_fingerprint()
        
        print(f"✅ Device fingerprint generated successfully")
        print(f"   Fingerprint length: {len(fingerprint)} characters")
        print(f"   Fingerprint preview: {fingerprint[:50]}...")
        
        # Test consistency
        fingerprint2 = generator.generate_fingerprint()
        if fingerprint == fingerprint2:
            print("✅ Fingerprint is consistent across calls")
        else:
            print("❌ Fingerprint is not consistent")
            
        return True
        
    except Exception as e:
        print(f"❌ Device fingerprinting failed: {e}")
        return False

def test_api_key_validation():
    """Test API key format validation"""
    print("\n=== Testing API Key Validation ===")
    
    valid_keys = [
        "massugc_V1StGXR8_Z5jdHi6B-myT5fR2h3kH7_P",
        "massugc_abcd1234efgh5678ijkl9012mnop3456"
    ]
    
    invalid_keys = [
        "invalid_key",
        "massugc_short",
        "wrong_prefix_V1StGXR8_Z5jdHi6B-myT5fR2h3kH7_P",
        "massugc_",
        ""
    ]
    
    success_count = 0
    
    # Test valid keys
    for key in valid_keys:
        try:
            client = MassUGCApiClient(key, "https://example.com")  # Won't actually connect
            print(f"✅ Valid key accepted: {key[:20]}...")
            success_count += 1
        except MassUGCApiError as e:
            if "Invalid API key format" in str(e):
                print(f"❌ Valid key rejected: {key[:20]}...")
            else:
                print(f"✅ Valid key accepted (other error expected): {key[:20]}...")
                success_count += 1
        except Exception as e:
            print(f"❌ Unexpected error for valid key: {e}")
    
    # Test invalid keys
    for key in invalid_keys:
        try:
            client = MassUGCApiClient(key, "https://example.com")
            print(f"❌ Invalid key accepted: {key[:20] if key else '(empty)'}...")
        except MassUGCApiError as e:
            if "Invalid API key format" in str(e):
                print(f"✅ Invalid key rejected: {key[:20] if key else '(empty)'}...")
                success_count += 1
            else:
                print(f"❌ Invalid key rejected with wrong error: {key[:20] if key else '(empty)'}...")
        except Exception as e:
            print(f"❌ Unexpected error for invalid key: {e}")
    
    expected_successes = len(valid_keys) + len(invalid_keys)
    print(f"API key validation: {success_count}/{expected_successes} tests passed")
    
    return success_count == expected_successes

def test_api_key_storage():
    """Test API key storage and retrieval"""
    print("\n=== Testing API Key Storage ===")
    
    try:
        # Create a temporary config directory
        import tempfile
        temp_dir = Path(tempfile.mkdtemp(prefix="massugc_test_"))
        
        try:
            manager = MassUGCApiKeyManager(temp_dir)
            
            # Test initial state
            if not manager.has_api_key():
                print("✅ Initial state: no API key stored")
            else:
                print("❌ Initial state: API key unexpectedly found")
                return False
            
            # Test storing API key
            test_key = "massugc_V1StGXR8_Z5jdHi6B-myT5fR2h3kH7_P"
            manager.store_api_key(test_key)
            
            if manager.has_api_key():
                print("✅ API key stored successfully")
            else:
                print("❌ API key not stored")
                return False
            
            # Test retrieving API key
            retrieved_key = manager.get_api_key()
            if retrieved_key == test_key:
                print("✅ API key retrieved successfully")
            else:
                print(f"❌ API key mismatch: expected {test_key}, got {retrieved_key}")
                return False
            
            # Test removing API key
            manager.remove_api_key()
            if not manager.has_api_key():
                print("✅ API key removed successfully")
            else:
                print("❌ API key not removed")
                return False
            
            return True
            
        finally:
            # Clean up temp directory
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)
            
    except Exception as e:
        print(f"❌ API key storage test failed: {e}")
        return False

def test_massugc_settings_validation():
    """Test MassUGC settings validation"""
    print("\n=== Testing MassUGC Settings Validation ===")
    
    try:
        # Test valid settings
        valid_settings = {
            "avatar_image_path": __file__,  # Use this file as a dummy image
            "quality": "high",
            "style": "professional"
        }
        
        is_valid, error = validate_massugc_settings(valid_settings)
        if is_valid:
            print("✅ Valid settings accepted")
        else:
            print(f"❌ Valid settings rejected: {error}")
            return False
        
        # Test missing avatar path
        invalid_settings = {
            "quality": "high"
        }
        
        is_valid, error = validate_massugc_settings(invalid_settings)
        if not is_valid and "avatar_image_path" in error:
            print("✅ Missing avatar path correctly rejected")
        else:
            print(f"❌ Missing avatar path not properly rejected: {error}")
            return False
        
        # Test invalid quality
        invalid_quality_settings = {
            "avatar_image_path": __file__,
            "quality": "invalid_quality"
        }
        
        is_valid, error = validate_massugc_settings(invalid_quality_settings)
        if not is_valid and "quality" in error:
            print("✅ Invalid quality correctly rejected")
        else:
            print(f"❌ Invalid quality not properly rejected: {error}")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Settings validation test failed: {e}")
        return False

async def test_api_client_initialization():
    """Test API client initialization (without actual API calls)"""
    print("\n=== Testing API Client Initialization ===")
    
    try:
        # Test with mock key (won't actually connect)
        test_key = "massugc_V1StGXR8_Z5jdHi6B-myT5fR2h3kH7_P"
        client = MassUGCApiClient(test_key, "https://httpbin.org")  # Use httpbin for testing
        
        # Test device fingerprint generation
        fingerprint = client.device_fingerprint_generator.generate_fingerprint()
        if fingerprint:
            print("✅ Device fingerprint generated for client")
            # Assign the fingerprint to the client so it can be used in headers
            client.device_fingerprint = fingerprint
        else:
            print("❌ Device fingerprint not generated for client")
            return False
        
        # Test headers creation
        headers = client._create_headers()
        expected_headers = ['X-API-Key', 'Content-Type', 'User-Agent', 'X-Device-Fingerprint']
        
        for header in expected_headers:
            if header in headers:
                print(f"✅ Header '{header}' present")
            else:
                print(f"❌ Header '{header}' missing")
                return False
        
        print("✅ API client initialization successful")
        return True
        
    except Exception as e:
        print(f"❌ API client initialization failed: {e}")
        return False

def main():
    """Run all tests"""
    print("MassUGC Integration Test Suite")
    print("=" * 50)
    
    tests = [
        ("Device Fingerprinting", test_device_fingerprinting),
        ("API Key Validation", test_api_key_validation),
        ("API Key Storage", test_api_key_storage),
        ("Settings Validation", test_massugc_settings_validation),
        ("API Client Initialization", lambda: asyncio.run(test_api_client_initialization()))
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
                print(f"✅ {test_name}: PASSED")
            else:
                print(f"❌ {test_name}: FAILED")
        except Exception as e:
            print(f"❌ {test_name}: ERROR - {e}")
    
    print("\n" + "=" * 50)
    print(f"Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! MassUGC integration is ready.")
        return 0
    else:
        print("⚠️  Some tests failed. Please check the implementation.")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)