import React from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { useStore } from '../store';

// Valid page titles that correspond to actual routes
const validPages = ['campaigns', 'running', 'avatars', 'scripts', 'clips', 'exports', 'settings'];

// Helper function to get page title from path
const getPageTitle = (pathname) => {
  const path = pathname.split('/')[1];
  
  // Return null for invalid or empty paths
  if (!path || !validPages.includes(path.toLowerCase())) {
    return 'Welcome'; // Default to Campaigns if invalid
  }
  
  return path.charAt(0).toUpperCase() + path.slice(1);
};

function TitleBar({ onMenuClick }) {
  const location = useLocation();
  const pageTitle = getPageTitle(location.pathname);
  const darkMode = useStore(state => state.darkMode);

  return (
    <div className={`titlebar-drag-region h-14 flex items-center justify-between px-6 
      ${darkMode 
        ? 'bg-neutral-900/95 backdrop-blur-xl border-b border-neutral-800' 
        : 'bg-white/95 backdrop-blur-xl border-b border-neutral-200'
      }`}>
      <div className="flex items-center space-x-4">
        <motion.button 
          type="button"
          onClick={onMenuClick}
          className={`p-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent-500/50
            ${darkMode 
              ? 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800' 
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <span className="sr-only">Toggle sidebar</span>
          <Bars3Icon className="h-5 w-5" aria-hidden="true" />
        </motion.button>
        
        <div className="flex items-center space-x-3">
          <h1 className={`text-lg font-semibold tracking-tight
            ${darkMode ? 'text-neutral-100' : 'text-neutral-900'}`}>
            MassUGC Studio
          </h1>
          {pageTitle && (
            <>
              <div className={`w-1 h-1 rounded-full ${darkMode ? 'bg-neutral-600' : 'bg-neutral-400'}`} />
              <span className={`text-sm font-medium ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                {pageTitle}
              </span>
            </>
          )}
        </div>
      </div>
      
      {/* Status indicator - could be used for connection status */}
      <div className="flex items-center space-x-2">
        <div className={`w-2 h-2 rounded-full ${darkMode ? 'bg-success-500' : 'bg-success-500'}`} />
        <span className={`text-xs font-medium ${darkMode ? 'text-neutral-500' : 'text-neutral-500'}`}>
          Connected
        </span>
      </div>
    </div>
  );
}

export default TitleBar; 