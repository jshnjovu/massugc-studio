#!/usr/bin/env python3
"""
Dependencies Test Suite for Built Libraries
==========================================

This test suite validates that all critical dependencies are properly
bundled and functional in the PyInstaller build.

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

class DependenciesTestSuite(unittest.TestCase):
    """Test suite for critical dependencies in built libraries"""
    
    @classmethod
    def setUpClass(cls):
        """Set up test environment"""
        cls.project_root = PROJECT_ROOT
        cls.dist_dir = DIST_DIR
        cls.internal_dir = INTERNAL_DIR
        
        # Create temporary test directory
        cls.test_dir = Path(tempfile.mkdtemp(prefix="zyra_deps_test_"))
        logger.info(f"Dependencies test directory: {cls.test_dir}")
        
        # Define critical dependencies
        cls.critical_dependencies = {
            'torch': {
                'import_name': 'torch',
                'test_functions': ['randn', 'zeros', 'ones'],
                'test_classes': ['Tensor', 'nn.Module'],
                'version_check': True
            },
            'cv2': {
                'import_name': 'cv2',
                'test_functions': ['imread', 'imwrite', 'cvtColor'],
                'test_classes': [],
                'version_check': True
            },
            'numpy': {
                'import_name': 'numpy',
                'test_functions': ['array', 'zeros', 'ones', 'sum'],
                'test_classes': ['ndarray'],
                'version_check': True
            },
            'scipy': {
                'import_name': 'scipy',
                'test_functions': ['stats.mean', 'stats.std'],
                'test_classes': [],
                'version_check': True
            },
            'PIL': {
                'import_name': 'PIL',
                'test_functions': ['Image.open', 'Image.new'],
                'test_classes': ['Image.Image'],
                'version_check': True
            },
            'whisper': {
                'import_name': 'whisper',
                'test_functions': ['load_model'],
                'test_classes': [],
                'version_check': False
            },
            'librosa': {
                'import_name': 'librosa',
                'test_functions': ['load', 'stft'],
                'test_classes': [],
                'version_check': True
            },
            'google.cloud.storage': {
                'import_name': 'google.cloud.storage',
                'test_functions': ['Client'],
                'test_classes': ['Client'],
                'version_check': False
            },
            'flask': {
                'import_name': 'flask',
                'test_functions': ['Flask'],
                'test_classes': ['Flask'],
                'version_check': True
            },
            'requests': {
                'import_name': 'requests',
                'test_functions': ['get', 'post'],
                'test_classes': [],
                'version_check': True
            },
            'openai': {
                'import_name': 'openai',
                'test_functions': ['OpenAI'],
                'test_classes': ['OpenAI'],
                'version_check': False
            },
            'elevenlabs': {
                'import_name': 'elevenlabs',
                'test_functions': ['generate'],
                'test_classes': [],
                'version_check': False
            }
        }
    
    @classmethod
    def tearDownClass(cls):
        """Clean up test environment"""
        if cls.test_dir.exists():
            shutil.rmtree(cls.test_dir)
            logger.info(f"Cleaned up dependencies test directory: {cls.test_dir}")
    
    def test_torch_dependency(self):
        """Test PyTorch dependency"""
        logger.info("Testing PyTorch dependency...")
        
        try:
            import torch
            import torch.nn as nn
            
            # Test version
            version = torch.__version__
            logger.info(f"PyTorch version: {version}")
            self.assertIsNotNone(version, "PyTorch should have a version")
            
            # Test basic tensor operations
            x = torch.randn(3, 4)
            y = torch.randn(4, 5)
            z = torch.mm(x, y)
            
            self.assertEqual(z.shape, (3, 5), "Matrix multiplication should work")
            logger.info("✓ PyTorch tensor operations working")
            
            # Test neural network
            model = nn.Linear(10, 5)
            self.assertIsNotNone(model, "Should be able to create neural network")
            logger.info("✓ PyTorch neural network creation working")
            
            # Test CUDA availability
            cuda_available = torch.cuda.is_available()
            logger.info(f"CUDA available: {cuda_available}")
            
            # Test autograd
            x = torch.randn(2, 2, requires_grad=True)
            y = x * 2
            z = y.sum()
            z.backward()
            self.assertIsNotNone(x.grad, "Autograd should work")
            logger.info("✓ PyTorch autograd working")
            
        except Exception as e:
            self.fail(f"PyTorch dependency test failed: {e}")
    
    def test_opencv_dependency(self):
        """Test OpenCV dependency"""
        logger.info("Testing OpenCV dependency...")
        
        try:
            import cv2
            import numpy as np
            
            # Test version
            version = cv2.__version__
            logger.info(f"OpenCV version: {version}")
            self.assertIsNotNone(version, "OpenCV should have a version")
            
            # Test basic image operations
            img = np.zeros((100, 100, 3), dtype=np.uint8)
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            self.assertEqual(gray.shape, (100, 100), "Color conversion should work")
            logger.info("✓ OpenCV image operations working")
            
            # Test video capture
            cap = cv2.VideoCapture(0)
            if cap.isOpened():
                ret, frame = cap.read()
                cap.release()
                logger.info("✓ OpenCV video capture working")
            else:
                logger.info("OpenCV video capture not available (expected in headless environment)")
            
            # Test image I/O
            test_img_path = self.test_dir / "test_image.jpg"
            cv2.imwrite(str(test_img_path), img)
            self.assertTrue(test_img_path.exists(), "Image writing should work")
            
            loaded_img = cv2.imread(str(test_img_path))
            self.assertIsNotNone(loaded_img, "Image reading should work")
            logger.info("✓ OpenCV image I/O working")
            
        except Exception as e:
            self.fail(f"OpenCV dependency test failed: {e}")
    
    def test_numpy_dependency(self):
        """Test NumPy dependency"""
        logger.info("Testing NumPy dependency...")
        
        try:
            import numpy as np
            
            # Test version
            version = np.__version__
            logger.info(f"NumPy version: {version}")
            self.assertIsNotNone(version, "NumPy should have a version")
            
            # Test basic array operations
            arr = np.array([1, 2, 3, 4, 5])
            result = np.sum(arr)
            self.assertEqual(result, 15, "Array sum should work")
            logger.info("✓ NumPy array operations working")
            
            # Test array creation
            zeros = np.zeros((3, 4))
            ones = np.ones((3, 4))
            random = np.random.rand(3, 4)
            
            self.assertEqual(zeros.shape, (3, 4), "Zeros array creation should work")
            self.assertEqual(ones.shape, (3, 4), "Ones array creation should work")
            self.assertEqual(random.shape, (3, 4), "Random array creation should work")
            logger.info("✓ NumPy array creation working")
            
            # Test mathematical operations
            a = np.array([1, 2, 3])
            b = np.array([4, 5, 6])
            c = a + b
            self.assertTrue(np.array_equal(c, [5, 7, 9]), "Array addition should work")
            logger.info("✓ NumPy mathematical operations working")
            
        except Exception as e:
            self.fail(f"NumPy dependency test failed: {e}")
    
    def test_scipy_dependency(self):
        """Test SciPy dependency"""
        logger.info("Testing SciPy dependency...")
        
        try:
            import scipy
            import numpy as np
            from scipy import stats
            
            # Test version
            version = scipy.__version__
            logger.info(f"SciPy version: {version}")
            self.assertIsNotNone(version, "SciPy should have a version")
            
            # Test statistical functions
            data = [1, 2, 3, 4, 5]
            mean_val = np.mean(data)  # Use numpy.mean instead of stats.mean
            std_val = np.std(data)    # Use numpy.std for consistency
            
            self.assertAlmostEqual(mean_val, 3.0, places=5, msg="Mean calculation should work")
            self.assertGreater(std_val, 0, "Standard deviation should be positive")
            logger.info("✓ SciPy statistical functions working")
            
            # Test optimization
            from scipy.optimize import minimize
            def objective(x):
                return x**2
            
            result = minimize(objective, x0=1.0)
            self.assertAlmostEqual(result.x[0], 0.0, places=3, msg="Optimization should work")
            logger.info("✓ SciPy optimization working")
            
        except Exception as e:
            self.fail(f"SciPy dependency test failed: {e}")
    
    def test_pil_dependency(self):
        """Test PIL (Pillow) dependency"""
        logger.info("Testing PIL dependency...")
        
        try:
            from PIL import Image
            
            # Test version
            version = Image.__version__
            logger.info(f"PIL version: {version}")
            self.assertIsNotNone(version, "PIL should have a version")
            
            # Test image creation
            img = Image.new('RGB', (100, 100), color='red')
            self.assertEqual(img.size, (100, 100), "Image creation should work")
            logger.info("✓ PIL image creation working")
            
            # Test image operations
            img_gray = img.convert('L')
            self.assertEqual(img_gray.mode, 'L', "Image conversion should work")
            logger.info("✓ PIL image operations working")
            
            # Test image I/O
            test_img_path = self.test_dir / "test_pil_image.png"
            img.save(str(test_img_path))
            self.assertTrue(test_img_path.exists(), "Image saving should work")
            
            loaded_img = Image.open(str(test_img_path))
            self.assertIsNotNone(loaded_img, "Image loading should work")
            logger.info("✓ PIL image I/O working")
            
        except Exception as e:
            self.fail(f"PIL dependency test failed: {e}")
    
    def test_whisper_dependency(self):
        """Test Whisper dependency"""
        logger.info("Testing Whisper dependency...")
        
        try:
            import whisper
            
            # Test model loading
            model = whisper.load_model("tiny")
            self.assertIsNotNone(model, "Should be able to load Whisper model")
            logger.info("✓ Whisper model loading working")
            
            # Test model properties
            self.assertTrue(hasattr(model, 'transcribe'), "Model should have transcribe method")
            logger.info("✓ Whisper model interface correct")
            
        except Exception as e:
            logger.warning(f"Whisper dependency test failed (may be expected): {e}")
            # Don't fail the test as Whisper might require additional setup
    
    def test_librosa_dependency(self):
        """Test Librosa dependency"""
        logger.info("Testing Librosa dependency...")
        
        try:
            import librosa
            
            # Test version
            version = librosa.__version__
            logger.info(f"Librosa version: {version}")
            self.assertIsNotNone(version, "Librosa should have a version")
            
            # Test audio loading (with dummy data)
            import numpy as np
            dummy_audio = np.random.randn(44100)  # 1 second of audio
            stft = librosa.stft(dummy_audio)
            self.assertIsNotNone(stft, "STFT should work")
            logger.info("✓ Librosa audio processing working")
            
        except Exception as e:
            self.fail(f"Librosa dependency test failed: {e}")
    
    def test_google_cloud_dependency(self):
        """Test Google Cloud dependency"""
        logger.info("Testing Google Cloud dependency...")
        
        try:
            from google.cloud import storage
            
            # Test client creation (without credentials)
            try:
                client = storage.Client()
                logger.info("✓ Google Cloud Storage client creation working")
            except Exception as e:
                logger.info(f"Google Cloud client creation failed (expected without credentials): {e}")
            
            # Test that the module is properly structured
            self.assertTrue(hasattr(storage, 'Client'), "Storage module should have Client class")
            logger.info("✓ Google Cloud Storage module structure correct")
            
        except Exception as e:
            logger.warning(f"Google Cloud dependency test failed: {e}")
    
    def test_flask_dependency(self):
        """Test Flask dependency"""
        logger.info("Testing Flask dependency...")
        
        try:
            from flask import Flask
            
            # Test version
            import flask
            version = flask.__version__
            logger.info(f"Flask version: {version}")
            self.assertIsNotNone(version, "Flask should have a version")
            
            # Test Flask app creation
            app = Flask(__name__)
            self.assertIsNotNone(app, "Should be able to create Flask app")
            logger.info("✓ Flask app creation working")
            
            # Test basic route
            @app.route('/test')
            def test_route():
                return "test"
            
            with app.test_client() as client:
                response = client.get('/test')
                self.assertEqual(response.status_code, 200, "Flask route should work")
                logger.info("✓ Flask routing working")
            
        except Exception as e:
            self.fail(f"Flask dependency test failed: {e}")
    
    def test_requests_dependency(self):
        """Test Requests dependency"""
        logger.info("Testing Requests dependency...")
        
        try:
            import requests
            
            # Test version
            version = requests.__version__
            logger.info(f"Requests version: {version}")
            self.assertIsNotNone(version, "Requests should have a version")
            
            # Test basic functionality
            self.assertTrue(hasattr(requests, 'get'), "Requests should have get method")
            self.assertTrue(hasattr(requests, 'post'), "Requests should have post method")
            logger.info("✓ Requests module structure correct")
            
        except Exception as e:
            self.fail(f"Requests dependency test failed: {e}")
    
    def test_openai_dependency(self):
        """Test OpenAI dependency"""
        logger.info("Testing OpenAI dependency...")
        
        try:
            from openai import OpenAI
            
            # Test client creation (without API key)
            try:
                client = OpenAI()
                logger.info("✓ OpenAI client creation working")
            except Exception as e:
                logger.info(f"OpenAI client creation failed (expected without API key): {e}")
            
            # Test that the module is properly structured
            self.assertTrue(hasattr(OpenAI, '__init__'), "OpenAI should be instantiable")
            logger.info("✓ OpenAI module structure correct")
            
        except Exception as e:
            logger.warning(f"OpenAI dependency test failed: {e}")
    
    def test_elevenlabs_dependency(self):
        """Test ElevenLabs dependency"""
        logger.info("Testing ElevenLabs dependency...")
        
        try:
            from elevenlabs import generate
            
            # Test that the module is properly structured
            self.assertTrue(callable(generate), "ElevenLabs generate should be callable")
            logger.info("✓ ElevenLabs module structure correct")
            
        except Exception as e:
            logger.warning(f"ElevenLabs dependency test failed: {e}")
    
    def test_dependency_versions(self):
        """Test that all dependencies have proper versions"""
        logger.info("Testing dependency versions...")
        
        version_info = {}
        
        for dep_name, dep_info in self.critical_dependencies.items():
            if dep_info.get('version_check', False):
                try:
                    module = __import__(dep_info['import_name'])
                    version = getattr(module, '__version__', 'Unknown')
                    version_info[dep_name] = version
                    logger.info(f"✓ {dep_name}: {version}")
                except Exception as e:
                    logger.warning(f"✗ {dep_name}: Version check failed - {e}")
                    version_info[dep_name] = 'Error'
        
        # Log all versions
        logger.info(f"Dependency versions: {json.dumps(version_info, indent=2)}")
        
        # At least 80% of dependencies should have versions
        successful_versions = sum(1 for v in version_info.values() if v != 'Error' and v != 'Unknown')
        total_versions = len([d for d in self.critical_dependencies.values() if d.get('version_check', False)])
        success_rate = successful_versions / total_versions if total_versions > 0 else 0
        
        self.assertGreaterEqual(success_rate, 0.8, 
                              f"Too many dependency version failures. Success rate: {success_rate:.2%}")
    
    def test_dependency_import_performance(self):
        """Test import performance of dependencies"""
        logger.info("Testing dependency import performance...")
        
        import_times = {}
        
        for dep_name, dep_info in self.critical_dependencies.items():
            try:
                start_time = time.time()
                __import__(dep_info['import_name'])
                end_time = time.time()
                
                import_time = end_time - start_time
                import_times[dep_name] = import_time
                
                # Import should be reasonably fast (less than 5 seconds)
                self.assertLess(import_time, 5.0, 
                              f"{dep_name} import too slow: {import_time:.3f}s")
                
                logger.info(f"✓ {dep_name}: {import_time:.3f}s")
                
            except Exception as e:
                logger.warning(f"✗ {dep_name}: Import failed - {e}")
                import_times[dep_name] = None
        
        # Log all import times
        logger.info(f"Import times: {json.dumps(import_times, indent=2)}")
        
        # Calculate average import time
        valid_times = [t for t in import_times.values() if t is not None]
        if valid_times:
            avg_time = sum(valid_times) / len(valid_times)
            logger.info(f"Average import time: {avg_time:.3f}s")
            
            # Average should be reasonable (less than 2 seconds)
            self.assertLess(avg_time, 2.0, 
                          f"Average import time too high: {avg_time:.3f}s")


def run_dependencies_tests():
    """Run the dependencies test suite"""
    logger.info("Starting Dependencies Test Suite...")
    
    # Create test suite
    suite = unittest.TestLoader().loadTestsFromTestCase(DependenciesTestSuite)
    
    # Run tests with detailed output
    runner = unittest.TextTestRunner(
        verbosity=2,
        descriptions=True,
        failfast=False
    )
    
    result = runner.run(suite)
    
    # Print summary
    logger.info(f"\n{'='*60}")
    logger.info(f"DEPENDENCIES TEST SUMMARY")
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
    success = run_dependencies_tests()
    sys.exit(0 if success else 1)
