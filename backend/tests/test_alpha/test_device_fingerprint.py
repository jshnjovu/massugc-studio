#!/usr/bin/env python3
"""
Test script to examine the current device fingerprinting implementation
"""

import base64
import json
import sys
from pathlib import Path

# Add project root to path for imports
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from massugc_api_client import DeviceFingerprintGenerator, create_massugc_client

def test_device_fingerprint_format():
    """Test the current device fingerprint format"""
    print("🔍 Testing Device Fingerprint Implementation\n")
    
    # Test the DeviceFingerprintGenerator directly
    print("1. DeviceFingerprintGenerator Test:")
    generator = DeviceFingerprintGenerator()
    fingerprint = generator.generate_fingerprint()
    
    print(f"   Generated fingerprint length: {len(fingerprint)} characters")
    print(f"   Raw fingerprint: {fingerprint}")
    
    # Decode the base64 to see the actual JSON structure
    try:
        decoded_bytes = base64.b64decode(fingerprint)
        decoded_json = json.loads(decoded_bytes.decode())
        print(f"   Decoded JSON structure:")
        for key, value in decoded_json.items():
            print(f"     {key}: {value}")
    except Exception as e:
        print(f"   ❌ Failed to decode fingerprint: {e}")
    
    print("\n2. API Client Integration Test:")
    
    # Test with API client
    test_api_key = "massugc_test1234567890abcdef1234567890ab"  # Dummy key for testing
    try:
        client = create_massugc_client(test_api_key)
        client.initialize()  # This should generate the device fingerprint
        
        print(f"   Client device fingerprint: {client.device_fingerprint}")
        print(f"   Fingerprint matches generator: {client.device_fingerprint == fingerprint}")
        
        # Test header creation
        headers = client._create_headers()
        print(f"\n3. Headers Analysis:")
        for header_name, header_value in headers.items():
            if header_name == 'X-Device-Fingerprint':
                print(f"   {header_name}: {header_value[:50]}... (truncated)")
            elif 'API' in header_name:
                print(f"   {header_name}: {header_value[:20]}... (truncated)")
            else:
                print(f"   {header_name}: {header_value}")
                
    except Exception as e:
        print(f"   ❌ API Client test failed: {e}")

def test_device_info_collection():
    """Test what device information is actually collected"""
    print("\n🖥️  Device Information Collection Test\n")
    
    generator = DeviceFingerprintGenerator()
    
    # Test the machine ID generation
    machine_id = generator._get_machine_id()
    print(f"Machine ID: {machine_id}")
    
    # Test the fingerprint data components
    import platform
    import socket
    import time
    
    fingerprint_data = {
        'machineId': machine_id,
        'platform': platform.system(),
        'arch': platform.machine(),
        'hostname': socket.gethostname(),
        'appVersion': '1.0.20',
        'timestamp': int(time.time())
    }
    
    print("\nFingerprint Data Components:")
    for key, value in fingerprint_data.items():
        print(f"  {key}: {value}")

if __name__ == "__main__":
    test_device_fingerprint_format()
    test_device_info_collection()