import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircleIcon, XCircleIcon, DocumentTextIcon, ClockIcon } from '@heroicons/react/24/outline';
import JobProgressService from '../services/JobProgressService';
import { useStore } from '../store';

export default function RenderProgress({ runId, initialProgress = 0, status = 'processing', message, error, outputPath }) {
  const [progress, setProgress] = useState(initialProgress);
  const [currentMessage, setCurrentMessage] = useState(message || 'Processing...');
  const [currentStatus, setCurrentStatus] = useState(status);
  const [currentOutputPath, setCurrentOutputPath] = useState(outputPath);
  const jobs = useStore(state => state.jobs);
  
  // Find the job in the store to get latest data
  useEffect(() => {
    const job = jobs.find(job => job.runId === runId);
    if (job) {
      setProgress(job.progress || initialProgress);
      
      // Set appropriate message based on status
      if (job.status === 'completed') {
        setCurrentMessage(job.message || 'Processing complete!');
      } else if (job.status === 'failed') {
        setCurrentMessage(job.message || 'Processing failed');
      } else if (job.status === 'queued') {
        setCurrentMessage(job.message || 'Waiting in queue...');
      } else {
        setCurrentMessage(job.message || message || 'Processing...');
      }
      
      setCurrentStatus(job.status || status);
      setCurrentOutputPath(job.outputPath || outputPath);
    }
  }, [jobs, runId, initialProgress, message, status, outputPath]);
  
  const isCompleted = currentStatus === 'completed';
  const isFailed = currentStatus === 'failed';
  const isQueued = currentStatus === 'queued';
  
  return (
          <div className="w-full bg-white dark:bg-neutral-900 rounded-lg shadow-md p-4">
      {/* Progress Bar */}
      {!isCompleted && !isFailed && (
        <div className="relative pt-1 mb-2">
          <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200 dark:bg-neutral-800">
            <motion.div 
              className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                isQueued ? 'bg-yellow-500' : 'bg-blue-500'
              }`}
              initial={{ width: `${progress}%` }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-gray-600 dark:text-gray-400">
              {isQueued ? 'Queued' : `${progress}%`}
            </span>
          </div>
        </div>
      )}
      
      {/* Status Message with inline icon */}
      <div className="flex items-center gap-2 mb-2">
        <p className="text-gray-700 dark:text-gray-300 text-sm">
          {currentMessage}
        </p>
        {isCompleted && (
          <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0" aria-hidden="true" />
        )}
        
        {isFailed && (
          <XCircleIcon className="h-5 w-5 text-red-500 flex-shrink-0" aria-hidden="true" />
        )}
        
        {isQueued && (
          <ClockIcon className="h-5 w-5 text-yellow-500 flex-shrink-0" aria-hidden="true" />
        )}
        
      </div>
      
      {/* Output Path (if available) - Only show in the progress component if it's not already shown in the parent */}
      {isCompleted && currentOutputPath && (
        <div className="text-xs text-gray-600 dark:text-gray-400 mt-3 p-2 bg-gray-100 dark:bg-neutral-800 rounded overflow-x-auto">
          <div className="flex items-start gap-2">
            <DocumentTextIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium mb-1">Output File:</div>
              <p className="font-mono break-all">{currentOutputPath}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Error Message */}
      {error && (
        <div className="text-xs text-red-600 dark:text-red-400 mt-1 p-1.5 bg-red-100 dark:bg-red-900/20 rounded">
          {error}
        </div>
      )}
    </div>
  );
} 