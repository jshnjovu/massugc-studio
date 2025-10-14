import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store';
import iconImage from '/icon.png';

const loadingMessages = [
  'Initializing backend services...',
  'Loading AI models...',
  'Preparing studio workspace...',
  'Setting up content generation...',
  'Almost ready...'
];

function LoadingScreen() {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const darkMode = useStore(state => state.darkMode);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessageIndex(prev => 
        prev < loadingMessages.length - 1 ? prev + 1 : prev
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`min-h-screen flex items-center justify-center transition-all duration-300
      ${darkMode 
        ? 'bg-neutral-900' 
        : 'bg-neutral-50'
      }`}>
      <div className="text-center max-w-md mx-auto px-6">
        {/* Logo */}
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <img 
            src={iconImage} 
            alt="MassUGC Studio"
            className="h-16 w-16 mx-auto object-contain rounded-2xl drop-shadow-lg"
          />
        </motion.div>

        {/* Title */}
        <motion.h1 
          className={`text-2xl font-semibold mb-2 ${darkMode ? 'text-neutral-100' : 'text-neutral-900'}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
        >
          MassUGC Studio
        </motion.h1>

        <motion.p 
          className={`text-sm mb-12 ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
        >
          The CapCut for Brands
        </motion.p>

        {/* Loading animation */}
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <div className="flex items-center justify-center space-x-2 mb-6">
            <div className="w-2 h-2 bg-accent-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-accent-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-accent-500 rounded-full animate-bounce"></div>
          </div>

          {/* Progress bar */}
          <div className={`w-full h-1 rounded-full overflow-hidden ${darkMode ? 'bg-neutral-800' : 'bg-neutral-200'}`}>
            <motion.div 
              className="h-full bg-gradient-to-r from-accent-500 to-accent-600 rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
            />
          </div>
        </motion.div>

        {/* Status message */}
        <motion.div 
          className="min-h-[1.5rem]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          <motion.p 
            className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}
            key={currentMessageIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
          >
            {loadingMessages[currentMessageIndex]}
          </motion.p>
        </motion.div>

        {/* Version info */}
        <motion.div 
          className="mt-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
        >
          <p className={`text-xs ${darkMode ? 'text-neutral-600' : 'text-neutral-400'}`}>
            Version 1.0.0
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default LoadingScreen; 