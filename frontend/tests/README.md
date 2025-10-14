# MassUGC Studio Backend Tests

This directory contains tests for the MassUGC Studio backend infrastructure.

## Thread Pool Queue Management Test

**File:** `test_thread_pool_queue_executable.py`

This test validates the thread pool queue management fix by testing against the deployed MassUGC Studio backend.

### Prerequisites

1. **MassUGC Studio Running**: Start the frontend first
   ```bash
   npm start
   ```

2. **Backend Running**: The backend should auto-start with the frontend on port 2026

3. **Python Dependencies**: Install required packages
   ```bash
   pip install requests
   ```

### Running the Test

```bash
# Navigate to MassUGC Studio
cd C:\Users\phila\Documents\MassUGC-Studio

# Run the test
python tests\test_thread_pool_queue_executable.py
```

### What This Test Validates

✅ **Backend Executable Presence**: Verifies `ZyraVideoAgentBackend.exe` exists  
✅ **Backend Health**: Tests `/health` endpoint  
✅ **Thread Pool Performance**: Tests concurrent request handling  
✅ **Queue Status**: Tests `/queue/status` endpoint (if authenticated)  
✅ **Campaign Availability**: Tests `/campaigns` endpoint (if authenticated)  
✅ **Job Submission**: Tests concurrent job submission (if authenticated)

### Expected Results

If the thread pool fix is working correctly:

- ✅ All tests should PASS
- ✅ Concurrent requests should handle 15+ requests successfully
- ✅ Response times should be < 1 second
- ✅ Backend should be responsive and healthy

### Troubleshooting

**Backend Not Running**: Start MassUGC Studio with `npm start`  
**API Authentication**: Some tests may skip if API key is invalid  
**High Response Times**: Indicates thread pool issues not resolved

### Test Architecture

This test runs **against the deployed executable**, not source code, ensuring:
- Real production behavior validation
- Actual thread pool configuration testing  
- Deployed backend performance verification
- MassUGC Studio integration testing
