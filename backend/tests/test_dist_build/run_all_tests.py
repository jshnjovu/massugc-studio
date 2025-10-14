#!/usr/bin/env python3
"""
Comprehensive Test Runner for Built Libraries
============================================

This script runs all test suites for the built ZyraVideoAgentBackend
application and its components.

Author: MassUGC Development Team
Version: 1.0.0
"""

import os
import sys
import time
import subprocess
import logging
import platform
from pathlib import Path
from typing import Dict, List, Optional, Any
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class TestRunner:
    """Comprehensive test runner for built libraries"""
    
    def __init__(self):
        self.project_root = Path(__file__).parent.parent.parent  # Go up two levels from test_dist_build/ to project root
        self.test_results = {}
        self.start_time = None
        self.end_time = None
        
        # Define test suites
        self.test_suites = {
            'built_libraries': {
                'file': 'tests/test_dist_build/test_built_libraries.py',
                'description': 'Built Libraries Test Suite',
                'critical': True
            },
            'backend_modules': {
                'file': 'tests/test_dist_build/test_backend_modules.py',
                'description': 'Backend Modules Test Suite',
                'critical': True
            },
            'dependencies': {
                'file': 'tests/test_dist_build/test_dependencies.py',
                'description': 'Dependencies Test Suite',
                'critical': True
            },
            'integration': {
                'file': 'tests/test_dist_build/test_integration.py',
                'description': 'Integration Test Suite',
                'critical': False
            }
        }
    
    def run_test_suite(self, suite_name: str, suite_info: Dict) -> bool:
        """Run a single test suite"""
        logger.info(f"\n{'='*60}")
        logger.info(f"Running {suite_info['description']}")
        logger.info(f"{'='*60}")
        
        test_file = self.project_root / suite_info['file']
        
        if not test_file.exists():
            logger.error(f"Test file not found: {test_file}")
            return False
        
        try:
            # Run the test suite
            result = subprocess.run(
                [sys.executable, str(test_file)],
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout per suite
            )
            
            # Store results
            self.test_results[suite_name] = {
                'success': result.returncode == 0,
                'returncode': result.returncode,
                'stdout': result.stdout,
                'stderr': result.stderr,
                'critical': suite_info['critical']
            }
            
            if result.returncode == 0:
                logger.info(f"✓ {suite_info['description']} PASSED")
            else:
                logger.error(f"✗ {suite_info['description']} FAILED")
                if result.stderr:
                    logger.error(f"Error output: {result.stderr}")
            
            return result.returncode == 0
            
        except subprocess.TimeoutExpired:
            logger.error(f"✗ {suite_info['description']} TIMED OUT")
            self.test_results[suite_name] = {
                'success': False,
                'returncode': -1,
                'stdout': '',
                'stderr': 'Test suite timed out',
                'critical': suite_info['critical']
            }
            return False
            
        except Exception as e:
            logger.error(f"✗ {suite_info['description']} ERROR: {e}")
            self.test_results[suite_name] = {
                'success': False,
                'returncode': -1,
                'stdout': '',
                'stderr': str(e),
                'critical': suite_info['critical']
            }
            return False
    
    def run_all_tests(self) -> bool:
        """Run all test suites"""
        logger.info("Starting Comprehensive Test Suite for Built Libraries")
        logger.info(f"Project root: {self.project_root}")
        
        self.start_time = time.time()
        
        # Run each test suite
        for suite_name, suite_info in self.test_suites.items():
            success = self.run_test_suite(suite_name, suite_info)
            
            # If a critical test fails, we can choose to continue or stop
            if not success and suite_info['critical']:
                logger.warning(f"Critical test suite failed: {suite_name}")
                # Continue with other tests for comprehensive reporting
        
        self.end_time = time.time()
        
        # Generate comprehensive report
        self.generate_report()
        
        # Determine overall success
        critical_failures = any(
            not result['success'] and result['critical'] 
            for result in self.test_results.values()
        )
        
        return not critical_failures
    
    def generate_report(self):
        """Generate comprehensive test report"""
        logger.info(f"\n{'='*80}")
        logger.info(f"COMPREHENSIVE TEST REPORT")
        logger.info(f"{'='*80}")
        
        # Summary statistics
        total_tests = len(self.test_results)
        passed_tests = sum(1 for r in self.test_results.values() if r['success'])
        failed_tests = total_tests - passed_tests
        critical_failures = sum(1 for r in self.test_results.values() if not r['success'] and r['critical'])
        
        logger.info(f"Total test suites: {total_tests}")
        logger.info(f"Passed: {passed_tests}")
        logger.info(f"Failed: {failed_tests}")
        logger.info(f"Critical failures: {critical_failures}")
        logger.info(f"Success rate: {(passed_tests/total_tests*100):.1f}%")
        
        if self.start_time and self.end_time:
            duration = self.end_time - self.start_time
            logger.info(f"Total duration: {duration:.2f} seconds")
        
        # Detailed results
        logger.info(f"\n{'='*80}")
        logger.info(f"DETAILED RESULTS")
        logger.info(f"{'='*80}")
        
        for suite_name, result in self.test_results.items():
            status = "✓ PASS" if result['success'] else "✗ FAIL"
            critical = " (CRITICAL)" if result['critical'] else ""
            logger.info(f"{suite_name}: {status}{critical}")
            
            if not result['success']:
                if result['stderr']:
                    logger.error(f"  Error: {result['stderr']}")
                if result['stdout']:
                    # Show last few lines of output for context
                    lines = result['stdout'].strip().split('\n')
                    if lines:
                        logger.info(f"  Last output: {lines[-1]}")
        
        # Save detailed report to file
        self.save_report_to_file()
    
    def save_report_to_file(self):
        """Save detailed report to file"""
        report_file = self.project_root / "tests" / "test_dist_build" / "test_report.json"
        
        report_data = {
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            'duration': self.end_time - self.start_time if self.start_time and self.end_time else None,
            'summary': {
                'total_tests': len(self.test_results),
                'passed_tests': sum(1 for r in self.test_results.values() if r['success']),
                'failed_tests': sum(1 for r in self.test_results.values() if not r['success']),
                'critical_failures': sum(1 for r in self.test_results.values() if not r['success'] and r['critical'])
            },
            'results': self.test_results
        }
        
        try:
            with open(report_file, 'w') as f:
                json.dump(report_data, f, indent=2)
            logger.info(f"Detailed report saved to: {report_file}")
        except Exception as e:
            logger.error(f"Failed to save report: {e}")
    
    def check_prerequisites(self) -> bool:
        """Check if prerequisites are met"""
        logger.info("Checking prerequisites...")
        
        # Check if dist directory exists
        dist_dir = self.project_root / "dist"
        if not dist_dir.exists():
            logger.error(f"Dist directory not found: {dist_dir}")
            return False
        
        # Check if executable exists (platform-aware)
        exe_name = "ZyraVideoAgentBackend.exe" if platform.system() == "Windows" else "ZyraVideoAgentBackend"
        exe_path = dist_dir / "ZyraVideoAgentBackend" / exe_name
        if not exe_path.exists():
            logger.error(f"Executable not found: {exe_path}")
            return False
        
        # Check if internal directory exists
        internal_dir = dist_dir / "ZyraVideoAgentBackend" / "_internal"
        if not internal_dir.exists():
            logger.error(f"Internal directory not found: {internal_dir}")
            return False
        
        # Check if test files exist
        for suite_name, suite_info in self.test_suites.items():
            test_file = self.project_root / suite_info['file']
            if not test_file.exists():
                logger.error(f"Test file not found: {test_file}")
                return False
        
        logger.info("✓ All prerequisites met")
        return True


def main():
    """Main entry point"""
    runner = TestRunner()
    
    # Check prerequisites
    if not runner.check_prerequisites():
        logger.error("Prerequisites not met. Exiting.")
        sys.exit(1)
    
    # Run all tests
    success = runner.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
