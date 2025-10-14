import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayIcon, CheckCircleIcon, XCircleIcon, DocumentTextIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useStore } from '../store';

function JobProgressIndicator() {
  const navigate = useNavigate();
  const darkMode = useStore(state => state.darkMode);
  const jobs = useStore(state => state.jobs);
  
  // Get notifications from store
  const launchNotification = useStore(state => state.launchNotification);
  const completionNotification = useStore(state => state.completionNotification);
  const failureNotification = useStore(state => state.failureNotification);
  
  // Get clear notification functions
  const clearLaunchNotification = useStore(state => state.clearLaunchNotification);
  const clearCompletionNotification = useStore(state => state.clearCompletionNotification);
  const clearFailureNotification = useStore(state => state.clearFailureNotification);
  
  // Calculate stats for active jobs only (those with status === 'processing' or 'queued')
  const jobStats = useMemo(() => {
    // Filter to get only jobs with processing or queued status
    const activeJobs = jobs.filter(job => job.status === 'processing' || job.status === 'queued');
    
    if (activeJobs.length === 0) {
      return { count: 0, averageProgress: 0 };
    }
    
    // Calculate the average progress for active jobs only
    // Queued jobs have 0 progress, processing jobs have their actual progress
    const totalProgress = activeJobs.reduce((sum, job) => {
      return sum + (job.progress || 0);
    }, 0);
    
    const averageProgress = Math.round(totalProgress / activeJobs.length);
    
    return {
      count: activeJobs.length,
      averageProgress
    };
  }, [jobs]);

  // Handle click to navigate to running campaigns page
  const handleClick = () => {
    navigate('/running');
  };
  
  // Handle click to view export (placeholder function)
  const handleViewExport = (outputPath) => {
    // On Windows or Linux we might use electron shell to open file
    // For now just navigate to exports page
    navigate('/exports');
    
    // Clear the notification after navigating
    clearCompletionNotification();
  };
  
  return (
    <>
      {/* Notifications Container */}
      <div className="fixed z-30 flex flex-col-reverse gap-3 right-6 bottom-24">
        {/* Launch notification */}
        <AnimatePresence>
          {launchNotification && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`p-4 rounded-xl shadow-xl backdrop-blur-md border
                ${darkMode 
                  ? 'bg-accent-600/90 border-accent-500/20 text-white' 
                  : 'bg-accent-500/95 border-accent-400/20 text-white'
                }`}
            >
              <div className="flex items-center gap-3">
                <div className="p-1 rounded-lg bg-white/20">
                  <PlayIcon className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-medium">
                  {launchNotification.message}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
          
        {/* Completion notification */}
        <AnimatePresence>
          {completionNotification && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`p-4 rounded-xl shadow-xl backdrop-blur-md border cursor-pointer transition-transform hover:scale-105
                ${darkMode 
                  ? 'bg-success-600/90 border-success-500/20 text-white' 
                  : 'bg-success-500/95 border-success-400/20 text-white'
                }`}
              onClick={() => handleViewExport(completionNotification.outputPath)}
            >
              <div className="flex items-start gap-3">
                <div className="p-1 rounded-lg bg-white/20 mt-0.5">
                  <CheckCircleIcon className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium block">
                    {completionNotification.message}
                  </span>
                  {completionNotification.outputPath && (
                    <div className="flex items-center text-xs mt-2 opacity-90">
                      <DocumentTextIcon className="h-3 w-3 mr-1.5 flex-shrink-0" />
                      <span className="truncate max-w-[200px]">{completionNotification.outputPath}</span>
                    </div>
                  )}
                  <span className="text-xs opacity-75 block mt-2">Click to view exports</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Failure notification */}
        <AnimatePresence>
          {failureNotification && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`p-4 rounded-xl shadow-xl backdrop-blur-md border cursor-pointer transition-transform hover:scale-105 max-w-sm
                ${darkMode 
                  ? 'bg-error-600/90 border-error-500/20 text-white' 
                  : 'bg-error-500/95 border-error-400/20 text-white'
                }`}
              onClick={() => clearFailureNotification()}
            >
              <div className="flex items-start gap-3">
                <div className="p-1 rounded-lg bg-white/20 mt-0.5 flex-shrink-0">
                  <XCircleIcon className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium block">
                    {failureNotification.error}
                  </span>
                  <span className="text-xs opacity-75 block mt-2">Click to dismiss</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
  
      {/* Active jobs indicator */}
      <AnimatePresence>
        {jobStats.count > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className={`fixed z-20 bottom-6 right-6 p-4 rounded-xl shadow-xl backdrop-blur-md border cursor-pointer transition-all duration-200 hover:scale-105
              ${darkMode 
                ? 'bg-surface-dark-warm/95 border-content-700/50' 
                : 'bg-surface-light-warm/95 border-content-200/50'
              }`}
            onClick={handleClick}
            whileHover={{ y: -2 }}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${darkMode ? 'bg-accent-500/20' : 'bg-accent-100'}`}>
                <PlayIcon className={`h-4 w-4 ${darkMode ? 'text-accent-400' : 'text-accent-600'}`} />
              </div>
              <div className="flex-grow min-w-0">
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-sm font-medium ${darkMode ? 'text-content-200' : 'text-content-800'}`}>
                    {jobStats.count} job{jobStats.count > 1 ? 's' : ''} running
                  </span>
                  <span className={`text-xs font-mono ${darkMode ? 'text-content-400' : 'text-content-600'}`}>
                    {jobStats.averageProgress}%
                  </span>
                </div>
                <div className={`w-36 h-2 rounded-full overflow-hidden ${darkMode ? 'bg-content-700' : 'bg-content-200'}`}>
                  <motion.div 
                    className="bg-gradient-to-r from-accent-500 to-accent-600 h-2 rounded-full" 
                    initial={{ width: '0%' }}
                    animate={{ width: `${jobStats.averageProgress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default JobProgressIndicator; 