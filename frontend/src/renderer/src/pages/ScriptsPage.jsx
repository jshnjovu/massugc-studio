import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusIcon, DocumentTextIcon, ArrowDownTrayIcon, XMarkIcon, TrashIcon, CheckIcon, SparklesIcon } from '@heroicons/react/24/outline';
import Button from '../components/Button';
import Modal from '../components/Modal';
import { useStore } from '../store';
import api from '../utils/api';
import ScriptGeneratorForm from '../components/ScriptGeneratorForm';

// Helper to format the file size
const formatFileSize = (size) => {
  if (size < 1024) return `${size} B`;
  else if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  else return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

function UploadScriptForm({ onSubmit, onCancel }) {
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fileContent, setFileContent] = useState(null);
  const [error, setError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const darkMode = useStore(state => state.darkMode);
  
  const processFile = (selectedFile) => {
    // Validate file type
    if (!selectedFile.name.toLowerCase().endsWith('.txt')) {
      setError('Only TXT files are supported');
      return;
    }
    
    setFile(selectedFile);
    setError('');
    
    // Read file contents
    const reader = new FileReader();
    reader.onload = (e) => {
      setFileContent(e.target.result);
    };
    reader.readAsText(selectedFile);
  };
  
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      processFile(selectedFile);
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
        document.getElementById('script-file').click();
        return;
      }
      
      // Use Electron's file dialog
      const result = await window.electron.ipcRenderer.invoke('select-file-dialog', {
        title: 'Select Script File',
        buttonLabel: 'Select Script',
        filters: [
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      
      if (result.success) {
        const filename = result.filePath.split(/[\\/]/).pop();
        
        // Read the file content
        const fileContentResult = await window.electron.ipcRenderer.invoke('read-text-file', result.filePath);
        
        if (fileContentResult.success) {
          setFile({
            name: filename,
            path: result.filePath,
            size: fileContentResult.content.length,
            type: 'text/plain'
          });
          setFileContent(fileContentResult.content);
        } else {
          throw new Error(`Failed to read file content: ${fileContentResult.message}`);
        }
      }
    } catch (error) {
      console.error('Error selecting file:', error);
      setError('Error selecting file: ' + error.message);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      // Prepare FormData for API request
      const formData = new FormData();
      formData.append('name', file.name);
      
      // Process file data
      if (file instanceof File) {
        // If it's a File object from the file input
        formData.append('script_file', file);
      } else {
        // If it's a path from electron dialog
        const fileBlob = new Blob([fileContent], { type: file.type });
        formData.append('script_file', new File([fileBlob], file.name, { type: file.type }));
      }
      
      // Submit to backend API
      const scriptData = await api.addBackendScript(formData);
      
      // Notify parent component
      onSubmit(scriptData);
    } catch (error) {
      console.error('Error uploading script:', error);
      setError(error.message || 'Failed to upload script');
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
      
      <div>
        <label className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
          Upload Script
        </label>
        <div 
          className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md transition-colors
            ${isDragOver 
              ? darkMode 
                ? 'border-accent-400 bg-accent-900/20' 
                : 'border-accent-500 bg-accent-50'
              : darkMode 
                ? 'border-dark-500 bg-dark-600/50' 
                : 'border-primary-300 bg-neutral-50'
            }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="space-y-1 text-center">
            <DocumentTextIcon className={`mx-auto h-12 w-12 ${darkMode ? 'text-primary-400' : 'text-primary-400'}`} />
            <div className="flex text-sm text-center justify-center">
              <button
                type="button"
                className={`relative cursor-pointer rounded-md font-medium focus:outline-none
                  ${darkMode ? 'text-accent-400 hover:text-accent-300' : 'text-accent-500 hover:text-accent-600'}`}
                onClick={handleSelectFile}
              >
                Upload a file
              </button>
              <input
                id="script-file"
                name="script-file"
                type="file"
                accept=".txt"
                className="sr-only"
                onChange={handleFileChange}
              />
              <p className={`pl-1 ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                or drag and drop
              </p>
            </div>
            <p className={`text-xs ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
              TXT files up to 10MB
            </p>
          </div>
        </div>
      </div>
      
      {file && (
        <div className={`p-3 rounded-md flex items-center justify-between
          ${darkMode ? 'bg-dark-600' : 'bg-neutral-100'}`}>
          <div className="flex items-center">
            <DocumentTextIcon className={`h-5 w-5 mr-2 ${darkMode ? 'text-primary-300' : 'text-primary-500'}`} />
            <div>
              <p className={`text-sm font-medium ${darkMode ? 'text-primary-200' : 'text-primary-700'}`}>
                {file.name}
              </p>
              <p className={`text-xs ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
                {formatFileSize(fileContent?.length || 0)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setFile(null);
              setFileContent(null);
            }}
            className={`p-1 rounded-full ${darkMode ? 'text-primary-400 hover:text-primary-200' : 'text-primary-500 hover:text-primary-700'}`}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      )}
      
      {/* Preview text content for .txt files */}
      {fileContent && file.type === 'text/plain' && (
        <div className={`p-4 rounded-md overflow-auto max-h-48 mt-2
          ${darkMode ? 'bg-dark-600 text-primary-300' : 'bg-neutral-100 text-primary-700'}`}>
          <pre className="text-xs whitespace-pre-wrap">{fileContent}</pre>
        </div>
      )}
      
      {/* Form Actions */}
      <div className="pt-4 flex justify-end space-x-3">
        <Button 
          variant="tertiary" 
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          variant="primary"
          isLoading={isLoading}
          disabled={!file || !fileContent}
        >
          Upload Script
        </Button>
      </div>
    </form>
  );
}

function ScriptsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedScripts, setSelectedScripts] = useState({});
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  
  // Get data and actions from global store
  const scripts = useStore(state => state.scripts);
  const addScript = useStore(state => state.addScript);
  const removeScript = useStore(state => state.removeScript);
  const darkMode = useStore(state => state.darkMode);
  const setScripts = useStore(state => state.setScripts); // Get setScripts action
  
  // Reset selections when exiting manage mode
  useEffect(() => {
    if (!isManageMode) {
      setSelectedScripts({});
    }
  }, [isManageMode]);
  
  // Fetch scripts from backend on component mount
  useEffect(() => {
    const fetchScripts = async () => {
      setIsLoading(true);
      setError('');
      
      try {
        const backendScripts = await api.fetchBackendScripts();
        console.log('Backend scripts:', backendScripts);
        
        // Clear any existing scripts first to prevent duplication
        setScripts([]);
        
        // Map backend scripts to frontend format
        backendScripts.forEach(script => {
          addScript({
            id: script.id,
            name: script.name,
            filePath: script.file_path,
            createdAt: script.created_at,
            size: formatFileSize(script.size || 0),
            backendScript: true
          });
        });
      } catch (error) {
        console.error('Error fetching scripts:', error);
        const errorMessage = error.message || 'Failed to fetch scripts from the backend';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchScripts();
  }, []);  // Remove addScript dependency to prevent multiple fetches
  
  const handleUploadScript = async (scriptData) => {
    try {
      // The script has already been created via the backend API
      // Add to our local store with the correct mappings
      addScript({
        id: scriptData.id,
        name: scriptData.name,
        filePath: scriptData.file_path,
        createdAt: scriptData.created_at,
        size: formatFileSize(scriptData.size || 0),
        backendScript: true
      });
      
      setIsModalOpen(false);
      setError('');
    } catch (error) {
      console.error('Error adding script to store:', error);
      setError(error.message || 'Failed to save script');
    }
  };
  
  const handleDownload = async (script) => {
    try {
      setIsLoading(true);
      
      if (script.filePath) {
        // Access the local file directly instead of through API URL
        if (window.electron) {
          // Use Electron to open the file directly from the filesystem
          await window.electron.ipcRenderer.invoke('save-file-dialog', {
            sourceFilePath: script.filePath,
            suggestedName: script.name
          });
        } else {
          // Fallback for browser - should still use direct file access, not URL
          console.error('Electron not available for direct file access');
          setError('Direct file access is only available in the Electron app');
        }
      }
    } catch (error) {
      console.error('Error downloading script:', error);
      setError(`Failed to download script: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const toggleManageMode = () => {
    setIsManageMode(!isManageMode);
  };
  
  const toggleScriptSelection = (scriptId) => {
    setSelectedScripts(prev => ({
      ...prev,
      [scriptId]: !prev[scriptId]
    }));
  };
  
  const getSelectedCount = () => {
    return Object.values(selectedScripts).filter(Boolean).length;
  };
  
  const handleDeleteSelected = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const selectedIds = Object.keys(selectedScripts).filter(id => selectedScripts[id]);
      
      // Delete each selected script from the backend
      for (const id of selectedIds) {
        await api.deleteBackendScript(id);
        // Remove from store
        removeScript(id);
      }
      
      // Exit manage mode and close delete modal
      setIsManageMode(false);
      setIsDeleteModalOpen(false);
      setSelectedScripts({});
    } catch (error) {
      console.error('Error deleting scripts:', error);
      const errorMessage = error.message || 'Failed to delete scripts';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <motion.div 
      className="space-y-8 px-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-display font-medium">Scripts</h2>
        <div className="flex space-x-2">
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
                variant="success" 
                icon={<SparklesIcon className="h-5 w-5" />}
                onClick={() => setIsGenerateModalOpen(true)}
              >
                Generate
              </Button>
              <Button 
                variant="primary" 
                icon={<PlusIcon className="h-5 w-5" />}
                onClick={() => setIsModalOpen(true)}
              >
                Upload Script
              </Button>
            </>
          )}
        </div>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="p-4 rounded-lg bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      
      <div className={`rounded-xl shadow-md overflow-hidden border
        ${darkMode ? 'bg-neutral-800/50 border-neutral-700' : 'bg-white border-neutral-200'}`}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-primary-200 dark:divide-dark-600">
            <thead className={darkMode ? 'bg-neutral-800' : 'bg-neutral-100'}>
              <tr>
                {isManageMode && (
                  <th scope="col" className={`pl-6 pr-3 py-3 text-left text-xs font-medium uppercase tracking-wider
                    ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                    <span className="sr-only">Select</span>
                  </th>
                )}
                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider
                  ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                  Name
                </th>
                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider
                  ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                  Size
                </th>
                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider
                  ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                  Date Added
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y
              ${darkMode ? 'divide-dark-600' : 'divide-primary-100'}`}>
              {(() => {
                // Pagination calculations
                const totalPages = Math.ceil(scripts.length / pageSize);
                const startIndex = (currentPage - 1) * pageSize;
                const endIndex = startIndex + pageSize;
                const paginatedScripts = scripts.slice(startIndex, endIndex);

                // Reset to page 1 if current page is beyond total pages
                if (currentPage > totalPages && totalPages > 0) {
                  setCurrentPage(1);
                }

                return scripts.length > 0 ? (
                  paginatedScripts.map((script) => (
                  <motion.tr 
                    key={script.id} 
                    className={`transition-colors
                      ${isManageMode && selectedScripts[script.id] ? 
                        darkMode ? 'bg-dark-500 bg-opacity-50' : 'bg-accent-50' 
                        : ''}
                      ${darkMode ? 'hover:bg-dark-600' : 'hover:bg-neutral-50'}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => isManageMode && toggleScriptSelection(script.id)}
                  >
                    {isManageMode && (
                      <td className="pl-6 pr-3 py-4 whitespace-nowrap">
                        <div className={`w-5 h-5 rounded ${
                          selectedScripts[script.id] 
                            ? 'bg-accent-500 text-white flex items-center justify-center' 
                            : `border ${darkMode ? 'border-dark-400' : 'border-primary-300'}`
                        }`}>
                          {selectedScripts[script.id] && <CheckIcon className="h-4 w-4" />}
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <DocumentTextIcon className={`h-5 w-5 mr-3 
                          ${darkMode ? 'text-primary-400' : 'text-primary-400'}`} />
                        <div className={`text-sm font-medium 
                          ${darkMode ? 'text-primary-200' : 'text-primary-900'}`}>
                          {script.name}
                        </div>
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm
                      ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
                      {script.size}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm
                      ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
                      {script.createdAt}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {!isManageMode && (
                        <button 
                          className={`focus:outline-none
                            ${darkMode ? 'text-accent-400 hover:text-accent-300' : 'text-accent-500 hover:text-accent-600'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(script);
                          }}
                        >
                          <ArrowDownTrayIcon className="h-5 w-5" />
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))
                ) : (
                  <tr>
                    <td
                      colSpan={isManageMode ? 5 : 4}
                      className={`px-6 py-10 text-center text-sm
                        ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}
                    >
                      No scripts uploaded yet. Click "Upload Script" to add one.
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>

          {/* Pagination */}
          {scripts.length > 0 && (() => {
            const totalPages = Math.ceil(scripts.length / pageSize);
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
                      scripts per page
                    </span>
                  </div>

                  {/* Page info and controls */}
                  <div className="flex items-center gap-4">
                    <span className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                      Showing {startIndex + 1}-{Math.min(endIndex, scripts.length)} of {scripts.length}
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
        </div>
      </div>
      
      {/* Upload Script Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Script"
        size="lg"
      >
        <div className="p-4">
          <UploadScriptForm 
            onSubmit={handleUploadScript}
            onCancel={() => setIsModalOpen(false)}
          />
        </div>
      </Modal>
      
      {/* Generate Script Modal */}
      <Modal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        title="Generate AI Script"
        size="xl"
      >
        <div className="p-6">
          <ScriptGeneratorForm 
            onSubmit={handleUploadScript}
            onCancel={() => setIsGenerateModalOpen(false)}
          />
        </div>
      </Modal>
      
      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Scripts"
        size="sm"
      >
        <div className="space-y-4">
          <p className={darkMode ? 'text-primary-200' : 'text-primary-700'}>
            Are you sure you want to delete {getSelectedCount()} {getSelectedCount() === 1 ? 'script' : 'scripts'}? This action cannot be undone.
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

export default ScriptsPage; 