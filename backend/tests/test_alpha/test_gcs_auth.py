#!/usr/bin/env python3
"""
GCS Authentication Diagnostic Script
Run this to test exactly what's wrong with your GCS setup
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_gcs_authentication():
    print("🔍 GCS Authentication Diagnostic")
    print("=" * 50)
    
    # Test 1: Check environment variables
    print("\n1. Environment Variables:")
    gcs_bucket = os.getenv('GCS_BUCKET_NAME')
    google_creds = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    
    print(f"   GCS_BUCKET_NAME: {gcs_bucket}")
    print(f"   GOOGLE_APPLICATION_CREDENTIALS: {google_creds}")
    
    if not gcs_bucket:
        print("   ❌ ERROR: GCS_BUCKET_NAME not set!")
        return False
    
    if not google_creds:
        print("   ❌ ERROR: GOOGLE_APPLICATION_CREDENTIALS not set!")
        return False
    
    # Test 2: Check if credentials file exists
    print("\n2. Credentials File Check:")
    creds_path = Path(google_creds)
    if creds_path.exists():
        print(f"   ✅ Credentials file exists: {creds_path}")
        print(f"   File size: {creds_path.stat().st_size} bytes")
    else:
        print(f"   ❌ ERROR: Credentials file not found: {creds_path}")
        return False
    
    # Test 3: Try to import Google Cloud Storage
    print("\n3. Google Cloud Storage Import:")
    try:
        from google.cloud import storage
        print("   ✅ Successfully imported google.cloud.storage")
    except ImportError as e:
        print(f"   ❌ ERROR: Failed to import google.cloud.storage: {e}")
        return False
    
    # Test 4: Try to create storage client with default credentials
    print("\n4. Default Storage Client Creation:")
    try:
        client = storage.Client()
        print("   ✅ Successfully created storage client with default credentials")
    except Exception as e:
        print(f"   ❌ ERROR: Failed to create storage client: {e}")
        print("   This is likely the root cause of your GCS upload failures!")
        
        # Test 5: Try to create client with explicit credentials
        print("\n5. Explicit Credentials Client Creation:")
        try:
            client = storage.Client.from_service_account_json(google_creds)
            print("   ✅ Successfully created storage client with explicit credentials")
        except Exception as e2:
            print(f"   ❌ ERROR: Failed with explicit credentials too: {e2}")
            return False
    
    # Test 6: Try to access the bucket
    print("\n6. Bucket Access Test:")
    try:
        if 'client' not in locals():
            client = storage.Client.from_service_account_json(google_creds)
        
        bucket = client.bucket(gcs_bucket)
        # Just check if bucket exists, don't list contents
        bucket.reload()
        print(f"   ✅ Successfully accessed bucket: {gcs_bucket}")
    except Exception as e:
        print(f"   ❌ ERROR: Failed to access bucket '{gcs_bucket}': {e}")
        print("   Check if:")
        print("     - Bucket name is correct")
        print("     - Service account has Storage Admin permissions")
        print("     - Bucket exists in the correct project")
        return False
    
    # Test 7: Try a simple upload test
    print("\n7. Upload Test:")
    try:
        test_blob_name = "test-upload-diagnostic.txt"
        test_content = "This is a test upload from the diagnostic script"
        
        blob = bucket.blob(test_blob_name)
        blob.upload_from_string(test_content)
        print(f"   ✅ Successfully uploaded test file: {test_blob_name}")
        
        # Clean up test file
        blob.delete()
        print("   ✅ Successfully deleted test file")
        
    except Exception as e:
        print(f"   ❌ ERROR: Failed to upload test file: {e}")
        return False
    
    print("\n🎉 ALL TESTS PASSED!")
    print("Your GCS authentication setup is working correctly.")
    print("The issue might be elsewhere in the video processing pipeline.")
    return True

def suggest_fixes():
    print("\n🔧 SUGGESTED FIXES:")
    print("=" * 50)
    
    print("1. Make sure your .env file contains:")
    print("   GCS_BUCKET_NAME=your-bucket-name")
    print("   GOOGLE_APPLICATION_CREDENTIALS=/full/path/to/your/service-account.json")
    
    print("\n2. If using Windows, avoid spaces in paths:")
    print("   ❌ C:\\Users\\name\\my folder\\creds.json")
    print("   ✅ C:\\Users\\name\\my-folder\\creds.json")
    
    print("\n3. Check service account permissions:")
    print("   - Storage Admin role")
    print("   - Storage Object Admin role")
    
    print("\n4. Verify bucket exists and is in correct project")
    
    print("\n5. If all else fails, try explicit credentials in code:")
    print("   storage.Client.from_service_account_json(credentials_path)")

if __name__ == "__main__":
    print("Starting GCS Authentication Diagnostic...")
    
    success = test_gcs_authentication()
    
    if not success:
        suggest_fixes()
        sys.exit(1)
    else:
        print("\n✅ Diagnosis complete - GCS setup is working!")
        sys.exit(0) 