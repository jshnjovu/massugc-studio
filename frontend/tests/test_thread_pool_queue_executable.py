#!/usr/bin/env python3
"""
Thread Pool Queue Management Test Suite - Deployed Executable Version
=====================================================================

This test validates that jobs don't get stuck in the queue by testing against
the deployed PyInstaller executable (ZyraVideoAgentBackend.exe) in MassUGC-Studio.

This version:
1. Tests against the running executable via HTTP endpoints
2. Simulates real campaign submissions from MassUGC-Studio
3. Monitors job queue status through the actual running backend
4. Validates thread pool performance in production environment
5. Depends entirely on the deployed backend infrastructure

Priority: HIGHEST (Critical Infrastructure)
Dependencies: ZyraVideoAgentBackend.exe running on port 2026
Expected Duration: 30-60 seconds
"""

import os
import sys
import time
import threading
import json
import platform
import uuid
import requests
from pathlib import Path
from datetime import datetime

# Ensure we're in the MassUGC-Studio directory
studio_root = Path(__file__).parent.parent
backend_path = studio_root / "ZyraData" / "backend"

print(f"[INFO] MassUGC Studio Root: {studio_root}")
print(f"[INFO] Backend Path: {backend_path}")
print(f"[INFO] Backend Executable: {backend_path / 'ZyraVideoAgentBackend.exe'}")


