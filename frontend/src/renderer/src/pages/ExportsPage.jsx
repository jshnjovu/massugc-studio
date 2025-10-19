import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  PlayIcon, 
  TrashIcon, 
  CheckIcon,
  FolderOpenIcon,
  CalendarIcon,
  CloudIcon,
  LinkIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import Button from '../components/Button';
import Modal from '../components/Modal';
import { useStore } from '../store';
import { useCampaigns } from '../hooks/useData';


// Helper function to format date (simplified)
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric'
  });
};

// Helper function to check if path is a Google Drive URL
const isDriveUrl = (path) => {
  return path && (path.startsWith('http') && path.includes('drive.google.com'));
};

// Helper function to copy text to clipboard
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
};

// Removed complex Google Drive logo

function ExportsPage() {
  const [filter, setFilter] = useState('all');
  // Removed colors state as we no longer use thumbnails
  const [currentVideo, setCurrentVideo] = useState(null);
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedExports, setSelectedExports] = useState({});
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const videoRef = useRef(null);
  
  // Get data from global store and React Query
  const exports = useStore(state => state.exports);
  const removeExport = useStore(state => state.removeExport);
  const darkMode = useStore(state => state.darkMode);
  
  // Get campaigns from React Query
  const { data: campaignsData = [] } = useCampaigns();
  
  // Create simple campaign lookup (just need id and name for exports)
  const campaigns = campaignsData.map(job => ({
    id: job.id,
    name: job.job_name,
  }));
  
  // Reset selections when exiting manage mode
  useEffect(() => {
    if (!isManageMode) {
      setSelectedExports({});
    }
  }, [isManageMode]);
  
  
  // Handle video playback
  useEffect(() => {
    if (currentVideo && videoRef.current) {
      // Make sure we use file:// protocol for local files
      if (currentVideo.path && !currentVideo.path.startsWith('file://')) {
        videoRef.current.src = `file://${currentVideo.path}`;
      } else {
        videoRef.current.src = currentVideo.path;
      }
      
      videoRef.current.play().catch(err => {
        console.error('Video playback error:', err);
      });
    }
  }, [currentVideo]);
  
  // Sort exports by creation date (newest first) - removed filtering, just show all
  const sortedExports = useMemo(() => {
    return [...exports].sort((a, b) => {
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      return dateB - dateA; // Newest first
    });
  }, [exports]);
  
  const handlePlayVideo = (exprt) => {
    if (isManageMode) return; // Don't play videos in manage mode
    
    // Check if the file exists before trying to play it
    if (exprt.path) {
      setCurrentVideo(exprt);
    } else {
      console.error('Video file not available:', exprt.name);
    }
  };
  
  const handleCloseVideo = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setCurrentVideo(null);
  };
  
  const handleOpenFileLocation = (exprt) => {
    if (!exprt.path) return;
    
    if (isDriveUrl(exprt.path)) {
      // Open Drive URL in browser
      window.open(exprt.path, '_blank');
    } else if (window.electron) {
      // Open local file location
      window.electron.ipcRenderer.invoke('show-in-folder', exprt.path)
        .catch(err => console.error('Error showing file in folder:', err));
    }
  };
  
  const handleCopyDriveLink = async (exprt) => {
    if (exprt.path && isDriveUrl(exprt.path)) {
      const success = await copyToClipboard(exprt.path);
      if (success) {
        // You could add a toast notification here
        console.log('Link copied to clipboard');
      }
    }
  };
  
  const toggleManageMode = () => {
    setIsManageMode(!isManageMode);
  };
  
  const toggleExportSelection = (exportId) => {
    setSelectedExports(prev => ({
      ...prev,
      [exportId]: !prev[exportId]
    }));
  };
  
  const getSelectedCount = () => {
    return Object.values(selectedExports).filter(Boolean).length;
  };
  
  const getSelectedExports = () => {
    return exports.filter(exprt => selectedExports[exprt.id]);
  };
  
  const handleDeleteSelected = () => {
    const selectedIds = Object.keys(selectedExports).filter(id => selectedExports[id]);
    
    // Delete each selected export
    selectedIds.forEach(id => {
      const exprt = exports.find(e => e.id === id);
      if (exprt && exprt.path) {
        // Delete the file from disk if applicable
        if (window.electron) {
          window.electron.ipcRenderer.invoke('delete-file', exprt.path)
            .catch(err => console.error(`Error deleting file: ${err}`));
        }
      }
      // Remove from store
      removeExport(id);
    });
    
    // Exit manage mode and close delete modal
    setIsManageMode(false);
    setIsDeleteModalOpen(false);
    setSelectedExports({});
  };
  
  // Helper to get original file name from path
  const getOriginalFileName = (path) => {
    if (!path) return '';
    return path.split(/[\\/]/).pop();
  };
  
  // Helper to get display name (campaign name + runId)
  const getDisplayName = (exprt) => {
    const campaign = campaigns.find(c => c.id === exprt.campaignId)?.name || 'Unknown';
    const runIdPrefix = exprt.runId ? exprt.runId.substring(0, 8) : '';
    // Replace spaces with hyphens
    return `${campaign.replace(/\s+/g, '-')}-${runIdPrefix}`;
  };
  
  return (
    <motion.div 
      className="space-y-8 px-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
        <h2 className="text-2xl font-display font-medium">Exports</h2>
        
        <div className="flex flex-wrap gap-2 items-center">
          {isManageMode ? (
            <>
              <Button 
                variant="tertiary" 
                onClick={toggleManageMode}
              >
                Cancel
              </Button>
              <Button 
                variant="danger" 
                icon={<TrashIcon className="h-5 w-5" />}
                onClick={() => getSelectedCount() > 0 && setIsDeleteModalOpen(true)}
                disabled={getSelectedCount() === 0}
              >
                Delete {getSelectedCount() > 0 ? `(${getSelectedCount()})` : ''}
              </Button>
            </>
          ) : (
            <Button 
              variant="secondary" 
              onClick={toggleManageMode}
            >
              Manage
            </Button>
          )}
        </div>
      </div>
      
      
      {sortedExports.length === 0 ? (
        <div className={`text-center py-16 ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
          <p className="text-lg">No exports found</p>
          <p className="mt-2">Complete a campaign to generate exports</p>
        </div>
      ) : (
        <>
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.1
                }
              }
            }}
            initial="hidden"
            animate="show"
          >
            {(() => {
              // Pagination calculations
              const totalPages = Math.ceil(sortedExports.length / pageSize);
              const startIndex = (currentPage - 1) * pageSize;
              const endIndex = startIndex + pageSize;
              const paginatedExports = sortedExports.slice(startIndex, endIndex);

              // Reset to page 1 if current page is beyond total pages
              if (currentPage > totalPages && totalPages > 0) {
                setCurrentPage(1);
              }

              return paginatedExports.map((exprt) => {
            const campaign = campaigns.find(c => c.id === exprt.campaignId)?.name || 'Unknown Campaign';
            const displayName = getDisplayName(exprt);
            const fileName = getOriginalFileName(exprt.path);
            
            return (
              <motion.div 
                key={exprt.id} 
                className={`rounded-lg shadow-md border hover:shadow-lg transition-all p-4
                  ${isManageMode && selectedExports[exprt.id] ? 'ring-2 ring-accent-500' : ''}
                  ${darkMode 
                    ? 'bg-neutral-800/50 border-neutral-700' 
                    : 'bg-white border-neutral-200'
                  }`}
                variants={{
                  hidden: { y: 20, opacity: 0 },
                  show: { y: 0, opacity: 1 }
                }}
                onClick={() => isManageMode && toggleExportSelection(exprt.id)}
              >
                <div className="flex items-center gap-3">
                  {/* Selection checkbox for manage mode */}
                  {isManageMode && (
                    <div className={`rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0
                      ${selectedExports[exprt.id]
                        ? 'bg-accent-500 text-white'
                        : darkMode 
                          ? 'bg-dark-900/70 border border-white/30' 
                          : 'bg-white/70 border border-black/30'
                      }`}>
                      {selectedExports[exprt.id] && <CheckIcon className="h-4 w-4" />}
                    </div>
                  )}
                  
                  {/* Play button */}
                  {!isManageMode && (
                    <button 
                      className={`flex-shrink-0 p-2 rounded-full transition-colors
                        ${darkMode 
                          ? 'bg-neutral-700 hover:bg-neutral-600 text-white' 
                          : 'bg-neutral-600 hover:bg-neutral-700 text-white'
                        }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayVideo(exprt);
                      }}
                      disabled={!exprt.path}
                      title={exprt.path ? 'Play video' : 'Video file not available'}
                    >
                      <PlayIcon className="h-5 w-5" />
                    </button>
                  )}
                  
                  {/* Video info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className={`font-medium truncate ${darkMode ? 'text-primary-100' : 'text-primary-900'}`} title={fileName}>
                        {campaign}
                      </h3>
                      
                      {/* Storage indicator */}
                      <div className="flex items-center ml-2">
                        {isDriveUrl(exprt.path) ? (
                          <CloudIcon className="h-5 w-5 text-blue-500" />
                        ) : (
                          <FolderOpenIcon className={`h-5 w-5 ${darkMode ? 'text-primary-400' : 'text-primary-600'}`} />
                        )}
                      </div>
                    </div>
                    
                    <div className={`text-sm ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
                      {formatDate(exprt.createdAt)}
                    </div>
                  </div>
                </div>
                
                {/* Action buttons */}
                {!isManageMode && (
                  <div className={`flex gap-2 mt-3 pt-3 border-t ${darkMode ? 'border-neutral-700' : 'border-neutral-200'}`}>
                    {isDriveUrl(exprt.path) ? (
                      // Google Drive buttons
                      <>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          icon={<CloudIcon className="h-4 w-4" />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenFileLocation(exprt);
                          }}
                          title="View in Google Drive"
                        >
                          View in Drive
                        </Button>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          icon={<LinkIcon className="h-4 w-4" />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyDriveLink(exprt);
                          }}
                          title="Copy Drive link"
                        >
                          Copy Link
                        </Button>
                      </>
                    ) : (
                      // Local file button
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        icon={<FolderOpenIcon className="h-4 w-4" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenFileLocation(exprt);
                        }}
                        disabled={!exprt.path}
                        title={exprt.path ? 'Show in folder' : 'Video file not available'}
                      >
                        Show in folder
                      </Button>
                    )}
                  </div>
                )}
              </motion.div>
            );
              });
            })()}
          </motion.div>

          {/* Pagination */}
          {sortedExports.length > 0 && (() => {
            const totalPages = Math.ceil(sortedExports.length / pageSize);
            const startIndex = (currentPage - 1) * pageSize;
            const endIndex = startIndex + pageSize;

            return (
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
                      <option value={500}>500</option>
                    </select>
                    <span className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                      exports per page
                    </span>
                  </div>

                  {/* Page info and controls */}
                  <div className="flex items-center gap-4">
                    <span className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                      Showing {startIndex + 1}-{Math.min(endIndex, sortedExports.length)} of {sortedExports.length}
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
            );
          })()}
        </>
      )}
      
      {/* Video player modal */}
      {currentVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
          <div className="relative w-full max-w-4xl">
            <div className="absolute top-2 right-2 z-10 flex space-x-2">
              <button 
                className="bg-white/20 hover:bg-white/30 rounded-full p-2 text-white"
                onClick={handleCloseVideo}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button 
                className="bg-white/20 hover:bg-white/30 rounded-full p-2 text-white"
                onClick={() => handleOpenFileLocation(currentVideo)}
              >
                <FolderOpenIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="bg-black/50 p-3 rounded-t-lg">
              <h3 className="text-white font-medium">{getDisplayName(currentVideo)}</h3>
              <p className="text-white/70 text-sm truncate">{getOriginalFileName(currentVideo.path)}</p>
            </div>
            <video 
              ref={videoRef} 
              className="w-full h-auto max-h-[80vh] rounded-b-lg" 
              controls
              autoPlay
              src={currentVideo.path ? 
                (isDriveUrl(currentVideo.path) ? currentVideo.path : `file://${currentVideo.path}`) 
                : undefined}
            />
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Exports"
        size="sm"
      >
        <div className="space-y-4">
          <p className={darkMode ? 'text-primary-200' : 'text-primary-700'}>
            Are you sure you want to delete {getSelectedCount()} {getSelectedCount() === 1 ? 'export' : 'exports'}? This action cannot be undone.
          </p>
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="tertiary"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={<TrashIcon className="h-5 w-5" />}
              onClick={handleDeleteSelected}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}

export default ExportsPage; 