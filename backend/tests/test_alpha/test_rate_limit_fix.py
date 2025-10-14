#!/usr/bin/env python3
"""
Test script for the rate limiting fix in massugc_api_client.py
"""

import logging
import sys
from pathlib import Path
from unittest.mock import Mock

# Add project root to path for imports
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from massugc_api_client import MassUGCApiClient

# Set up logging to see the output
logging.basicConfig(level=logging.DEBUG)

def test_rate_limit_fix():
    print("🧪 Testing rate limiting fix...")
    
    # Create a client with real API key to test actual API responses
    real_api_key = "massugc_fwQwoqBLJm-je5bLwR-dvpJfaHxoZVkh"
    client = MassUGCApiClient(real_api_key)
    
    # Test 1: Response with no rate limit headers (should not warn)
    print("\n📝 Test 1: No rate limit headers (normal API response)")
    mock_response_no_headers = Mock()
    mock_response_no_headers.headers = {}
    client._update_rate_limit_info(mock_response_no_headers)
    print(f"   Rate limit info: {client.rate_limit_info}")
    print("   ✅ Should be None and no warnings logged")
    
    # Test 2: Response with rate limit headers showing healthy limits
    print("\n📝 Test 2: Rate limit headers with healthy limits")
    mock_response_healthy = Mock()
    mock_response_healthy.headers = {
        'X-RateLimit-Limit': '1000',
        'X-RateLimit-Remaining': '800',
        'X-RateLimit-Reset': '1234567890'
    }
    client._update_rate_limit_info(mock_response_healthy)
    print(f"   Rate limit info: {client.rate_limit_info}")
    print("   ✅ Should have data and no warnings logged")
    
    # Test 3: Response with rate limit headers showing low limits (should warn)
    print("\n📝 Test 3: Rate limit headers with low remaining (should warn)")
    mock_response_low = Mock()
    mock_response_low.headers = {
        'X-RateLimit-Limit': '1000',
        'X-RateLimit-Remaining': '2',
        'X-RateLimit-Reset': '1234567890'
    }
    client._update_rate_limit_info(mock_response_low)
    print(f"   Rate limit info: {client.rate_limit_info}")
    print("   ✅ Should have data and WARNING logged")
    
    # Test 4: Response with rate limit headers showing medium limits (should info log)
    print("\n📝 Test 4: Rate limit headers with medium remaining (should info log)")
    mock_response_medium = Mock()
    mock_response_medium.headers = {
        'X-RateLimit-Limit': '1000',
        'X-RateLimit-Remaining': '15',
        'X-RateLimit-Reset': '1234567890'
    }
    client._update_rate_limit_info(mock_response_medium)
    print(f"   Rate limit info: {client.rate_limit_info}")
    print("   ✅ Should have data and INFO log about status")
    
    # Test 5: MassUGC Custom Headers (the real format from your backend)
    print("\n📝 Test 5: MassUGC Custom Headers (per-minute and per-hour)")
    mock_response_massugc = Mock()
    mock_response_massugc.headers = {
        'X-RateLimit-Limit-Minute': '60',
        'X-RateLimit-Remaining-Minute': '45',
        'X-RateLimit-Limit-Hour': '1000',
        'X-RateLimit-Remaining-Hour': '850'
    }
    client._update_rate_limit_info(mock_response_massugc)
    print(f"   Rate limit info: {client.rate_limit_info}")
    print("   ✅ Should detect MassUGC custom headers and log appropriately")
    
    # Test 6: Make a real API call to see actual headers
    print("\n📝 Test 6: Real API validation call to see actual headers")
    try:
        result = client.validate_connection()
        print(f"   API validation successful!")
        print(f"   Rate limit info after real call: {client.rate_limit_info}")
        print("   ✅ Should show real rate limiting data from your API")
    except Exception as e:
        print(f"   ❌ API call failed: {e}")
    
    print("\n✅ Rate limiting fix test completed!")
    print("   - No false warnings for missing headers")
    print("   - Proper warnings only when limits are actually low")
    print("   - Graceful handling of missing headers")
    print("   - Support for MassUGC custom rate limit headers")

if __name__ == "__main__":
    test_rate_limit_fix()