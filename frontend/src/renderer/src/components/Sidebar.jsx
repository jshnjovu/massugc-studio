import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FolderIcon, 
  PlayIcon,
  UserCircleIcon, 
  DocumentTextIcon, 
  FilmIcon,
  MusicalNoteIcon,
  ArrowUpTrayIcon, 
  Cog6ToothIcon 
} from '@heroicons/react/24/outline';
import { useStore } from '../store';
import iconImage from '/icon.png';

const navigation = [
  { name: 'Campaigns', icon: FolderIcon, href: '/campaigns' },
  { name: 'Running', icon: PlayIcon, href: '/running' },
  { name: 'Avatars', icon: UserCircleIcon, href: '/avatars' },
  { name: 'Scripts', icon: DocumentTextIcon, href: '/scripts' },
  { name: 'Clips', icon: FilmIcon, href: '/clips' },
  { name: 'Music', icon: MusicalNoteIcon, href: '/music' },
  { name: 'Exports', icon: ArrowUpTrayIcon, href: '/exports' },
];

function Sidebar({ isOpen }) {
  const darkMode = useStore(state => state.darkMode);
  
  return (
    <motion.div 
      className={`${isOpen ? 'w-20' : 'w-0'} flex flex-col fixed inset-y-0 z-30 transition-all duration-300 ease-out
        ${darkMode 
          ? 'bg-surface-dark-warm/95 backdrop-blur-sm border-r border-content-800/30' 
          : 'bg-surface-light-warm/95 backdrop-blur-sm border-r border-content-200/30'
        }`}
      animate={{ width: isOpen ? 80 : 0 }}
    >
      {/* Header with app icon */}
      <div className="h-14 flex items-center justify-center border-b divider-warm">
        <motion.div 
          className="h-8 w-8 flex items-center justify-center"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
        >
          <img 
            src={iconImage} 
            alt="MassUGC Studio"
            className="h-8 w-8 object-contain drop-shadow-sm rounded-lg"
          />
        </motion.div>
      </div>
      
      {/* Navigation */}
      <div className="flex-1 flex flex-col overflow-y-auto py-4">
        <nav className="flex-1 px-2 space-y-1">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `group relative flex flex-col items-center justify-center py-3 px-2 text-xs font-medium rounded-xl transition-all duration-200 interactive-spring ${
                  isActive 
                    ? darkMode
                      ? 'text-crimson-300 bg-gradient-to-b from-crimson-900/40 to-crimson-800/20 shadow-inner-glow border border-crimson-800/30'
                      : 'text-crimson-700 bg-gradient-to-b from-crimson-50 to-crimson-100/50 shadow-glow-crimson border border-crimson-200/50'
                    : darkMode
                      ? 'text-content-300 hover:text-content-100 hover:bg-content-900/30'
                      : 'text-content-700 hover:text-content-900 hover:bg-content-50/50'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <motion.div
                    whileHover={{ scale: 1.05, y: -1 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    className="flex flex-col items-center space-y-1"
                  >
                    <item.icon 
                      className={`h-5 w-5 ${isActive ? 'drop-shadow-sm' : ''}`} 
                      aria-hidden="true" 
                    />
                    <span className="text-xs leading-none font-medium">{item.name}</span>
                  </motion.div>
                  
                  {/* Active indicator with glow effect - aligned with icon center */}
                  {isActive && (
                    <motion.div 
                      className={`absolute -right-2 top-4 w-1 h-6 rounded-l-full ${
                        darkMode 
                          ? 'bg-gradient-to-b from-crimson-400 to-crimson-500 shadow-glow-crimson' 
                          : 'bg-gradient-to-b from-crimson-500 to-crimson-600 shadow-glow-crimson'
                      }`}
                      layoutId="activeIndicator"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        
        {/* Settings section */}
        <div className="px-2 pb-2">
          <div className={`h-px divider-warm mb-4 opacity-60`} />
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `group relative flex flex-col items-center justify-center py-3 px-2 text-xs font-medium rounded-xl transition-all duration-200 interactive-spring ${
                isActive 
                  ? darkMode
                    ? 'text-crimson-300 bg-gradient-to-b from-crimson-900/40 to-crimson-800/20 shadow-inner-glow border border-crimson-800/30'
                    : 'text-crimson-700 bg-gradient-to-b from-crimson-50 to-crimson-100/50 shadow-glow-crimson border border-crimson-200/50'
                  : darkMode
                    ? 'text-content-300 hover:text-content-100 hover:bg-content-900/30'
                    : 'text-content-700 hover:text-content-900 hover:bg-content-50/50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <motion.div
                  whileHover={{ scale: 1.05, y: -1 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className="flex flex-col items-center space-y-1"
                >
                  <Cog6ToothIcon 
                    className={`h-5 w-5 ${isActive ? 'drop-shadow-sm' : ''}`} 
                    aria-hidden="true" 
                  />
                  <span className="text-xs leading-none font-medium">Settings</span>
                </motion.div>
                
                {/* Active indicator with glow effect - aligned with icon center */}
                {isActive && (
                  <motion.div 
                    className={`absolute -right-2 top-4 w-1 h-6 rounded-l-full ${
                      darkMode 
                        ? 'bg-gradient-to-b from-crimson-400 to-crimson-500 shadow-glow-crimson' 
                        : 'bg-gradient-to-b from-crimson-500 to-crimson-600 shadow-glow-crimson'
                    }`}
                    layoutId="activeIndicator"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  />
                )}
              </>
            )}
          </NavLink>
        </div>
      </div>
    </motion.div>
  );
}

export default Sidebar; 