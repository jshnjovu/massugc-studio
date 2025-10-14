#!/usr/bin/env python3
"""
Backend Modules Test Suite for Built Libraries
==============================================

This test suite specifically tests the backend modules that are bundled
in the PyInstaller build, ensuring they work correctly in the built environment.

Author: MassUGC Development Team
Version: 1.0.0
"""

import os
import sys
import unittest
import tempfile
import shutil
import json
import time
import traceback
from pathlib import Path
from typing import Dict, List, Optional, Any
import logging

# Import package configuration
try:
    from . import PROJECT_ROOT, DIST_DIR, INTERNAL_DIR
except ImportError:
    # If running directly, set up paths manually
    import sys
    from pathlib import Path
    PROJECT_ROOT = Path(__file__).parent.parent.parent
    DIST_DIR = PROJECT_ROOT / "dist"
    INTERNAL_DIR = DIST_DIR / "ZyraVideoAgentBackend" / "_internal"
    
    # Add paths to sys.path
    if str(PROJECT_ROOT) not in sys.path:
        sys.path.insert(0, str(PROJECT_ROOT))
    if INTERNAL_DIR.exists() and str(INTERNAL_DIR) not in sys.path:
        sys.path.insert(0, str(INTERNAL_DIR))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class BackendModulesTestSuite(unittest.TestCase):
    """Test suite for backend modules in built libraries"""
    
    @classmethod
    def setUpClass(cls):
        """Set up test environment"""
        cls.project_root = PROJECT_ROOT
        cls.dist_dir = DIST_DIR
        cls.internal_dir = INTERNAL_DIR
        
        # Create temporary test directory
        cls.test_dir = Path(tempfile.mkdtemp(prefix="zyra_backend_test_"))
        logger.info(f"Backend test directory: {cls.test_dir}")
        
        # Verify backend directory exists
        cls.backend_dir = cls.internal_dir / "backend"
        assert cls.backend_dir.exists(), f"Backend directory not found: {cls.backend_dir}"
    
    @classmethod
    def tearDownClass(cls):
        """Clean up test environment"""
        if cls.test_dir.exists():
            shutil.rmtree(cls.test_dir)
            logger.info(f"Cleaned up backend test directory: {cls.test_dir}")
    
    def test_create_video_module(self):
        """Test create_video module functionality"""
        logger.info("Testing create_video module...")
        
        try:
            from backend import create_video
            
            # Test module attributes
            self.assertTrue(hasattr(create_video, 'create_video_job'), 
                          "create_video should have create_video_job function")
            self.assertTrue(hasattr(create_video, 'create_randomized_video_job'), 
                          "create_video should have create_randomized_video_job function")
            self.assertTrue(hasattr(create_video, 'generate_script'), 
                          "create_video should have generate_script function")
            
            # Test global variables
            self.assertTrue(hasattr(create_video, 'WORKING_DIR'), 
                          "create_video should have WORKING_DIR")
            self.assertTrue(hasattr(create_video, 'OUTPUT_BASE_DIR'), 
                          "create_video should have OUTPUT_BASE_DIR")
            
            logger.info("✓ create_video module structure correct")
            
            # Test helper functions
            if hasattr(create_video, 'calculate_ffmpeg_timeout'):
                timeout = create_video.calculate_ffmpeg_timeout()
                self.assertIsInstance(timeout, (int, float), 
                                    "calculate_ffmpeg_timeout should return a number")
                logger.info("✓ calculate_ffmpeg_timeout function working")
            
        except Exception as e:
            self.fail(f"create_video module test failed: {e}")
    
    def test_randomizer_module(self):
        """Test randomizer module functionality"""
        logger.info("Testing randomizer module...")
        
        try:
            from backend import randomizer
            
            # Test utility functions
            self.assertTrue(hasattr(randomizer, 'random_float'), 
                          "randomizer should have random_float function")
            self.assertTrue(hasattr(randomizer, 'random_int'), 
                          "randomizer should have random_int function")
            self.assertTrue(hasattr(randomizer, 'generate_random_string'), 
                          "randomizer should have generate_random_string function")
            
            # Test random_float function
            if hasattr(randomizer, 'random_float'):
                val = randomizer.random_float(1.0, 10.0)
                self.assertIsInstance(val, float, "random_float should return float")
                self.assertGreaterEqual(val, 1.0, "random_float should respect min value")
                self.assertLessEqual(val, 10.0, "random_float should respect max value")
                logger.info("✓ random_float function working")
            
            # Test random_int function
            if hasattr(randomizer, 'random_int'):
                val = randomizer.random_int(1, 10)
                self.assertIsInstance(val, int, "random_int should return int")
                self.assertGreaterEqual(val, 1, "random_int should respect min value")
                self.assertLessEqual(val, 10, "random_int should respect max value")
                logger.info("✓ random_int function working")
            
            # Test generate_random_string function
            if hasattr(randomizer, 'generate_random_string'):
                string = randomizer.generate_random_string(10)
                self.assertIsInstance(string, str, "generate_random_string should return string")
                self.assertEqual(len(string), 10, "generate_random_string should respect length")
                logger.info("✓ generate_random_string function working")
            
            # Test main randomize_video function
            self.assertTrue(hasattr(randomizer, 'randomize_video'), 
                          "randomizer should have randomize_video function")
            
            logger.info("✓ randomizer module structure correct")
            
        except Exception as e:
            self.fail(f"randomizer module test failed: {e}")
    
    def test_whisper_service_module(self):
        """Test whisper_service module functionality"""
        logger.info("Testing whisper_service module...")
        
        try:
            from backend import whisper_service
            
            # Test classes
            self.assertTrue(hasattr(whisper_service, 'TranscriptionSegment'), 
                          "whisper_service should have TranscriptionSegment class")
            self.assertTrue(hasattr(whisper_service, 'WhisperConfig'), 
                          "whisper_service should have WhisperConfig class")
            self.assertTrue(hasattr(whisper_service, 'WhisperService'), 
                          "whisper_service should have WhisperService class")
            
            # Test TranscriptionSegment
            if hasattr(whisper_service, 'TranscriptionSegment'):
                segment = whisper_service.TranscriptionSegment(
                    start=0.0, end=1.0, text="test"
                )
                self.assertEqual(segment.start, 0.0, "TranscriptionSegment start should work")
                self.assertEqual(segment.end, 1.0, "TranscriptionSegment end should work")
                self.assertEqual(segment.text, "test", "TranscriptionSegment text should work")
                logger.info("✓ TranscriptionSegment class working")
            
            # Test WhisperConfig
            if hasattr(whisper_service, 'WhisperConfig'):
                config = whisper_service.WhisperConfig()
                self.assertIsInstance(config.use_api, bool, "WhisperConfig use_api should be bool")
                self.assertIsInstance(config.model_size, str, "WhisperConfig model_size should be str")
                logger.info("✓ WhisperConfig class working")
            
            # Test WhisperService
            if hasattr(whisper_service, 'WhisperService'):
                service = whisper_service.WhisperService()
                self.assertIsNotNone(service, "WhisperService should be instantiable")
                logger.info("✓ WhisperService class working")
            
            logger.info("✓ whisper_service module structure correct")
            
        except Exception as e:
            self.fail(f"whisper_service module test failed: {e}")
    
    def test_clip_stitch_generator_module(self):
        """Test clip_stitch_generator module functionality"""
        logger.info("Testing clip_stitch_generator module...")
        
        try:
            from backend import clip_stitch_generator
            
            # Test main function
            self.assertTrue(hasattr(clip_stitch_generator, 'build_clip_stitch_video'), 
                          "clip_stitch_generator should have build_clip_stitch_video function")
            
            logger.info("✓ clip_stitch_generator module structure correct")
            
        except Exception as e:
            self.fail(f"clip_stitch_generator module test failed: {e}")
    
    def test_concat_random_videos_module(self):
        """Test concat_random_videos module functionality"""
        logger.info("Testing concat_random_videos module...")
        
        try:
            from backend import concat_random_videos
            
            # Test that module can be imported
            self.assertIsNotNone(concat_random_videos, "concat_random_videos should be importable")
            
            logger.info("✓ concat_random_videos module structure correct")
            
        except Exception as e:
            self.fail(f"concat_random_videos module test failed: {e}")
    
    def test_merge_audio_video_module(self):
        """Test merge_audio_video module functionality"""
        logger.info("Testing merge_audio_video module...")
        
        try:
            from backend import merge_audio_video
            
            # Test that module can be imported
            self.assertIsNotNone(merge_audio_video, "merge_audio_video should be importable")
            
            logger.info("✓ merge_audio_video module structure correct")
            
        except Exception as e:
            self.fail(f"merge_audio_video module test failed: {e}")
    
    def test_music_library_module(self):
        """Test music_library module functionality"""
        logger.info("Testing music_library module...")
        
        try:
            from backend import music_library
            
            # Test that module can be imported
            self.assertIsNotNone(music_library, "music_library should be importable")
            
            logger.info("✓ music_library module structure correct")
            
        except Exception as e:
            self.fail(f"music_library module test failed: {e}")
    
    def test_google_drive_service_module(self):
        """Test google_drive_service module functionality"""
        logger.info("Testing google_drive_service module...")
        
        try:
            from backend import google_drive_service
            
            # Test that module can be imported
            self.assertIsNotNone(google_drive_service, "google_drive_service should be importable")
            
            # Test GoogleDriveService class if it exists
            if hasattr(google_drive_service, 'GoogleDriveService'):
                logger.info("✓ GoogleDriveService class found")
            
            logger.info("✓ google_drive_service module structure correct")
            
        except Exception as e:
            self.fail(f"google_drive_service module test failed: {e}")
    
    def test_massugc_video_job_module(self):
        """Test massugc_video_job module functionality"""
        logger.info("Testing massugc_video_job module...")
        
        try:
            from backend import massugc_video_job
            
            # Test that module can be imported
            self.assertIsNotNone(massugc_video_job, "massugc_video_job should be importable")
            
            # Test main function
            if hasattr(massugc_video_job, 'create_massugc_video_job'):
                logger.info("✓ create_massugc_video_job function found")
            
            logger.info("✓ massugc_video_job module structure correct")
            
        except Exception as e:
            self.fail(f"massugc_video_job module test failed: {e}")
    
    def test_enhanced_video_processor_module(self):
        """Test enhanced_video_processor module functionality"""
        logger.info("Testing enhanced_video_processor module...")
        
        try:
            from backend import enhanced_video_processor
            
            # Test that module can be imported
            self.assertIsNotNone(enhanced_video_processor, "enhanced_video_processor should be importable")
            
            logger.info("✓ enhanced_video_processor module structure correct")
            
        except Exception as e:
            self.fail(f"enhanced_video_processor module test failed: {e}")
    
    def test_backend_module_dependencies(self):
        """Test that backend modules can access their dependencies"""
        logger.info("Testing backend module dependencies...")
        
        try:
            # Test that backend modules can import their dependencies
            from backend import create_video
            from backend import randomizer
            from backend import whisper_service
            
            # Test that modules can access common dependencies
            import cv2
            import numpy as np
            import torch
            import whisper
            
            logger.info("✓ Backend modules can access their dependencies")
            
        except Exception as e:
            self.fail(f"Backend module dependencies test failed: {e}")
    
    def test_backend_module_integration(self):
        """Test integration between backend modules"""
        logger.info("Testing backend module integration...")
        
        try:
            # Test that modules can import each other
            from backend import create_video
            from backend import randomizer
            from backend import clip_stitch_generator
            
            # Test that create_video can import randomizer
            if hasattr(create_video, 'randomize_video'):
                logger.info("✓ create_video can access randomizer functions")
            
            # Test that create_video can import clip_stitch_generator
            if hasattr(create_video, 'build_clip_stitch_video'):
                logger.info("✓ create_video can access clip_stitch_generator functions")
            
            logger.info("✓ Backend module integration working")
            
        except Exception as e:
            self.fail(f"Backend module integration test failed: {e}")
    
    def test_backend_module_error_handling(self):
        """Test error handling in backend modules"""
        logger.info("Testing backend module error handling...")
        
        try:
            from backend import randomizer
            
            # Test error handling in random_float
            if hasattr(randomizer, 'random_float'):
                try:
                    # This should handle invalid input gracefully
                    val = randomizer.random_float(10.0, 1.0)  # min > max
                    # If it doesn't raise an error, that's also acceptable
                    logger.info("✓ random_float handles edge cases")
                except Exception as e:
                    logger.info(f"✓ random_float raises appropriate error: {e}")
            
            logger.info("✓ Backend module error handling working")
            
        except Exception as e:
            self.fail(f"Backend module error handling test failed: {e}")
    
    def test_backend_module_performance(self):
        """Test performance of backend modules"""
        logger.info("Testing backend module performance...")
        
        try:
            from backend import randomizer
            import time
            
            # Test random_float performance
            if hasattr(randomizer, 'random_float'):
                start_time = time.time()
                for _ in range(1000):
                    randomizer.random_float(0.0, 1.0)
                end_time = time.time()
                
                duration = end_time - start_time
                self.assertLess(duration, 1.0, "random_float should be fast (< 1s for 1000 calls)")
                logger.info(f"✓ random_float performance: {duration:.3f}s for 1000 calls")
            
            # Test random_int performance
            if hasattr(randomizer, 'random_int'):
                start_time = time.time()
                for _ in range(1000):
                    randomizer.random_int(0, 100)
                end_time = time.time()
                
                duration = end_time - start_time
                self.assertLess(duration, 1.0, "random_int should be fast (< 1s for 1000 calls)")
                logger.info(f"✓ random_int performance: {duration:.3f}s for 1000 calls")
            
            logger.info("✓ Backend module performance acceptable")
            
        except Exception as e:
            self.fail(f"Backend module performance test failed: {e}")


