import JobProgressService from '../src/renderer/src/services/JobProgressService';
import { createBroadcastEventSource, cancelAllJobs } from '../src/renderer/src/utils/api';
import { useStore } from '../src/renderer/src/store';

// Mock dependencies
jest.mock('../src/renderer/src/utils/api', () => ({
  createBroadcastEventSource: jest.fn(() => ({
    addEventListener: jest.fn(),
    close: jest.fn(),
    readyState: 0,
    onerror: jest.fn()
  })),
  cancelAllJobs: jest.fn(() => Promise.resolve({ success: true }))
}));

const mockStore = {
  jobs: [
    { campaignId: 'campaign1', runId: 'run1', status: 'processing', progress: 50 },
    { campaignId: 'campaign2', runId: 'run2', status: 'completed', progress: 100 },
    { campaignId: 'campaign3', runId: 'run3', status: 'queued', progress: 0 }
  ],
  updateJobProgress: jest.fn(),
  completeJob: jest.fn(),
  failJob: jest.fn(),
  queueJob: jest.fn(),
  stopBatchOperation: jest.fn()
};

jest.mock('../src/renderer/src/store', () => ({
  useStore: {
    getState: jest.fn(() => mockStore)
  }
}));

describe('JobProgressService', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Reset the singleton instance
    JobProgressService.instance = null;
    
    // Reset store mock functions
    mockStore.updateJobProgress.mockClear();
    mockStore.completeJob.mockClear();
    mockStore.failJob.mockClear();
    mockStore.queueJob.mockClear();
    mockStore.stopBatchOperation.mockClear();
  });
  
  test('getInstance returns singleton instance', () => {
    const instance1 = JobProgressService.getInstance();
    const instance2 = JobProgressService.getInstance();
    
    expect(instance1).toBeDefined();
    expect(instance1).toBe(instance2);
  });
  
  test('startJobProgress initializes broadcast connection and tracks job', () => {
    const service = JobProgressService.getInstance();
    
    service.startJobProgress('campaign1', 'run1');
    
    expect(createBroadcastEventSource).toHaveBeenCalled();
    expect(service.isTracking('run1')).toBe(true);
  });
  
  test('pauseJobProgress stops tracking the job', () => {
    const service = JobProgressService.getInstance();
    
    service.startJobProgress('campaign1', 'run1');
    const result = service.pauseJobProgress('run1');
    
    expect(result).toBe(true);
    expect(service.isTracking('run1')).toBe(false);
  });
  
  test('resumeAllJobs restarts tracking for processing and queued jobs', () => {
    const service = JobProgressService.getInstance();
    const jobs = useStore.getState().jobs;
    
    // Spy on startJobProgress
    const startJobSpy = jest.spyOn(service, 'startJobProgress');
    
    const count = service.resumeAllJobs();
    
    // Should find two jobs with 'processing' or 'queued' status
    expect(count).toBe(2);
    expect(startJobSpy).toHaveBeenCalledWith('campaign1', 'run1');
    expect(startJobSpy).toHaveBeenCalledWith('campaign3', 'run3');
    expect(startJobSpy).not.toHaveBeenCalledWith('campaign2', 'run2');
  });
  
  test('getJobStatus returns correct status', () => {
    const service = JobProgressService.getInstance();
    
    service.startJobProgress('campaign1', 'run1');
    
    // Job status should be set to queued initially in the service
    expect(service.getJobStatus('run1')).toBe('queued');
  });
  
  test('isTracking returns true for tracked jobs', () => {
    const service = JobProgressService.getInstance();
    
    service.startJobProgress('campaign1', 'run1');
    
    expect(service.isTracking('run1')).toBe(true);
    expect(service.isTracking('run2')).toBe(false);
  });
  
  test('stopAll closes broadcast connection and clears tracking', () => {
    const service = JobProgressService.getInstance();
    
    service.startJobProgress('campaign1', 'run1');
    service.startJobProgress('campaign2', 'run2');
    
    service.stopAll();
    
    // Should mark unfinished jobs as failed
    expect(mockStore.failJob).toHaveBeenCalledWith('campaign1', 'run1', 'Interrupted by user');
    expect(mockStore.failJob).toHaveBeenCalledWith('campaign3', 'run3', 'Interrupted by user');
    // Should not mark completed jobs as failed
    expect(mockStore.failJob).not.toHaveBeenCalledWith('campaign2', 'run2', 'Interrupted by user');
    
    // Should clear batch operation state
    expect(mockStore.stopBatchOperation).toHaveBeenCalled();
    
    expect(service.getTrackedJobIds()).toHaveLength(0);
  });

  // ─── EventSource Event Handling Tests ─────────────────────────────────────
  
  describe('EventSource Event Handling', () => {
    let service;
    let mockEventSource;
    let eventHandlers;

    beforeEach(() => {
      service = JobProgressService.getInstance();
      
      // Capture event handlers
      eventHandlers = {};
      createBroadcastEventSource.mockImplementation(() => ({
        addEventListener: jest.fn((event, handler) => {
          eventHandlers[event] = handler;
        }),
        close: jest.fn(),
        readyState: 0,
        onerror: jest.fn()
      }));
      
      mockEventSource = createBroadcastEventSource();
      
      // Start tracking a job
      service.startJobProgress('campaign1', 'run1');
    });

    test('handles progress events correctly', () => {
      const progressEvent = {
        data: JSON.stringify({
          run_id: 'run1',
          step: 25,
          total: 100,
          message: 'Processing video...'
        })
      };

      // Trigger progress event
      eventHandlers.progress(progressEvent);

      // Should update job progress
      expect(mockStore.updateJobProgress).toHaveBeenCalledWith(
        'campaign1',
        'run1',
        25,
        'Processing video...'
      );

      // Should set job status to processing
      expect(service.getJobStatus('run1')).toBe('processing');
    });

    test('handles queued events correctly', () => {
      const queuedEvent = {
        data: JSON.stringify({
          run_id: 'run1',
          message: 'Waiting for available slot...'
        })
      };

      // Trigger queued event
      eventHandlers.queued(queuedEvent);

      // Should update job status to queued
      expect(service.getJobStatus('run1')).toBe('queued');
      expect(mockStore.queueJob).toHaveBeenCalledWith(
        'campaign1',
        'run1',
        'Waiting for available slot...'
      );
    });

    test('handles done events with success', () => {
      const doneEvent = {
        data: JSON.stringify({
          run_id: 'run1',
          success: true,
          output_path: '/path/to/video.mp4'
        })
      };

      // Trigger done event
      eventHandlers.done(doneEvent);

      // Should complete job
      expect(mockStore.completeJob).toHaveBeenCalledWith(
        'campaign1',
        'run1',
        '/path/to/video.mp4'
      );
      expect(service.getJobStatus('run1')).toBe('completed');
    });

    test('handles done events with failure', () => {
      const doneEvent = {
        data: JSON.stringify({
          run_id: 'run1',
          success: false,
          message: 'Video generation failed'
        })
      };

      // Trigger done event
      eventHandlers.done(doneEvent);

      // Should fail job
      expect(mockStore.failJob).toHaveBeenCalledWith(
        'campaign1',
        'run1',
        'Video generation failed'
      );
      expect(service.getJobStatus('run1')).toBe('failed');
    });

    test('handles error events with job data', () => {
      const errorEvent = {
        data: JSON.stringify({
          run_id: 'run1',
          message: 'Network error occurred'
        })
      };

      // Trigger error event
      eventHandlers.error(errorEvent);

      // Should fail job
      expect(mockStore.failJob).toHaveBeenCalledWith(
        'campaign1',
        'run1',
        'Network error occurred'
      );
      expect(service.getJobStatus('run1')).toBe('failed');
    });

    test('handles heartbeat events', () => {
      const heartbeatEvent = {
        data: JSON.stringify({ timestamp: Date.now() })
      };

      // Mock console.log to verify heartbeat logging
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Trigger heartbeat event
      eventHandlers.heartbeat(heartbeatEvent);

      // Should log heartbeat
      expect(consoleSpy).toHaveBeenCalledWith('JobProgressService: Received heartbeat');

      consoleSpy.mockRestore();
    });

    test('ignores events for untracked jobs', () => {
      const progressEvent = {
        data: JSON.stringify({
          run_id: 'untracked-run-id',
          step: 50,
          total: 100
        })
      };

      // Trigger progress event for untracked job
      eventHandlers.progress(progressEvent);

      // Should not update store
      expect(mockStore.updateJobProgress).not.toHaveBeenCalled();
    });

    test('handles malformed event data gracefully', () => {
      const malformedEvent = {
        data: 'invalid json'
      };

      // Mock console.error to verify error logging
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Trigger event with malformed data
      eventHandlers.progress(malformedEvent);

      // Should log error
      expect(consoleSpy).toHaveBeenCalledWith(
        'JobProgressService: Error parsing progress data',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  // ─── Timeout Handling Tests ──────────────────────────────────────────────
  
  describe('Timeout Handling', () => {
    let service;
    let mockEventSource;
    let eventHandlers;

    beforeEach(() => {
      jest.useFakeTimers();
      service = JobProgressService.getInstance();
      
      // Capture event handlers
      eventHandlers = {};
      createBroadcastEventSource.mockImplementation(() => ({
        addEventListener: jest.fn((event, handler) => {
          eventHandlers[event] = handler;
        }),
        close: jest.fn(),
        readyState: 0,
        onerror: jest.fn()
      }));
      
      mockEventSource = createBroadcastEventSource();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('handles queue timeout', () => {
      // Start tracking a job
      service.startJobProgress('campaign1', 'run1');
      
      // Simulate queued event to set up queue timeout
      const queuedEvent = {
        data: JSON.stringify({
          run_id: 'run1',
          message: 'Waiting in queue...'
        })
      };
      eventHandlers.queued(queuedEvent);
      
      // Fast-forward past queue timeout (7 days)
      jest.advanceTimersByTime(JobProgressService.MAX_QUEUE_TIME + 1000);

      // Should fail job due to queue timeout
      expect(mockStore.failJob).toHaveBeenCalledWith(
        'campaign1',
        'run1',
        'Job stuck in queue - timeout'
      );
    });

    test('handles job processing timeout', () => {
      // Start tracking a job
      service.startJobProgress('campaign1', 'run1');
      
      // Simulate progress event to start processing timeout
      const progressEvent = {
        data: JSON.stringify({
          run_id: 'run1',
          step: 1,
          total: 100
        })
      };
      eventHandlers.progress(progressEvent);

      // Fast-forward past job timeout (7 days)
      jest.advanceTimersByTime(JobProgressService.MAX_JOB_TIME + 1000);

      // Should fail job due to processing timeout
      expect(mockStore.failJob).toHaveBeenCalledWith(
        'campaign1',
        'run1',
        'Job processing timeout'
      );
    });

    test('clears queue timeout when job starts processing', () => {
      // Start tracking a job
      service.startJobProgress('campaign1', 'run1');
      
      // Simulate queued event
      const queuedEvent = {
        data: JSON.stringify({
          run_id: 'run1',
          message: 'Waiting in queue...'
        })
      };
      eventHandlers.queued(queuedEvent);

      // Simulate progress event
      const progressEvent = {
        data: JSON.stringify({
          run_id: 'run1',
          step: 1,
          total: 100
        })
      };
      eventHandlers.progress(progressEvent);

      // Fast-forward past queue timeout
      jest.advanceTimersByTime(JobProgressService.MAX_QUEUE_TIME + 1000);

      // Should not fail due to queue timeout (timeout was cleared)
      expect(mockStore.failJob).not.toHaveBeenCalledWith(
        'campaign1',
        'run1',
        'Job stuck in queue - timeout'
      );
    });
  });

  // ─── Error Scenarios and Connection Failures ─────────────────────────────
  
  describe('Error Scenarios and Connection Failures', () => {
    let service;
    let mockEventSource;

    beforeEach(() => {
      service = JobProgressService.getInstance();
      
      // Reset mock implementation
      createBroadcastEventSource.mockImplementation(() => ({
        addEventListener: jest.fn(),
        close: jest.fn(),
        readyState: 0,
        onerror: jest.fn()
      }));
      
      mockEventSource = createBroadcastEventSource();
    });

    test('handles EventSource connection errors', () => {
      // Mock console.error to verify error logging
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // Capture event handlers
      const eventHandlers = {};
      createBroadcastEventSource.mockImplementation(() => ({
        addEventListener: jest.fn((event, handler) => {
          eventHandlers[event] = handler;
        }),
        close: jest.fn(),
        readyState: 2, // CLOSED state
        onerror: jest.fn()
      }));
      
      mockEventSource = createBroadcastEventSource();

      // Start tracking a job to initialize the connection
      service.startJobProgress('campaign1', 'run1');

      // Simulate connection error by triggering the error event handler with invalid JSON
      const errorEvent = {
        data: 'invalid json' // This will cause a parsing error and trigger connection error path
      };
      
      // Trigger error event
      eventHandlers.error(errorEvent);

      // Should log connection error
      expect(consoleSpy).toHaveBeenCalledWith(
        'JobProgressService: EventSource connection error',
        expect.any(Object)
      );

      // Should schedule reconnect
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'JobProgressService: Connection closed, scheduling reconnect'
      );

      consoleSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    test('handles EventSource creation failure', () => {
      // Mock createBroadcastEventSource to throw error
      createBroadcastEventSource.mockImplementation(() => {
        throw new Error('Failed to create EventSource');
      });

      // Mock console.error to verify error logging
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Should return false when initialization fails
      const result = service.initializeBroadcastConnection();
      expect(result).toBe(false);

      // Should log error
      expect(consoleSpy).toHaveBeenCalledWith(
        'JobProgressService: Error creating broadcast EventSource',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    test('handles missing campaignId or runId in startJobProgress', () => {
      // Mock console.error to verify error logging
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Should return false for missing campaignId
      expect(service.startJobProgress(null, 'run1')).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'JobProgressService: Missing campaignId or runId'
      );

      // Should return false for missing runId
      expect(service.startJobProgress('campaign1', null)).toBe(false);

      consoleSpy.mockRestore();
    });
  });

  // ─── Cancel All Jobs Tests ───────────────────────────────────────────────
  
  describe('Cancel All Jobs', () => {
    let service;

    beforeEach(() => {
      service = JobProgressService.getInstance();
    });

    test('cancels all active and queued jobs successfully', async () => {
      // Start tracking some jobs
      service.startJobProgress('campaign1', 'run1');
      service.startJobProgress('campaign2', 'run2');

      // Mock successful API response
      cancelAllJobs.mockResolvedValue({ success: true });

      // Mock console.log to verify success logging
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await service.cancelAllJobs();

      // Should return true
      expect(result).toBe(true);

      // Should call API
      expect(cancelAllJobs).toHaveBeenCalled();

      // Should mark all jobs as cancelled
      expect(mockStore.failJob).toHaveBeenCalledWith(
        'campaign1',
        'run1',
        'Cancelled by user'
      );
      expect(mockStore.failJob).toHaveBeenCalledWith(
        'campaign3',
        'run3',
        'Cancelled by user'
      );

      // Should clear tracking
      expect(service.getTrackedJobIds()).toHaveLength(0);

      // Should log success
      expect(consoleSpy).toHaveBeenCalledWith(
        'JobProgressService: All jobs cancelled successfully'
      );

      consoleSpy.mockRestore();
    });

    test('handles cancelAllJobs API failure', async () => {
      // Mock API failure
      cancelAllJobs.mockRejectedValue(new Error('API Error'));

      // Mock console.error to verify error logging
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await service.cancelAllJobs();

      // Should return false
      expect(result).toBe(false);

      // Should log error
      expect(consoleSpy).toHaveBeenCalledWith(
        'JobProgressService: Error cancelling all jobs:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  // ─── Cleanup Job Tracking Tests ──────────────────────────────────────────
  
  describe('Cleanup Job Tracking', () => {
    let service;
    let mockEventSource;
    let eventHandlers;

    beforeEach(() => {
      jest.useFakeTimers();
      service = JobProgressService.getInstance();
      
      // Capture event handlers
      eventHandlers = {};
      createBroadcastEventSource.mockImplementation(() => ({
        addEventListener: jest.fn((event, handler) => {
          eventHandlers[event] = handler;
        }),
        close: jest.fn(),
        readyState: 0,
        onerror: jest.fn()
      }));
      
      mockEventSource = createBroadcastEventSource();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('cleans up job tracking on completion', () => {
      // Start tracking a job
      service.startJobProgress('campaign1', 'run1');
      
      // Simulate queued event to set up timeouts
      const queuedEvent = {
        data: JSON.stringify({
          run_id: 'run1',
          message: 'Waiting in queue...'
        })
      };
      eventHandlers.queued(queuedEvent);

      // Simulate completion
      const doneEvent = {
        data: JSON.stringify({
          run_id: 'run1',
          success: true,
          output_path: '/path/to/video.mp4'
        })
      };
      eventHandlers.done(doneEvent);

      // Should no longer be tracking the job
      expect(service.isTracking('run1')).toBe(false);
      // Status should still be available after cleanup
      expect(service.getJobStatus('run1')).toBe('completed');
    });

    test('cleans up job tracking on failure', () => {
      // Start tracking a job
      service.startJobProgress('campaign1', 'run1');
      
      // Simulate failure
      const errorEvent = {
        data: JSON.stringify({
          run_id: 'run1',
          message: 'Job failed'
        })
      };
      eventHandlers.error(errorEvent);

      // Should no longer be tracking the job
      expect(service.isTracking('run1')).toBe(false);
      // Status should still be available after cleanup
      expect(service.getJobStatus('run1')).toBe('failed');
    });
  });

  // ─── Singleton Pattern Tests ─────────────────────────────────────────────
  
  describe('Singleton Pattern', () => {
    test('enforces singleton pattern in constructor', () => {
      // Get first instance
      const instance1 = JobProgressService.getInstance();
      
      // Try to create new instance directly
      const instance2 = new JobProgressService();
      
      // Should return the same instance
      expect(instance1).toBe(instance2);
    });

    test('maintains singleton across multiple getInstance calls', () => {
      const instance1 = JobProgressService.getInstance();
      const instance2 = JobProgressService.getInstance();
      const instance3 = JobProgressService.getInstance();
      
      // All should be the same instance
      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);
    });
  });

  // ─── Resume Job Progress Edge Cases ──────────────────────────────────────
  
  describe('Resume Job Progress Edge Cases', () => {
    let service;
    let eventHandlers;

    beforeEach(() => {
      service = JobProgressService.getInstance();
      
      // Capture event handlers
      eventHandlers = {};
      createBroadcastEventSource.mockImplementation(() => ({
        addEventListener: jest.fn((event, handler) => {
          eventHandlers[event] = handler;
        }),
        close: jest.fn(),
        readyState: 0,
        onerror: jest.fn()
      }));
    });

    test('does not resume completed jobs', () => {
      // Start tracking a job
      service.startJobProgress('campaign1', 'run1');
      
      // Simulate completion
      const doneEvent = {
        data: JSON.stringify({
          run_id: 'run1',
          success: true,
          output_path: '/path/to/video.mp4'
        })
      };
      eventHandlers.done(doneEvent);

      // Try to resume completed job
      const result = service.resumeJobProgress('campaign1', 'run1');
      
      // Should return false
      expect(result).toBe(false);
    });

    test('does not resume failed jobs', () => {
      // Start tracking a job
      service.startJobProgress('campaign1', 'run1');
      
      // Simulate failure
      const errorEvent = {
        data: JSON.stringify({
          run_id: 'run1',
          message: 'Job failed'
        })
      };
      eventHandlers.error(errorEvent);

      // Try to resume failed job
      const result = service.resumeJobProgress('campaign1', 'run1');
      
      // Should return false
      expect(result).toBe(false);
    });

    test('resumes queued jobs successfully', () => {
      // Start tracking a job
      service.startJobProgress('campaign1', 'run1');
      
      // Simulate queued state
      const queuedEvent = {
        data: JSON.stringify({
          run_id: 'run1',
          message: 'Waiting in queue...'
        })
      };
      eventHandlers.queued(queuedEvent);

      // Try to resume queued job
      const result = service.resumeJobProgress('campaign1', 'run1');
      
      // Should return true
      expect(result).toBe(true);
    });

    test('resumes processing jobs successfully', () => {
      // Start tracking a job
      service.startJobProgress('campaign1', 'run1');
      
      // Simulate processing state
      const progressEvent = {
        data: JSON.stringify({
          run_id: 'run1',
          step: 50,
          total: 100
        })
      };
      eventHandlers.progress(progressEvent);

      // Try to resume processing job
      const result = service.resumeJobProgress('campaign1', 'run1');
      
      // Should return true
      expect(result).toBe(true);
    });
  });
}); 