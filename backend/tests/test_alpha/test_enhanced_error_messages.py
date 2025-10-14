#!/usr/bin/env python3
"""
Test script to demonstrate the enhanced error messages for failed job tracking.
Shows the difference between old generic errors and new detailed errors.
"""

import sys
import os
from pathlib import Path

# Add project root to path for imports
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from app import create_detailed_error_message

def test_error_message_enhancements():
    """Test various error scenarios with enhanced error messages"""
    
    print("🔍 Testing Enhanced Error Messages for Customer Support\n")
    print("=" * 80)
    
    # Sample job configuration for testing
    sample_job_config = {
        "job_name": "Test Campaign",
        "product": "Wireless Earbuds",
        "persona": "Tech Reviewer", 
        "setting": "Studio",
        "emotion": "Enthusiastic",
        "hook": "Check this out!",
        "brand_name": "TechBrand",
        "language": "English",
        "elevenlabs_voice_id": "21m00Tcm4TlvDq8ikWAM",
        "avatar_video_path": "/path/to/avatar.mp4",
        "example_script_file": "/path/to/script.txt",
        "product_clip_path": "/path/to/product.mov"
    }
    
    test_run_id = "test-run-12345"
    
    # Test scenarios
    error_scenarios = [
        # API Key Errors
        {
            "category": "API Authentication Errors",
            "original_error": "Audio generation failed",
            "enhanced_error": "ElevenLabs API authentication failed: Invalid API key"
        },
        {
            "category": "API Authentication Errors", 
            "original_error": "Script generation failed",
            "enhanced_error": "OpenAI API key invalid or quota exceeded"
        },
        
        # File System Errors
        {
            "category": "File System Errors",
            "original_error": "Avatar video file not found",
            "enhanced_error": "Avatar video file not found: /Users/user/videos/avatar.mp4"
        },
        {
            "category": "File System Errors",
            "original_error": "Script file missing",
            "enhanced_error": "Script file not found: insufficient disk space in output directory"
        },
        
        # Network/Connection Errors
        {
            "category": "Network Connectivity Errors",
            "original_error": "DreamFace request failed",
            "enhanced_error": "Connection timeout to DreamFace API after 30 seconds"
        },
        {
            "category": "Network Connectivity Errors",
            "original_error": "GCS upload failed",
            "enhanced_error": "Network connection lost during GCS upload - file size 45MB"
        },
        
        # Service-Specific Errors
        {
            "category": "Audio Generation Errors",
            "original_error": "Audio generation failed",
            "enhanced_error": "ElevenLabs voice synthesis failed: Voice ID not found for selected language"
        },
        {
            "category": "Video Generation Errors", 
            "original_error": "Video generation failed",
            "enhanced_error": "DreamFace lipsync processing failed: Avatar video format not supported"
        },
        {
            "category": "Cloud Storage Errors",
            "original_error": "Upload failed", 
            "enhanced_error": "GCS bucket access denied: check service account permissions"
        },
        
        # System Resource Errors
        {
            "category": "System Resource Errors",
            "original_error": "Processing failed",
            "enhanced_error": "Insufficient memory for video processing: 85% RAM usage detected"
        }
    ]
    
    for i, scenario in enumerate(error_scenarios, 1):
        print(f"\n{i}. {scenario['category']}")
        print("-" * 50)
        
        print("❌ BEFORE (Generic Error):")
        print(f"   {scenario['original_error']}")
        
        print("\n✅ AFTER (Enhanced Error):")
        enhanced_message = create_detailed_error_message(
            scenario['enhanced_error'], 
            sample_job_config, 
            test_run_id
        )
        
        # Show first few lines of enhanced message
        lines = enhanced_message.split('\n')
        for line in lines[:15]:  # Show first 15 lines
            print(f"   {line}")
        
        if len(lines) > 15:
            print("   ... (additional diagnostic information)")
        
        print("\n" + "=" * 80)

def test_specific_error_categories():
    """Test specific error categories in detail"""
    
    print("\n\n🎯 Detailed Testing of Specific Error Categories\n")
    
    sample_job = {
        "job_name": "Sample Job",
        "product": "Test Product",
        "persona": "Reviewer",
        "elevenlabs_voice_id": "test_voice_id",
        "language": "English"
    }
    
    # Test each major error category
    categories = [
        ("API Key Error", "OpenAI API key invalid - authentication failed"),
        ("File System Error", "Avatar video file not found: /missing/path.mp4"),
        ("Network Error", "Connection timeout to ElevenLabs API after 30 seconds"), 
        ("Audio Generation Error", "ElevenLabs voice synthesis failed: quota exceeded"),
        ("Video Generation Error", "DreamFace processing failed: invalid video format"),
        ("Cloud Storage Error", "GCS upload failed: bucket permission denied"),
        ("System Resource Error", "Insufficient disk space for processing")
    ]
    
    for category, error_msg in categories:
        print(f"\n📋 {category}")
        print("─" * 40)
        
        enhanced = create_detailed_error_message(error_msg, sample_job, "test-123")
        
        # Extract key sections
        lines = enhanced.split('\n')
        
        # Show error summary and category
        for line in lines[:4]:
            print(line)
        
        # Show solutions if present
        solution_lines = [line for line in lines if line.startswith('SOLUTION:')]
        if solution_lines:
            print("\nKey Solutions:")
            for solution in solution_lines[:3]:  # Show first 3 solutions
                print(f"  • {solution.replace('SOLUTION: ', '')}")
    
    print("\n" + "=" * 80)

def compare_payload_sizes():
    """Compare the size difference between old and new error messages"""
    
    print("\n📊 Error Message Size Comparison\n")
    
    sample_job = {"job_name": "Test", "product": "Test Product"}
    
    # Old style error
    old_error = "Audio generation failed"
    
    # New style error  
    new_error = create_detailed_error_message(
        "ElevenLabs API authentication failed: Invalid API key",
        sample_job,
        "test-123"
    )
    
    print(f"Old Error Length: {len(old_error)} characters")
    print(f"New Error Length: {len(new_error)} characters")
    print(f"Size Increase: {len(new_error) - len(old_error)} characters ({((len(new_error) / len(old_error)) - 1) * 100:.0f}% increase)")
    
    print(f"\n💡 Benefits of Size Increase:")
    print("  • Actionable solutions for customer support")
    print("  • System diagnostics for faster troubleshooting") 
    print("  • Reduced back-and-forth with customers")
    print("  • Better error categorization and routing")

if __name__ == "__main__":
    test_error_message_enhancements()
    test_specific_error_categories() 
    compare_payload_sizes()
    
    print(f"\n🎉 Enhanced Error Message Testing Complete!")
    print(f"\nCustomer support will now receive detailed, actionable error reports")
    print(f"instead of generic messages like 'Audio generation failed'.")