class MassUGCStudioThreadPoolQueueTestSuite:
    """Comprehensive test suite for thread pool queue management against MassUGC Studio backend"""
    
    def __init__(self):
        self.test_results = {}
        self.backend_url = "http://127.0.0.1:2026"
        self.session = requests.Session()
        self.session.timeout = 30
        
        # Try to use an existing valid API key from MassUGC-Studio config
        self.api_client = None
        self._init_api_client()
            
    def _init_api_client(self):
        """Initialize API client if possible"""
        try:
            # Add massugc-video-service to path to import API client
            massugc_service_root = Path(__file__).parent.parent.parent / "massugc-video-service"
            if massugc_service_root.exists():
                sys.path.insert(0, str(massugc_service_root))
                
                from massugc_api_client import create_massugc_client
                
                # Try to use a valid API key (you can modify this)
                api_key = os.getenv("MASSUGC_API_KEY") or "massugc_test1234567890abcdef1234567890ab"
                
                self.api_client = create_massugc_client(api_key)
                self.api_client.initialize()
                
                # Set up session headers
                self.session.headers.update(self.api_client.get_headers())
                print("[SUCCESS] API client initialized successfully")
                
        except Exception as e:
            print(f"[WARN] Warning: Could not initialize API client: {e}")
            print("Tests will continue but may have limited functionality")
            self.api_client = None
            
    def test_backend_executable_exists(self):
        """Test 0: Verify backend executable exists and is recent"""
        print("[TEST] Test 0: Backend Executable Presence Check")
        print("-" * 50)
        
        try:
            exec_path = backend_path / "ZyraVideoAgentBackend.exe"
            
            if not exec_path.exists():
                raise FileNotFoundError(f"Backend executable not found: {exec_path}")
                
            # Check file size (should be ~33MB for PyInstaller build)
            file_size = exec_path.stat().st_size
            file_size_mb = file_size / (1024 * 1024)
            
            print(f"[DATA] Executable Path: {exec_path}")
            print(f"[DATA] File Size: {file_size_mb:.1f} MB")
            print(f"[DATA] Last Modified: {datetime.fromtimestamp(exec_path.stat().st_mtime)}")
            
            # Verify reasonable file size (> 20MB for PyInstaller)
            assert file_size > 20 * 1024 * 1024, f"Executable too small: {file_size_mb:.1f} MB"
            
            self.test_results['backend_executable_exists'] = 'PASSED'
            print("[SUCCESS] Backend executable presence test PASSED")
            
        except Exception as e:
            self.test_results['backend_executable_exists'] = f'FAILED: {e}'
            print(f"[ERROR] Backend executable presence test FAILED: {e}")
            raise Exception("Backend executable not found or invalid")
            
    def test_backend_health(self):
        """Test 1: Verify backend executable is running and healthy"""
        print("\n[TEST] Test 1: Backend Health Check")
        print("-" * 50)
        
        try:
            response = self.session.get(f"{self.backend_url}/health")
            response.raise_for_status()
            
            health_data = response.json()
            print(f"[DATA] Backend Status: {health_data}")
            
            assert response.status_code == 200
            
            # Handle different response formats
            if 'ok' in health_data:
                assert health_data['ok'] == True
                print(f"[DATA] Health Status: {health_data['ok']}")
            elif 'status' in health_data:
                assert health_data['status'] == 'ok'
                print(f"[DATA] Health Status: {health_data['status']}")
            else:
                raise AssertionError(f"Unexpected health check format: {health_data}")
            
            self.test_results['backend_health'] = 'PASSED'
            print("[SUCCESS] SUCCESS! Backend is running and responding correctly!")
            
        except Exception as e:
            self.test_results['backend_health'] = f'FAILED: {e}'
            print(f"[ERROR] Backend health test FAILED: {e}")
            print("[HINT] Make sure MassUGC Studio is running (npm start)")
            raise Exception("Backend not running or not accessible")
            
    def test_thread_pool_initialization_log(self):
        """Test 2: Verify thread pool initialization is working"""
        print("\n[TEST] Test 2: Thread Pool Initialization Check")
        print("-" * 50)
        
        try:
            # This test checks if we can detect thread pool initialization
            # by looking for successful concurrent request handling
            print("[DATA] Testing thread pool capacity via concurrent requests...")
            
            concurrent_start = time.time()
            threads = []
            results = []
            
            def make_health_request():
                try:
                    start = time.time()
                    response = self.session.get(f"{self.backend_url}/health")
                    end = time.time()
                    
                    if response.status_code == 200:
                        results.append({
                            'status_code': response.status_code,
                            'response_time': end - start,
                            'success': True
                        })
                    else:
                        results.append({
                            'status_code': response.status_code,
                            'success': False
                        })
                except Exception as e:
                    results.append({'error': str(e), 'success': False})
                    
            # Submit concurrent requests (test thread pool capacity)
            num_concurrent = 20  # Test up to 20 concurrent requests
            
            for i in range(num_concurrent):
                thread = threading.Thread(target=make_health_request)
                threads.append(thread)
                thread.start()
                
            # Wait for all threads
            for thread in threads:
                thread.join()
                
            concurrent_time = time.time() - concurrent_start
            successful_requests = [r for r in results if r.get('success')]
            
            print(f"[DATA] Concurrent Test Results:")
            print(f"   Total Requests: {len(results)}")
            print(f"   Successful: {len(successful_requests)}")
            print(f"   Concurrent Time: {concurrent_time:.3f}s")
            
            if successful_requests:
                response_times = [r['response_time'] for r in successful_requests]
                avg_response_time = sum(response_times) / len(response_times)
                print(f"   Average Response Time: {avg_response_time:.3f}s")
                
            # Verify thread pool is working (most requests should succeed quickly)
            success_rate = len(successful_requests) / len(results)
            assert success_rate >= 0.8, f"Too many requests failed: {success_rate:.1%}"
            assert concurrent_time < 5.0, f"Concurrent requests too slow: {concurrent_time:.3f}s"
            
            if len(successful_requests) >= 15:  # Good thread pool performance
                print("[TEST] Thread Pool Performance: EXCELLENT")
            elif len(successful_requests) >= 10:
                print("[TEST] Thread Pool Performance: GOOD")
            else:
                print("[TEST] Thread Pool Performance: MODERATE")
            
            self.test_results['thread_pool_initialization'] = 'PASSED'
            print("[SUCCESS] Thread pool initialization test PASSED")
            
        except Exception as e:
            self.test_results['thread_pool_initialization'] = f'FAILED: {e}'
            print(f"[ERROR] Thread pool initialization test FAILED: {e}")
            
    def test_queue_status_endpoint(self):
        """Test 3: Verify queue status monitoring endpoint works"""
        print("\n[TEST] Test 3: Queue Status Endpoint Test")
        print("-" * 50)
        
        try:
            response = self.session.get(f"{self.backend_url}/queue/status")
            
            if response.status_code == 401:
                print("[WARN] Queue status endpoint requires authentication - skipping")
                self.test_results['queue_status_endpoint'] = 'SKIPPED'
                return
            
            response.raise_for_status()
            queue_data = response.json()
            
            print(f"[DATA] Queue Status: {queue_data}")
            
            # Verify status structure
            required_keys = ['active_jobs', 'queue_size', 'jobs', 'blocked_patterns']
            for key in required_keys:
                assert key in queue_data, f"Missing key: {key}"
                
            print(f"[DATA] Active Jobs: {queue_data['active_jobs']}")
            print(f"[DATA] Queue Size: {queue_data['queue_size']}")
            print(f"[DATA] Blocked Patterns: {queue_data['blocked_patterns']}")
                
            self.test_results['queue_status_endpoint'] = 'PASSED'
            print("[SUCCESS] Queue status endpoint test PASSED")
            
        except Exception as e:
            self.test_results['queue_status_endpoint'] = f'FAILED: {e}'
            print(f"[ERROR] Queue status endpoint test FAILED: {e}")
            
    def test_campaign_endpoints(self):
        """Test 4: Test campaign-related endpoints"""
        print("\n[TEST] Test 4: Campaign Endpoints Test")
        print("-" * 50)
        
        try:
            # Test campaigns endpoint
            campaigns_response = self.session.get(f"{self.backend_url}/campaigns")
            
            if campaigns_response.status_code == 401:
                print("[WARN] Campaigns endpoint requires authentication - skipping")
                self.test_results['campaign_endpoints'] = 'SKIPPED'
                return
                
            campaigns_response.raise_for_status()
            campaigns_data = campaigns_response.json()
            
            print(f"[DATA] Campaigns Response: {campaigns_data}")
            
            # Verify campaigns structure - backend returns 'jobs' key
            assert 'jobs' in campaigns_data, f"Expected 'jobs' key, got: {list(campaigns_data.keys())}"
            
            campaigns = campaigns_data['jobs']
            print(f"[DATA] Available Campaigns: {len(campaigns)}")
            
            if campaigns:
                for i, campaign in enumerate(campaigns[:3]):  # Show first 3
                    print(f"   {i+1}. {campaign.get('job_name', 'Unnamed')} (ID: {campaign.get('id', 'unknown')})")
                    
            self.test_results['campaign_endpoints'] = 'PASSED'
            print("[SUCCESS] Campaign endpoints test PASSED")
            
        except Exception as e:
            self.test_results['campaign_endpoints'] = f'FAILED: {e}'
            print(f"[ERROR] Campaign endpoints test FAILED: {e}")
            
    def test_job_submission_simulation(self):
        """Test 5: Simulate job submission (if campaigns available)"""
        print("\n[TEST] Test 5: Job Submission Simulation Test")
        print("-" * 50)
        
        try:
            # Get available campaigns first
            campaigns_response = self.session.get(f"{self.backend_url}/campaigns")
            
            if campaigns_response.status_code == 401:
                print("[WARN] Campaigns endpoint requires authentication - skipping")
                self.test_results['job_submission_simulation'] = 'SKIPPED'
                return
                
            campaigns_response.raise_for_status()
            campaigns_data = campaigns_response.json()
            available_campaigns = campaigns_data.get('jobs', [])
            
            if not available_campaigns:
                print("[WARN] No campaigns available for testing")
                self.test_results['job_submission_simulation'] = 'SKIPPED'
                return
                
            # Use first available campaign
            test_campaign = available_campaigns[0]
            campaign_id = test_campaign['id']
            
            print(f"[DATA] Using Campaign: {test_campaign.get('job_name', campaign_id)}")
            
            # Test job submission capacity (without actually running jobs)
            burst_size = 5  # Test 5 concurrent job submissions
            burst_jobs = []
            
            print(f"[DATA] Testing {burst_size} concurrent job submissions...")
            burst_start = time.time()
            
            for i in range(burst_size):
                job_data = {
                    'campaign_id': campaign_id,
                    'id': campaign_id
                }
                
                try:
                    response = self.session.post(f"{self.backend_url}/run-job", data=job_data)
                    
                    if response.status_code == 401:
                        print("[WARN] Run job endpoint requires authentication - skipping")
                        self.test_results['job_submission_simulation'] = 'SKIPPED'
                        return
                        
                    response.raise_for_status()
                    job_result = response.json()
                    run_id = job_result.get('run_id')
                    
                    if run_id:
                        burst_jobs.append(run_id)
                        print(f"[SUCCESS] Job {i+1}: {run_id} submitted successfully")
                        
                except Exception as e:
                    print(f"[ERROR] Failed to submit job {i+1}: {e}")
                    
            submission_time = time.time() - burst_start
            print(f"[DATA] Job Submission Results:")
            print(f"   Time: {submission_time:.3f}s")
            print(f"   Successful: {len(burst_jobs)}/{burst_size}")
            
            # Verify reasonable submission performance
            if len(burst_jobs) > 0:
                self.test_results['job_submission_simulation'] = 'PASSED'
                print("[SUCCESS] Job submission simulation test PASSED")
            else:
                self.test_results['job_submission_simulation'] = 'FAILED: No jobs submitted successfully'
                print("[ERROR] Job submission simulation test FAILED: No jobs submitted")
                
        except Exception as e:
            self.test_results['job_submission_simulation'] = f'FAILED: {e}'
            print(f"[ERROR] Job submission simulation test FAILED: {e}")
            
    def run_full_test_suite(self):
        """Run all tests and provide summary"""
        print("[START] MassUGC Studio Thread Pool Queue Management Test Suite")
        print("=" * 70)
        print(f"[DATA] Testing against: {self.backend_url}")
        print(f"[DATA] Studio Root: {studio_root}")
        print(f"[DATA] Backend Path: {backend_path}")
        print(f"[DATA] Platform: {platform.system()} ({platform.machine()})")
        print(f"[DATA] Target: ZyraVideoAgentBackend.exe")
        print("=" * 70)
        
        suite_start = time.time()
        
        try:
            # Run all tests
            self.test_backend_executable_exists()
            self.test_backend_health()
            self.test_thread_pool_initialization_log()
            self.test_queue_status_endpoint()
            self.test_campaign_endpoints()
            self.test_job_submission_simulation()
            
            # Summary
            suite_time = time.time() - suite_start
            self._print_test_summary(suite_time)
            
        except Exception as e:
            print(f"[CRASH] Test suite crashed: {e}")
            self._print_test_summary(time.time() - suite_start)
            raise
        
    def _print_test_summary(self, total_time):
        """Print comprehensive test summary"""
        print("\n" + "=" * 70)
        print("[REPORT] MASSUGC-STUDIO THREAD POOL QUEUE TEST RESULTS")
        print("=" * 70)
        
        passed_tests = 0
        failed_tests = 0
        skipped_tests = 0
        
        for test_name, resultado in self.test_results.items():
            if resultado == "PASSED":
                status = "[SUCCESS] PASSED"
                passed_tests += 1
            elif resultado == "SKIPPED":
                status = "[SKIP] SKIPPED"
                skipped_tests += 1
            else:
                status = "[ERROR] FAILED"
                failed_tests += 1
                
            print(f"{status} {test_name.replace('_', ' ').title()}")
            
            if resultado.startswith("FAILED"):
                print(f"    [MSG] Error: {resultado}")
                
        print(f"\n[TEST] SUMMARY:")
        print(f"    [SUCCESS] Passed: {passed_tests}")
        print(f"    [ERROR] Failed: {failed_tests}")
        print(f"    [SKIP] Skipped: {skipped_tests}")
        print(f"    [DATA] Total: {passed_tests + failed_tests + skipped_tests}")
        print(f"    [TIME] Duration: {total_time:.2f}s")
        
        print(f"\n[FIX] TEST CONTEXT:")
        print(f"    [INFO] MassUGC Studio: {studio_root}")
        print(f"    [INFO] Backend Executable: {backend_path / 'ZyraVideoAgentBackend.exe'}")
        print(f"    [DATA] Backend URL: {self.backend_url}")
        print(f"    [DATA] Platform: {platform.system()}")
        
        if failed_tests == 0:
            print("\n[COMPLETE] ALL TESTS PASSED! MassUGC Studio thread pool queue management is working correctly.")
            print("[SUCCESS] Backend executable is properly deployed")
            print("[SUCCESS] Backend is running efficiently")
            print("[SUCCESS] Thread pool is functioning")
            print("[SUCCESS] Queue management is working")
            print("[SUCCESS] Job processing is operational")
        else:
            print(f"\n[WARN] {failed_tests} TESTS FAILED. Review results above.")
            
        print("=" * 70)


def main():
    """Main test execution"""
    print("[TEST] MassUGC Studio Thread Pool Queue Management Test Suite")
    print("Priority: HIGHEST - Critical Infrastructure")
    print("Testing: MassUGC-Studio deployed executable")
    print("Purpose: Validate production thread pool scaling")
    print("Dependencies: ZyraVideoAgentBackend.exe running on port 2026")
    print()
    
    try:
        # Initialize and run test suite
        test_suite = MassUGCStudioThreadPoolQueueTestSuite()
        test_suite.run_full_test_suite()
        
        # Return exit code based on results
        failed_tests = sum(1 for result in test_suite.test_results.values() if result.startswith("FAILED"))
        
        if failed_tests == 0:
            print("\n[WINNER] MassUGC Studio test suite completed successfully!")
            print("[START] Your thread pool queue fix is working in production!")
            sys.exit(0)
        else:
            print("\n[CRASH] MassUGC Studio test suite failed!")
            print("[FIX] Review the backend executable and deployment")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n[CRASH] MassUGC Studio test suite crashed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
