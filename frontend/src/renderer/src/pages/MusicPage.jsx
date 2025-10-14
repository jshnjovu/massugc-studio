import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MusicalNoteIcon,
  PlusIcon,
  PlayIcon,
  PauseIcon,
  TrashIcon,
  XMarkIcon,
  CheckIcon,
  ArrowUpTrayIcon
} from '@heroicons/react/24/outline';
import Button from '../components/Button';
import Modal from '../components/Modal';
import { useStore } from '../store';
import { apiGet, API_URL } from '../utils/api';

// Helper to format duration
const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds)) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Helper to format file size
const formatFileSize = (size) => {
  if (size < 1024) return `${size} B`;
  else if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  else return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

function UploadMusicForm({ onSubmit, onCancel }) {
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const darkMode = useStore(state => state.darkMode);
  
  const processFiles = (selectedFiles) => {
    const validFiles = Array.from(selectedFiles).filter(file => {
      const validTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a'];
      return validTypes.includes(file.type) || file.name.toLowerCase().match(/\.(mp3|wav|ogg|m4a)$/);
    });

    if (validFiles.length !== selectedFiles.length) {
      setError('Some files were skipped. Only MP3, WAV, OGG, and M4A files are supported.');
    }

    setFiles(validFiles);
    setError('');
  };
  
  const handleFileChange = (e) => {
    const selectedFiles = e.target.files;
    if (selectedFiles.length > 0) {
      processFiles(selectedFiles);
    }
  };
  
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };
  
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      processFiles(droppedFiles);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('music_file', file);
        formData.append('title', file.name.replace(/\.[^/.]+$/, ''));
        formData.append('artist', 'Unknown');
        formData.append('category', 'upbeat_energy');
        formData.append('mood', 'energetic');

        const response = await fetch(`${API_URL}/api/enhancements/music/upload`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        return response.json();
      });

      await Promise.all(uploadPromises);
      onSubmit();
    } catch (error) {
      console.error('Upload failed:', error);
      setError(`Upload failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        {/* Drag & Drop Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragOver
              ? darkMode ? 'border-accent-400 bg-accent-900/20' : 'border-accent-400 bg-accent-50'
              : darkMode ? 'border-gray-600 bg-gray-800' : 'border-gray-300 bg-gray-50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            multiple
            accept=".mp3,.wav,.ogg,.m4a,audio/*"
            onChange={handleFileChange}
            className="hidden"
            id="music-files"
          />
          
          <ArrowUpTrayIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          
          <div>
            <label
              htmlFor="music-files"
              className="cursor-pointer text-accent-600 dark:text-accent-400 font-medium hover:underline"
            >
              Choose music files
            </label>
            <span className="text-gray-500 ml-1">or drag and drop</span>
          </div>
          
          <p className="text-sm text-gray-400 mt-2">
            MP3, WAV, OGG, M4A files supported
          </p>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded">
            {error}
          </div>
        )}
        
        {/* Selected Files */}
        {files.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Selected Files ({files.length})
            </p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {files.map((file, index) => (
                <div key={index} className={`p-3 rounded-md flex items-center justify-between
                  ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <div className="flex items-center min-w-0">
                    <MusicalNoteIcon className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => {
                      const newFiles = files.filter((_, i) => i !== index);
                      setFiles(newFiles);
                    }}
                    className="ml-2 text-red-500 hover:text-red-700 flex-shrink-0"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Form Actions */}
      <div className="flex justify-end space-x-3 mt-6">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          Cancel
        </Button>
        
        <Button
          type="submit"
          disabled={files.length === 0 || isLoading}
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Uploading...
            </>
          ) : (
            `Upload ${files.length} Track${files.length !== 1 ? 's' : ''}`
          )}
        </Button>
      </div>
    </form>
  );
}

