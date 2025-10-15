import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusIcon, PlayIcon, DocumentArrowUpIcon, TrashIcon, CheckIcon } from '@heroicons/react/24/outline';
import Button from '../components/Button';
import Modal from '../components/Modal';
import { useStore } from '../store';
import api, { createLocalFileUrl } from '../utils/api';

// Available language options
const languageOptions = [ 
  'English (US)',
  'English (UK)',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Japanese',
  'Korean',
  'Mandarin',
  'Portuguese',
  'Russian',
];

// Gender options for avatar
const genderOptions = [
  'Male',
  'Female',
  'Other'
];

// Helper function to get voice name from ID
const getVoiceName = (voiceId) => {
  const voices = {
    'EXAVITQu4vr4xnSDxMaL': 'Rachel (Female)',
    'VR6AewLTigWG4xSOukaG': 'Drew (Male)',
    'pNInz6obpgDQGcFmaJgB': 'Adam (Male)',
    'jBpfuIE2acCO8z3wKNLl': 'Bella (Female)'
  };
  return voices[voiceId] || `Custom (${voiceId?.substring(0, 8)}...)`;
};

function NewAvatarForm({ onSubmit, onCancel }) {
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    gender: 'Male', // New field for gender
    language: '',
    file: null,
    filename: '',
    elevenlabs_voice_id: 'EXAVITQu4vr4xnSDxMaL', // Default voice
    custom_voice_id: '', // For custom voice ID entry
    useCustomVoice: false // Add this to form state
  });
  const darkMode = useStore(state => state.darkMode);
  const [error, setError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  
  const processFile = (selectedFile) => {
    // Validate file type
    const validExtensions = ['.mp4', '.mov'];
    const fileExtension = '.' + selectedFile.name.toLowerCase().split('.').pop();
    
    if (!validExtensions.includes(fileExtension)) {
      setError('Only MP4 and MOV files are supported');
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
        document.getElementById('avatar-file').click();
        return;
      }
      
      // Use Electron's file dialog
      const result = await window.electron.ipcRenderer.invoke('select-file-dialog', {
        title: 'Select Avatar Video',
        buttonLabel: 'Select Video',
        filters: [
          { name: 'Video Files', extensions: ['mp4', 'mov'] },
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
        throw new Error('Please select an avatar video file');
      }
      
      // Prepare FormData for API request
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('gender', form.gender);
      formData.append('origin_language', form.language);
      
      // Use the custom voice ID if that option is selected
      const finalVoiceId = form.useCustomVoice ? form.custom_voice_id : form.elevenlabs_voice_id;
      formData.append('elevenlabs_voice_id', finalVoiceId);
      
      // Process file data correctly based on type
      let fileData = form.file;
      
      // If it's a File object from the file input
      if (fileData instanceof File) {
        formData.append('avatar_file', fileData);
      } else {
        // If it's a path from electron dialog, read the file directly using fs
        if (window.electron) {
          try {
            const fs = window.electron.fs;
            const buffer = fs.readFileSync(fileData);
            const blob = new Blob([buffer]);
            formData.append('avatar_file', blob, form.filename);
          } catch (error) {
            console.error('Error reading file with fs:', error);
            throw new Error('Failed to read avatar file');
          }
        } else {
          // Fallback for non-electron environments
          const fileResponse = await fetch(`file://${fileData}`);
          const blob = await fileResponse.blob();
          formData.append('avatar_file', new File([blob], form.filename));
        }
      }
      
      // Submit to backend API
      const avatar = await api.addBackendAvatar(formData);
      
      // Complete the avatar creation by notifying the parent component
      onSubmit(avatar);
    } catch (error) {
      console.error('Error creating avatar:', error);
      setError(error.message || 'Failed to create avatar');
    } finally {
      setIsLoading(false);
    }
  };
  
  const setUseCustomVoice = (value) => {
    setForm({
      ...form,
      useCustomVoice: value
    });
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-md bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-sm">
          {error}
        </div>
      )}
      
      {/* Avatar Name */}
      <div>
        <label htmlFor="name" className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
          Avatar Name
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
          placeholder="e.g., Emma"
        />
      </div>
      
      {/* Gender */}
      <div>
        <label htmlFor="gender" className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
          Gender
        </label>
        <select
          id="gender"
          name="gender"
          required
          value={form.gender}
          onChange={handleInputChange}
          className={`mt-1 block w-full rounded-md shadow-sm focus:border-accent-500 focus:ring-accent-500 sm:text-sm
            ${darkMode 
              ? 'bg-dark-600 border-dark-500 text-primary-100'
              : 'border-primary-300 text-primary-900'
            }`}
        >
          {genderOptions.map((gender) => (
            <option key={gender} value={gender}>{gender}</option>
          ))}
        </select>
      </div>
      
      {/* Language */}
      <div>
        <label htmlFor="language" className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
          Language
        </label>
        <select
          id="language"
          name="language"
          required
          value={form.language}
          onChange={handleInputChange}
          className={`mt-1 block w-full rounded-md shadow-sm focus:border-accent-500 focus:ring-accent-500 sm:text-sm
            ${darkMode 
              ? 'bg-dark-600 border-dark-500 text-primary-100'
              : 'border-primary-300 text-primary-900'
            }`}
        >
          <option value="">Select language</option>
          {languageOptions.map((lang) => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </select>
      </div>
      
      {/* Upload Video File */}
      <div>
        <label className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
          Avatar Video
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
            <svg 
              className={`mx-auto h-12 w-12 ${darkMode ? 'text-primary-400' : 'text-primary-400'}`} 
              stroke="currentColor" 
              fill="none" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div className="flex text-sm text-center justify-center">
              <button
                type="button"
                className={`relative cursor-pointer rounded-md font-medium focus:outline-none
                  ${darkMode ? 'text-accent-400 hover:text-accent-300' : 'text-accent-500 hover:text-accent-600'}`}
                onClick={handleSelectFile}
              >
                Upload a video
              </button>
              <input
                id="avatar-file"
                name="avatar-file"
                type="file"
                accept="video/*"
                className="sr-only"
                onChange={handleFileChange}
              />
              <p className={`pl-1 ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                or drag and drop
              </p>
            </div>
            <p className={`text-xs ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
              MP4, MOV up to 50MB
            </p>
          </div>
        </div>
        
        {form.filename && (
          <div className={`mt-2 p-2 flex items-center justify-between rounded-md
            ${darkMode ? 'bg-dark-600 text-primary-300' : 'bg-neutral-100 text-primary-600'}`}>
            <div className="flex items-center">
              <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="text-sm">{form.filename}</span>
            </div>
            <button 
              type="button"
              className="p-1 rounded-full hover:bg-dark-500 focus:outline-none"
              onClick={() => setForm({...form, file: null, filename: ''})}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>
      
      {/* ElevenLabs Voice ID */}
      <div className="space-y-2">
        <label className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
          ElevenLabs Voice
        </label>
        
        <div className="flex items-center space-x-2">
          <input
            type="radio"
            id="use-preset-voice"
            name="voice-type"
            checked={!form.useCustomVoice}
            onChange={() => setUseCustomVoice(false)}
            className="h-4 w-4 text-accent-500 focus:ring-accent-500"
          />
          <label htmlFor="use-preset-voice" className={`text-sm ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
            Use preset voice
          </label>
          
          <input
            type="radio"
            id="use-custom-voice"
            name="voice-type"
            checked={form.useCustomVoice}
            onChange={() => setUseCustomVoice(true)}
            className="ml-4 h-4 w-4 text-accent-500 focus:ring-accent-500"
          />
          <label htmlFor="use-custom-voice" className={`text-sm ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
            Use custom voice ID
          </label>
        </div>
        
        {!form.useCustomVoice ? (
          <select
            id="elevenlabs_voice_id"
            name="elevenlabs_voice_id"
            required={!form.useCustomVoice}
            value={form.elevenlabs_voice_id}
            onChange={handleInputChange}
            className={`mt-1 block w-full rounded-md shadow-sm focus:border-accent-500 focus:ring-accent-500 sm:text-sm
              ${darkMode 
                ? 'bg-dark-600 border-dark-500 text-primary-100'
                : 'border-primary-300 text-primary-900'
              }`}
          >
            <option value="EXAVITQu4vr4xnSDxMaL">Rachel (Female)</option>
            <option value="VR6AewLTigWG4xSOukaG">Drew (Male)</option>
            <option value="pNInz6obpgDQGcFmaJgB">Adam (Male)</option>
            <option value="jBpfuIE2acCO8z3wKNLl">Bella (Female)</option>
          </select>
        ) : (
          <input
            type="text"
            id="custom_voice_id"
            name="custom_voice_id"
            required={form.useCustomVoice}
            value={form.custom_voice_id}
            onChange={handleInputChange}
            placeholder="Enter ElevenLabs Voice ID"
            className={`mt-1 block w-full rounded-md shadow-sm focus:border-accent-500 focus:ring-accent-500 sm:text-sm
              ${darkMode 
                ? 'bg-dark-600 border-dark-500 text-primary-100'
                : 'border-primary-300 text-primary-900'
              }`}
          />
        )}
        
        <p className={`text-xs ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
          The voice ID will be used with your ElevenLabs account via the video agent.
        </p>
      </div>
      
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
        >
          Create Avatar
        </Button>
      </div>
    </form>
  );
}

// AvatarThumbnail component using image thumbnails for fast loading
function AvatarThumbnail({ avatar, darkMode }) {
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setError(true);
    setIsLoading(false);
  };

  // If no avatar or no thumbnail path, show fallback
  if (!avatar || (!avatar.thumbnail_path && !avatar.filePath) || error) {
    return (
      <div className={`h-full w-full flex items-center justify-center ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
        <DocumentArrowUpIcon className="h-8 w-8" />
      </div>
    );
  }

  // Prefer thumbnail over video file
  const imageSrc = avatar.thumbnail_path
    ? createLocalFileUrl(avatar.thumbnail_path)
    : null;

  // If we have a thumbnail, use it
  if (imageSrc) {
    return (
      <div className="absolute inset-0">
        {/* Loading skeleton */}
        {isLoading && (
          <div className={`absolute inset-0 flex items-center justify-center ${darkMode ? 'bg-dark-700' : 'bg-neutral-200'}`}>
            <div className={`animate-pulse w-full h-full ${darkMode ? 'bg-dark-600' : 'bg-neutral-300'}`} />
          </div>
        )}

        {/* Thumbnail image */}
        <img
          src={imageSrc}
          alt={`${avatar.name} thumbnail`}
          className={`w-full h-full object-cover transition-opacity duration-200 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
          onLoad={handleImageLoad}
          onError={handleError}
        />
      </div>
    );
  }

  // Fallback to video (for existing avatars without thumbnails)
  const videoSrc = createLocalFileUrl(avatar.filePath);

  return (
    <div className="absolute inset-0">
      {isLoading && (
        <div className={`absolute inset-0 flex items-center justify-center ${darkMode ? 'bg-dark-700' : 'bg-neutral-200'}`}>
          <div className={`animate-pulse w-full h-full ${darkMode ? 'bg-dark-600' : 'bg-neutral-300'}`} />
        </div>
      )}

      <video
        className={`w-full h-full object-cover transition-opacity duration-200 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        muted
        preload="metadata"
        src={videoSrc}
        onLoadedData={handleImageLoad}
        onError={handleError}
      />
    </div>
  );
}

function AvatarPreviewModal({ avatar, onClose }) {
  const darkMode = useStore(state => state.darkMode);
  const [videoSrc, setVideoSrc] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Set video source from file path
    if (avatar && avatar.filePath) {
      // Use the helper function to create properly formatted URL
      const src = createLocalFileUrl(avatar.filePath);
      
      console.log('Loading video preview:', src);
      setVideoSrc(src);
      setIsLoading(false);
    } else {
      setVideoSrc(null);
      setIsLoading(false);
    }
  }, [avatar]);
  
  const handleVideoError = (e) => {
    console.error('Error loading video:', e);
    setIsLoading(false);
  };
  
  return (
    <Modal isOpen={!!avatar} onClose={onClose} title={`Preview: ${avatar?.name}`} size="lg">
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
            src={videoSrc}
            controls 
            className="w-full h-full rounded-lg"
            onError={handleVideoError}
            autoPlay
          />
        ) : (
          <div className={`text-center ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
            <PlayIcon className="h-16 w-16 mx-auto mb-2 opacity-50" />
            <p>No video available</p>
            <p className="text-sm mt-1">This avatar doesn't have a video file</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function AvatarsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewAvatar, setPreviewAvatar] = useState(null);
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedAvatars, setSelectedAvatars] = useState({});
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  
  // Get data and actions from global store
  const avatars = useStore(state => state.avatars);
  const addAvatar = useStore(state => state.addAvatar);
  const removeAvatar = useStore(state => state.removeAvatar);
  const setAvatars = useStore(state => state.setAvatars);  // Get setAvatars action
  const darkMode = useStore(state => state.darkMode);
  
  // Reset selections when exiting manage mode
  useEffect(() => {
    if (!isManageMode) {
      setSelectedAvatars({});
    }
  }, [isManageMode]);
  
  // Fetch avatars from backend on component mount
  useEffect(() => {
    const fetchAvatars = async () => {
      setIsLoading(true);
      setError('');
      
      try {
        const backendAvatars = await api.fetchBackendAvatars();
        console.log('Backend avatars:', backendAvatars);
        
        // Map backend avatars to frontend format and set all at once
        const formattedAvatars = backendAvatars.map(avatar => ({
          id: avatar.id,
          name: avatar.name,
          language: avatar.origin_language || '',
          filePath: avatar.file_path,
          thumbnail_path: avatar.thumbnail_path, // Include thumbnail path
          elevenlabs_voice_id: avatar.elevenlabs_voice_id,
          gender: avatar.gender,
          backendAvatar: true
        }));

        // Set all avatars at once to prevent duplication
        setAvatars(formattedAvatars);
      } catch (error) {
        console.error('Error fetching avatars:', error);
        const errorMessage = error.message || 'Failed to fetch avatars from the backend';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAvatars();
  }, []); // Remove addAvatar dependency to prevent multiple fetches
  
  const handleNewAvatar = async (avatarData) => {
    try {
      // The avatar has already been created via the backend API
      // Add it to our local store with the correct mappings
      addAvatar({
        id: avatarData.id,
        name: avatarData.name,
        language: avatarData.origin_language || '',
        filePath: avatarData.file_path,
        elevenlabs_voice_id: avatarData.elevenlabs_voice_id,
        gender: avatarData.gender,
        backendAvatar: true
      });
      
      setIsModalOpen(false);
      setError('');
    } catch (error) {
      console.error('Error adding avatar to store:', error);
      setError(error.message || 'Failed to save avatar');
    }
  };
  
  const handlePreview = (avatar) => {
    if (!isManageMode) {
      setPreviewAvatar(avatar);
    }
  };
  
  const toggleManageMode = () => {
    setIsManageMode(!isManageMode);
  };
  
  const toggleAvatarSelection = (avatarId) => {
    setSelectedAvatars(prev => ({
      ...prev,
      [avatarId]: !prev[avatarId]
    }));
  };
  
  const getSelectedCount = () => {
    return Object.values(selectedAvatars).filter(Boolean).length;
  };
  
  const handleDeleteSelected = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const selectedIds = Object.keys(selectedAvatars).filter(id => selectedAvatars[id]);
      
      // Delete each selected avatar from the backend
      for (const id of selectedIds) {
        await api.deleteBackendAvatar(id);
        // Remove from store
        removeAvatar(id);
      }
      
      // Exit manage mode and close delete modal
      setIsManageMode(false);
      setIsDeleteModalOpen(false);
      setSelectedAvatars({});
    } catch (error) {
      console.error('Error deleting avatars:', error);
      const errorMessage = error.message || 'Failed to delete avatars';
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
        <h2 className="text-2xl font-display font-medium">Avatars</h2>
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
                disabled={getSelectedCount() === 0 || isLoading}
                isLoading={isLoading}
              >
                Delete {getSelectedCount() > 0 ? `(${getSelectedCount()})` : ''}
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="secondary" 
                onClick={toggleManageMode}
                disabled={isLoading}
              >
                Manage
              </Button>
              <Button 
                variant="primary" 
                icon={<PlusIcon className="h-5 w-5" />}
                onClick={() => setIsModalOpen(true)}
                disabled={isLoading}
              >
                New Avatar
              </Button>
            </>
          )}
        </div>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="p-3 rounded-md bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-sm">
          {error}
        </div>
      )}
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent-500"></div>
        </div>
      )}
      
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
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
          const sortedAvatars = [...avatars].reverse();
          const totalPages = Math.ceil(sortedAvatars.length / pageSize);
          const startIndex = (currentPage - 1) * pageSize;
          const endIndex = startIndex + pageSize;
          const paginatedAvatars = sortedAvatars.slice(startIndex, endIndex);

          // Reset to page 1 if current page is beyond total pages
          if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(1);
          }

          return avatars.length > 0 ? (
            paginatedAvatars.map(avatar => (
            <motion.div 
              key={avatar.id}
              className={`flex overflow-hidden rounded-xl shadow-md border hover:shadow-lg transition-all h-32
                ${isManageMode && selectedAvatars[avatar.id] ? 'ring-2 ring-accent-500' : ''}
                ${darkMode 
                  ? 'bg-neutral-800/50 border-neutral-700' 
                  : 'bg-white border-neutral-200'
                }`}
              variants={{
                hidden: { y: 20, opacity: 0 },
                show: { y: 0, opacity: 1 }
              }}
              onClick={() => isManageMode && toggleAvatarSelection(avatar.id)}
            >
              {/* Avatar preview image/placeholder */}
              <div className={`w-32 h-32 flex-shrink-0 flex items-center justify-center relative overflow-hidden
                ${darkMode ? 'bg-dark-600' : 'bg-neutral-100'}`}>
                {isManageMode && (
                  <div className={`absolute top-2 left-2 z-10 rounded-full w-6 h-6 flex items-center justify-center
                    ${selectedAvatars[avatar.id]
                      ? 'bg-accent-500 text-white'
                      : darkMode 
                        ? 'bg-dark-500 border border-dark-400' 
                        : 'bg-white border border-primary-300'
                    }`}>
                    {selectedAvatars[avatar.id] && <CheckIcon className="h-4 w-4" />}
                  </div>
                )}
                {(avatar.filePath || avatar.thumbnail_path) ? (
                  <AvatarThumbnail avatar={avatar} darkMode={darkMode} />
                ) : (
                  <div className={`h-16 w-16 rounded-full flex items-center justify-center
                    ${darkMode ? 'bg-dark-500' : 'bg-neutral-200'}`}>
                    <span className={`text-xl font-medium
                      ${darkMode ? 'text-primary-200' : 'text-primary-600'}`}>
                      {avatar.name.charAt(0)}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Avatar info */}
              <div className="flex-1 h-full flex flex-col p-3">
                {/* Content area */}
                <div className="flex-1 min-h-0">
                  <h3 className={`text-lg font-medium line-clamp-1
                    ${darkMode ? 'text-primary-100' : 'text-primary-900'}`}>
                    {avatar.name}
                  </h3>
                  <p className={`line-clamp-1 ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
                    {avatar.language || 'No language specified'}
                  </p>
                  <p className={`text-xs mt-1 line-clamp-1 ${darkMode ? 'text-primary-500' : 'text-primary-400'}`}>
                    {avatar.gender && `Gender: ${avatar.gender}`}
                  </p>
                  {avatar.elevenlabs_voice_id && (
                    <p className={`text-xs line-clamp-1 ${darkMode ? 'text-primary-500' : 'text-primary-400'}`}>
                      Voice: {getVoiceName(avatar.elevenlabs_voice_id)}
                    </p>
                  )}
                </div>
                
                {/* Button positioned at the bottom */}
                <div className="flex justify-end mt-1">
                  {!isManageMode && (
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      icon={<PlayIcon className="h-4 w-4" />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreview(avatar);
                      }}
                    >
                      Preview
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ))
          ) : (
            !isLoading && (
              <p className={`col-span-2 text-center py-12 ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
                No avatars yet. Click "New Avatar" to create one.
              </p>
            )
          );
        })()}
      </motion.div>

      {/* Pagination */}
      {!isLoading && avatars.length > 0 && (() => {
        const sortedAvatars = [...avatars].reverse();
        const totalPages = Math.ceil(sortedAvatars.length / pageSize);
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
                  avatars per page
                </span>
              </div>

              {/* Page info and controls */}
              <div className="flex items-center gap-4">
                <span className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                  Showing {startIndex + 1}-{Math.min(endIndex, sortedAvatars.length)} of {sortedAvatars.length}
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
      
      {/* New Avatar Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Avatar"
        size="lg"
      >
        <NewAvatarForm 
          onSubmit={handleNewAvatar}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>
      
      {/* Preview Modal */}
      <AvatarPreviewModal 
        avatar={previewAvatar} 
        onClose={() => setPreviewAvatar(null)} 
      />
      
      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Avatars"
        size="sm"
      >
        <div className="space-y-4">
          <p className={darkMode ? 'text-primary-200' : 'text-primary-700'}>
            Are you sure you want to delete {getSelectedCount()} {getSelectedCount() === 1 ? 'avatar' : 'avatars'}? This action cannot be undone.
          </p>
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="tertiary"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={<TrashIcon className="h-5 w-5" />}
              onClick={handleDeleteSelected}
              isLoading={isLoading}
              disabled={isLoading}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}

export default AvatarsPage; 