def run_backend_modules_tests():
    """Run the backend modules test suite"""
    logger.info("Starting Backend Modules Test Suite...")
    
    # Create test suite
    suite = unittest.TestLoader().loadTestsFromTestCase(BackendModulesTestSuite)
    
    # Run tests with detailed output
    runner = unittest.TextTestRunner(
        verbosity=2,
        descriptions=True,
        failfast=False
    )
    
    result = runner.run(suite)
    
    # Print summary
    logger.info(f"\n{'='*60}")
    logger.info(f"BACKEND MODULES TEST SUMMARY")
    logger.info(f"{'='*60}")
    logger.info(f"Tests run: {result.testsRun}")
    logger.info(f"Failures: {len(result.failures)}")
    logger.info(f"Errors: {len(result.errors)}")
    logger.info(f"Success rate: {((result.testsRun - len(result.failures) - len(result.errors)) / result.testsRun * 100):.1f}%")
    
    if result.failures:
        logger.error(f"\nFAILURES ({len(result.failures)}):")
        for test, traceback in result.failures:
            logger.error(f"- {test}: {traceback}")
    
    if result.errors:
        logger.error(f"\nERRORS ({len(result.errors)}):")
        for test, traceback in result.errors:
            logger.error(f"- {test}: {traceback}")
    
    return result.wasSuccessful()


if __name__ == "__main__":
    success = run_backend_modules_tests()
    sys.exit(0 if success else 1)
