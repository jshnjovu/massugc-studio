import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store';
import { ClockIcon, DocumentTextIcon, CalendarIcon, XCircleIcon } from '@heroicons/react/24/outline';
import JobProgressService from '../services/JobProgressService';
import RenderProgress from '../components/RenderProgress';
import { useCampaigns } from '../hooks/useData';

function RunningCampaignsPage() {
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(300);
  
  // Subscribe to all relevant store data for proper reactivity
  const jobs = useStore(state => state.jobs);
  const darkMode = useStore(state => state.darkMode);
  
  // Get campaigns from React Query
  const { data: campaignsData = [] } = useCampaigns();
  
  // Create simple campaign lookup (just need id and name for running jobs)
  const campaigns = campaignsData.map(job => ({
    id: job.id,
    name: job.job_name,
  }));
  
  // Ensure JobProgressService is initialized
  useEffect(() => {
    JobProgressService.getInstance().resumeAllJobs();
  }, []);

  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    in: { opacity: 1, y: 0 },
    out: { opacity: 0, y: -20 }
  };

  const pageTransition = {
    type: 'tween',
    ease: 'anticipate',
    duration: 0.5
  };

  // Format elapsed time - takes job object and returns formatted duration
  const formatElapsedTime = (job) => {
    if (!job) return '0s';
    
    // For processing jobs, use processingStartTime if available to show actual work time
    // For queued jobs, use startTime to show total wait time
    const referenceTime = (job.status === 'processing' && job.processingStartTime) 
      ? job.processingStartTime 
      : job.startTime;
    
    if (!referenceTime) return '0s';
    
    const startTime = new Date(referenceTime);
    const now = new Date();
    const elapsedMs = now - startTime;
    
    // Ensure we don't show negative time
    if (elapsedMs < 0) return '0s';
    
    const seconds = Math.floor(elapsedMs / 1000) % 60;
    const minutes = Math.floor(elapsedMs / (1000 * 60)) % 60;
    const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Format execution time for completed jobs
  const formatExecutionTime = (job) => {
    if (!job) return 'Unknown';
    
    // Use processingStartTime if available (actual work time), otherwise fall back to startTime
    const workStartTime = job.processingStartTime || job.startTime;
    const endTime = job.completedAt || job.failedAt;
    
    if (!workStartTime || !endTime) return 'Unknown';
    
    const startTime = new Date(workStartTime);
    const completedTime = new Date(endTime);
    const durationMs = completedTime - startTime;
    
    // If duration is negative or very small, it might be an error
    if (durationMs < 0) return 'Unknown';
    
    const seconds = Math.floor(durationMs / 1000) % 60;
    const minutes = Math.floor(durationMs / (1000 * 60)) % 60;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Format date for displaying completion time
  const formatCompletionTime = (timeIso) => {
    if (!timeIso) return 'Unknown';
    const date = new Date(timeIso);
    return date.toLocaleString();
  };

  // Filter jobs by status
  const filteredJobs = statusFilter === 'all' 
    ? jobs 
    : jobs.filter(job => job.status === statusFilter);

  // Sort jobs with newest first
  const sortedJobs = [...filteredJobs].sort((a, b) =>
    new Date(b.startTime) - new Date(a.startTime)
  );

  // Pagination calculations
  const totalPages = Math.ceil(sortedJobs.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedJobs = sortedJobs.slice(startIndex, endIndex);

  // Reset to page 1 if current page is beyond total pages
  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(1);
  }

  // Get campaign name for a job
  const getCampaignName = (campaignId) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    return campaign ? campaign.name : 'Unknown Campaign';
  };

  // Cancel all jobs function
  const handleCancelAllJobs = async () => {
    try {
      const result = await JobProgressService.getInstance().cancelAllJobs();
      if (result) {
        // Show success message
        console.log('All jobs cancelled successfully');
        setError(null);
      }
    } catch (error) {
      console.error('Error cancelling all jobs:', error);
      setError('Failed to cancel all jobs. Please try again.');
    }
  };

  // Get unique statuses from jobs for filter options
  const statusOptions = [
    { id: 'all', name: 'All', count: jobs.length },
    { id: 'processing', name: 'Running', count: jobs.filter(j => j.status === 'processing').length },
    { id: 'queued', name: 'Queued', count: jobs.filter(j => j.status === 'queued').length },
    { id: 'completed', name: 'Completed', count: jobs.filter(j => j.status === 'completed').length },
    { id: 'failed', name: 'Failed', count: jobs.filter(j => j.status === 'failed').length }
  ].filter(option => option.id === 'all' || option.count > 0); // Only show statuses that have jobs

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
    >
      {/* Top section with title */}
      <div className="flex justify-between items-center">
        <h1 className={`text-2xl font-bold ${darkMode ? 'text-primary-100' : 'text-primary-900'}`}>
          Running Campaigns
        </h1>
        
        {/* Cancel All Button - only show if there are active jobs */}
        {jobs.some(job => job.status === 'processing' || job.status === 'queued') && (
          <div className="relative group">
            <motion.button
              onClick={handleCancelAllJobs}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                darkMode 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <XCircleIcon className="h-4 w-4" />
              Cancel All Jobs
            </motion.button>
            
            {/* Custom Tooltip */}
            <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-2 px-3 py-2 text-sm font-medium rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap z-50 bg-accent-500/10 dark:bg-accent-500/20 text-accent-500 border border-accent-500/20">
              ⚠️ Cancels queued jobs instantly. Processing jobs may need app restart.
              <div className="absolute left-full top-1/2 transform -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-l-4 border-transparent border-l-accent-500/20"></div>
            </div>
          </div>
        )}
      </div>

      {/* Status filter buttons */}
      {jobs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {statusOptions.map(status => (
            <motion.button
              key={status.id}
              onClick={() => setStatusFilter(status.id)}
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
                statusFilter === status.id
                  ? darkMode 
                      ? 'bg-accent-600 text-white' 
                      : 'bg-accent-500 text-white'
                  : darkMode
                      ? 'bg-dark-600 text-primary-300 hover:bg-dark-500'
                      : 'bg-neutral-100 text-primary-700 hover:bg-neutral-200'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {status.name} {status.count > 0 && status.id !== 'all' && `(${status.count})`}
            </motion.button>
          ))}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className={`p-4 rounded-lg ${darkMode ? 'bg-red-900/20 text-red-400' : 'bg-red-100 text-red-600'}`}>
          {error}
        </div>
      )}

      {/* No jobs message */}
      {jobs.length === 0 ? (
        <div className={`text-center py-12 rounded-lg ${darkMode ? 'bg-dark-700' : 'bg-neutral-100'}`}>
          <p className={`text-lg ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
            No jobs currently running
          </p>
          <p className={`mt-2 ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
            Start a job from the Campaigns page
          </p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className={`text-center py-12 rounded-lg ${darkMode ? 'bg-dark-700' : 'bg-neutral-100'}`}>
          <p className={`text-lg ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
            No jobs with status "{statusFilter}"
          </p>
          <p className={`mt-2 ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
            Try selecting a different status filter
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {paginatedJobs.map(job => (
            <div
              key={`${job.campaignId}-${job.runId}`}
              className={`rounded-xl p-6 ${darkMode ? 'bg-neutral-800/50 border border-neutral-700' : 'bg-white border border-neutral-200'} shadow-md`}
            >
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className={`font-medium text-lg ${darkMode ? 'text-primary-100' : 'text-primary-900'}`}>
                    {getCampaignName(job.campaignId)}
                  </h3>
                  <div className={`text-xs mt-1 ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
                    Run ID: <span className="font-mono">{job.runId}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {job.status === 'completed' || job.status === 'failed' ? (
                    // For completed or failed jobs, show completion time and execution duration
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="h-4 w-4 text-gray-400" />
                        <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {formatCompletionTime(job.completedAt || job.failedAt)} ({formatExecutionTime(job)})
                        </span>
                      </div>
                    </div>
                  ) : (
                    // For processing jobs, show elapsed time
                    <div className="flex items-center gap-1">
                      <ClockIcon className="h-4 w-4 text-gray-400" />
                      <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {formatElapsedTime(job)}
                      </span>
                    </div>
                  )}
                  <div
                    className={`px-2.5 py-1.5 rounded-full text-xs font-medium ${
                      job.status === 'processing' 
                        ? 'bg-accent-500/10 dark:bg-accent-500/20 text-accent-500' 
                        : job.status === 'completed'
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                        : job.status === 'failed'
                        ? 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                        : job.status === 'queued'
                        ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400'
                        : 'bg-neutral-100 dark:bg-dark-600 text-primary-500'
                    }`}
                  >
                    {job.status === 'processing' 
                      ? 'Processing' 
                      : job.status === 'completed'
                      ? 'Completed'
                      : job.status === 'failed'
                      ? 'Failed'
                      : job.status === 'queued'
                      ? 'Queued'
                      : 'Unknown'}
                  </div>
                </div>
              </div>
              
              {job.runId && (
                <div className="mt-4">
                  <RenderProgress 
                    runId={job.runId}
                    initialProgress={job.progress || 0}
                    status={job.status}
                    message={job.message}
                    error={job.error}
                    outputPath={job.outputPath}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {sortedJobs.length > 0 && (
          <div className={`px-6 py-4 border-t ${darkMode ? 'border-neutral-700' : 'border-neutral-200'}`}>
            <div className="flex items-center justify-between">
              {/* Page size selector */}
              <div className="flex items-center gap-2">
                <span className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                  Show:
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1); // Reset to page 1 when changing page size
                  }}
                  className={`text-sm rounded border px-2 py-1 ${darkMode
                    ? 'bg-dark-600 border-dark-500 text-primary-100'
                    : 'bg-white border-neutral-300 text-neutral-900'
                  }`}
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={300}>300</option>
                  <option value={500}>500</option>
                </select>
                <span className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                  jobs per page
                </span>
              </div>

              {/* Page info and controls */}
              <div className="flex items-center gap-4">
                <span className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                  Showing {startIndex + 1}-{Math.min(endIndex, sortedJobs.length)} of {sortedJobs.length}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 text-sm rounded border transition-colors ${
                      currentPage === 1
                        ? darkMode
                          ? 'bg-dark-700 border-dark-600 text-neutral-500 cursor-not-allowed'
                          : 'bg-neutral-100 border-neutral-300 text-neutral-400 cursor-not-allowed'
                        : darkMode
                          ? 'bg-dark-600 border-dark-500 text-primary-100 hover:bg-dark-500'
                          : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    Previous
                  </button>

                  <span className={`px-3 py-1 text-sm ${darkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1 text-sm rounded border transition-colors ${
                      currentPage === totalPages
                        ? darkMode
                          ? 'bg-dark-700 border-dark-600 text-neutral-500 cursor-not-allowed'
                          : 'bg-neutral-100 border-neutral-300 text-neutral-400 cursor-not-allowed'
                        : darkMode
                          ? 'bg-dark-600 border-dark-500 text-primary-100 hover:bg-dark-500'
                          : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </motion.div>
  );
}

export default RunningCampaignsPage;