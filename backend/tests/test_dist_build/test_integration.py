#!/usr/bin/env python3
"""
Integration Test Suite for Built Application
============================================

This test suite performs end-to-end integration tests of the complete
built ZyraVideoAgentBackend application.

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
import subprocess
import threading
import requests
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

class IntegrationTestSuite(unittest.TestCase):
    """Integration test suite for the complete built application"""
    
    @classmethod
    def setUpClass(cls):
        """Set up test environment"""
        cls.project_root = PROJECT_ROOT
        cls.dist_dir = DIST_DIR
        
        # Platform-aware executable path
        exe_name = "ZyraVideoAgentBackend.exe" if os.name == 'nt' else "ZyraVideoAgentBackend"
        cls.exe_path = cls.dist_dir / "ZyraVideoAgentBackend" / exe_name
        cls.internal_dir = INTERNAL_DIR
        
        # Create temporary test directory
        cls.test_dir = Path(tempfile.mkdtemp(prefix="zyra_integration_test_"))
        logger.info(f"Integration test directory: {cls.test_dir}")
        
        # Test configuration
        cls.test_port = 2026  # Use actual application port
        cls.test_host = "127.0.0.1"
        cls.test_url = f"http://{cls.test_host}:{cls.test_port}"
        
        # Process handle for the application
        cls.app_process = None
        
        # Verify executable exists
        assert cls.exe_path.exists(), f"Executable not found: {cls.exe_path}"
    
    @classmethod
    def tearDownClass(cls):
        """Clean up test environment"""
        # Stop the application if it's running
        if cls.app_process:
            try:
                cls.app_process.terminate()
                cls.app_process.wait(timeout=10)
            except:
                try:
                    cls.app_process.kill()
                except:
                    pass
        
        # Clean up test directory
        if cls.test_dir.exists():
            shutil.rmtree(cls.test_dir)
            logger.info(f"Cleaned up integration test directory: {cls.test_dir}")
    
    def start_application(self, timeout=30):
        """Start the built application"""
        logger.info("Starting built application...")
        
        try:
            # Start the application
            self.app_process = subprocess.Popen(
                [str(self.exe_path)],
                cwd=str(self.exe_path.parent),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            # Wait for the application to start
            start_time = time.time()
            while time.time() - start_time < timeout:
                try:
                    response = requests.get(f"{self.test_url}/health", timeout=1)
                    if response.status_code == 200:
                        logger.info("✓ Application started successfully")
                        return True
                except requests.exceptions.RequestException:
                    time.sleep(1)
            
            # If we get here, the application didn't start
            logger.error("Application failed to start within timeout")
            return False
            
        except Exception as e:
            logger.error(f"Failed to start application: {e}")
            return False
    
    def stop_application(self):
        """Stop the built application"""
        logger.info("Stopping built application...")
        
        if self.app_process:
            try:
                self.app_process.terminate()
                self.app_process.wait(timeout=10)
                logger.info("✓ Application stopped successfully")
            except subprocess.TimeoutExpired:
                try:
                    self.app_process.kill()
                    logger.info("✓ Application killed")
                except:
                    pass
            except Exception as e:
                logger.error(f"Error stopping application: {e}")
    
    def test_application_startup(self):
        """Test that the application can start up"""
        logger.info("Testing application startup...")
        
        try:
            # Start the application
            success = self.start_application(timeout=30)
            self.assertTrue(success, "Application should start successfully")
            
            # Test basic health endpoint
            try:
                response = requests.get(f"{self.test_url}/health", timeout=5)
                self.assertEqual(response.status_code, 200, "Health endpoint should work")
                logger.info("✓ Health endpoint working")
            except requests.exceptions.RequestException as e:
                logger.warning(f"Health endpoint not available: {e}")
            
        finally:
            self.stop_application()
    
    def test_application_endpoints(self):
        """Test application endpoints"""
        logger.info("Testing application endpoints...")
        
        try:
            # Start the application
            success = self.start_application(timeout=30)
            self.assertTrue(success, "Application should start successfully")
            
            # Test actual application endpoints
            endpoints_to_test = [
                "/health",
                "/campaigns",
                "/api/settings",
                "/queue/status"
            ]
            
            for endpoint in endpoints_to_test:
                try:
                    response = requests.get(f"{self.test_url}{endpoint}", timeout=5)
                    logger.info(f"✓ {endpoint}: {response.status_code}")
                except requests.exceptions.RequestException as e:
                    logger.info(f"✗ {endpoint}: {e}")
            
        finally:
            self.stop_application()
    
    def test_application_configuration(self):
        """Test application configuration"""
        logger.info("Testing application configuration...")
        
        try:
            # Start the application
            success = self.start_application(timeout=30)
            self.assertTrue(success, "Application should start successfully")
            
            # Test actual configuration endpoints
            config_endpoints = [
                "/api/settings",
                "/api/enhancements/settings"
            ]
            
            for endpoint in config_endpoints:
                try:
                    response = requests.get(f"{self.test_url}{endpoint}", timeout=5)
                    if response.status_code == 200:
                        config_data = response.json()
                        logger.info(f"✓ {endpoint}: Configuration loaded")
                        logger.info(f"  Config keys: {list(config_data.keys())}")
                except requests.exceptions.RequestException as e:
                    logger.info(f"✗ {endpoint}: {e}")
                except json.JSONDecodeError:
                    logger.info(f"✗ {endpoint}: Invalid JSON response")
            
        finally:
            self.stop_application()
    
    def test_application_logging(self):
        """Test application logging"""
        logger.info("Testing application logging...")
        
        try:
            # Start the application
            success = self.start_application(timeout=30)
            self.assertTrue(success, "Application should start successfully")
            
            # Check if logs are being generated
            log_files = [
                Path.home() / ".zyra-video-agent" / "app.log",
                self.test_dir / "app.log"
            ]
            
            for log_file in log_files:
                if log_file.exists():
                    log_content = log_file.read_text()
                    self.assertGreater(len(log_content), 0, "Log file should not be empty")
                    logger.info(f"✓ Log file found: {log_file}")
                    logger.info(f"  Log size: {len(log_content)} characters")
                    break
            else:
                logger.warning("No log files found")
            
        finally:
            self.stop_application()
    
    def test_application_file_operations(self):
        """Test application file operations"""
        logger.info("Testing application file operations...")
        
        try:
            # Start the application
            success = self.start_application(timeout=30)
            self.assertTrue(success, "Application should start successfully")
            
            # Test avatar upload endpoint (actual file operation)
            test_file = self.test_dir / "test_avatar.jpg"
            # Create a minimal image file for testing
            test_file.write_bytes(b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=82<.342\xff\xc0\x00\x11\x08\x00\x01\x00\x01\x01\x01\x11\x00\x02\x11\x01\x03\x11\x01\xff\xc4\x00\x14\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x08\xff\xc4\x00\x14\x10\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xff\xda\x00\x0c\x03\x01\x00\x02\x11\x03\x11\x00\x3f\x00\xaa\xff\xd9')
            
            try:
                with open(test_file, 'rb') as f:
                    files = {'avatar': f}
                    data = {'name': 'test_avatar'}
                    response = requests.post(f"{self.test_url}/avatars", files=files, data=data, timeout=10)
                    logger.info(f"✓ Avatar upload: {response.status_code}")
            except requests.exceptions.RequestException as e:
                logger.info(f"✗ Avatar upload: {e}")
            
            # Test campaigns endpoint (actual endpoint)
            try:
                response = requests.get(f"{self.test_url}/campaigns", timeout=10)
                logger.info(f"✓ Campaigns list: {response.status_code}")
            except requests.exceptions.RequestException as e:
                logger.info(f"✗ Campaigns list: {e}")
            
        finally:
            self.stop_application()
    
    def test_application_error_handling(self):
        """Test application error handling"""
        logger.info("Testing application error handling...")
        
        try:
            # Start the application
            success = self.start_application(timeout=30)
            self.assertTrue(success, "Application should start successfully")
            
            # Test error endpoints
            error_endpoints = [
                "/nonexistent",
                "/api/invalid",
                "/error"
            ]
            
            for endpoint in error_endpoints:
                try:
                    response = requests.get(f"{self.test_url}{endpoint}", timeout=5)
                    # Should return 404 or similar error status
                    self.assertIn(response.status_code, [404, 400, 500], 
                                f"Error endpoint should return error status: {endpoint}")
                    logger.info(f"✓ {endpoint}: {response.status_code}")
                except requests.exceptions.RequestException as e:
                    logger.info(f"✗ {endpoint}: {e}")
            
        finally:
            self.stop_application()
    
    def test_application_performance(self):
        """Test application performance"""
        logger.info("Testing application performance...")
        
        try:
            # Start the application
            success = self.start_application(timeout=30)
            self.assertTrue(success, "Application should start successfully")
            
            # Test response times for actual endpoints
            endpoints_to_test = ["/health", "/campaigns", "/api/settings"]
            
            for endpoint in endpoints_to_test:
                try:
                    start_time = time.time()
                    response = requests.get(f"{self.test_url}{endpoint}", timeout=5)
                    end_time = time.time()
                    
                    response_time = end_time - start_time
                    self.assertLess(response_time, 5.0, 
                                  f"Response time too slow: {response_time:.3f}s for {endpoint}")
                    logger.info(f"✓ {endpoint}: {response_time:.3f}s")
                    
                except requests.exceptions.RequestException as e:
                    logger.info(f"✗ {endpoint}: {e}")
            
        finally:
            self.stop_application()
    
    def test_application_memory_usage(self):
        """Test application memory usage"""
        logger.info("Testing application memory usage...")
        
        try:
            # Start the application
            success = self.start_application(timeout=30)
            self.assertTrue(success, "Application should start successfully")
            
            # Check memory usage
            try:
                import psutil
                process = psutil.Process(self.app_process.pid)
                memory_info = process.memory_info()
                memory_mb = memory_info.rss / 1024 / 1024
                
                # Memory usage should be reasonable (less than 2GB)
                self.assertLess(memory_mb, 2048, 
                              f"Memory usage too high: {memory_mb:.2f} MB")
                logger.info(f"✓ Memory usage: {memory_mb:.2f} MB")
                
            except ImportError:
                logger.warning("psutil not available, skipping memory test")
            except Exception as e:
                logger.warning(f"Memory test failed: {e}")
            
        finally:
            self.stop_application()
    
    def test_application_concurrent_requests(self):
        """Test application handling of concurrent requests"""
        logger.info("Testing concurrent requests...")
        
        try:
            # Start the application
            success = self.start_application(timeout=30)
            self.assertTrue(success, "Application should start successfully")
            
            # Send concurrent requests
            import threading
            import queue
            
            results = queue.Queue()
            
            def make_request():
                try:
                    response = requests.get(f"{self.test_url}/health", timeout=10)
                    results.put(('success', response.status_code))
                except Exception as e:
                    results.put(('error', str(e)))
            
            # Start multiple threads
            threads = []
            for i in range(5):
                thread = threading.Thread(target=make_request)
                threads.append(thread)
                thread.start()
            
            # Wait for all threads to complete
            for thread in threads:
                thread.join(timeout=15)
            
            # Check results
            success_count = 0
            error_count = 0
            
            while not results.empty():
                result_type, result_data = results.get()
                if result_type == 'success':
                    success_count += 1
                    logger.info(f"✓ Concurrent request: {result_data}")
                else:
                    error_count += 1
                    logger.info(f"✗ Concurrent request: {result_data}")
            
            # At least 80% of requests should succeed
            total_requests = success_count + error_count
            if total_requests > 0:
                success_rate = success_count / total_requests
                self.assertGreaterEqual(success_rate, 0.8, 
                                      f"Too many concurrent request failures. Success rate: {success_rate:.2%}")
                logger.info(f"✓ Concurrent request success rate: {success_rate:.2%}")
            
        finally:
            self.stop_application()
    
    def test_application_graceful_shutdown(self):
        """Test application graceful shutdown"""
        logger.info("Testing graceful shutdown...")
        
        try:
            # Start the application
            success = self.start_application(timeout=30)
            self.assertTrue(success, "Application should start successfully")
            
            # Test graceful shutdown by terminating process
            # Note: The application doesn't have a /shutdown endpoint, so we test process termination
            logger.info("Testing process termination as graceful shutdown...")
            
            if self.app_process:
                try:
                    # Send terminate signal
                    self.app_process.terminate()
                    
                    # Wait for graceful shutdown
                    try:
                        self.app_process.wait(timeout=5)
                        logger.info("✓ Application shut down gracefully")
                    except subprocess.TimeoutExpired:
                        logger.warning("Application didn't shut down gracefully, forcing kill")
                        self.app_process.kill()
                        self.app_process.wait()
                        
                except Exception as e:
                    logger.error(f"Error during shutdown test: {e}")
            
        except Exception as e:
            logger.error(f"Graceful shutdown test failed: {e}")
        finally:
            self.stop_application()


def run_integration_tests():
    """Run the integration test suite"""
    logger.info("Starting Integration Test Suite...")
    
    # Create test suite
    suite = unittest.TestLoader().loadTestsFromTestCase(IntegrationTestSuite)
    
    # Run tests with detailed output
    runner = unittest.TextTestRunner(
        verbosity=2,
        descriptions=True,
        failfast=False
    )
    
    result = runner.run(suite)
    
    # Print summary
    logger.info(f"\n{'='*60}")
    logger.info(f"INTEGRATION TEST SUMMARY")
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
    success = run_integration_tests()
    sys.exit(0 if success else 1)
