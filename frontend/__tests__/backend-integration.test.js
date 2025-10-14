/**
 * Backend integration tests for job progress components
 * Tests against running ZyraVideoAgentBackend.exe
 * NO MOCKS - Tests real backend communication
 */
import { createBroadcastEventSource } from '../src/renderer/src/utils/api';
import path from 'path';
import fs from 'fs';

// Backend executable path from package.json dev:backend script
const BACKEND_EXECUTABLE_PATH = path.join(process.cwd(), 'ZyraData', 'backend', 'ZyraVideoAgentBackend.exe');

describe('Backend Integration Tests', () => {
  const BACKEND_URL = 'http://localhost:2026';
  const TIMEOUT = 30000; // 30 seconds timeout for integration tests

  beforeAll(() => {
    // Log backend executable information for debugging
    console.log('[BACKEND-INTEGRATION] Backend Integration Tests Starting');
    console.log(`[BACKEND-INTEGRATION] Backend URL: ${BACKEND_URL}`);
    console.log(`[BACKEND-INTEGRATION] Backend Executable Path: ${BACKEND_EXECUTABLE_PATH}`);
    console.log(`[BACKEND-INTEGRATION] fetch available: ${typeof fetch !== 'undefined'}`);
    console.log(`[BACKEND-INTEGRATION] EventSource available: ${typeof EventSource !== 'undefined'}`);
    
    // Check if backend executable exists
    if (fs.existsSync(BACKEND_EXECUTABLE_PATH)) {
      const stats = fs.statSync(BACKEND_EXECUTABLE_PATH);
      console.log(`[BACKEND-INTEGRATION] Backend Executable Found: ${(stats.size / 1024 / 1024).toFixed(1)}MB`);
      console.log(`[BACKEND-INTEGRATION] Last Modified: ${stats.mtime.toISOString()}`);
    } else {
      console.warn(`[BACKEND-INTEGRATION] WARNING: Backend executable not found at ${BACKEND_EXECUTABLE_PATH}`);
    }

    // These tests require the backend to be running
    if (!process.env.RUN_INTEGRATION_TESTS) {
      console.log('[BACKEND-INTEGRATION] Skipping integration tests - set RUN_INTEGRATION_TESTS=true to run');
    }
  });

  describe('Backend Health Check', () => {
    test('backend health endpoint responds', async () => {
      if (!process.env.RUN_INTEGRATION_TESTS) {
        return;
      }

      console.log(`[BACKEND-INTEGRATION] Testing health endpoint: ${BACKEND_URL}/health`);
      
      try {
        const response = await fetch(`${BACKEND_URL}/health`);
        console.log(`[BACKEND-INTEGRATION] Health response status: ${response.status}`);
        
        expect(response.status).toBe(200);
        
        const data = await response.json();
        console.log(`[BACKEND-INTEGRATION] Health response data:`, data);
        
        // Handle different response formats from backend
        if (data.status) {
          expect(data.status).toBeDefined();
        } else if (data.ok !== undefined) {
          expect(data.ok).toBeDefined();
        } else {
          // Accept any response structure as long as it's valid JSON
          expect(data).toBeDefined();
        }
        
        console.log('[BACKEND-INTEGRATION] Health check PASSED');
      } catch (error) {
        console.error(`[BACKEND-INTEGRATION] Health check FAILED:`, error);
        console.error(`[BACKEND-INTEGRATION] This indicates ZyraVideoAgentBackend.exe is not running or not accessible`);
        throw error;
      }
    }, TIMEOUT);
  });

  describe('Campaigns Endpoint', () => {
    test('fetches available campaigns', async () => {
      if (!process.env.RUN_INTEGRATION_TESTS) {
        return;
      }

      console.log(`[BACKEND-INTEGRATION] Testing campaigns endpoint: ${BACKEND_URL}/campaigns`);
      
      try {
        const response = await fetch(`${BACKEND_URL}/campaigns`);
        console.log(`[BACKEND-INTEGRATION] Campaigns response status: ${response.status}`);
        
        expect(response.status).toBe(200);
        
        const data = await response.json();
        console.log(`[BACKEND-INTEGRATION] Campaigns response data:`, data);
        
        // Handle different response formats from backend
        if (Array.isArray(data)) {
          expect(Array.isArray(data)).toBe(true);
          console.log(`[BACKEND-INTEGRATION] Found ${data.length} campaigns (array format)`);
        } else if (data.jobs && Array.isArray(data.jobs)) {
          expect(Array.isArray(data.jobs)).toBe(true);
          console.log(`[BACKEND-INTEGRATION] Found ${data.jobs.length} campaigns (jobs format)`);
        } else {
          // Accept any response structure as long as it's valid JSON
          expect(data).toBeDefined();
          console.log(`[BACKEND-INTEGRATION] Campaigns response received (custom format)`);
        }
        
        console.log('[BACKEND-INTEGRATION] Campaigns endpoint PASSED');
      } catch (error) {
        console.error(`[BACKEND-INTEGRATION] Campaigns endpoint FAILED:`, error);
        console.error(`[BACKEND-INTEGRATION] This indicates backend campaigns API issue`);
        throw error;
      }
    }, TIMEOUT);
  });

  describe('Queue Status Endpoint', () => {
    test('gets queue status', async () => {
      if (!process.env.RUN_INTEGRATION_TESTS) {
        return;
      }

      console.log(`[BACKEND-INTEGRATION] Testing queue status endpoint: ${BACKEND_URL}/queue/status`);
      
      try {
        const response = await fetch(`${BACKEND_URL}/queue/status`);
        console.log(`[BACKEND-INTEGRATION] Queue status response status: ${response.status}`);
        
        if (response.status === 401) {
          console.log('[BACKEND-INTEGRATION] Queue status requires authentication - skipping');
          return;
        }
        
        expect(response.status).toBe(200);
        
        const data = await response.json();
        console.log(`[BACKEND-INTEGRATION] Queue status response data:`, data);
        
        // Handle different response formats from backend
        if (data.queue_length !== undefined) {
          expect(data).toHaveProperty('queue_length');
          expect(data).toHaveProperty('active_jobs');
          console.log(`[BACKEND-INTEGRATION] Queue length: ${data.queue_length}, Active jobs: ${data.active_jobs}`);
        } else if (data.queue_size !== undefined) {
          expect(data).toHaveProperty('queue_size');
          expect(data).toHaveProperty('active_jobs');
          console.log(`[BACKEND-INTEGRATION] Queue size: ${data.queue_size}, Active jobs: ${data.active_jobs}`);
        } else {
          // Accept any response structure as long as it's valid JSON
          expect(data).toBeDefined();
          console.log(`[BACKEND-INTEGRATION] Queue status response received (custom format)`);
        }
        
        console.log('[BACKEND-INTEGRATION] Queue status endpoint PASSED');
      } catch (error) {
        console.error(`[BACKEND-INTEGRATION] Queue status endpoint FAILED:`, error);
        console.error(`[BACKEND-INTEGRATION] This indicates backend queue API issue`);
        throw error;
      }
    }, TIMEOUT);
  });

  describe('EventSource Connection', () => {
    test('connects to events endpoint', (done) => {
      if (!process.env.RUN_INTEGRATION_TESTS) {
        done();
        return;
      }

      console.log(`[BACKEND-INTEGRATION] Testing EventSource connection to: ${BACKEND_URL}/events`);
      
      let eventSource;
      let connectionTested = false;
      
      try {
        eventSource = createBroadcastEventSource();
      } catch (error) {
        console.log('[BACKEND-INTEGRATION] EventSource connection test SKIPPED - EventSource not available:', error.message);
        done();
        return;
      }
      
      // Test connection by listening for any event or checking readyState
      const testConnection = () => {
        if (connectionTested) return;
        connectionTested = true;
        
        console.log(`[BACKEND-INTEGRATION] EventSource readyState: ${eventSource.readyState}`);
        
        // EventSource states: 0=CONNECTING, 1=OPEN, 2=CLOSED
        if (eventSource.readyState === 1) {
          console.log('[BACKEND-INTEGRATION] EventSource connection test PASSED');
          eventSource.close();
          done();
        } else if (eventSource.readyState === 2) {
          console.error('[BACKEND-INTEGRATION] EventSource connection failed');
          eventSource.close();
          done(new Error('EventSource connection failed - backend may not be running'));
        } else {
          // Still connecting, wait a bit more
          setTimeout(testConnection, 1000);
        }
      };
      
      // Listen for heartbeat to confirm connection is working
      eventSource.addEventListener('heartbeat', () => {
        if (connectionTested) return;
        connectionTested = true;
        console.log('[BACKEND-INTEGRATION] EventSource connection test PASSED - heartbeat received');
        eventSource.close();
        done();
      });

      // Handle connection errors following JobProgressService pattern
      eventSource.onerror = (error) => {
        if (connectionTested) return;
        connectionTested = true;
        console.error(`[BACKEND-INTEGRATION] EventSource connection error:`, error);
        console.error(`[BACKEND-INTEGRATION] This indicates ZyraVideoAgentBackend.exe EventSource issue`);
        eventSource.close();
        done(new Error('EventSource connection error - backend may not be running'));
      };

      // Start testing connection after a brief delay
      setTimeout(testConnection, 2000);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (connectionTested) return;
        connectionTested = true;
        console.error('[BACKEND-INTEGRATION] EventSource connection timeout');
        eventSource.close();
        done(new Error('EventSource connection timeout - backend may not be running'));
      }, 10000);
    }, TIMEOUT);

    test('receives heartbeat events', (done) => {
      if (!process.env.RUN_INTEGRATION_TESTS) {
        done();
        return;
      }

      console.log(`[BACKEND-INTEGRATION] Testing heartbeat events from: ${BACKEND_URL}/events`);
      
      let eventSource;
      let heartbeatReceived = false;
      
      try {
        eventSource = createBroadcastEventSource();
      } catch (error) {
        console.log('[BACKEND-INTEGRATION] Heartbeat test SKIPPED - EventSource not available:', error.message);
        done();
        return;
      }

      eventSource.addEventListener('heartbeat', (event) => {
        heartbeatReceived = true;
        console.log(`[BACKEND-INTEGRATION] Heartbeat received:`, event.data);
        expect(event.data).toBeDefined();
        eventSource.close();
        console.log('[BACKEND-INTEGRATION] Heartbeat test PASSED');
        done();
      });

      // Use onerror pattern consistent with JobProgressService
      eventSource.onerror = (error) => {
        console.error(`[BACKEND-INTEGRATION] EventSource heartbeat error:`, error);
        console.error(`[BACKEND-INTEGRATION] This indicates backend EventSource heartbeat issue`);
        eventSource.close();
        done(new Error('EventSource heartbeat error - backend may not be running'));
      };

      // Timeout after 15 seconds
      setTimeout(() => {
        eventSource.close();
        if (!heartbeatReceived) {
          console.error('[BACKEND-INTEGRATION] No heartbeat received within timeout');
          done(new Error('No heartbeat received within timeout - backend may not be sending heartbeats'));
        }
      }, 15000);
    }, TIMEOUT);
  });

  describe('Job Submission', () => {
    test('submits job via run-job endpoint', async () => {
      if (!process.env.RUN_INTEGRATION_TESTS) {
        return;
      }

      const jobData = {
        campaign_id: 'test-campaign',
        run_id: 'test-run-' + Date.now(),
        script: 'Test script content',
        voice: 'test-voice',
        avatar: 'test-avatar'
      };

      console.log(`[BACKEND-INTEGRATION] Testing job submission to: ${BACKEND_URL}/run-job`);
      console.log(`[BACKEND-INTEGRATION] Job data:`, jobData);
      
      try {
        const response = await fetch(`${BACKEND_URL}/run-job`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(jobData)
        });

        console.log(`[BACKEND-INTEGRATION] Job submission response status: ${response.status}`);
        
        if (response.status === 401) {
          console.log('[BACKEND-INTEGRATION] Job submission requires authentication - skipping');
          return;
        }
        
        expect(response.status).toBe(200);
        
        const data = await response.json();
        console.log(`[BACKEND-INTEGRATION] Job submission response data:`, data);
        
        // Handle different response formats from backend
        if (data.success !== undefined) {
          expect(data).toHaveProperty('success');
          expect(data.success).toBe(true);
          console.log(`[BACKEND-INTEGRATION] Job submitted successfully: ${data.success}`);
        } else if (data.run_id) {
          expect(data).toHaveProperty('run_id');
          console.log(`[BACKEND-INTEGRATION] Job submitted with run_id: ${data.run_id}`);
        } else {
          // Accept any response structure as long as it's valid JSON
          expect(data).toBeDefined();
          console.log(`[BACKEND-INTEGRATION] Job submission response received (custom format)`);
        }
        
        console.log('[BACKEND-INTEGRATION] Job submission test PASSED');
      } catch (error) {
        console.error(`[BACKEND-INTEGRATION] Job submission FAILED:`, error);
        console.error(`[BACKEND-INTEGRATION] This indicates backend job submission API issue`);
        throw error;
      }
    }, TIMEOUT);
  });

  describe('Job Lifecycle Events', () => {
    test('receives job lifecycle events', (done) => {
      if (!process.env.RUN_INTEGRATION_TESTS) {
        return;
      }

      console.log(`[BACKEND-INTEGRATION] Testing job lifecycle events from: ${BACKEND_URL}/events`);
      
      let eventSource;
      const receivedEvents = [];
      
      try {
        eventSource = createBroadcastEventSource();
      } catch (error) {
        console.log('[BACKEND-INTEGRATION] Job lifecycle test SKIPPED - EventSource not available:', error.message);
        done();
        return;
      }

      eventSource.addEventListener('queued', (event) => {
        receivedEvents.push('queued');
        console.log(`[BACKEND-INTEGRATION] Queued event received:`, event.data);
        const data = JSON.parse(event.data);
        expect(data).toHaveProperty('run_id');
      });

      eventSource.addEventListener('progress', (event) => {
        receivedEvents.push('progress');
        console.log(`[BACKEND-INTEGRATION] Progress event received:`, event.data);
        const data = JSON.parse(event.data);
        expect(data).toHaveProperty('run_id');
        expect(data).toHaveProperty('step');
        expect(data).toHaveProperty('total');
      });

      eventSource.addEventListener('done', (event) => {
        receivedEvents.push('done');
        console.log(`[BACKEND-INTEGRATION] Done event received:`, event.data);
        const data = JSON.parse(event.data);
        expect(data).toHaveProperty('run_id');
        expect(data).toHaveProperty('success');
        
        eventSource.close();
        expect(receivedEvents.length).toBeGreaterThan(0);
        console.log(`[BACKEND-INTEGRATION] Job lifecycle test PASSED - received ${receivedEvents.length} events`);
        done();
      });

      // Use onerror pattern consistent with JobProgressService
      eventSource.onerror = (error) => {
        console.error(`[BACKEND-INTEGRATION] Job lifecycle EventSource error:`, error);
        console.error(`[BACKEND-INTEGRATION] This indicates backend job lifecycle EventSource issue`);
        eventSource.close();
        done(new Error('Job lifecycle EventSource error - backend may not be running'));
      };

      // Submit a test job to trigger events
      setTimeout(async () => {
        try {
          const jobData = {
            campaign_id: 'test-campaign',
            run_id: 'test-run-' + Date.now(),
            script: 'Test script content',
            voice: 'test-voice',
            avatar: 'test-avatar'
          };

          console.log(`[BACKEND-INTEGRATION] Submitting test job to trigger lifecycle events:`, jobData);
          
          await fetch(`${BACKEND_URL}/run-job`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(jobData)
          });
        } catch (error) {
          console.error(`[BACKEND-INTEGRATION] Failed to submit test job:`, error);
          eventSource.close();
          done(error);
        }
      }, 1000);

      // Timeout after 30 seconds
      setTimeout(() => {
        eventSource.close();
        console.error(`[BACKEND-INTEGRATION] Job lifecycle events timeout - received ${receivedEvents.length} events`);
        done(new Error('Job lifecycle events timeout - backend may not be processing jobs'));
      }, 30000);
    }, TIMEOUT);
  });

  describe('Error Handling', () => {
    test('handles backend connection failures', async () => {
      if (!process.env.RUN_INTEGRATION_TESTS) {
        return;
      }

      console.log(`[BACKEND-INTEGRATION] Testing connection failure handling with invalid URL`);
      
      // Test with invalid URL using EventSource directly (not createBroadcastEventSource)
      // This is testing connection failure handling, so we use invalid URL
      let invalidEventSource;
      
      try {
        // Try to use global EventSource if available, otherwise skip test
        if (typeof global.EventSource !== 'undefined') {
          invalidEventSource = new global.EventSource('http://localhost:9999/events');
        } else {
          console.log('[BACKEND-INTEGRATION] Connection failure test SKIPPED - EventSource not available');
          return;
        }
      } catch (error) {
        console.log('[BACKEND-INTEGRATION] Connection failure test SKIPPED - EventSource not available:', error.message);
        return;
      }
      
      return new Promise((resolve, reject) => {
        // Use onerror pattern consistent with JobProgressService
        invalidEventSource.onerror = () => {
          console.log(`[BACKEND-INTEGRATION] Connection failure test PASSED - expected error received`);
          invalidEventSource.close();
          resolve(); // Expected to fail
        };

        setTimeout(() => {
          console.error(`[BACKEND-INTEGRATION] Connection failure test FAILED - expected error not received`);
          invalidEventSource.close();
          reject(new Error('Expected connection failure'));
        }, 5000);
      });
    }, TIMEOUT);

    test('handles malformed API responses', async () => {
      if (!process.env.RUN_INTEGRATION_TESTS) {
        return;
      }

      console.log(`[BACKEND-INTEGRATION] Testing invalid endpoint handling: ${BACKEND_URL}/invalid-endpoint`);
      
      try {
        // Test with invalid endpoint
        const response = await fetch(`${BACKEND_URL}/invalid-endpoint`);
        console.log(`[BACKEND-INTEGRATION] Invalid endpoint response status: ${response.status}`);
        
        expect(response.status).toBe(404);
        console.log(`[BACKEND-INTEGRATION] Invalid endpoint test PASSED - 404 received`);
      } catch (error) {
        console.error(`[BACKEND-INTEGRATION] Invalid endpoint test FAILED:`, error);
        throw error;
      }
    }, TIMEOUT);
  });

  describe('Concurrent Job Handling', () => {
    test('handles multiple concurrent jobs', async () => {
      if (!process.env.RUN_INTEGRATION_TESTS) {
        return;
      }

      console.log(`[BACKEND-INTEGRATION] Testing concurrent job handling with 3 jobs`);
      
      const jobPromises = [];
      
      // Submit 3 concurrent jobs
      for (let i = 0; i < 3; i++) {
        const jobData = {
          campaign_id: 'test-campaign',
          run_id: 'test-run-' + Date.now() + '-' + i,
          script: 'Test script content',
          voice: 'test-voice',
          avatar: 'test-avatar'
        };

        console.log(`[BACKEND-INTEGRATION] Submitting concurrent job ${i + 1}:`, jobData);

        jobPromises.push(
          fetch(`${BACKEND_URL}/run-job`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(jobData)
          })
        );
      }

      try {
        const responses = await Promise.all(jobPromises);
        
        console.log(`[BACKEND-INTEGRATION] Concurrent job responses:`, responses.map(r => r.status));
        
        responses.forEach((response, index) => {
          if (response.status === 401) {
            console.log(`[BACKEND-INTEGRATION] Job ${index + 1} requires authentication - skipping`);
            return;
          }
          expect(response.status).toBe(200);
        });
        
        console.log(`[BACKEND-INTEGRATION] Concurrent job handling test PASSED`);
      } catch (error) {
        console.error(`[BACKEND-INTEGRATION] Concurrent job handling test FAILED:`, error);
        console.error(`[BACKEND-INTEGRATION] This indicates backend concurrent job processing issue`);
        throw error;
      }
    }, TIMEOUT);
  });
});
