import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusIcon, PlayIcon, DocumentArrowUpIcon, TrashIcon, CheckIcon } from '@heroicons/react/24/outline';
import Button from '../components/Button';
import Modal from '../components/Modal';
import { useStore } from '../store';
import api from '../utils/api';
import { useClips, useCreateClip, useDeleteClip } from '../hooks/useData';
import { useQueryClient } from '@tanstack/react-query';

function NewClipForm({ onSubmit, onCancel }) {
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    product: '',
    file: null,
    filename: ''
  });
  const darkMode = useStore(state => state.darkMode);
  const [error, setError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  
  const processFile = (selectedFile) => {
    // Validate file type
    if (!selectedFile.name.toLowerCase().endsWith('.mov')) {
      setError('Only MOV files are supported');
      return;
    }
    
    setError('');
    setForm({
      ...form,
      file: selectedFile,
      filename: selectedFile.name,
    });
  };
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm({
      ...form,
      [name]: value,
    });
  };
  
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      processFile(file);
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
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFile(files[0]);
    }
  };
  
  const handleSelectFile = async () => {
    try {
      if (!window.electron) {
        // Fallback for development or if electron is not available
        document.getElementById('clip-file').click();
        return;
      }
      
      // Use Electron's file dialog
      const result = await window.electron.ipcRenderer.invoke('select-file-dialog', {
        title: 'Select Product Clip Video',
        buttonLabel: 'Select Video',
        filters: [
          { name: 'MOV Files', extensions: ['mov'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      
      if (result.success) {
        const filename = result.filePath.split(/[\\/]/).pop();
        setForm({
          ...form,
          file: result.filePath,
          filename: filename
        });
      }
    } catch (error) {
      console.error('Error selecting file:', error);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      if (!form.file) {
        throw new Error('Please select a product clip video file');
      }
      
      // Prepare FormData for API request
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('product', form.product);
      
      // Process file data correctly based on type
      let fileData = form.file;
      
      // If it's a File object from the file input
      if (fileData instanceof File) {
        formData.append('clip_file', fileData);
      } else {
        // If it's a path from electron dialog
        const fileName = form.filename;
        const fileResponse = await fetch(`file://${fileData}`);
        const blob = await fileResponse.blob();
        formData.append('clip_file', new File([blob], fileName));
      }
      
      // Submit to backend API
      const clip = await api.addBackendClip(formData);
      
      // Complete the clip creation by notifying the parent component
      onSubmit(clip);
    } catch (error) {
      console.error('Error creating clip:', error);
      setError(error.message || 'Failed to create clip');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-md bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-sm">
          {error}
        </div>
      )}
      
      {/* Clip Name */}
      <div>
        <label htmlFor="name" className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
          Clip Name
        </label>
        <input
          type="text"
          name="name"
          id="name"
          required
          value={form.name}
          onChange={handleInputChange}
          className={`mt-1 block w-full rounded-md shadow-sm focus:border-accent-500 focus:ring-accent-500 sm:text-sm
            ${darkMode 
              ? 'bg-dark-600 border-dark-500 text-primary-100 placeholder-primary-400'
              : 'border-primary-300 text-primary-900 placeholder-primary-400'
            }`}
          placeholder="e.g., iPhone 15 Pro"
        />
      </div>
      
      {/* Product */}
      <div>
        <label htmlFor="product" className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
          Product
        </label>
        <input
          type="text"
          name="product"
          id="product"
          required
          value={form.product}
          onChange={handleInputChange}
          className={`mt-1 block w-full rounded-md shadow-sm focus:border-accent-500 focus:ring-accent-500 sm:text-sm
            ${darkMode 
              ? 'bg-dark-600 border-dark-500 text-primary-100 placeholder-primary-400'
              : 'border-primary-300 text-primary-900 placeholder-primary-400'
            }`}
          placeholder="e.g., iPhone, MacBook, etc."
        />
      </div>
      
      {/* File Upload */}
      <div>
        <label className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
          Product Clip Video (.mov)
        </label>
        <div 
          className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md transition-colors
            ${isDragOver 
              ? darkMode 
                ? 'border-accent-400 bg-accent-900/20' 
                : 'border-accent-500 bg-accent-50'
              : darkMode 
                ? 'border-dark-500' 
                : 'border-primary-300'
            }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="space-y-1 text-center">
            <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-primary-400" />
            <div className="flex text-sm text-primary-600 dark:text-primary-400">
              <button
                type="button"
                onClick={handleSelectFile}
                className="relative cursor-pointer rounded-md font-medium text-accent-600 hover:text-accent-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-accent-500"
              >
                <span>Upload a file</span>
                <input 
                  id="clip-file" 
                  name="clip-file" 
                  type="file" 
                  className="sr-only" 
                  accept=".mov"
                  onChange={handleFileChange}
                />
              </button>
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-xs text-primary-500 dark:text-primary-400">
              MOV files up to 100MB
            </p>
            {form.filename && (
              <p className="text-sm text-accent-600 dark:text-accent-400 font-medium">
                Selected: {form.filename}
              </p>
            )}
          </div>
        </div>
      </div>
      
      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-4">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={isLoading}
          disabled={isLoading}
        >
          Create Clip
        </Button>
      </div>
    </form>
  );
}

function ClipThumbnail({ filePath, darkMode }) {
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef(null);

  const handleVideoError = () => {
    setHasError(true);
  };

  if (hasError || !filePath) {
    return (
      <div className={`w-full h-32 flex items-center justify-center rounded-lg
        ${darkMode ? 'bg-dark-600' : 'bg-neutral-100'}`}>
        <PlayIcon className={`h-8 w-8 ${darkMode ? 'text-primary-400' : 'text-primary-500'}`} />
      </div>
    );
  }

  // Use the filePath directly for local file system access
  // For electron: prefix with file:// protocol
  const videoSrc = window.electron 
    ? `file://${filePath}` 
    : filePath;

  return (
    <video
      ref={videoRef}
      className="w-full h-32 object-cover rounded-lg"
      onError={handleVideoError}
      muted
      preload="metadata"
      src={videoSrc}
    >
      Your browser does not support the video tag.
    </video>
  );
}

function ClipPreviewModal({ clip, onClose }) {
  const darkMode = useStore(state => state.darkMode);
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoSrc, setVideoSrc] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set video source from file path
    if (clip && clip.filePath) {
      // Use the filePath directly for local file system access
      // For electron: prefix with file:// protocol
      const src = window.electron 
        ? `file://${clip.filePath}` 
        : clip.filePath;
      
      console.log('Loading clip preview:', src);
      setVideoSrc(src);
      setIsLoading(false);
    } else {
      setVideoSrc(null);
      setIsLoading(false);
    }
  }, [clip]);

  const handleVideoError = (e) => {
    console.error('Video error:', e);
    setIsLoading(false);
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Preview: ${clip.name}`} size="lg">
      <div className="space-y-4">
        <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
          {isLoading ? (
            <div className={`text-center ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
              <svg className="animate-spin h-10 w-10 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p>Loading video...</p>
            </div>
          ) : videoSrc ? (
            <video 
              ref={videoRef}
              src={videoSrc}
              controls 
              className="w-full h-full rounded-lg"
              onError={handleVideoError}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              autoPlay
            />
          ) : (
            <div className={`text-center ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
              <PlayIcon className="h-16 w-16 mx-auto mb-2 opacity-50" />
              <p>No video available</p>
              <p className="text-sm mt-1">This clip doesn't have a video file</p>
            </div>
          )}
        </div>
        
        <div className={`p-4 rounded-lg ${darkMode ? 'bg-dark-700' : 'bg-neutral-100'}`}>
          <h3 className={`font-medium ${darkMode ? 'text-primary-200' : 'text-primary-900'}`}>
            {clip.name}
          </h3>
          <p className={`text-sm mt-1 ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
            Product: {clip.product}
          </p>
        </div>
      </div>
    </Modal>
  );
}

function ProductClipsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedClips, setSelectedClips] = useState({});
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [previewClip, setPreviewClip] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  
  // Get darkMode from global store
  const darkMode = useStore(state => state.darkMode);
  
  // Use React Query hooks for data management
  const queryClient = useQueryClient();
  const { data: clipsData = [], isLoading, error: queryError } = useClips();
  const deleteClipMutation = useDeleteClip();
  
  // Format clips for display
  const clips = clipsData.map(clip => ({
    id: clip.id,
    name: clip.name,
    product: clip.product,
    filePath: clip.file_path,
    createdAt: new Date().toISOString().split('T')[0],
  }));
  
  const error = queryError ? queryError.message : '';

  const handleNewClip = async (clipData) => {
    try {
      // The clip has already been created via Flask API (which wrote to YAML)
      // Trigger refetch in background (don't wait - close modal immediately)
      queryClient.invalidateQueries(['clips']);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error refreshing clips:', error);
    }
  };

  const handlePreview = (clip) => {
    setPreviewClip(clip);
  };

  const toggleManageMode = () => {
    setIsManageMode(!isManageMode);
    setSelectedClips({});
  };

  const toggleClipSelection = (clipId) => {
    setSelectedClips(prev => ({
      ...prev,
      [clipId]: !prev[clipId]
    }));
  };

  const getSelectedCount = () => {
    return Object.values(selectedClips).filter(Boolean).length;
  };

  const handleDeleteSelected = async () => {
    try {
      const selectedIds = Object.keys(selectedClips).filter(id => selectedClips[id]);
      
      // Delete each selected clip using mutation
      for (const id of selectedIds) {
        await deleteClipMutation.mutateAsync(id);
      }
      
      setSelectedClips({});
      setIsDeleteModalOpen(false);
      setIsManageMode(false);
    } catch (error) {
      console.error('Error deleting clips:', error);
    }
  };

  return (
    <motion.div 
      className="space-y-8 px-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
        <h2 className="text-2xl font-display font-medium">Product Clips</h2>
        
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
            <>
              <Button 
                variant="secondary" 
                onClick={toggleManageMode}
              >
                Manage
              </Button>
              <Button 
                variant="primary" 
                icon={<PlusIcon className="h-5 w-5" />}
                onClick={() => setIsModalOpen(true)}
              >
                Add Clip
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-500"></div>
        </div>
      ) : clips.length === 0 ? (
        <div className={`text-center py-12 rounded-lg ${darkMode ? 'bg-neutral-800/50' : 'bg-neutral-100'}`}>
          <DocumentArrowUpIcon className={`mx-auto h-12 w-12 mb-4 ${darkMode ? 'text-primary-400' : 'text-primary-500'}`} />
          <h3 className={`text-lg font-medium mb-2 ${darkMode ? 'text-primary-200' : 'text-primary-800'}`}>
            No product clips yet
          </h3>
          <p className={`mb-4 ${darkMode ? 'text-primary-300' : 'text-primary-600'}`}>
            Upload your first product clip to get started
          </p>
          <Button
            variant="primary"
            icon={<PlusIcon className="h-4 w-4" />}
            onClick={() => setIsModalOpen(true)}
          >
            Add Clip
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {(() => {
              // Pagination calculations
              const totalPages = Math.ceil(clips.length / pageSize);
              const startIndex = (currentPage - 1) * pageSize;
              const endIndex = startIndex + pageSize;
              const paginatedClips = clips.slice(startIndex, endIndex);

              // Reset to page 1 if current page is beyond total pages
              if (currentPage > totalPages && totalPages > 0) {
                setCurrentPage(1);
              }

              return paginatedClips.map((clip) => (
              <motion.div
                key={clip.id}
                className={`relative rounded-xl p-4 cursor-pointer transition-all duration-200 hover:scale-105
                  ${darkMode
                    ? 'bg-neutral-800/50 hover:bg-dark-600 border border-neutral-700'
                    : 'bg-white hover:bg-neutral-50 border border-neutral-200 shadow-sm hover:shadow-md'
                  }`}
                onClick={() => isManageMode && toggleClipSelection(clip.id)}
                whileHover={{ y: -2 }}
                layout
              >
                {isManageMode && (
                  <div className={`absolute top-2 left-2 z-10 rounded-full w-6 h-6 flex items-center justify-center
                    ${selectedClips[clip.id]
                      ? 'bg-accent-500 text-white'
                      : darkMode
                        ? 'bg-dark-900/70 border border-white/30'
                        : 'bg-white/70 border border-black/30'
                    }`}>
                    {selectedClips[clip.id] && <CheckIcon className="h-4 w-4" />}
                  </div>
                )}

                <ClipThumbnail filePath={clip.filePath} darkMode={darkMode} />

                <div className="mt-3">
                  <h3 className={`font-medium text-sm truncate ${darkMode ? 'text-primary-200' : 'text-primary-900'}`}>
                    {clip.name}
                  </h3>
                  <p className={`text-xs mt-1 truncate ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                    {clip.product}
                  </p>
                  <p className={`text-xs mt-1 ${darkMode ? 'text-primary-500' : 'text-primary-500'}`}>
                    {clip.createdAt}
                  </p>

                  {/* Preview button - only show when not in manage mode */}
                  {!isManageMode && (
                    <div className="flex justify-end mt-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<PlayIcon className="h-4 w-4" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreview(clip);
                        }}
                      >
                        Preview
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
              ));
            })()}
          </div>

          {/* Pagination */}
          {!isLoading && clips.length > 0 && (() => {
            const totalPages = Math.ceil(clips.length / pageSize);
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
                      clips per page
                    </span>
                  </div>

                  {/* Page info and controls */}
                  <div className="flex items-center gap-4">
                    <span className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                      Showing {startIndex + 1}-{Math.min(endIndex, clips.length)} of {clips.length}
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

      {/* New Clip Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add New Product Clip"
        size="lg"
      >
        <NewClipForm 
          onSubmit={handleNewClip} 
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Product Clips"
      >
        <div className="space-y-4">
          <p className={darkMode ? 'text-primary-200' : 'text-primary-700'}>
            Are you sure you want to delete {getSelectedCount()} {getSelectedCount() === 1 ? 'clip' : 'clips'}? This action cannot be undone.
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

      {/* Preview Modal */}
      {previewClip && (
        <ClipPreviewModal 
          clip={previewClip} 
          onClose={() => setPreviewClip(null)} 
        />
      )}
    </motion.div>
  );
}

export default ProductClipsPage; 