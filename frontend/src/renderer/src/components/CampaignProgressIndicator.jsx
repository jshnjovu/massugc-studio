import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PlayIcon } from '@heroicons/react/24/outline';
import { useStore } from '../store';

function CampaignProgressIndicator() {
  const navigate = useNavigate();
  const darkMode = useStore(state => state.darkMode);
  const getActiveJobs = useStore(state => state.getActiveJobs);
  
  // Calculate stats for active jobs
  const jobStats = useMemo(() => {
    // Get active jobs from the store helper function
    const activeJobs = getActiveJobs();
    
    if (!activeJobs || activeJobs.length === 0) {
      return { count: 0, averageProgress: 0 };
    }
    
    // Calculate the average progress
    const totalProgress = activeJobs.reduce((sum, job) => {
      return sum + (job.progress || 0);
    }, 0);
    
    const averageProgress = Math.round(totalProgress / activeJobs.length);
    
    return {
      count: activeJobs.length,
      averageProgress
    };
  }, [getActiveJobs]);
  
  // If no active jobs, don't render anything
  if (jobStats.count === 0) {
    return null;
  }
  
  const handleClick = () => {
    navigate('/running');
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`fixed z-20 top-16 right-4 p-2 rounded-lg shadow-lg cursor-pointer hover:scale-105 transition-transform
        ${darkMode ? 'bg-dark-700 border border-dark-600' : 'bg-white border border-primary-200'}
      `}
      onClick={handleClick}
    >
      <div className="flex items-center gap-2">
        <div className="flex-shrink-0">
          <PlayIcon className={`h-5 w-5 ${darkMode ? 'text-accent-500' : 'text-accent-600'}`} />
        </div>
        <div className="flex-grow">
          <div className="flex justify-between items-center">
            <span className={`text-xs font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
              {jobStats.count} job{jobStats.count > 1 ? 's' : ''} running
            </span>
            <span className={`text-xs ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
              {jobStats.averageProgress}%
            </span>
          </div>
          <div className="w-36 h-1.5 bg-gray-200 rounded-full mt-1 dark:bg-neutral-800">
            <motion.div 
              className="bg-accent-500 h-1.5 rounded-full" 
              initial={{ width: '0%' }}
              animate={{ width: `${jobStats.averageProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default CampaignProgressIndicator; 