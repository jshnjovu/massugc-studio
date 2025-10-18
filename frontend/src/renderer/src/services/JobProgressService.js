import { createBroadcastEventSource, cancelAllJobs } from '../utils/api';
import { useStore } from '../store';

/**
 * Service for managing job progress centrally.
 * Handles connecting to a single broadcast EventSource for all job progress updates.
 */
class JobProgressService {
  // Singleton instance
  static instance = null;
  
  // Private properties
  #eventSource = null;        // Single EventSource for all jobs
  #trackedJobs = new Set();   // Set of runIds we're tracking
  #jobStatuses = new Map();   // Map of runId -> status
  #reconnectTimer = null;     // Single reconnect timer
  #jobTimeouts = new Map();   // Map of runId -> timeout ID
  #queueTimeouts = new Map(); // Map of runId -> queue timeout ID
  
  // Constants for timeout handling - INCREASED FOR LONG-RUNNING JOBS
  static MAX_QUEUE_TIME = 7 * 24 * 60 * 60 * 1000;  // 7 days max in queue
  static MAX_JOB_TIME = 7 * 24 * 60 * 60 * 1000;    // 7 days max per job

  /**
   * Get the singleton instance of JobProgressService
   * @returns {JobProgressService} The singleton instance
   */
  static getInstance() {
    if (!JobProgressService.instance) {
      JobProgressService.instance = new JobProgressService();
    }
    return JobProgressService.instance;
  }

  /**
   * Constructor - private, use getInstance() instead
   */
  constructor() {
    // Ensure this is a singleton
    if (JobProgressService.instance) {
      return JobProgressService.instance;
    }
    JobProgressService.instance = this;
  }

  /**
   * Initialize the broadcast EventSource connection
   * @returns {boolean} Success status
   */
  initializeBroadcastConnection() {
    if (this.#eventSource) {
      return true;
    }

    try {
      // Create a single EventSource connection for all jobs
      this.#eventSource = createBroadcastEventSource();
      
      // Handle progress events
      this.#eventSource.addEventListener('progress', (event) => {
        try {
          const data = JSON.parse(event.data);
          const runId = data.run_id;
          
          // Only process if we're tracking this job
          if (!this.#trackedJobs.has(runId)) {
            return;
          }
          
          const step = data.step || 0;
          const total = data.total || 100;
          const progress = Math.round((step / total) * 100);
          
          // Update the job status
          this.#jobStatuses.set(runId, 'processing');
          
          // Clear queue timeout since job is now processing
          const queueTimeoutId = this.#queueTimeouts.get(runId);
          if (queueTimeoutId) {
            clearTimeout(queueTimeoutId);
            this.#queueTimeouts.delete(runId);
          }
          
          // Set processing timeout
          if (!this.#jobTimeouts.has(runId)) {
            const jobTimeoutId = setTimeout(() => {
              console.warn(`JobProgressService: Job ${runId} processing timeout`);
              this.#handleJobTimeout(runId, 'Job processing timeout');
            }, JobProgressService.MAX_JOB_TIME);
            this.#jobTimeouts.set(runId, jobTimeoutId);
          }
          
          // Find the campaign ID for this job
          const job = useStore.getState().jobs.find(j => j.runId === runId);
          if (job) {
            // Update the store with progress
            useStore.getState().updateJobProgress(
              job.campaignId, 
              runId, 
              progress, 
              data.message || 'Processing...'
            );
          }
        } catch (error) {
          console.error('JobProgressService: Error parsing progress data', error);
        }
      });
      