const MusicPage = () => {
  const darkMode = useStore(state => state.darkMode);
  
  // State
  const [musicLibrary, setMusicLibrary] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [playingTrack, setPlayingTrack] = useState(null);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedTracks, setSelectedTracks] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  // Auto-dismiss success messages after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);
  
  const audioRef = useRef(null);

  // Load music library
  useEffect(() => {
    loadMusicLibrary();
  }, []);

  // Flatten tracks for table display
  useEffect(() => {
    if (!musicLibrary) return;
    
    let allTracks = [];
    Object.values(musicLibrary.tracks_by_category || {}).forEach(categoryTracks => {
      // Map file_path to filePath for consistency with avatars/clips
      const mappedTracks = categoryTracks.map(track => ({
        ...track,
        filePath: track.file_path
      }));
      allTracks = allTracks.concat(mappedTracks);
    });
    
    setTracks(allTracks);
  }, [musicLibrary]);

  // Audio cleanup
  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
        setCurrentAudio(null);
      }
    };
  }, []);

  const loadMusicLibrary = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiGet('/api/enhancements/music/library');
      setMusicLibrary(response);
    } catch (error) {
      console.error('Failed to load music library:', error);
      setError('Failed to load music library. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = (track) => {
    if (playingTrack?.id === track.id) {
      // Pause current track
      if (currentAudio) {
        currentAudio.pause();
        setPlayingTrack(null);
      }
    } else {
      // Play new track
      if (currentAudio) {
        currentAudio.pause();
      }

      // Use the filePath directly for local file system access
      // For electron: prefix with file:// protocol  
      const audioSrc = window.electron 
        ? `file://${track.filePath}` 
        : track.filePath;
      
      const audio = new Audio(audioSrc);
      audio.play().then(() => {
        setCurrentAudio(audio);
        setPlayingTrack(track);
        
        // Auto-pause when track ends
        audio.addEventListener('ended', () => {
          setPlayingTrack(null);
          setCurrentAudio(null);
        });
      }).catch(err => {
        console.error('Failed to play audio:', err);
        setError('Failed to play audio file. File may be corrupted.');
      });
    }
  };

  const handleDelete = async (trackIds) => {
    if (window.confirm(`Are you sure you want to delete ${trackIds.length} track${trackIds.length !== 1 ? 's' : ''}?`)) {
      try {
        const response = await fetch(`${API_URL}/api/enhancements/music/delete`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            track_ids: trackIds
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
          setSuccess(`${trackIds.length} track${trackIds.length !== 1 ? 's' : ''} deleted successfully`);
          setSelectedTracks({});
          setIsManageMode(false);
          await loadMusicLibrary();
        } else {
          throw new Error(result.error || 'Failed to delete tracks');
        }
      } catch (error) {
        console.error('Delete failed:', error);
        setError(`Failed to delete tracks: ${error.message}`);
      }
    }
  };

  const handleUploadSuccess = async () => {
    setIsUploadModalOpen(false);
    setSuccess('Music uploaded successfully!');
    await loadMusicLibrary();
  };

  const getCategoryName = (category) => {
    const names = {
      upbeat_energy: 'Upbeat',
      chill_vibes: 'Chill',
      corporate_clean: 'Corporate',
      trending_sounds: 'Trending',
      emotional: 'Emotional',
      epic_dramatic: 'Epic',
      minimal_ambient: 'Ambient',
      comedy_fun: 'Fun'
    };
    return names[category] || category;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Music Library
          </h1>
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Upload and manage background music for enhanced videos
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {tracks.length > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                setIsManageMode(!isManageMode);
                setSelectedTracks({});
              }}
            >
              {isManageMode ? 'Done' : 'Manage'}
            </Button>
          )}
          
          <Button 
            onClick={() => setIsUploadModalOpen(true)} 
            className="min-w-[140px]"
            icon={<PlusIcon className="w-5 h-5" />}
          >
            Upload Music
          </Button>
        </div>
      </div>

      {/* Success/Error Messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
          >
            <div className="flex justify-between items-start">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-500 hover:text-red-700"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4"
          >
            <div className="flex justify-between items-start">
              <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
              <button
                onClick={() => setSuccess(null)}
                className="text-green-500 hover:text-green-700"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Music Table */}
      {tracks.length === 0 ? (
        <div className="text-center py-12">
          <MusicalNoteIcon className="w-24 h-24 mx-auto text-gray-300 mb-4" />
          <h3 className={`text-lg font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            No music tracks yet
          </h3>
          <p className={`text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Upload some music files to get started
          </p>
          <Button 
            onClick={() => setIsUploadModalOpen(true)} 
            className="min-w-[140px]"
            icon={<PlusIcon className="w-5 h-5" />}
          >
            Upload Music
          </Button>
        </div>
      ) : (
        <>
          {/* Manage Mode Actions */}
          {isManageMode && (
            <div className={`p-4 rounded-lg border flex items-center justify-between ${
              darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={Object.keys(selectedTracks).length === tracks.length && tracks.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const allSelected = {};
                        tracks.forEach(track => {
                          allSelected[track.id] = true;
                        });
                        setSelectedTracks(allSelected);
                      } else {
                        setSelectedTracks({});
                      }
                    }}
                    className="rounded border-gray-300 text-accent-600 focus:ring-accent-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Select All
                  </span>
                </label>
                
                <span className="text-sm text-gray-500">
                  {Object.keys(selectedTracks).length} selected
                </span>
              </div>
              
              {Object.keys(selectedTracks).length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => handleDelete(Object.keys(selectedTracks))}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  <TrashIcon className="w-4 h-4 mr-2" />
                  Delete Selected
                </Button>
              )}
            </div>
          )}

          {/* Music Table */}
          <div className={`rounded-xl shadow-md overflow-hidden border
            ${darkMode ? 'bg-neutral-800/50 border-neutral-700' : 'bg-white border-neutral-200'}`}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-primary-200 dark:divide-dark-600">
                <thead className={darkMode ? 'bg-neutral-800' : 'bg-neutral-100'}>
                  <tr>
                    {isManageMode && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-12">
                        <input type="checkbox" className="rounded" disabled />
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Track
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${darkMode ? 'divide-neutral-700 bg-neutral-800/30' : 'divide-neutral-200 bg-white'}`}>
                  {(() => {
                    // Pagination calculations
                    const totalPages = Math.ceil(tracks.length / pageSize);
                    const startIndex = (currentPage - 1) * pageSize;
                    const endIndex = startIndex + pageSize;
                    const paginatedTracks = tracks.slice(startIndex, endIndex);

                    // Reset to page 1 if current page is beyond total pages
                    if (currentPage > totalPages && totalPages > 0) {
                      setCurrentPage(1);
                    }

                    return paginatedTracks.map(track => (
                    <motion.tr
                      key={track.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`${darkMode ? 'hover:bg-neutral-700/50' : 'hover:bg-neutral-50'}`}
                    >
                      {isManageMode && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedTracks[track.id] || false}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTracks({...selectedTracks, [track.id]: true});
                              } else {
                                const newSelected = {...selectedTracks};
                                delete newSelected[track.id];
                                setSelectedTracks(newSelected);
                              }
                            }}
                            className="rounded border-gray-300 text-accent-600 focus:ring-accent-500"
                          />
                        </td>
                      )}
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <MusicalNoteIcon className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-3" />
                          <div>
                            <div className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                              {track.title}
                            </div>
                            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {track.artist}
                            </div>
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                          ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                          {getCategoryName(track.category)}
                        </span>
                      </td>
                      
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                        {formatDuration(track.duration)}
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                        <button
                          onClick={() => handlePlay(track)}
                          className={`p-2 rounded-full transition-colors ${
                            playingTrack?.id === track.id
                              ? 'bg-accent-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-accent-600 hover:text-white'
                          }`}
                        >
                          {playingTrack?.id === track.id ? (
                            <PauseIcon className="w-4 h-4" />
                          ) : (
                            <PlayIcon className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </motion.tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {!loading && tracks.length > 0 && (() => {
            const totalPages = Math.ceil(tracks.length / pageSize);
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
                      tracks per page
                    </span>
                  </div>

                  {/* Page info and controls */}
                  <div className="flex items-center gap-4">
                    <span className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                      Showing {startIndex + 1}-{Math.min(endIndex, tracks.length)} of {tracks.length}
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

      {/* Upload Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload Music"
      >
        <UploadMusicForm
          onSubmit={handleUploadSuccess}
          onCancel={() => setIsUploadModalOpen(false)}
        />
      </Modal>
    </div>
  );
};

export default MusicPage;