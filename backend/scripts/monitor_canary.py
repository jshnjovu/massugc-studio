#!/usr/bin/env python3
"""
Canary Deployment Monitor
Monitors canary deployment health and triggers rollback if issues detected
"""

import requests
import time
import sys
import json
from datetime import datetime, timedelta
from typing import Dict, List, Tuple

class CanaryMonitor:
    def __init__(self, base_url: str, duration_seconds: int = 1800):
        self.base_url = base_url.rstrip('/')
        self.duration_seconds = duration_seconds
        self.error_count = 0
        self.total_checks = 0
        self.error_threshold = 5.0  # 5% error rate
        self.checks = []
        
    def check_health(self) -> Tuple[bool, str]:
        """Check health endpoint"""
        try:
            response = requests.get(
                f"{self.base_url}/health",
                timeout=10
            )
            
            if response.status_code == 200:
                return True, "OK"
            else:
                return False, f"HTTP {response.status_code}"
                
        except requests.exceptions.Timeout:
            return False, "Timeout"
        except requests.exceptions.ConnectionError:
            return False, "Connection Error"
        except Exception as e:
            return False, str(e)
    
    def check_metrics(self) -> Dict:
        """Get metrics from endpoint"""
        try:
            response = requests.get(
                f"{self.base_url}/metrics",
                timeout=10
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return {}
                
        except Exception as e:
            print(f"⚠️  Failed to fetch metrics: {e}")
            return {}
    
    def calculate_error_rate(self) -> float:
        """Calculate current error rate percentage"""
        if self.total_checks == 0:
            return 0.0
        return (self.error_count / self.total_checks) * 100
    
    def should_rollback(self) -> bool:
        """Determine if automatic rollback should be triggered"""
        error_rate = self.calculate_error_rate()
        
        # Trigger rollback if error rate exceeds threshold
        if error_rate > self.error_threshold:
            return True
        
        # Trigger rollback if last 5 consecutive checks failed
        if len(self.checks) >= 5:
            recent_checks = self.checks[-5:]
            if all(not check['success'] for check in recent_checks):
                return True
        
        return False
    
    def log_check(self, success: bool, message: str, metrics: Dict = None):
        """Log check result"""
        check = {
            'timestamp': datetime.now().isoformat(),
            'success': success,
            'message': message,
            'metrics': metrics or {},
            'error_rate': self.calculate_error_rate()
        }
        self.checks.append(check)
        
        # Print status
        status_icon = "✓" if success else "❌"
        print(f"{status_icon} Check {self.total_checks}: {message} (Error rate: {self.calculate_error_rate():.2f}%)")
    
    def save_report(self, filepath: str = "canary_report.json"):
        """Save monitoring report"""
        report = {
            'monitoring_started': self.checks[0]['timestamp'] if self.checks else None,
            'monitoring_ended': self.checks[-1]['timestamp'] if self.checks else None,
            'duration_seconds': self.duration_seconds,
            'total_checks': self.total_checks,
            'error_count': self.error_count,
            'error_rate': self.calculate_error_rate(),
            'error_threshold': self.error_threshold,
            'checks': self.checks
        }
        
        with open(filepath, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"📊 Report saved to {filepath}")
    
    def monitor(self) -> int:
        """
        Main monitoring loop
        Returns: 0 for success, 1 for failure
        """
        start_time = datetime.now()
        end_time = start_time + timedelta(seconds=self.duration_seconds)
        
        print("=" * 60)
        print("🔍 CANARY DEPLOYMENT MONITOR")
        print("=" * 60)
        print(f"Base URL: {self.base_url}")
        print(f"Duration: {self.duration_seconds/60:.1f} minutes")
        print(f"Error Threshold: {self.error_threshold}%")
        print(f"Started: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)
        print()
        
        try:
            while datetime.now() < end_time:
                self.total_checks += 1
                
                # Perform health check
                success, message = self.check_health()
                
                if not success:
                    self.error_count += 1
                
                # Fetch metrics
                metrics = self.check_metrics()
                
                # Log the check
                self.log_check(success, message, metrics)
                
                # Check if rollback should be triggered
                if self.should_rollback():
                    print()
                    print("=" * 60)
                    print("🚨 AUTOMATIC ROLLBACK TRIGGERED")
                    print("=" * 60)
                    print(f"Error rate: {self.calculate_error_rate():.2f}%")
                    print(f"Threshold: {self.error_threshold}%")
                    print(f"Total checks: {self.total_checks}")
                    print(f"Failed checks: {self.error_count}")
                    print()
                    self.save_report()
                    return 1
                
                # Wait before next check
                time.sleep(60)  # Check every minute
        
        except KeyboardInterrupt:
            print("\n\n⚠️  Monitoring interrupted by user")
            self.save_report()
            return 1
        
        # Monitoring complete
        print()
        print("=" * 60)
        print("✅ MONITORING COMPLETE")
        print("=" * 60)
        print(f"Total checks: {self.total_checks}")
        print(f"Failed checks: {self.error_count}")
        print(f"Error rate: {self.calculate_error_rate():.2f}%")
        print(f"Threshold: {self.error_threshold}%")
        print()
        
        final_error_rate = self.calculate_error_rate()
        
        self.save_report()
        
        if final_error_rate > self.error_threshold:
            print("❌ Canary deployment FAILED - Error rate too high")
            return 1
        else:
            print("✅ Canary deployment PASSED - Ready for production")
            return 0


def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Monitor canary deployment health'
    )
    parser.add_argument(
        '--url',
        default='https://deploy.massugc.com/canary',
        help='Base URL for canary deployment'
    )
    parser.add_argument(
        '--duration',
        type=int,
        default=1800,
        help='Monitor duration in seconds (default: 1800 = 30 minutes)'
    )
    parser.add_argument(
        '--error-threshold',
        type=float,
        default=5.0,
        help='Error rate threshold percentage (default: 5.0)'
    )
    parser.add_argument(
        '--report',
        default='canary_report.json',
        help='Output report file path'
    )
    
    args = parser.parse_args()
    
    monitor = CanaryMonitor(args.url, args.duration)
    monitor.error_threshold = args.error_threshold
    
    exit_code = monitor.monitor()
    
    sys.exit(exit_code)


if __name__ == "__main__":
    main()

