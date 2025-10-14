import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useStore } from '../store';

function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-md',
  size = 'md',
  closeButton = true,
  showOverlay = true,
  headerActions = null,
  needsScrolling = false
}) {
  const darkMode = useStore(state => state.darkMode);
  
  // Map size to maxWidth class
  const sizeToWidth = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-full mx-4'
  };
  
  const finalMaxWidth = sizeToWidth[size] || maxWidth;
  
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className={`fixed z-50 inset-0 ${needsScrolling ? 'overflow-y-auto' : 'overflow-y-hidden'}`} onClose={onClose}>
        <div className="flex items-center justify-center min-h-screen py-0 sm:py-2 text-center">
          {showOverlay && (
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Dialog.Overlay className={`fixed inset-0 transition-opacity ${
                darkMode 
                  ? 'bg-neutral-900/80 backdrop-blur-sm' 
                  : 'bg-neutral-900/20 backdrop-blur-sm'
              }`} />
            </Transition.Child>
          )}

          {/* This element is to trick the browser into centering the modal contents. */}
          <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
            &#8203;
          </span>
          
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <motion.div
              className={`inline-block align-bottom rounded-2xl pt-3 pb-1 px-6 text-left transform transition-all sm:my-0 sm:align-middle ${finalMaxWidth} w-full
                ${darkMode
                  ? 'backdrop-blur-xl border border-neutral-700/50 shadow-2xl text-neutral-100'
                  : 'bg-white/95 backdrop-blur-xl border border-neutral-200/50 shadow-2xl text-neutral-900'
                }`}
              style={{
                backgroundColor: darkMode ? '#141414' : undefined
              }}
              initial={{ y: 20, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {closeButton && (
                <div className="absolute top-4 right-4 z-10">
                  <motion.button
                    type="button"
                    className={`p-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent-500/50
                      ${darkMode 
                        ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50' 
                        : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100/50'
                      }`}
                    onClick={onClose}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                  </motion.button>
                </div>
              )}
              
              {(title || headerActions) && (
                <div className="flex items-center justify-between mb-3">
                  {title && (
                    <Dialog.Title as="h3" className={`text-lg font-semibold leading-6 ${headerActions ? '' : 'pr-8'}
                      ${darkMode ? 'text-neutral-100' : 'text-neutral-900'}`}>
                      {title}
                    </Dialog.Title>
                  )}
                  {headerActions && (
                    <div className="flex items-center gap-2">
                      {headerActions}
                    </div>
                  )}
                </div>
              )}
              
              <div className="relative">
                {children}
              </div>
            </motion.div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}

export default Modal; 