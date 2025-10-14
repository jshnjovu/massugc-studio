import React from 'react';
import { motion } from 'framer-motion';
import { 
  VideoCameraIcon, 
  ClockIcon, 
  CheckCircleIcon, 
  ArrowPathIcon, 
  ExclamationTriangleIcon,
  PlayIcon
} from '@heroicons/react/24/outline';
import { useStore } from '../store';
import Button from './Button';

// Statuses and their corresponding icons/colors
const statusConfig = {
  ready: {
    icon: VideoCameraIcon,
    iconColor: 'text-primary-500',
    bgColor: 'bg-neutral-100 dark:bg-dark-600',
    label: 'Ready'
  },
  queued: {
    icon: ClockIcon,
    iconColor: 'text-primary-500',
    bgColor: 'bg-neutral-100 dark:bg-dark-600',
    label: 'Queued'
  },
  processing: {
    icon: ArrowPathIcon,
    iconColor: 'text-accent-500',
    bgColor: 'bg-accent-500/10 dark:bg-accent-500/20',
    label: 'Processing'
  },
  completed: {
    icon: CheckCircleIcon,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    label: 'Completed'
  },
  failed: {
    icon: ExclamationTriangleIcon,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    label: 'Failed'
  }
};

function CampaignCard({ campaign, onRun, isSelectable = false, isSelected = false, onToggleSelect = () => {} }) {
  const { name, status, created_at, progress, product, output_path } = campaign;
  const { icon: StatusIcon, iconColor, bgColor, label } = statusConfig[status] || statusConfig.ready;
  const darkMode = useStore(state => state.darkMode);
  const exports = useStore(state => state.exports);
  
  // Count exports for this campaign
  const campaignExports = exports.filter(exp => exp.campaignId === campaign.id);
  const exportCount = campaignExports.length;
  
  // Format the creation date
  const formattedDate = new Date(created_at).toLocaleDateString();
  
  // Handle card click for selection
  const handleCardClick = () => {
    if (isSelectable) {
      onToggleSelect();
    }
  };
  
  return (
    <motion.div 
      className={`relative overflow-hidden rounded-xl transition-all duration-200 border p-5 flex flex-col justify-between
        ${darkMode 
          ? 'bg-dark-700 border-dark-600 shadow-lg' 
          : 'bg-white border-primary-200/60 shadow-md hover:shadow-lg'
        }
        ${isSelectable ? 'cursor-pointer' : ''}
        ${isSelected ? 'ring-2 ring-accent-500' : ''}
      `}
      whileHover={{ y: -5 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={handleCardClick}
    >
      {/* Progress bar (only shown when rendering/processing) */}
      {(status === 'rendering' || status === 'processing') && (
        <div className="absolute left-0 top-0 h-1 bg-accent-500" style={{ width: `${progress || 0}%` }}></div>
      )}
      
      {/* Top row with name */}
      <div className="flex justify-between items-start mb-3">
        <h3 className={`font-medium text-lg truncate
          ${darkMode ? 'text-primary-100' : 'text-primary-900'}`}>
          {name}
        </h3>
        
        {/* Selection indicator */}
        {isSelectable && isSelected && (
          <CheckCircleIcon className="h-5 w-5 text-accent-500" />
        )}
      </div>
      
      {/* Middle content */}
      <div className="flex-grow">
        {/* Product */}
        <div className="mb-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Product:</span>
          <div className="flex items-center gap-2">
            <p className="font-medium">{product}</p>
            {campaign.useExactScript && (
              <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full">
                📝 Exact Script
              </span>
            )}
          </div>
        </div>
        
        {/* Output path if completed */}
        {status === 'completed' && output_path && (
          <div className="mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Output:</span>
            <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{output_path}</p>
          </div>
        )}
        
        {/* Run button (only if ready or failed) */}
        {(status === 'ready' || status === 'failed') && !isSelectable && (
          <div className="mt-4">
            <Button 
              variant="primary" 
              size="sm"
              icon={<PlayIcon className="h-4 w-4" />}
              onClick={(e) => {
                e.stopPropagation();
                onRun();
              }}
            >
              Run Campaign
            </Button>
          </div>
        )}
      </div>
      
      {/* Bottom area with status and date */}
      <div className={`flex justify-between items-center pt-3 border-t mt-3
        ${darkMode ? 'border-dark-600' : 'border-primary-100'}`}>
        <div className={`flex items-center px-2.5 py-1.5 rounded-full ${bgColor} text-xs font-medium`}>
          <StatusIcon className={`${iconColor} h-3.5 w-3.5 mr-1.5`} />
          <span>{label}</span>
        </div>
        <div className={`text-xs ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>{formattedDate}</div>
      </div>
    </motion.div>
  );
}

export default CampaignCard; 