      // Handle queued state - when job is waiting for a free slot in thread pool
      this.#eventSource.addEventListener('queued', (event) => {
        try {
          const data = JSON.parse(event.data);
          const runId = data.run_id;
          
          // Only process if we're tracking this job
          if (!this.#trackedJobs.has(runId)) {
            return;
          }
          
          // Update the job status to queued
          this.#jobStatuses.set(runId, 'queued');
          
          // Set queue timeout - if job stays in queue too long, mark as failed
          const queueTimeoutId = setTimeout(() => {
            console.warn(`JobProgressService: Job ${runId} stuck in queue, timing out`);
            this.#handleJobTimeout(runId, 'Job stuck in queue - timeout');
          }, JobProgressService.MAX_QUEUE_TIME);
          this.#queueTimeouts.set(runId, queueTimeoutId);
          
          // Find the campaign ID for this job
          const job = useStore.getState().jobs.find(j => j.runId === runId);
          if (job) {
            // Update the store with queued status
            useStore.getState().queueJob(
              job.campaignId, 
              runId, 
              data.message || 'Waiting in queue...'
            );
          }
        } catch (error) {
          console.error('JobProgressService: Error parsing queued data', error);
        }
      });
      
      // Handle completion - using 'done' event name to match backend
      this.#eventSource.addEventListener('done', (event) => {
        try {
          const data = JSON.parse(event.data);
          const runId = data.run_id;
          
          // Only process if we're tracking this job
          if (!this.#trackedJobs.has(runId)) {
            return;
          }
          
          // Find the campaign ID for this job
          const job = useStore.getState().jobs.find(j => j.runId === runId);
          if (job) {
            // Update the store with completion
            if (data.success) {
              useStore.getState().completeJob(
                job.campaignId, 
                runId, 
                data.output_path || null
              );
              this.#jobStatuses.set(runId, 'completed');
            } else {
              useStore.getState().failJob(
                job.campaignId,
                runId,
                data.message || 'Job failed'
              );
              this.#jobStatuses.set(runId, 'failed');
            }
          }
          
          // Stop tracking this job and clear timeouts
          this.#cleanupJobTracking(runId);
        } catch (error) {
          console.error('JobProgressService: Error handling job completion', error);
        }
      });
      
      // Handle errors
      this.#eventSource.addEventListener('error', (event) => {
        try {
          // First try to parse the event data as it might contain error details
          const data = JSON.parse(event.data);
          const runId = data.run_id;
          
          // Only process if we're tracking this job
          if (!this.#trackedJobs.has(runId)) {
            return;
          }
          
          console.error('JobProgressService: Job error', data);
          
          // Find the campaign ID for this job
          const job = useStore.getState().jobs.find(j => j.runId === runId);
          if (job) {
            // Update the store with error
            useStore.getState().failJob(
              job.campaignId,
              runId,
              data.message || 'Unknown error occurred'
            );
          }
          
          this.#jobStatuses.set(runId, 'failed');
          this.#cleanupJobTracking(runId);
        } catch (error) {
          // If parsing fails, it's likely a connection error
          console.error('JobProgressService: EventSource connection error', event);
          
          // Check if the connection was closed
          if (this.#eventSource && this.#eventSource.readyState === 2) { // CLOSED
            console.log('JobProgressService: Connection closed, scheduling reconnect');
            this.scheduleReconnect();
          }
        }
      });
      
      // Handle heartbeat events to keep connection alive
      this.#eventSource.addEventListener('heartbeat', (event) => {
        // Heartbeat received - connection is alive
      });
      
      // Handle general connection errors
      this.#eventSource.onerror = (event) => {
        console.error('JobProgressService: EventSource connection error', event);
        
        // Check if the connection was closed and schedule reconnect
        if (this.#eventSource && this.#eventSource.readyState === 2) { // CLOSED
          console.log('JobProgressService: Connection closed, scheduling reconnect');
          this.scheduleReconnect();
        }
      };
      
      return true;
    } catch (error) {
      console.error('JobProgressService: Error creating broadcast EventSource', error);
      return false;
    }
  }

  /**
   * Start tracking a job's progress
   * @param {string} campaignId - The campaign ID
   * @param {string} runId - The run ID for the job
   * @returns {boolean} Success status
   */
  startJobProgress(campaignId, runId) {
    if (!campaignId || !runId) {
      console.error('JobProgressService: Missing campaignId or runId');
      return false;
    }

    // Initialize broadcast connection if not already done
    if (!this.#eventSource) {
      const initialized = this.initializeBroadcastConnection();
      if (!initialized) {
        return false;
      }
    }

    // Add this job to our tracking set
    this.#trackedJobs.add(runId);
    this.#jobStatuses.set(runId, 'queued');
    
    return true;
  }

  /**
   * Schedule a reconnect attempt
   */
  scheduleReconnect() {
    // Clear any existing reconnect timer
    if (this.#reconnectTimer) {
      clearTimeout(this.#reconnectTimer);
    }
    
    // Schedule a reconnect attempt after 5 seconds
    this.#reconnectTimer = setTimeout(() => {
      console.log('JobProgressService: Attempting to reconnect broadcast connection');
      this.closeBroadcastConnection();
      this.initializeBroadcastConnection();
    }, 5000);
  }

  /**
   * Pause tracking a job's progress
   * @param {string} runId - The run ID for the job
   * @returns {boolean} Success status
   */
  pauseJobProgress(runId) {
    if (!this.#trackedJobs.has(runId)) {
      return false;
    }
    
    this.#trackedJobs.delete(runId);
    return true;
  }

  /**
   * Resume tracking a job's progress
   * @param {string} campaignId - The campaign ID
   * @param {string} runId - The run ID for the job
   * @returns {boolean} Success status
   */
  resumeJobProgress(campaignId, runId) {
    // Get the current job status
    const status = this.#jobStatuses.get(runId);
    
    // If job is completed or failed, don't resume
    if (status === 'completed' || status === 'failed') {
      return false;
    }
    
    return this.startJobProgress(campaignId, runId);
  }

  /**
   * Resume all active jobs
   * @returns {number} Number of jobs resumed
   */
  resumeAllJobs() {
    const jobs = useStore.getState().jobs;
    let resumedCount = 0;
    
    jobs.forEach(job => {
      if (job.status === 'processing' || job.status === 'queued') {
        const resumed = this.resumeJobProgress(job.campaignId, job.runId);
        if (resumed) resumedCount++;
      }
    });
    
    return resumedCount;
  }

  /**
   * Close the broadcast EventSource connection
   */
  closeBroadcastConnection() {
    if (this.#eventSource) {
      this.#eventSource.close();
      this.#eventSource = null;
      
      // Clear any reconnect timer
      if (this.#reconnectTimer) {
        clearTimeout(this.#reconnectTimer);
        this.#reconnectTimer = null;
      }
    }
  }

  /**
   * Get the status of a job
   * @param {string} runId - The run ID for the job
   * @returns {string|null} The job status or null if not found
   */
  getJobStatus(runId) {
    return this.#jobStatuses.get(runId) || null;
  }

  /**
   * Check if a job is currently being tracked
   * @param {string} runId - The run ID for the job
   * @returns {boolean} Whether the job is being tracked
   */
  isTracking(runId) {
    return this.#trackedJobs.has(runId);
  }

  /**
   * Get all currently tracked job run IDs
   * @returns {string[]} Array of run IDs
   */
  getTrackedJobIds() {
    return Array.from(this.#trackedJobs);
  }

  /**
   * Stop tracking all jobs and close the connection
   * Marks all unfinished jobs as failed with "Interrupted by user" message
   */
  stopAll() {
    // Get all jobs from the store
    const jobs = useStore.getState().jobs;
    
    // Mark all unfinished jobs as failed
    jobs.forEach(job => {
      if (job.status === 'processing' || job.status === 'queued') {
        console.log(`JobProgressService: Marking job ${job.runId} as failed due to app shutdown`);
        
        // Update the store to mark the job as failed
        useStore.getState().failJob(
          job.campaignId,
          job.runId,
          'Interrupted by user'
        );
        
        // Update our internal status tracking
        this.#jobStatuses.set(job.runId, 'failed');
      }
    });
    
    // Clear batch operation state to ensure run buttons are enabled on restart
    useStore.getState().stopBatchOperation();
    
    // Clear tracking data
    this.#trackedJobs.clear();
    this.#jobStatuses.clear();
    
    // Close the connection
    this.closeBroadcastConnection();
  }

  /**
   * Handle job timeout by marking it as failed
   * @param {string} runId - The run ID for the job
   * @param {string} reason - The timeout reason
   */
  #handleJobTimeout(runId, reason) {
    // Find the campaign ID for this job
    const job = useStore.getState().jobs.find(j => j.runId === runId);
    if (job) {
      // Update the store with timeout error
      useStore.getState().failJob(
        job.campaignId,
        runId,
        reason
      );
    }
    
    // Clean up tracking
    this.#cleanupJobTracking(runId);
  }

  /**
   * Cancel all active and queued jobs
   * @returns {Promise<boolean>} Success status
   */
  async cancelAllJobs() {
    try {
      const result = await cancelAllJobs();
      
      // Mark all jobs as cancelled in the store
      const jobs = useStore.getState().jobs;
      jobs.forEach(job => {
        if (job.status === 'processing' || job.status === 'queued') {
          useStore.getState().failJob(
            job.campaignId,
            job.runId,
            'Cancelled by user'
          );
        }
      });
      
      // Clear all tracking
      this.#trackedJobs.clear();
      this.#jobStatuses.clear();
      
      // Clear timeouts
      this.#jobTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
      this.#queueTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
      this.#jobTimeouts.clear();
      this.#queueTimeouts.clear();
      
      console.log('JobProgressService: All jobs cancelled successfully');
      return true;
    } catch (error) {
      console.error('JobProgressService: Error cancelling all jobs:', error);
      return false;
    }
  }

  /**
   * Clean up job tracking and timeouts
   * @param {string} runId - The run ID for the job
   * @param {boolean} clearStatus - Whether to clear the job status (default: false)
   */
  #cleanupJobTracking(runId, clearStatus = false) {
    // Clear timeouts
    const queueTimeoutId = this.#queueTimeouts.get(runId);
    if (queueTimeoutId) {
      clearTimeout(queueTimeoutId);
      this.#queueTimeouts.delete(runId);
    }
    
    const jobTimeoutId = this.#jobTimeouts.get(runId);
    if (jobTimeoutId) {
      clearTimeout(jobTimeoutId);
      this.#jobTimeouts.delete(runId);
    }
    
    // Remove from tracking
    this.#trackedJobs.delete(runId);
    
    // Optionally clear status (only when explicitly requested)
    if (clearStatus) {
      this.#jobStatuses.delete(runId);
    }
  }
}

export default JobProgressService;
