#!/usr/bin/env python3
"""
Quick script to run the MassUGC Studio backend thread pool queue test
"""

import sys
import os
from pathlib import Path

# Add current directory to Python path
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

# Run the test
if __name__ == "__main__":
    print("[TESTS] Running MassUGC Studio Backend Thread Pool Test")
    print("=" * 50)
    
    try:
        from tests.test_thread_pool_queue_executable import main
        main()
    except ImportError as e:
        print(f"ERROR: Import Error: {e}")
        print("HINT: Make sure you're in the MassUGC-Studio directory")
        print("HINT: Install dependencies: pip install requests")
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: Test Error: {e}")
        sys.exit(1)
