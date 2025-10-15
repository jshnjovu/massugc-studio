import React, { useState, useEffect, Fragment } from 'react';
import { PlusIcon, TrashIcon, PlayIcon, EllipsisVerticalIcon, FolderIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../components/Button';
import Modal from '../components/Modal';
import NewCampaignForm from '../components/NewCampaignForm';
import { useStore } from '../store';
import api from '../utils/api';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import JobProgressService from '../services/JobProgressService';
import { createPortal } from 'react-dom';

function CampaignsPage() {
  const [isModalOpen, setIsModalOpenInternal] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [backendAvatarsMap, setBackendAvatarsMap] = useState({});
  const [backendAvatarsList, setBackendAvatarsList] = useState([]);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState({});
  const [isAllSelected, setIsAllSelected] = useState(false);
  const [editCampaignData, setEditCampaignData] = useState(null);
  const [campaignToDelete, setCampaignToDelete] = useState(null);
  const [campaignName, setCampaignName] = useState('');
  const [currentCampaignType, setCurrentCampaignType] = useState('avatar');
  const [showNameError, setShowNameError] = useState(false);
  
  // Add dropdown state
  const [openDropdown, setOpenDropdown] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  
  // Track individual campaign loading states
  const [loadingCampaigns, setLoadingCampaigns] = useState(new Set());

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  
  // Get data and actions from global store
  const campaigns = useStore(state => state.campaigns);
  const avatars = useStore(state => state.avatars);
  const scripts = useStore(state => state.scripts);
  const clips = useStore(state => state.clips);
  const addCampaign = useStore(state => state.addCampaign);
  const removeCampaign = useStore(state => state.removeCampaign);
  const darkMode = useStore(state => state.darkMode);
  const addAvatar = useStore(state => state.addAvatar);
  const setCampaigns = useStore(state => state.setCampaigns);
  const startJob = useStore(state => state.startJob);
  const failJob = useStore(state => state.failJob);
  const startMultipleJobs = useStore(state => state.startMultipleJobs);
  
  // Batch running state from global store
  const isRunningMultiple = useStore(state => state.isRunningMultiple);
  const runningProgress = useStore(state => state.runningProgress);
  const startBatchOperation = useStore(state => state.startBatchOperation);
  const updateBatchProgress = useStore(state => state.updateBatchProgress);
  const stopBatchOperation = useStore(state => state.stopBatchOperation);
  
  // Fetch campaigns on component mount
  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        setIsLoading(true);
        const response = await api.fetchCampaigns();
        if (response && response.jobs) {
          // Transform the campaigns to match our store format
          const transformedCampaigns = response.jobs.map(job => ({
            id: job.id,
            name: job.job_name,
            product: job.product,
            persona: job.persona,
            setting: job.setting,
            emotion: job.emotion, 
            hook: job.hook,
            elevenlabs_voice_id: job.elevenlabs_voice_id,
            trigger_keywords: job.trigger_keywords,
            language: job.language,
            brand_name: job.brand_name || '',
            // Store campaign type from backend
            campaign_type: job.campaign_type || 'avatar', // Default to avatar if not specified
            // Store randomized video settings properly (preserve nested structure for edit/duplicate)
            random_video_settings: job.random_video_settings || null,
            // Also store flattened versions for backward compatibility and direct access
            source_directory: job.random_video_settings?.source_directory || job.source_directory || '',
            total_clips: job.random_video_settings?.total_clips || job.total_clips || '',
            hook_video: job.random_video_settings?.hook_video || job.hook_video || '',
            original_volume: job.random_video_settings?.original_volume !== undefined ? job.random_video_settings.original_volume : job.original_volume !== undefined ? job.original_volume : 0.6,
            voice_audio_volume: job.random_video_settings?.voice_audio_volume !== undefined ? job.random_video_settings.voice_audio_volume : job.voice_audio_volume !== undefined ? job.voice_audio_volume : 1.0,
            // Store both path and ID for avatar and script
            avatar_video_path: job.avatar_video_path,
            avatar_id: job.avatar_id,
            example_script_file: job.example_script_file,
            script_id: job.script_id,
            product_clip_id: job.product_clip_id || null,
            product_clip_path: job.product_clip_path || null,
            remove_silence: job.remove_silence,
            output_volume_enabled: job.output_volume_enabled !== undefined ? job.output_volume_enabled : false,
            output_volume_level: job.output_volume_level !== undefined ? job.output_volume_level : 0.5,
            enhance_for_elevenlabs: job.enhance_for_elevenlabs,
            use_randomization: job.use_randomization,
            useExactScript: job.useExactScript,
            randomization_intensity: job.randomization_intensity,
            // Overlay settings
            use_overlay: job.use_overlay || false,
            overlay_settings: job.overlay_settings || null,
            // Enhanced video settings - Load all flat properties from backend
            automated_video_editing_enabled: job.automated_video_editing_enabled !== undefined ? job.automated_video_editing_enabled : false,
            text_overlay_enabled: job.text_overlay_enabled !== undefined ? job.text_overlay_enabled : false,
            text_overlay_1_enabled: job.text_overlay_1_enabled !== undefined ? job.text_overlay_1_enabled : false,
            text_overlay_mode: job.text_overlay_mode || 'custom',
            text_overlay_custom_text: job.text_overlay_custom_text || '',
            text_overlay_category: job.text_overlay_category || 'engagement',
            text_overlay_font: job.text_overlay_font || 'Proxima Nova Semibold',
            text_overlay_fontSize: job.text_overlay_fontSize || 20,
            text_overlay_bold: job.text_overlay_bold !== undefined ? job.text_overlay_bold : false,
            text_overlay_underline: job.text_overlay_underline !== undefined ? job.text_overlay_underline : false,
            text_overlay_italic: job.text_overlay_italic !== undefined ? job.text_overlay_italic : false,
            text_overlay_textCase: job.text_overlay_textCase || 'none',
            text_overlay_color: job.text_overlay_color || '#000000',
            text_overlay_characterSpacing: job.text_overlay_characterSpacing || 0,
            text_overlay_lineSpacing: job.text_overlay_lineSpacing || -1,
            text_overlay_alignment: job.text_overlay_alignment || 'center',
            text_overlay_style: job.text_overlay_style || 'default',
            text_overlay_scale: job.text_overlay_scale || 60,
            text_overlay_x_position: job.text_overlay_x_position || 50,
            text_overlay_y_position: job.text_overlay_y_position || 18,
            text_overlay_rotation: job.text_overlay_rotation || 0,
            text_overlay_opacity: job.text_overlay_opacity || 100,
            text_overlay_hasStroke: job.text_overlay_hasStroke !== undefined ? job.text_overlay_hasStroke : false,
            text_overlay_strokeColor: job.text_overlay_strokeColor || '#000000',
            text_overlay_strokeThickness: job.text_overlay_strokeThickness || 2,
            text_overlay_hasBackground: job.text_overlay_hasBackground !== undefined ? job.text_overlay_hasBackground : true,
            text_overlay_backgroundColor: job.text_overlay_backgroundColor || '#ffffff',
            text_overlay_backgroundOpacity: job.text_overlay_backgroundOpacity !== undefined ? job.text_overlay_backgroundOpacity : 100,
            text_overlay_backgroundRounded: job.text_overlay_backgroundRounded || 20,
            text_overlay_backgroundHeight: job.text_overlay_backgroundHeight !== undefined ? job.text_overlay_backgroundHeight : 40,
            text_overlay_backgroundWidth: job.text_overlay_backgroundWidth !== undefined ? job.text_overlay_backgroundWidth : 50,
            text_overlay_backgroundYOffset: job.text_overlay_backgroundYOffset || 0,
            text_overlay_backgroundXOffset: job.text_overlay_backgroundXOffset || 0,
            text_overlay_backgroundStyle: job.text_overlay_backgroundStyle || 'line-width',
            text_overlay_animation: job.text_overlay_animation || 'fade_in',
            text_overlay_connected_background_data: job.text_overlay_connected_background_data,
            text_overlay_2_enabled: job.text_overlay_2_enabled !== undefined ? job.text_overlay_2_enabled : false,
            text_overlay_2_mode: job.text_overlay_2_mode || 'custom',
            text_overlay_2_custom_text: job.text_overlay_2_custom_text || '',
            text_overlay_2_category: job.text_overlay_2_category || 'engagement',
            text_overlay_2_font: job.text_overlay_2_font || 'Proxima Nova Semibold',
            text_overlay_2_customFontName: job.text_overlay_2_customFontName || '',
            text_overlay_2_fontSize: job.text_overlay_2_fontSize || 20,
            text_overlay_2_bold: job.text_overlay_2_bold !== undefined ? job.text_overlay_2_bold : false,
            text_overlay_2_underline: job.text_overlay_2_underline !== undefined ? job.text_overlay_2_underline : false,
            text_overlay_2_italic: job.text_overlay_2_italic !== undefined ? job.text_overlay_2_italic : false,
            text_overlay_2_textCase: job.text_overlay_2_textCase || 'none',
            text_overlay_2_color: job.text_overlay_2_color || '#000000',
            text_overlay_2_characterSpacing: job.text_overlay_2_characterSpacing || 0,
            text_overlay_2_lineSpacing: job.text_overlay_2_lineSpacing || -1,
            text_overlay_2_alignment: job.text_overlay_2_alignment || 'center',
            text_overlay_2_style: job.text_overlay_2_style || 'default',
            text_overlay_2_scale: job.text_overlay_2_scale || 60,
            text_overlay_2_x_position: job.text_overlay_2_x_position || 30,
            text_overlay_2_y_position: job.text_overlay_2_y_position || 55,
            text_overlay_2_rotation: job.text_overlay_2_rotation || 0,
            text_overlay_2_opacity: job.text_overlay_2_opacity || 100,
            text_overlay_2_hasStroke: job.text_overlay_2_hasStroke !== undefined ? job.text_overlay_2_hasStroke : false,
            text_overlay_2_strokeColor: job.text_overlay_2_strokeColor || '#000000',
            text_overlay_2_strokeThickness: job.text_overlay_2_strokeThickness || 2,
            text_overlay_2_hasBackground: job.text_overlay_2_hasBackground !== undefined ? job.text_overlay_2_hasBackground : true,
            text_overlay_2_backgroundColor: job.text_overlay_2_backgroundColor || '#ffffff',
            text_overlay_2_backgroundOpacity: job.text_overlay_2_backgroundOpacity !== undefined ? job.text_overlay_2_backgroundOpacity : 100,
            text_overlay_2_backgroundRounded: job.text_overlay_2_backgroundRounded || 7,
            text_overlay_2_backgroundHeight: job.text_overlay_2_backgroundHeight !== undefined ? job.text_overlay_2_backgroundHeight : 40,
            text_overlay_2_backgroundWidth: job.text_overlay_2_backgroundWidth !== undefined ? job.text_overlay_2_backgroundWidth : 50,
            text_overlay_2_backgroundYOffset: job.text_overlay_2_backgroundYOffset || 0,
            text_overlay_2_backgroundXOffset: job.text_overlay_2_backgroundXOffset || 0,
            text_overlay_2_backgroundStyle: job.text_overlay_2_backgroundStyle || 'line-width',
            text_overlay_2_animation: job.text_overlay_2_animation || 'fade_in',
            text_overlay_2_connected_background_data: job.text_overlay_2_connected_background_data,
            text_overlay_3_enabled: job.text_overlay_3_enabled !== undefined ? job.text_overlay_3_enabled : false,
            text_overlay_3_mode: job.text_overlay_3_mode || 'custom',
            text_overlay_3_custom_text: job.text_overlay_3_custom_text || '',
            text_overlay_3_category: job.text_overlay_3_category || 'engagement',
            text_overlay_3_font: job.text_overlay_3_font || 'Proxima Nova Semibold',
            text_overlay_3_customFontName: job.text_overlay_3_customFontName || '',
            text_overlay_3_fontSize: job.text_overlay_3_fontSize || 20,
            text_overlay_3_bold: job.text_overlay_3_bold !== undefined ? job.text_overlay_3_bold : false,
            text_overlay_3_underline: job.text_overlay_3_underline !== undefined ? job.text_overlay_3_underline : false,
            text_overlay_3_italic: job.text_overlay_3_italic !== undefined ? job.text_overlay_3_italic : false,
            text_overlay_3_textCase: job.text_overlay_3_textCase || 'none',
            text_overlay_3_color: job.text_overlay_3_color || '#000000',
            text_overlay_3_characterSpacing: job.text_overlay_3_characterSpacing || 0,
            text_overlay_3_lineSpacing: job.text_overlay_3_lineSpacing || -1,
            text_overlay_3_alignment: job.text_overlay_3_alignment || 'center',
            text_overlay_3_style: job.text_overlay_3_style || 'default',
            text_overlay_3_scale: job.text_overlay_3_scale || 60,
            text_overlay_3_x_position: job.text_overlay_3_x_position || 70,
            text_overlay_3_y_position: job.text_overlay_3_y_position || 65,
            text_overlay_3_rotation: job.text_overlay_3_rotation || 0,
            text_overlay_3_opacity: job.text_overlay_3_opacity || 100,
            text_overlay_3_hasStroke: job.text_overlay_3_hasStroke !== undefined ? job.text_overlay_3_hasStroke : false,
            text_overlay_3_strokeColor: job.text_overlay_3_strokeColor || '#000000',
            text_overlay_3_strokeThickness: job.text_overlay_3_strokeThickness || 2,
            text_overlay_3_hasBackground: job.text_overlay_3_hasBackground !== undefined ? job.text_overlay_3_hasBackground : true,
            text_overlay_3_backgroundColor: job.text_overlay_3_backgroundColor || '#ffffff',
            text_overlay_3_backgroundOpacity: job.text_overlay_3_backgroundOpacity !== undefined ? job.text_overlay_3_backgroundOpacity : 100,
            text_overlay_3_backgroundRounded: job.text_overlay_3_backgroundRounded || 7,
            text_overlay_3_backgroundHeight: job.text_overlay_3_backgroundHeight !== undefined ? job.text_overlay_3_backgroundHeight : 40,
            text_overlay_3_backgroundWidth: job.text_overlay_3_backgroundWidth !== undefined ? job.text_overlay_3_backgroundWidth : 50,
            text_overlay_3_backgroundYOffset: job.text_overlay_3_backgroundYOffset || 0,
            text_overlay_3_backgroundXOffset: job.text_overlay_3_backgroundXOffset || 0,
            text_overlay_3_backgroundStyle: job.text_overlay_3_backgroundStyle || 'line-width',
            text_overlay_3_animation: job.text_overlay_3_animation || 'fade_in',
            text_overlay_3_connected_background_data: job.text_overlay_3_connected_background_data,
            captions_enabled: job.captions_enabled !== undefined ? job.captions_enabled : false,
            captions_style: job.captions_style || 'tiktok_classic',
            captions_position: job.captions_position || 'bottom_center',
            captions_size: job.captions_size || 'medium',
            captions_highlight_keywords: job.captions_highlight_keywords !== undefined ? job.captions_highlight_keywords : true,
            captions_processing_method: job.captions_processing_method || 'auto',
            // New extended caption fields
            captions_template: job.captions_template || 'tiktok_classic',
            captions_fontSize: job.captions_fontSize || 32,
            captions_fontFamily: job.captions_fontFamily || 'Montserrat-Bold',
            captions_x_position: job.captions_x_position || 50,
            captions_y_position: job.captions_y_position || 85,
            captions_color: job.captions_color || '#FFFFFF',
            captions_hasStroke: job.captions_hasStroke !== undefined ? job.captions_hasStroke : true,
            captions_strokeColor: job.captions_strokeColor || '#000000',
            captions_strokeWidth: job.captions_strokeWidth || 2,
            captions_hasBackground: job.captions_hasBackground || false,
            captions_backgroundColor: job.captions_backgroundColor || '#000000',
            captions_backgroundOpacity: job.captions_backgroundOpacity || 0.8,
            captions_animation: job.captions_animation || 'none',
            captions_max_words_per_segment: job.captions_max_words_per_segment || 4,
            captions_allCaps: job.captions_allCaps || false,
            music_enabled: job.music_enabled !== undefined ? job.music_enabled : false,
            music_track_id: job.music_track_id || 'random_upbeat',
            music_volume: job.music_volume !== undefined ? job.music_volume : 0.6,
            music_fade_duration: job.music_fade_duration !== undefined ? job.music_fade_duration : 2.0,
            enabled: job.enabled,
            status: job.output_path ? 'completed' : 'ready',
            output_path: job.output_path || null,
            created_at: job.created_at
          }));
          
          // Update the store
          setCampaigns(transformedCampaigns);
        }
        setApiError(null);
      } catch (error) {
        console.error('Error fetching campaigns:', error);
        setApiError({
          message: error.message || 'Failed to fetch campaigns',
          guidance: 'Please check your internet connection and API configuration.',
          severity: 'error'
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchCampaigns();
  }, [setCampaigns]);
  
  // Load API key on component mount and test connectivity
  useEffect(() => {
    try {
      // Check if Zyra API key exists first
      const zyraApiKey = api.getStoredZyraApiKey();
      if (!zyraApiKey) {
        setApiError({
          message: 'Zyra API key is required to use MassUGC Studio',
          guidance: 'Please go to Settings to configure your Zyra API key.',
          severity: 'error'
        });
        return;
      }
      
      // Test API connection
      const testConnection = async () => {
        try {
          // Use the health endpoint to check API connectivity
          const response = await fetch(`${api.API_URL}/health`);
          
          if (!response.ok) {
            throw new Error(`Health check failed with status: ${response.status}`);
          }
          
          const data = await response.json();
          if (data.status === "ok") {
            console.log('API health check successful');
            setApiError(null);
          } else {
            throw new Error('API responded with non-ok status');
          }
        } catch (error) {
          console.error('API health check failed:', error);
          setApiError({
            message: 'Failed to connect to API server',
            guidance: 'Please check if the backend server is running and try again.',
            severity: 'error'
          });
        }
      };
      
      testConnection();
    } catch (e) {
      console.error('Error loading API key:', e);
      setApiError({
        message: 'Failed to initialize API connection',
        guidance: 'Please check your API configuration in Settings.',
        severity: 'error'
      });
    }
  }, []);
  
  // After the other useEffect hooks, add a new one to fetch backend avatars
  useEffect(() => {
    const fetchBackendAvatars = async () => {
      try {
        // Fetch avatars from backend
        const backendAvatars = await api.fetchBackendAvatars();
        console.log('Backend avatars:', backendAvatars);
        
        // Store the raw list for direct selection
        setBackendAvatarsList(backendAvatars);
        
        // Create a map for easy reference
        const avatarMap = {};
        
        // Map backend avatars to frontend format for display
        const mappedAvatars = backendAvatars.map(avatar => {
          const mappedAvatar = {
            id: avatar.id, // Use backend ID directly
            name: avatar.name,
            language: avatar.origin_language || 'Various', // Map origin_language to language
            filePath: avatar.file_path, // Map file_path to filePath
            elevenlabs_voice_id: avatar.elevenlabs_voice_id,
            gender: avatar.gender,
            backendAvatar: true // Flag to indicate this is a backend avatar
          };
          
          // Add to our reference map
          avatarMap[avatar.id] = mappedAvatar;
          
          return mappedAvatar;
        });
        
        console.log('Mapped avatars to add:', mappedAvatars);
        
        // Store a reference to all backend avatars
        setBackendAvatarsMap(avatarMap);
        
        // Update avatar store with mapped backend avatars
        if (mappedAvatars.length > 0) {
          // Since we can't directly access the set method, we'll add each avatar
          mappedAvatars.forEach(avatar => {
            // Only add if it doesn't already exist
            if (!avatars.some(a => a.id === avatar.id)) {
              console.log(`Adding backend avatar to store: ${avatar.id} - ${avatar.name}`);
              addAvatar(avatar);
            } else {
              console.log(`Skipping existing avatar: ${avatar.id} - ${avatar.name}`);
            }
          });
        }
        setApiError(null);
      } catch (error) {
        console.error('Failed to fetch backend avatars:', error);
        setApiError({
          message: 'Failed to fetch avatars from the backend',
          guidance: 'Please check your server connection and try again.',
          severity: 'warning'
        });
      }
    };
    
    // Always fetch avatars, regardless of API error state
    fetchBackendAvatars();
  }, []);
  
  const handleNewCampaign = async (formData) => {
    try {
      // Validate campaign name
      if (!campaignName.trim()) {
        setShowNameError(true);
        setTimeout(() => setShowNameError(false), 3000); // Hide after 3 seconds
        return;
      }

      setIsLoading(true);

      let jsonData;
      
      if (formData.campaignType === 'avatar') {
        // Avatar-based campaign
        // Get the selected avatar
        const selectedAvatar = avatars.find(a => a.id === formData.avatarId);
        if (!selectedAvatar) {
          throw new Error('No avatar selected or avatar not found');
        }
        
        // Get the selected script
        const selectedScript = scripts.find(s => s.id === formData.scriptId);
        if (!selectedScript) {
          throw new Error('Selected script not found');
        }
        
        // Get selected clip (optional)
        let selectedClip = null;
        if (formData.clipId) {
          selectedClip = clips.find(c => c.id === formData.clipId);
          if (!selectedClip) {
            console.warn('Selected clip not found:', formData.clipId);
          }
        }
        
        // Create JSON data for avatar-based campaign
        jsonData = {
          job_name: formData.name,
          persona: formData.persona,
          setting: formData.setting,
          emotion: formData.emotion,
          product: formData.product,
          hook: formData.hook,
          elevenlabs_voice_id: formData.elevenlabsVoiceId,
          trigger_keywords: formData.trigger_keywords,
          language: formData.language,
          brand_name: formData.brandName || '',
          remove_silence: formData.removeSilence,
          output_volume_enabled: formData.outputVolumeEnabled === true,
          output_volume_level: formData.outputVolumeLevel,
          enhance_for_elevenlabs: formData.enhanceForElevenlabs,
          use_randomization: formData.use_randomization === true,
          randomization_intensity: formData.randomization_intensity || 'none',
          useExactScript: formData.useExactScript === true,
          avatar_id: selectedAvatar.id,
          avatar_video_path: selectedAvatar.filePath,
          script_id: selectedScript.id,
          example_script_file: selectedScript.filePath,
          product_clip_id: selectedClip ? selectedClip.id : null,
          product_clip_path: selectedClip ? selectedClip.filePath : null,
          // Overlay settings
          use_overlay: formData.useOverlay || false,
          overlay_settings: formData.overlaySettings,
          // Enhanced video settings (structured format - NEW)
          enhanced_settings: formData.enhanced_settings,
          // Enhanced video settings (flat properties - legacy compatibility)
          automated_video_editing_enabled: formData.automated_video_editing_enabled,
          text_overlay_enabled: formData.text_overlay_enabled,
          text_overlay_1_enabled: formData.text_overlay_1_enabled,
          text_overlay_mode: formData.text_overlay_mode,
          text_overlay_custom_text: formData.text_overlay_custom_text,
          text_overlay_category: formData.text_overlay_category,
          text_overlay_font: formData.text_overlay_font,
          text_overlay_fontSize: formData.text_overlay_fontSize,
          text_overlay_bold: formData.text_overlay_bold,
          text_overlay_underline: formData.text_overlay_underline,
          text_overlay_italic: formData.text_overlay_italic,
          text_overlay_textCase: formData.text_overlay_textCase,
          text_overlay_color: formData.text_overlay_color,
          text_overlay_characterSpacing: formData.text_overlay_characterSpacing,
          text_overlay_lineSpacing: formData.text_overlay_lineSpacing,
          text_overlay_alignment: formData.text_overlay_alignment,
          text_overlay_style: formData.text_overlay_style,
          text_overlay_scale: formData.text_overlay_scale,
          text_overlay_x_position: formData.text_overlay_x_position,
          text_overlay_y_position: formData.text_overlay_y_position,
          text_overlay_rotation: formData.text_overlay_rotation,
          text_overlay_opacity: formData.text_overlay_opacity,
          text_overlay_hasStroke: formData.text_overlay_hasStroke,
          text_overlay_strokeColor: formData.text_overlay_strokeColor,
          text_overlay_strokeThickness: formData.text_overlay_strokeThickness,
          text_overlay_hasBackground: formData.text_overlay_hasBackground,
          text_overlay_backgroundColor: formData.text_overlay_backgroundColor,
          text_overlay_backgroundOpacity: formData.text_overlay_backgroundOpacity,
          text_overlay_backgroundRounded: formData.text_overlay_backgroundRounded,
          text_overlay_backgroundStyle: formData.text_overlay_backgroundStyle,
          text_overlay_backgroundHeight: formData.text_overlay_backgroundHeight,
          text_overlay_backgroundWidth: formData.text_overlay_backgroundWidth,
          text_overlay_backgroundYOffset: formData.text_overlay_backgroundYOffset,
          text_overlay_backgroundXOffset: formData.text_overlay_backgroundXOffset,
          text_overlay_animation: formData.text_overlay_animation,
          // Don't persist computed background data
          // text_overlay_connected_background_data: formData.text_overlay_connected_background_data,
          text_overlay_2_enabled: formData.text_overlay_2_enabled,
          text_overlay_2_mode: formData.text_overlay_2_mode,
          text_overlay_2_custom_text: formData.text_overlay_2_custom_text,
          text_overlay_2_category: formData.text_overlay_2_category,
          text_overlay_2_font: formData.text_overlay_2_font,
          text_overlay_2_customFontName: formData.text_overlay_2_customFontName,
          text_overlay_2_fontSize: formData.text_overlay_2_fontSize,
          text_overlay_2_bold: formData.text_overlay_2_bold,
          text_overlay_2_underline: formData.text_overlay_2_underline,
          text_overlay_2_italic: formData.text_overlay_2_italic,
          text_overlay_2_textCase: formData.text_overlay_2_textCase,
          text_overlay_2_color: formData.text_overlay_2_color,
          text_overlay_2_characterSpacing: formData.text_overlay_2_characterSpacing,
          text_overlay_2_lineSpacing: formData.text_overlay_2_lineSpacing,
          text_overlay_2_alignment: formData.text_overlay_2_alignment,
          text_overlay_2_style: formData.text_overlay_2_style,
          text_overlay_2_scale: formData.text_overlay_2_scale,
          text_overlay_2_x_position: formData.text_overlay_2_x_position,
          text_overlay_2_y_position: formData.text_overlay_2_y_position,
          text_overlay_2_rotation: formData.text_overlay_2_rotation,
          text_overlay_2_opacity: formData.text_overlay_2_opacity,
          text_overlay_2_hasStroke: formData.text_overlay_2_hasStroke,
          text_overlay_2_strokeColor: formData.text_overlay_2_strokeColor,
          text_overlay_2_strokeThickness: formData.text_overlay_2_strokeThickness,
          text_overlay_2_hasBackground: formData.text_overlay_2_hasBackground,
          text_overlay_2_backgroundColor: formData.text_overlay_2_backgroundColor,
          text_overlay_2_backgroundOpacity: formData.text_overlay_2_backgroundOpacity,
          text_overlay_2_backgroundRounded: formData.text_overlay_2_backgroundRounded,
          text_overlay_2_backgroundStyle: formData.text_overlay_2_backgroundStyle,
          text_overlay_2_backgroundHeight: formData.text_overlay_2_backgroundHeight,
          text_overlay_2_backgroundWidth: formData.text_overlay_2_backgroundWidth,
          text_overlay_2_backgroundYOffset: formData.text_overlay_2_backgroundYOffset,
          text_overlay_2_backgroundXOffset: formData.text_overlay_2_backgroundXOffset,
          text_overlay_2_animation: formData.text_overlay_2_animation,
          // Don't persist computed background data
          // text_overlay_2_connected_background_data: formData.text_overlay_2_connected_background_data,
          text_overlay_3_enabled: formData.text_overlay_3_enabled,
          text_overlay_3_mode: formData.text_overlay_3_mode,
          text_overlay_3_custom_text: formData.text_overlay_3_custom_text,
          text_overlay_3_category: formData.text_overlay_3_category,
          text_overlay_3_font: formData.text_overlay_3_font,
          text_overlay_3_customFontName: formData.text_overlay_3_customFontName,
          text_overlay_3_fontSize: formData.text_overlay_3_fontSize,
          text_overlay_3_bold: formData.text_overlay_3_bold,
          text_overlay_3_underline: formData.text_overlay_3_underline,
          text_overlay_3_italic: formData.text_overlay_3_italic,
          text_overlay_3_textCase: formData.text_overlay_3_textCase,
          text_overlay_3_color: formData.text_overlay_3_color,
          text_overlay_3_characterSpacing: formData.text_overlay_3_characterSpacing,
          text_overlay_3_lineSpacing: formData.text_overlay_3_lineSpacing,
          text_overlay_3_alignment: formData.text_overlay_3_alignment,
          text_overlay_3_style: formData.text_overlay_3_style,
          text_overlay_3_scale: formData.text_overlay_3_scale,
          text_overlay_3_x_position: formData.text_overlay_3_x_position,
          text_overlay_3_y_position: formData.text_overlay_3_y_position,
          text_overlay_3_rotation: formData.text_overlay_3_rotation,
          text_overlay_3_opacity: formData.text_overlay_3_opacity,
          text_overlay_3_hasStroke: formData.text_overlay_3_hasStroke,
          text_overlay_3_strokeColor: formData.text_overlay_3_strokeColor,
          text_overlay_3_strokeThickness: formData.text_overlay_3_strokeThickness,
          text_overlay_3_hasBackground: formData.text_overlay_3_hasBackground,
          text_overlay_3_backgroundColor: formData.text_overlay_3_backgroundColor,
          text_overlay_3_backgroundOpacity: formData.text_overlay_3_backgroundOpacity,
          text_overlay_3_backgroundRounded: formData.text_overlay_3_backgroundRounded,
          text_overlay_3_backgroundStyle: formData.text_overlay_3_backgroundStyle,
          text_overlay_3_backgroundHeight: formData.text_overlay_3_backgroundHeight,
          text_overlay_3_backgroundWidth: formData.text_overlay_3_backgroundWidth,
          text_overlay_3_backgroundYOffset: formData.text_overlay_3_backgroundYOffset,
          text_overlay_3_backgroundXOffset: formData.text_overlay_3_backgroundXOffset,
          text_overlay_3_animation: formData.text_overlay_3_animation,
          // Don't persist computed background data
          // text_overlay_3_connected_background_data: formData.text_overlay_3_connected_background_data,
          captions_enabled: formData.captions_enabled,
          captions_style: formData.captions_style,
          captions_position: formData.captions_position,
          captions_size: formData.captions_size,
          captions_highlight_keywords: formData.captions_highlight_keywords,
          // New extended caption fields with defaults
          captions_template: formData.captions_template || 'tiktok_classic',
          captions_fontSize: formData.captions_fontSize || 32,
          captions_fontFamily: formData.captions_fontFamily || 'Montserrat-Bold',
          captions_x_position: formData.captions_x_position !== undefined ? formData.captions_x_position : 50,
          captions_y_position: formData.captions_y_position !== undefined ? formData.captions_y_position : 85,
          captions_color: formData.captions_color || '#FFFFFF',
          captions_hasStroke: formData.captions_hasStroke !== undefined ? formData.captions_hasStroke : true,
          captions_strokeColor: formData.captions_strokeColor || '#000000',
          captions_strokeWidth: formData.captions_strokeWidth || 2,
          captions_hasBackground: formData.captions_hasBackground !== undefined ? formData.captions_hasBackground : false,
          captions_backgroundColor: formData.captions_backgroundColor || '#000000',
          captions_backgroundOpacity: formData.captions_backgroundOpacity !== undefined ? formData.captions_backgroundOpacity : 0.8,
          captions_animation: formData.captions_animation || 'none',
          captions_max_words_per_segment: formData.captions_max_words_per_segment || 4,
          captions_allCaps: formData.captions_allCaps || false,
          captions_processing_method: formData.captions_processing_method,
          music_enabled: formData.music_enabled,
          music_track_id: formData.music_track_id,
          music_volume: formData.music_volume,
          music_fade_duration: formData.music_fade_duration
        };

      } else if (formData.campaignType === 'randomized') {
        // Randomized video campaign
        // Get the selected script (still needed for AI text generation)
        const selectedScript = scripts.find(s => s.id === formData.scriptId);
        if (!selectedScript) {
          throw new Error('Selected script not found');
        }
        
        // Get selected clip (optional, but required if overlay is enabled)
        let selectedClip = null;
        if (formData.clipId) {
          selectedClip = clips.find(c => c.id === formData.clipId);
          if (!selectedClip && formData.useOverlay) {
            throw new Error('Selected product clip not found');
          }
        }
        
        // Validate overlay settings for randomized campaigns
        if (formData.useOverlay && !selectedClip) {
          throw new Error('A product clip is required when overlay is enabled for randomized video campaigns');
        }
        
        // Create JSON data for randomized campaign
        jsonData = {
          job_name: formData.name,
          persona: formData.persona,
          setting: formData.setting,
          emotion: formData.emotion,
          product: formData.product,
          hook: formData.hook,
          elevenlabs_voice_id: formData.elevenlabsVoiceId,
          trigger_keywords: formData.trigger_keywords,
          language: formData.language,
          brand_name: formData.brandName || '',
          enhance_for_elevenlabs: formData.enhanceForElevenlabs,
          remove_silence: formData.remove_silence,
          script_id: selectedScript.id,
          example_script_file: selectedScript.filePath,
          product_clip_id: selectedClip ? selectedClip.id : null,
          product_clip_path: selectedClip ? selectedClip.filePath : null,
          // Randomized video specific settings
          random_video_settings: formData.randomVideoSettings,
          // Required fields for API compatibility (use dummy values for randomized campaigns)
          avatar_id: 'randomized',
          avatar_video_path: 'randomized',
          // Output volume settings
          output_volume_enabled: formData.outputVolumeEnabled === true,
          output_volume_level: formData.outputVolumeLevel,
          // Use actual randomization settings from form instead of hardcoding to false
          use_randomization: formData.use_randomization === true,
          randomization_intensity: formData.randomization_intensity || 'none',
          // Overlay settings (NEW - now properly passed for randomized campaigns)
          use_overlay: formData.useOverlay || false,
          overlay_settings: formData.overlaySettings,
          // Enhanced video settings (structured format - NEW)
          enhanced_settings: formData.enhanced_settings,
          // Enhanced video settings (flat properties - legacy compatibility)
          automated_video_editing_enabled: formData.automated_video_editing_enabled,
          text_overlay_enabled: formData.text_overlay_enabled,
          text_overlay_1_enabled: formData.text_overlay_1_enabled,
          text_overlay_mode: formData.text_overlay_mode,
          text_overlay_custom_text: formData.text_overlay_custom_text,
          text_overlay_category: formData.text_overlay_category,
          text_overlay_font: formData.text_overlay_font,
          text_overlay_fontSize: formData.text_overlay_fontSize,
          text_overlay_bold: formData.text_overlay_bold,
          text_overlay_underline: formData.text_overlay_underline,
          text_overlay_italic: formData.text_overlay_italic,
          text_overlay_textCase: formData.text_overlay_textCase,
          text_overlay_color: formData.text_overlay_color,
          text_overlay_characterSpacing: formData.text_overlay_characterSpacing,
          text_overlay_lineSpacing: formData.text_overlay_lineSpacing,
          text_overlay_alignment: formData.text_overlay_alignment,
          text_overlay_style: formData.text_overlay_style,
          text_overlay_scale: formData.text_overlay_scale,
          text_overlay_x_position: formData.text_overlay_x_position,
          text_overlay_y_position: formData.text_overlay_y_position,
          text_overlay_rotation: formData.text_overlay_rotation,
          text_overlay_opacity: formData.text_overlay_opacity,
          text_overlay_hasStroke: formData.text_overlay_hasStroke,
          text_overlay_strokeColor: formData.text_overlay_strokeColor,
          text_overlay_strokeThickness: formData.text_overlay_strokeThickness,
          text_overlay_hasBackground: formData.text_overlay_hasBackground,
          text_overlay_backgroundColor: formData.text_overlay_backgroundColor,
          text_overlay_backgroundOpacity: formData.text_overlay_backgroundOpacity,
          text_overlay_backgroundRounded: formData.text_overlay_backgroundRounded,
          text_overlay_backgroundStyle: formData.text_overlay_backgroundStyle,
          text_overlay_backgroundHeight: formData.text_overlay_backgroundHeight,
          text_overlay_backgroundWidth: formData.text_overlay_backgroundWidth,
          text_overlay_backgroundYOffset: formData.text_overlay_backgroundYOffset,
          text_overlay_backgroundXOffset: formData.text_overlay_backgroundXOffset,
          text_overlay_animation: formData.text_overlay_animation,
          // Don't persist computed background data
          // text_overlay_connected_background_data: formData.text_overlay_connected_background_data,
          text_overlay_2_enabled: formData.text_overlay_2_enabled,
          text_overlay_2_mode: formData.text_overlay_2_mode,
          text_overlay_2_custom_text: formData.text_overlay_2_custom_text,
          text_overlay_2_category: formData.text_overlay_2_category,
          text_overlay_2_font: formData.text_overlay_2_font,
          text_overlay_2_customFontName: formData.text_overlay_2_customFontName,
          text_overlay_2_fontSize: formData.text_overlay_2_fontSize,
          text_overlay_2_bold: formData.text_overlay_2_bold,
          text_overlay_2_underline: formData.text_overlay_2_underline,
          text_overlay_2_italic: formData.text_overlay_2_italic,
          text_overlay_2_textCase: formData.text_overlay_2_textCase,
          text_overlay_2_color: formData.text_overlay_2_color,
          text_overlay_2_characterSpacing: formData.text_overlay_2_characterSpacing,
          text_overlay_2_lineSpacing: formData.text_overlay_2_lineSpacing,
          text_overlay_2_alignment: formData.text_overlay_2_alignment,
          text_overlay_2_style: formData.text_overlay_2_style,
          text_overlay_2_scale: formData.text_overlay_2_scale,
          text_overlay_2_x_position: formData.text_overlay_2_x_position,
          text_overlay_2_y_position: formData.text_overlay_2_y_position,
          text_overlay_2_rotation: formData.text_overlay_2_rotation,
          text_overlay_2_opacity: formData.text_overlay_2_opacity,
          text_overlay_2_hasStroke: formData.text_overlay_2_hasStroke,
          text_overlay_2_strokeColor: formData.text_overlay_2_strokeColor,
          text_overlay_2_strokeThickness: formData.text_overlay_2_strokeThickness,
          text_overlay_2_hasBackground: formData.text_overlay_2_hasBackground,
          text_overlay_2_backgroundColor: formData.text_overlay_2_backgroundColor,
          text_overlay_2_backgroundOpacity: formData.text_overlay_2_backgroundOpacity,
          text_overlay_2_backgroundRounded: formData.text_overlay_2_backgroundRounded,
          text_overlay_2_backgroundStyle: formData.text_overlay_2_backgroundStyle,
          text_overlay_2_backgroundHeight: formData.text_overlay_2_backgroundHeight,
          text_overlay_2_backgroundWidth: formData.text_overlay_2_backgroundWidth,
          text_overlay_2_backgroundYOffset: formData.text_overlay_2_backgroundYOffset,
          text_overlay_2_backgroundXOffset: formData.text_overlay_2_backgroundXOffset,
          text_overlay_2_animation: formData.text_overlay_2_animation,
          // Don't persist computed background data
          // text_overlay_2_connected_background_data: formData.text_overlay_2_connected_background_data,
          text_overlay_3_enabled: formData.text_overlay_3_enabled,
          text_overlay_3_mode: formData.text_overlay_3_mode,
          text_overlay_3_custom_text: formData.text_overlay_3_custom_text,
          text_overlay_3_category: formData.text_overlay_3_category,
          text_overlay_3_font: formData.text_overlay_3_font,
          text_overlay_3_customFontName: formData.text_overlay_3_customFontName,
          text_overlay_3_fontSize: formData.text_overlay_3_fontSize,
          text_overlay_3_bold: formData.text_overlay_3_bold,
          text_overlay_3_underline: formData.text_overlay_3_underline,
          text_overlay_3_italic: formData.text_overlay_3_italic,
          text_overlay_3_textCase: formData.text_overlay_3_textCase,
          text_overlay_3_color: formData.text_overlay_3_color,
          text_overlay_3_characterSpacing: formData.text_overlay_3_characterSpacing,
          text_overlay_3_lineSpacing: formData.text_overlay_3_lineSpacing,
          text_overlay_3_alignment: formData.text_overlay_3_alignment,
          text_overlay_3_style: formData.text_overlay_3_style,
          text_overlay_3_scale: formData.text_overlay_3_scale,
          text_overlay_3_x_position: formData.text_overlay_3_x_position,
          text_overlay_3_y_position: formData.text_overlay_3_y_position,
          text_overlay_3_rotation: formData.text_overlay_3_rotation,
          text_overlay_3_opacity: formData.text_overlay_3_opacity,
          text_overlay_3_hasStroke: formData.text_overlay_3_hasStroke,
          text_overlay_3_strokeColor: formData.text_overlay_3_strokeColor,
          text_overlay_3_strokeThickness: formData.text_overlay_3_strokeThickness,
          text_overlay_3_hasBackground: formData.text_overlay_3_hasBackground,
          text_overlay_3_backgroundColor: formData.text_overlay_3_backgroundColor,
          text_overlay_3_backgroundOpacity: formData.text_overlay_3_backgroundOpacity,
          text_overlay_3_backgroundRounded: formData.text_overlay_3_backgroundRounded,
          text_overlay_3_backgroundStyle: formData.text_overlay_3_backgroundStyle,
          text_overlay_3_backgroundHeight: formData.text_overlay_3_backgroundHeight,
          text_overlay_3_backgroundWidth: formData.text_overlay_3_backgroundWidth,
          text_overlay_3_backgroundYOffset: formData.text_overlay_3_backgroundYOffset,
          text_overlay_3_backgroundXOffset: formData.text_overlay_3_backgroundXOffset,
          text_overlay_3_animation: formData.text_overlay_3_animation,
          // Don't persist computed background data
          // text_overlay_3_connected_background_data: formData.text_overlay_3_connected_background_data,
          captions_enabled: formData.captions_enabled,
          captions_style: formData.captions_style,
          captions_position: formData.captions_position,
          captions_size: formData.captions_size,
          captions_highlight_keywords: formData.captions_highlight_keywords,
          // New extended caption fields with defaults
          captions_template: formData.captions_template || 'tiktok_classic',
          captions_fontSize: formData.captions_fontSize || 32,
          captions_fontFamily: formData.captions_fontFamily || 'Montserrat-Bold',
          captions_x_position: formData.captions_x_position !== undefined ? formData.captions_x_position : 50,
          captions_y_position: formData.captions_y_position !== undefined ? formData.captions_y_position : 85,
          captions_color: formData.captions_color || '#FFFFFF',
          captions_hasStroke: formData.captions_hasStroke !== undefined ? formData.captions_hasStroke : true,
          captions_strokeColor: formData.captions_strokeColor || '#000000',
          captions_strokeWidth: formData.captions_strokeWidth || 2,
          captions_hasBackground: formData.captions_hasBackground !== undefined ? formData.captions_hasBackground : false,
          captions_backgroundColor: formData.captions_backgroundColor || '#000000',
          captions_backgroundOpacity: formData.captions_backgroundOpacity !== undefined ? formData.captions_backgroundOpacity : 0.8,
          captions_animation: formData.captions_animation || 'none',
          captions_max_words_per_segment: formData.captions_max_words_per_segment || 4,
          captions_allCaps: formData.captions_allCaps || false,
          captions_processing_method: formData.captions_processing_method,
          music_enabled: formData.music_enabled,
          music_track_id: formData.music_track_id,
          music_volume: formData.music_volume,
          music_fade_duration: formData.music_fade_duration,
          // Exact script feature
          useExactScript: formData.useExactScript === true
        };
      } else {
        throw new Error('Invalid campaign type');
      }
      
      let response;
      
      // Check if this is an edit operation
      if (formData.isEdit && formData.id) {
        // Send PUT request to update the existing campaign
        response = await api.updateCampaign(formData.id, jsonData);
        
        // Update the campaign in the store
        const updatedCampaign = {
          id: response.id,
          name: response.job_name,
          product: response.product,
          persona: response.persona,
          setting: response.setting,
          emotion: response.emotion,
          hook: response.hook,
          elevenlabs_voice_id: response.elevenlabs_voice_id,
          trigger_keywords: response.trigger_keywords,
          language: response.language,
          brand_name: response.brand_name || '',
          // Campaign type specific fields
          campaign_type: formData.campaignType,
          random_video_settings: response.random_video_settings || null,
          // Also store flattened versions for backward compatibility and direct access
          source_directory: response.random_video_settings?.source_directory || response.source_directory || '',
          total_clips: response.random_video_settings?.total_clips || response.total_clips || '',
          hook_video: response.random_video_settings?.hook_video || response.hook_video || '',
          original_volume: response.random_video_settings?.original_volume !== undefined ? response.random_video_settings.original_volume : response.original_volume !== undefined ? response.original_volume : 0.6,
          voice_audio_volume: response.random_video_settings?.voice_audio_volume !== undefined ? response.random_video_settings.voice_audio_volume : response.voice_audio_volume !== undefined ? response.voice_audio_volume : 1.0,
          // Store both paths and IDs from backend response (for avatar campaigns)
          avatar_video_path: response.avatar_video_path,
          avatar_id: response.avatar_id,
          example_script_file: response.example_script_file,
          script_id: response.script_id,
          product_clip_id: response.product_clip_id || null,
          product_clip_path: response.product_clip_path || null,
          remove_silence: response.remove_silence,
          output_volume_enabled: response.output_volume_enabled !== undefined ? response.output_volume_enabled : false,
          output_volume_level: response.output_volume_level !== undefined ? response.output_volume_level : 0.5,
          enhance_for_elevenlabs: response.enhance_for_elevenlabs,
          use_randomization: response.use_randomization === true,
          useExactScript: response.useExactScript,
          randomization_intensity: response.randomization_intensity || 'none',
          // Overlay settings
          use_overlay: response.use_overlay || false,
          overlay_settings: response.overlay_settings || null,
          // Enhanced video settings - Load all flat properties from backend response
          enhancedVideoSettings: response.enhancedVideoSettings || null,
          automated_video_editing_enabled: response.automated_video_editing_enabled !== undefined ? response.automated_video_editing_enabled : false,
          text_overlay_enabled: response.text_overlay_enabled !== undefined ? response.text_overlay_enabled : false,
          text_overlay_1_enabled: response.text_overlay_1_enabled !== undefined ? response.text_overlay_1_enabled : false,
          text_overlay_mode: response.text_overlay_mode || 'custom',
          text_overlay_custom_text: response.text_overlay_custom_text || '',
          text_overlay_category: response.text_overlay_category || 'engagement',
          text_overlay_font: response.text_overlay_font || 'Proxima Nova Semibold',
          text_overlay_fontSize: response.text_overlay_fontSize || 20,
          text_overlay_bold: response.text_overlay_bold !== undefined ? response.text_overlay_bold : false,
          text_overlay_underline: response.text_overlay_underline !== undefined ? response.text_overlay_underline : false,
          text_overlay_italic: response.text_overlay_italic !== undefined ? response.text_overlay_italic : false,
          text_overlay_textCase: response.text_overlay_textCase || 'none',
          text_overlay_color: response.text_overlay_color || '#000000',
          text_overlay_characterSpacing: response.text_overlay_characterSpacing || 0,
          text_overlay_lineSpacing: response.text_overlay_lineSpacing || -1,
          text_overlay_alignment: response.text_overlay_alignment || 'center',
          text_overlay_style: response.text_overlay_style || 'default',
          text_overlay_scale: response.text_overlay_scale || 60,
          text_overlay_x_position: response.text_overlay_x_position || 50,
          text_overlay_y_position: response.text_overlay_y_position || 18,
          text_overlay_rotation: response.text_overlay_rotation || 0,
          text_overlay_opacity: response.text_overlay_opacity || 100,
          text_overlay_hasStroke: response.text_overlay_hasStroke !== undefined ? response.text_overlay_hasStroke : false,
          text_overlay_strokeColor: response.text_overlay_strokeColor || '#000000',
          text_overlay_strokeThickness: response.text_overlay_strokeThickness || 2,
          text_overlay_hasBackground: response.text_overlay_hasBackground !== undefined ? response.text_overlay_hasBackground : true,
          text_overlay_backgroundColor: response.text_overlay_backgroundColor || '#ffffff',
          text_overlay_backgroundOpacity: response.text_overlay_backgroundOpacity !== undefined ? response.text_overlay_backgroundOpacity : 100,
          text_overlay_backgroundRounded: response.text_overlay_backgroundRounded || 7,
          text_overlay_backgroundHeight: response.text_overlay_backgroundHeight !== undefined ? response.text_overlay_backgroundHeight : 40,
          text_overlay_backgroundWidth: response.text_overlay_backgroundWidth !== undefined ? response.text_overlay_backgroundWidth : 50,
          text_overlay_backgroundYOffset: response.text_overlay_backgroundYOffset || 0,
          text_overlay_backgroundXOffset: response.text_overlay_backgroundXOffset || 0,
          text_overlay_backgroundStyle: response.text_overlay_backgroundStyle || 'line-width',
          text_overlay_animation: response.text_overlay_animation || 'fade_in',
          text_overlay_connected_background_data: response.text_overlay_connected_background_data,
          text_overlay_2_enabled: response.text_overlay_2_enabled !== undefined ? response.text_overlay_2_enabled : false,
          text_overlay_2_mode: response.text_overlay_2_mode || 'custom',
          text_overlay_2_custom_text: response.text_overlay_2_custom_text || '',
          text_overlay_2_category: response.text_overlay_2_category || 'engagement',
          text_overlay_2_font: response.text_overlay_2_font || 'Proxima Nova Semibold',
          text_overlay_2_customFontName: response.text_overlay_2_customFontName || '',
          text_overlay_2_fontSize: response.text_overlay_2_fontSize || 20,
          text_overlay_2_bold: response.text_overlay_2_bold !== undefined ? response.text_overlay_2_bold : false,
          text_overlay_2_underline: response.text_overlay_2_underline !== undefined ? response.text_overlay_2_underline : false,
          text_overlay_2_italic: response.text_overlay_2_italic !== undefined ? response.text_overlay_2_italic : false,
          text_overlay_2_textCase: response.text_overlay_2_textCase || 'none',
          text_overlay_2_color: response.text_overlay_2_color || '#000000',
          text_overlay_2_characterSpacing: response.text_overlay_2_characterSpacing || 0,
          text_overlay_2_lineSpacing: response.text_overlay_2_lineSpacing || -1,
          text_overlay_2_alignment: response.text_overlay_2_alignment || 'center',
          text_overlay_2_style: response.text_overlay_2_style || 'default',
          text_overlay_2_scale: response.text_overlay_2_scale || 60,
          text_overlay_2_x_position: response.text_overlay_2_x_position || 30,
          text_overlay_2_y_position: response.text_overlay_2_y_position || 55,
          text_overlay_2_rotation: response.text_overlay_2_rotation || 0,
          text_overlay_2_opacity: response.text_overlay_2_opacity || 100,
          text_overlay_2_hasStroke: response.text_overlay_2_hasStroke !== undefined ? response.text_overlay_2_hasStroke : false,
          text_overlay_2_strokeColor: response.text_overlay_2_strokeColor || '#000000',
          text_overlay_2_strokeThickness: response.text_overlay_2_strokeThickness || 2,
          text_overlay_2_hasBackground: response.text_overlay_2_hasBackground !== undefined ? response.text_overlay_2_hasBackground : true,
          text_overlay_2_backgroundColor: response.text_overlay_2_backgroundColor || '#ffffff',
          text_overlay_2_backgroundOpacity: response.text_overlay_2_backgroundOpacity !== undefined ? response.text_overlay_2_backgroundOpacity : 100,
          text_overlay_2_backgroundRounded: response.text_overlay_2_backgroundRounded || 7,
          text_overlay_2_backgroundHeight: response.text_overlay_2_backgroundHeight !== undefined ? response.text_overlay_2_backgroundHeight : 40,
          text_overlay_2_backgroundWidth: response.text_overlay_2_backgroundWidth !== undefined ? response.text_overlay_2_backgroundWidth : 50,
          text_overlay_2_backgroundYOffset: response.text_overlay_2_backgroundYOffset || 0,
          text_overlay_2_backgroundXOffset: response.text_overlay_2_backgroundXOffset || 0,
          text_overlay_2_backgroundStyle: response.text_overlay_2_backgroundStyle || 'line-width',
          text_overlay_2_animation: response.text_overlay_2_animation || 'fade_in',
          text_overlay_2_connected_background_data: response.text_overlay_2_connected_background_data,
          text_overlay_3_enabled: response.text_overlay_3_enabled !== undefined ? response.text_overlay_3_enabled : false,
          text_overlay_3_mode: response.text_overlay_3_mode || 'custom',
          text_overlay_3_custom_text: response.text_overlay_3_custom_text || '',
          text_overlay_3_category: response.text_overlay_3_category || 'engagement',
          text_overlay_3_font: response.text_overlay_3_font || 'Proxima Nova Semibold',
          text_overlay_3_customFontName: response.text_overlay_3_customFontName || '',
          text_overlay_3_fontSize: response.text_overlay_3_fontSize || 20,
          text_overlay_3_bold: response.text_overlay_3_bold !== undefined ? response.text_overlay_3_bold : false,
          text_overlay_3_underline: response.text_overlay_3_underline !== undefined ? response.text_overlay_3_underline : false,
          text_overlay_3_italic: response.text_overlay_3_italic !== undefined ? response.text_overlay_3_italic : false,
          text_overlay_3_textCase: response.text_overlay_3_textCase || 'none',
          text_overlay_3_color: response.text_overlay_3_color || '#000000',
          text_overlay_3_characterSpacing: response.text_overlay_3_characterSpacing || 0,
          text_overlay_3_lineSpacing: response.text_overlay_3_lineSpacing || -1,
          text_overlay_3_alignment: response.text_overlay_3_alignment || 'center',
          text_overlay_3_style: response.text_overlay_3_style || 'default',
          text_overlay_3_scale: response.text_overlay_3_scale || 60,
          text_overlay_3_x_position: response.text_overlay_3_x_position || 70,
          text_overlay_3_y_position: response.text_overlay_3_y_position || 65,
          text_overlay_3_rotation: response.text_overlay_3_rotation || 0,
          text_overlay_3_opacity: response.text_overlay_3_opacity || 100,
          text_overlay_3_hasStroke: response.text_overlay_3_hasStroke !== undefined ? response.text_overlay_3_hasStroke : false,
          text_overlay_3_strokeColor: response.text_overlay_3_strokeColor || '#000000',
          text_overlay_3_strokeThickness: response.text_overlay_3_strokeThickness || 2,
          text_overlay_3_hasBackground: response.text_overlay_3_hasBackground !== undefined ? response.text_overlay_3_hasBackground : true,
          text_overlay_3_backgroundColor: response.text_overlay_3_backgroundColor || '#ffffff',
          text_overlay_3_backgroundOpacity: response.text_overlay_3_backgroundOpacity !== undefined ? response.text_overlay_3_backgroundOpacity : 100,
          text_overlay_3_backgroundRounded: response.text_overlay_3_backgroundRounded || 7,
          text_overlay_3_backgroundHeight: response.text_overlay_3_backgroundHeight !== undefined ? response.text_overlay_3_backgroundHeight : 40,
          text_overlay_3_backgroundWidth: response.text_overlay_3_backgroundWidth !== undefined ? response.text_overlay_3_backgroundWidth : 50,
          text_overlay_3_backgroundYOffset: response.text_overlay_3_backgroundYOffset || 0,
          text_overlay_3_backgroundXOffset: response.text_overlay_3_backgroundXOffset || 0,
          text_overlay_3_backgroundStyle: response.text_overlay_3_backgroundStyle || 'line-width',
          text_overlay_3_animation: response.text_overlay_3_animation || 'fade_in',
          text_overlay_3_connected_background_data: response.text_overlay_3_connected_background_data,
          captions_enabled: response.captions_enabled !== undefined ? response.captions_enabled : false,
          captions_style: response.captions_style || 'tiktok_classic',
          captions_position: response.captions_position || 'bottom_center',
          captions_size: response.captions_size || 'medium',
          captions_highlight_keywords: response.captions_highlight_keywords !== undefined ? response.captions_highlight_keywords : true,
          // New extended caption fields
          captions_template: response.captions_template || 'tiktok_classic',
          captions_fontSize: response.captions_fontSize || 32,
          captions_fontFamily: response.captions_fontFamily || 'Montserrat-Bold',
          captions_x_position: response.captions_x_position || 50,
          captions_y_position: response.captions_y_position || 85,
          captions_color: response.captions_color || '#FFFFFF',
          captions_hasStroke: response.captions_hasStroke !== undefined ? response.captions_hasStroke : true,
          captions_strokeColor: response.captions_strokeColor || '#000000',
          captions_strokeWidth: response.captions_strokeWidth || 2,
          captions_hasBackground: response.captions_hasBackground || false,
          captions_backgroundColor: response.captions_backgroundColor || '#000000',
          captions_backgroundOpacity: response.captions_backgroundOpacity || 0.8,
          captions_animation: response.captions_animation || 'none',
          captions_max_words_per_segment: response.captions_max_words_per_segment || 4,
          captions_allCaps: response.captions_allCaps || false,
          captions_processing_method: response.captions_processing_method || 'auto',
          music_enabled: response.music_enabled !== undefined ? response.music_enabled : false,
          music_track_id: response.music_track_id || 'random_upbeat',
          music_volume: response.music_volume !== undefined ? response.music_volume : 0.6,
          music_fade_duration: response.music_fade_duration !== undefined ? response.music_fade_duration : 2.0,
          status: 'ready',
          created_at: response.created_at
        };
        
        // Remove the old campaign and add the updated one
        removeCampaign(formData.id);
        addCampaign(updatedCampaign);
      } else {
        // Send the request to create a new campaign
        response = await api.addCampaign(jsonData, false);
        
        // Add to the store
        addCampaign({
          id: response.id,
          name: response.job_name,
          product: response.product,
          persona: response.persona,
          setting: response.setting,
          emotion: response.emotion,
          hook: response.hook,
          elevenlabs_voice_id: response.elevenlabs_voice_id,
          trigger_keywords: response.trigger_keywords,
          language: response.language,
          brand_name: response.brand_name || '',
          // Campaign type specific fields
          campaign_type: formData.campaignType,
          random_video_settings: response.random_video_settings || null,
          // Also store flattened versions for backward compatibility and direct access
          source_directory: response.random_video_settings?.source_directory || response.source_directory || '',
          total_clips: response.random_video_settings?.total_clips || response.total_clips || '',
          hook_video: response.random_video_settings?.hook_video || response.hook_video || '',
          original_volume: response.random_video_settings?.original_volume !== undefined ? response.random_video_settings.original_volume : response.original_volume !== undefined ? response.original_volume : 0.6,
          voice_audio_volume: response.random_video_settings?.voice_audio_volume !== undefined ? response.random_video_settings.voice_audio_volume : response.voice_audio_volume !== undefined ? response.voice_audio_volume : 1.0,
          // Store both paths and IDs from backend response (for avatar campaigns)
          avatar_video_path: response.avatar_video_path,
          avatar_id: response.avatar_id,
          example_script_file: response.example_script_file,
          script_id: response.script_id,
          product_clip_id: response.product_clip_id || null,
          product_clip_path: response.product_clip_path || null,
          remove_silence: response.remove_silence,
          output_volume_enabled: response.output_volume_enabled !== undefined ? response.output_volume_enabled : false,
          output_volume_level: response.output_volume_level !== undefined ? response.output_volume_level : 0.5,
          enhance_for_elevenlabs: response.enhance_for_elevenlabs,
          use_randomization: response.use_randomization === true,
          useExactScript: response.useExactScript,
          randomization_intensity: response.randomization_intensity || 'none',
          // Overlay settings
          use_overlay: response.use_overlay || false,
          overlay_settings: response.overlay_settings || null,
          // Enhanced video settings - Load all flat properties from backend response
          enhancedVideoSettings: response.enhancedVideoSettings || null,
          automated_video_editing_enabled: response.automated_video_editing_enabled !== undefined ? response.automated_video_editing_enabled : false,
          text_overlay_enabled: response.text_overlay_enabled !== undefined ? response.text_overlay_enabled : false,
          text_overlay_1_enabled: response.text_overlay_1_enabled !== undefined ? response.text_overlay_1_enabled : false,
          text_overlay_mode: response.text_overlay_mode || 'custom',
          text_overlay_custom_text: response.text_overlay_custom_text || '',
          text_overlay_category: response.text_overlay_category || 'engagement',
          text_overlay_font: response.text_overlay_font || 'Proxima Nova Semibold',
          text_overlay_fontSize: response.text_overlay_fontSize || 20,
          text_overlay_bold: response.text_overlay_bold !== undefined ? response.text_overlay_bold : false,
          text_overlay_underline: response.text_overlay_underline !== undefined ? response.text_overlay_underline : false,
          text_overlay_italic: response.text_overlay_italic !== undefined ? response.text_overlay_italic : false,
          text_overlay_textCase: response.text_overlay_textCase || 'none',
          text_overlay_color: response.text_overlay_color || '#000000',
          text_overlay_characterSpacing: response.text_overlay_characterSpacing || 0,
          text_overlay_lineSpacing: response.text_overlay_lineSpacing || -1,
          text_overlay_alignment: response.text_overlay_alignment || 'center',
          text_overlay_style: response.text_overlay_style || 'default',
          text_overlay_scale: response.text_overlay_scale || 60,
          text_overlay_x_position: response.text_overlay_x_position || 50,
          text_overlay_y_position: response.text_overlay_y_position || 18,
          text_overlay_rotation: response.text_overlay_rotation || 0,
          text_overlay_opacity: response.text_overlay_opacity || 100,
          text_overlay_hasStroke: response.text_overlay_hasStroke !== undefined ? response.text_overlay_hasStroke : false,
          text_overlay_strokeColor: response.text_overlay_strokeColor || '#000000',
          text_overlay_strokeThickness: response.text_overlay_strokeThickness || 2,
          text_overlay_hasBackground: response.text_overlay_hasBackground !== undefined ? response.text_overlay_hasBackground : true,
          text_overlay_backgroundColor: response.text_overlay_backgroundColor || '#ffffff',
          text_overlay_backgroundOpacity: response.text_overlay_backgroundOpacity !== undefined ? response.text_overlay_backgroundOpacity : 100,
          text_overlay_backgroundRounded: response.text_overlay_backgroundRounded || 7,
          text_overlay_backgroundHeight: response.text_overlay_backgroundHeight !== undefined ? response.text_overlay_backgroundHeight : 40,
          text_overlay_backgroundWidth: response.text_overlay_backgroundWidth !== undefined ? response.text_overlay_backgroundWidth : 50,
          text_overlay_backgroundYOffset: response.text_overlay_backgroundYOffset || 0,
          text_overlay_backgroundXOffset: response.text_overlay_backgroundXOffset || 0,
          text_overlay_backgroundStyle: response.text_overlay_backgroundStyle || 'line-width',
          text_overlay_animation: response.text_overlay_animation || 'fade_in',
          text_overlay_connected_background_data: response.text_overlay_connected_background_data,
          text_overlay_2_enabled: response.text_overlay_2_enabled !== undefined ? response.text_overlay_2_enabled : false,
          text_overlay_2_mode: response.text_overlay_2_mode || 'custom',
          text_overlay_2_custom_text: response.text_overlay_2_custom_text || '',
          text_overlay_2_category: response.text_overlay_2_category || 'engagement',
          text_overlay_2_font: response.text_overlay_2_font || 'Proxima Nova Semibold',
          text_overlay_2_customFontName: response.text_overlay_2_customFontName || '',
          text_overlay_2_fontSize: response.text_overlay_2_fontSize || 20,
          text_overlay_2_bold: response.text_overlay_2_bold !== undefined ? response.text_overlay_2_bold : false,
          text_overlay_2_underline: response.text_overlay_2_underline !== undefined ? response.text_overlay_2_underline : false,
          text_overlay_2_italic: response.text_overlay_2_italic !== undefined ? response.text_overlay_2_italic : false,
          text_overlay_2_textCase: response.text_overlay_2_textCase || 'none',
          text_overlay_2_color: response.text_overlay_2_color || '#000000',
          text_overlay_2_characterSpacing: response.text_overlay_2_characterSpacing || 0,
          text_overlay_2_lineSpacing: response.text_overlay_2_lineSpacing || -1,
          text_overlay_2_alignment: response.text_overlay_2_alignment || 'center',
          text_overlay_2_style: response.text_overlay_2_style || 'default',
          text_overlay_2_scale: response.text_overlay_2_scale || 60,
          text_overlay_2_x_position: response.text_overlay_2_x_position || 30,
          text_overlay_2_y_position: response.text_overlay_2_y_position || 55,
          text_overlay_2_rotation: response.text_overlay_2_rotation || 0,
          text_overlay_2_opacity: response.text_overlay_2_opacity || 100,
          text_overlay_2_hasStroke: response.text_overlay_2_hasStroke !== undefined ? response.text_overlay_2_hasStroke : false,
          text_overlay_2_strokeColor: response.text_overlay_2_strokeColor || '#000000',
          text_overlay_2_strokeThickness: response.text_overlay_2_strokeThickness || 2,
          text_overlay_2_hasBackground: response.text_overlay_2_hasBackground !== undefined ? response.text_overlay_2_hasBackground : true,
          text_overlay_2_backgroundColor: response.text_overlay_2_backgroundColor || '#ffffff',
          text_overlay_2_backgroundOpacity: response.text_overlay_2_backgroundOpacity !== undefined ? response.text_overlay_2_backgroundOpacity : 100,
          text_overlay_2_backgroundRounded: response.text_overlay_2_backgroundRounded || 7,
          text_overlay_2_backgroundHeight: response.text_overlay_2_backgroundHeight !== undefined ? response.text_overlay_2_backgroundHeight : 40,
          text_overlay_2_backgroundWidth: response.text_overlay_2_backgroundWidth !== undefined ? response.text_overlay_2_backgroundWidth : 50,
          text_overlay_2_backgroundYOffset: response.text_overlay_2_backgroundYOffset || 0,
          text_overlay_2_backgroundXOffset: response.text_overlay_2_backgroundXOffset || 0,
          text_overlay_2_backgroundStyle: response.text_overlay_2_backgroundStyle || 'line-width',
          text_overlay_2_animation: response.text_overlay_2_animation || 'fade_in',
          text_overlay_2_connected_background_data: response.text_overlay_2_connected_background_data,
          text_overlay_3_enabled: response.text_overlay_3_enabled !== undefined ? response.text_overlay_3_enabled : false,
          text_overlay_3_mode: response.text_overlay_3_mode || 'custom',
          text_overlay_3_custom_text: response.text_overlay_3_custom_text || '',
          text_overlay_3_category: response.text_overlay_3_category || 'engagement',
          text_overlay_3_font: response.text_overlay_3_font || 'Proxima Nova Semibold',
          text_overlay_3_customFontName: response.text_overlay_3_customFontName || '',
          text_overlay_3_fontSize: response.text_overlay_3_fontSize || 20,
          text_overlay_3_bold: response.text_overlay_3_bold !== undefined ? response.text_overlay_3_bold : false,
          text_overlay_3_underline: response.text_overlay_3_underline !== undefined ? response.text_overlay_3_underline : false,
          text_overlay_3_italic: response.text_overlay_3_italic !== undefined ? response.text_overlay_3_italic : false,
          text_overlay_3_textCase: response.text_overlay_3_textCase || 'none',
          text_overlay_3_color: response.text_overlay_3_color || '#000000',
          text_overlay_3_characterSpacing: response.text_overlay_3_characterSpacing || 0,
          text_overlay_3_lineSpacing: response.text_overlay_3_lineSpacing || -1,
          text_overlay_3_alignment: response.text_overlay_3_alignment || 'center',
          text_overlay_3_style: response.text_overlay_3_style || 'default',
          text_overlay_3_scale: response.text_overlay_3_scale || 60,
          text_overlay_3_x_position: response.text_overlay_3_x_position || 70,
          text_overlay_3_y_position: response.text_overlay_3_y_position || 65,
          text_overlay_3_rotation: response.text_overlay_3_rotation || 0,
          text_overlay_3_opacity: response.text_overlay_3_opacity || 100,
          text_overlay_3_hasStroke: response.text_overlay_3_hasStroke !== undefined ? response.text_overlay_3_hasStroke : false,
          text_overlay_3_strokeColor: response.text_overlay_3_strokeColor || '#000000',
          text_overlay_3_strokeThickness: response.text_overlay_3_strokeThickness || 2,
          text_overlay_3_hasBackground: response.text_overlay_3_hasBackground !== undefined ? response.text_overlay_3_hasBackground : true,
          text_overlay_3_backgroundColor: response.text_overlay_3_backgroundColor || '#ffffff',
          text_overlay_3_backgroundOpacity: response.text_overlay_3_backgroundOpacity !== undefined ? response.text_overlay_3_backgroundOpacity : 100,
          text_overlay_3_backgroundRounded: response.text_overlay_3_backgroundRounded || 7,
          text_overlay_3_backgroundHeight: response.text_overlay_3_backgroundHeight !== undefined ? response.text_overlay_3_backgroundHeight : 40,
          text_overlay_3_backgroundWidth: response.text_overlay_3_backgroundWidth !== undefined ? response.text_overlay_3_backgroundWidth : 50,
          text_overlay_3_backgroundYOffset: response.text_overlay_3_backgroundYOffset || 0,
          text_overlay_3_backgroundXOffset: response.text_overlay_3_backgroundXOffset || 0,
          text_overlay_3_backgroundStyle: response.text_overlay_3_backgroundStyle || 'line-width',
          text_overlay_3_animation: response.text_overlay_3_animation || 'fade_in',
          text_overlay_3_connected_background_data: response.text_overlay_3_connected_background_data,
          captions_enabled: response.captions_enabled !== undefined ? response.captions_enabled : false,
          captions_style: response.captions_style || 'tiktok_classic',
          captions_position: response.captions_position || 'bottom_center',
          captions_size: response.captions_size || 'medium',
          captions_highlight_keywords: response.captions_highlight_keywords !== undefined ? response.captions_highlight_keywords : true,
          // New extended caption fields
          captions_template: response.captions_template || 'tiktok_classic',
          captions_fontSize: response.captions_fontSize || 32,
          captions_fontFamily: response.captions_fontFamily || 'Montserrat-Bold',
          captions_x_position: response.captions_x_position || 50,
          captions_y_position: response.captions_y_position || 85,
          captions_color: response.captions_color || '#FFFFFF',
          captions_hasStroke: response.captions_hasStroke !== undefined ? response.captions_hasStroke : true,
          captions_strokeColor: response.captions_strokeColor || '#000000',
          captions_strokeWidth: response.captions_strokeWidth || 2,
          captions_hasBackground: response.captions_hasBackground || false,
          captions_backgroundColor: response.captions_backgroundColor || '#000000',
          captions_backgroundOpacity: response.captions_backgroundOpacity || 0.8,
          captions_animation: response.captions_animation || 'none',
          captions_max_words_per_segment: response.captions_max_words_per_segment || 4,
          captions_allCaps: response.captions_allCaps || false,
          captions_processing_method: response.captions_processing_method || 'auto',
          music_enabled: response.music_enabled !== undefined ? response.music_enabled : false,
          music_track_id: response.music_track_id || 'random_upbeat',
          music_volume: response.music_volume !== undefined ? response.music_volume : 0.6,
          music_fade_duration: response.music_fade_duration !== undefined ? response.music_fade_duration : 2.0,
          status: 'ready',
          created_at: response.created_at
        });
      }
      
      setIsModalOpen(false);
      setApiError(null);
    } catch (error) {
      console.error('Error saving campaign:', error);
      setApiError({
        message: error.message || 'Failed to save campaign',
        guidance: 'Please check your form data and try again.',
        severity: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRunCampaign = async (campaignId) => {
    try {
      // Add campaign to loading set
      setLoadingCampaigns(prev => new Set(prev).add(campaignId));
      
      const campaign = campaigns.find(c => c.id === campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }
      
      // Send the run request to the backend
      const response = await api.runCampaign(campaignId);
      
      if (response && response.run_id) {
        // Start a new job from this campaign
        startJob(campaignId, response.run_id);
        
        // Start tracking job progress with the service
        JobProgressService.getInstance().startJobProgress(campaignId, response.run_id);
        
        // Create launch notification for a single job
        startMultipleJobs(1);
        
        setApiError(null);
      } else {
        throw new Error('No run ID returned from server');
      }
    } catch (error) {
      console.error('Error running campaign:', error);
      
      // Only show page-level error for connection issues
      if (error.message?.includes('Network Error') || 
          error.message?.includes('Failed to fetch')) {
        setApiError({
          message: 'Network connection error',
          guidance: 'Please check your internet connection and try again.',
          severity: 'error'
        });
      }
      
      // The failJob call will handle the user notification
      failJob(campaignId, null, error.message || error);
    } finally {
      // Remove campaign from loading set
      setLoadingCampaigns(prev => {
        const newSet = new Set(prev);
        newSet.delete(campaignId);
        return newSet;
      });
    }
  };
  
  const getRandomColor = () => {
    // Always return the same dark color close to black
    return 'bg-neutral-900';
  };
  
  const toggleCampaignSelection = (campaignId) => {
    setSelectedCampaignIds(prev => ({
      ...prev,
      [campaignId]: !prev[campaignId]
    }));
    
    // Update isAllSelected based on current selection state
    const updatedSelection = {
      ...selectedCampaignIds,
      [campaignId]: !selectedCampaignIds[campaignId]
    };
    
    // Count eligible campaigns (ready or failed)
    const eligibleCampaigns = campaigns.filter(
      c => c.status === 'ready' || c.status === 'failed'
    );
    
    // Check if all eligible campaigns are selected
    const allEligibleSelected = eligibleCampaigns.every(
      c => updatedSelection[c.id]
    );
    
    setIsAllSelected(allEligibleSelected && eligibleCampaigns.length > 0);
  };
  
  const getSelectedCount = () => {
    return Object.values(selectedCampaignIds).filter(Boolean).length;
  };
  
  const handleDeleteSelected = async () => {
    try {
      setIsLoading(true);
      
      if (campaignToDelete) {
        // Delete the specific campaign
        await api.deleteCampaign(campaignToDelete);
        removeCampaign(campaignToDelete);
        setCampaignToDelete(null);
      } else {
        // Original behavior - delete all selected campaigns
        const selectedIds = Object.entries(selectedCampaignIds)
          .filter(([_, selected]) => selected)
          .map(([id]) => id);
        
        for (const id of selectedIds) {
          await api.deleteCampaign(id);
          removeCampaign(id);
        }
      }
      
      setSelectedCampaignIds({});
      setIsDeleteModalOpen(false);
      setApiError(null);
    } catch (error) {
      console.error('Error deleting campaigns:', error);
      setApiError({
        message: error.message || 'Failed to delete campaigns',
        guidance: 'Please try again or check your connection.',
        severity: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Sort campaigns with newest first
  const sortedCampaigns = [...campaigns].sort((a, b) =>
    new Date(b.created_at) - new Date(a.created_at)
  );

  // Pagination calculations
  const totalPages = Math.ceil(sortedCampaigns.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedCampaigns = sortedCampaigns.slice(startIndex, endIndex);

  // Reset to page 1 if current page is beyond total pages
  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(1);
  }
  
  // Update isModalOpen state to trigger refresh
  const setIsModalOpen = (open) => {
    if (open) {
      // When opening the modal, refresh backend avatars first
      refreshBackendAvatars().then(() => {
        setIsModalOpenInternal(true);
      }).catch(() => {
        // Even if avatar refresh fails, still open the modal
        setIsModalOpenInternal(true);
      });
    } else {
      setIsModalOpenInternal(false);
      // Reset edit data and campaign name when closing modal
      setEditCampaignData(null);
      setCampaignName('');
      setCurrentCampaignType('avatar');
      setShowNameError(false);
    }
  };
  
  // Add a refresh function
  const refreshBackendAvatars = async () => {
    try {
      setApiError(null);
      const backendAvatars = await api.fetchBackendAvatars();
      
      // Store the raw list for direct selection
      setBackendAvatarsList(backendAvatars);
      
      // Create a map for easy reference
      const avatarMap = {};
      
      // Map backend avatars to frontend format for display
      const mappedAvatars = backendAvatars.map(avatar => {
        const mappedAvatar = {
          id: avatar.id, // Use backend ID directly
          name: avatar.name,
          language: avatar.origin_language || 'Various', // Map origin_language to language
          filePath: avatar.file_path, // Map file_path to filePath
          elevenlabs_voice_id: avatar.elevenlabs_voice_id,
          gender: avatar.gender,
          backendAvatar: true // Flag to indicate this is a backend avatar
        };
        
        // Add to our reference map
        avatarMap[avatar.id] = mappedAvatar;
        
        return mappedAvatar;
      });
      
      // Store a reference to all backend avatars
      setBackendAvatarsMap(avatarMap);
      
      // Add each backend avatar to the store if it doesn't exist
      mappedAvatars.forEach(avatar => {
        if (!avatars.some(a => a.id === avatar.id)) {
          addAvatar(avatar);
        }
      });
      
      return true;
    } catch (error) {
      console.error('Failed to refresh backend avatars:', error);
      setApiError({
        message: 'Failed to refresh avatars from backend',
        guidance: 'Please check your server connection and try again.',
        severity: 'warning'
      });
      
      return false;
    }
  };
  
  // Update method to run multiple campaigns
  const handleRunSelectedCampaigns = async () => {
    const selectedIds = Object.entries(selectedCampaignIds)
      .filter(([_, isSelected]) => isSelected)
      .map(([id]) => id);
    
    if (selectedIds.length === 0) {
      return;
    }
    
    try {
      startBatchOperation('selected', selectedIds.length);
      let successCount = 0;
      
      // Run campaigns with the API's built-in multiple campaign support
      const results = await api.runMultipleCampaigns(
        selectedIds, 
        350, // 350ms delay
        (campaignId, index, total) => {
          // Progress callback
          updateBatchProgress(index + 1, total);
        },
        (result) => {
          // Immediate callback when each campaign completes
        if (result.success && result.response && result.response.run_id) {
            // Start a job immediately for successful campaign
          startJob(result.campaignId, result.response.run_id);
          
          // Start tracking job progress with the service
          JobProgressService.getInstance().startJobProgress(result.campaignId, result.response.run_id);
            successCount++;
        } else {
            // Handle failed campaigns immediately
          failJob(result.campaignId, null, result.error?.message || 'Failed to run campaign');
        }
        }
      );
      
      // Create launch notification for all successful launches
      if (successCount > 0) {
        startMultipleJobs(successCount);
      }
      
      // Reset selections after running
      setSelectedCampaignIds({});
      setIsAllSelected(false);
      setApiError(null);
    } catch (error) {
      console.error('Error running selected campaigns:', error);
      setApiError({
        message: error.message || 'Failed to run selected campaigns',
        guidance: 'Please check your connection and try again.',
        severity: 'error'
      });
    } finally {
      stopBatchOperation();
    }
  };
  
  // Add toggle functions for selections
  const toggleSelectAll = () => {
    if (isAllSelected) {
      // Deselect all
      setSelectedCampaignIds({});
    } else {
      // Select all campaigns that are in 'ready' or 'failed' status (can be run)
      const newSelectedIds = {};
      sortedCampaigns.forEach(campaign => {
        if (campaign.status === 'ready' || campaign.status === 'failed') {
          newSelectedIds[campaign.id] = true;
        }
      });
      setSelectedCampaignIds(newSelectedIds);
    }
    setIsAllSelected(!isAllSelected);
  };
  
  // Add handleRun10x function to run a campaign 10 times
  const handleRun10x = async (campaignId) => {
    const totalRuns = 10;
    
    try {
      startBatchOperation('run10x', totalRuns);
      let successCount = 0;
      
      const campaign = campaigns.find(c => c.id === campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }
      
      // Create array of the same campaign ID 10 times
      const campaignIds = Array(totalRuns).fill(campaignId);
      
      // Run the campaigns with the API's built-in multiple campaign support
      const results = await api.runMultipleCampaigns(
        campaignIds, 
        1000, // 1 second delay to prevent file conflicts in 10x runs
        (campaignId, index, total) => {
          // Progress callback
          updateBatchProgress(index + 1, total);
        },
        (result) => {
          // Immediate callback when each campaign completes
          if (result.success && result.response && result.response.run_id) {
            // Start a job immediately for successful campaign
            startJob(result.campaignId, result.response.run_id);
            successCount++;
          } else {
            // Handle failed campaigns immediately
            failJob(result.campaignId, null, result.error?.message || 'Failed to run campaign');
          }
        }
      );
      
      // Create launch notification for all successful launches
      if (successCount > 0) {
        startMultipleJobs(successCount);
      }
      
      setApiError(null);
    } catch (error) {
      console.error('Error running campaign multiple times:', error);
      setApiError({
        message: error.message || 'Failed to run campaign multiple times',
        guidance: 'Please check your connection and try again.',
        severity: 'error'
      });
    } finally {
      stopBatchOperation();
    }
  };
  
  // Add handleRunSelected10x function to run each selected campaign 10 times
  const handleRunSelected10x = async () => {
    const selectedIds = Object.entries(selectedCampaignIds)
      .filter(([_, isSelected]) => isSelected)
      .map(([id]) => id);
    
    if (selectedIds.length === 0) {
      return;
    }
    
    const totalRuns = selectedIds.length * 10; // Each selected campaign will run 10 times
    
    try {
      startBatchOperation('selected10x', totalRuns);
      let successCount = 0;
      
      // Create array where each selected campaign ID appears 10 times
      const campaignIds = [];
      selectedIds.forEach(campaignId => {
        for (let i = 0; i < 10; i++) {
          campaignIds.push(campaignId);
        }
      });
      
      // Run the campaigns with the API's built-in multiple campaign support
      const results = await api.runMultipleCampaigns(
        campaignIds, 
        1000, // 1 second delay to prevent file conflicts in 10x runs
        (campaignId, index, total) => {
          // Progress callback
          updateBatchProgress(index + 1, total);
        },
        (result) => {
          // Immediate callback when each campaign completes
        if (result.success && result.response && result.response.run_id) {
            // Start a job immediately for successful campaign
          startJob(result.campaignId, result.response.run_id);
            
            // Start tracking job progress with the service
            JobProgressService.getInstance().startJobProgress(result.campaignId, result.response.run_id);
            successCount++;
        } else {
            // Handle failed campaigns immediately
          failJob(result.campaignId, null, result.error?.message || 'Failed to run campaign');
        }
        }
      );
      
      // Create launch notification for all successful launches
      if (successCount > 0) {
        startMultipleJobs(successCount);
      }
      
      // Reset selections after running
      setSelectedCampaignIds({});
      setIsAllSelected(false);
      setApiError(null);
    } catch (error) {
      console.error('Error running selected campaigns 10x:', error);
      setApiError({
        message: error.message || 'Failed to run selected campaigns 10x',
        guidance: 'Please check your connection and try again.',
        severity: 'error'
      });
    } finally {
      stopBatchOperation();
    }
  };
  
  // Update the handleEditCampaign function to use IDs instead of paths
  const handleEditCampaign = async (campaignId) => {
    try {
      // Find the campaign to edit
      const campaign = campaigns.find(c => c.id === campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }
      
      // Find the avatar related to this campaign - first try by ID, then by path
      let avatar = null;
      if (campaign.avatar_id) {
        avatar = avatars.find(a => a.id === campaign.avatar_id);
      }
      if (!avatar && campaign.avatar_video_path) {
        avatar = avatars.find(a => a.filePath === campaign.avatar_video_path);
      }
      
      // Find the script related to this campaign - first try by ID, then by path
      let script = null;
      if (campaign.script_id) {
        script = scripts.find(s => s.id === campaign.script_id);
      }
      if (!script && campaign.example_script_file) {
        script = scripts.find(s => s.filePath === campaign.example_script_file);
      }
      
      // Find the clip related to this campaign (optional)
      let clip = null;
      if (campaign.product_clip_id) {
        clip = clips.find(c => c.id === campaign.product_clip_id);
      }
      
      // Prefill the form with campaign data
      const formData = {
        id: campaign.id,
        name: campaign.name,
        campaignType: campaign.campaign_type === 'randomized' ? 'randomized' : 'avatar', // Properly preserve campaign type
        avatarId: avatar ? avatar.id : '',
        scriptId: script ? script.id : '',
        clipId: clip ? clip.id : '',
        prompt: campaign.prompt || '',
        persona: campaign.persona,
        setting: campaign.setting,
        emotion: campaign.emotion,
        product: campaign.product,
        hook: campaign.hook,
        elevenlabs_voice_id: campaign.elevenlabs_voice_id,
        // Add voice ID fields for randomized campaigns
        elevenlabsVoiceId: campaign.elevenlabs_voice_id,
        useCustomVoice: (() => {
          // More robust custom voice detection
          const voiceId = campaign.elevenlabs_voice_id;
          if (!voiceId) return false;
          
          const presetVoices = [
            "EXAVITQu4vr4xnSDxMaL", // Rachel
            "VR6AewLTigWG4xSOukaG", // Drew  
            "pNInz6obpgDQGcFmaJgB", // Adam
            "jBpfuIE2acCO8z3wKNLl"  // Bella
          ];
          
          const isCustom = !presetVoices.includes(voiceId);
          
          return isCustom;
        })(),
        custom_voice_id: (() => {
          const voiceId = campaign.elevenlabs_voice_id;
          if (!voiceId) return '';
          
          const presetVoices = [
            "EXAVITQu4vr4xnSDxMaL", // Rachel
            "VR6AewLTigWG4xSOukaG", // Drew  
            "pNInz6obpgDQGcFmaJgB", // Adam
            "jBpfuIE2acCO8z3wKNLl"  // Bella
          ];
          
          // If it's not a preset voice, it's the custom voice ID
          return presetVoices.includes(voiceId) ? '' : voiceId;
        })(),
        trigger_keywords: Array.isArray(campaign.trigger_keywords) 
          ? campaign.trigger_keywords.join(', ') 
          : campaign.trigger_keywords || '',
        language: campaign.language || 'English',
        enhance_for_elevenlabs: campaign.enhance_for_elevenlabs !== undefined ? campaign.enhance_for_elevenlabs : true,
        brand_name: campaign.brand_name || '',
        remove_silence: campaign.remove_silence !== undefined ? campaign.remove_silence : true,
        output_volume_enabled: campaign.output_volume_enabled !== undefined ? campaign.output_volume_enabled : false,
        output_volume_level: campaign.output_volume_level !== undefined ? campaign.output_volume_level : 0.5,
        use_randomization: campaign.use_randomization !== undefined ? campaign.use_randomization : false,
        randomization_intensity: campaign.randomization_intensity || 'none',
        // Overlay settings - properly extract from overlay_settings object
        use_overlay: campaign.use_overlay || false,
        overlay_placement: campaign.overlay_settings?.placements?.[0] || 'middle_left',
        overlay_size_min: campaign.overlay_settings?.size_range?.[0] !== undefined ? campaign.overlay_settings.size_range[0] : 0.25,
        overlay_size_max: campaign.overlay_settings?.size_range?.[1] !== undefined ? campaign.overlay_settings.size_range[1] : 0.4,
        overlay_max_duration: campaign.overlay_settings?.maximum_overlay_duration !== undefined ? campaign.overlay_settings.maximum_overlay_duration : 5.0,
        // Enhanced video settings - Load all flat properties from backend
        enhancedVideoSettings: campaign.enhancedVideoSettings || null,
        automated_video_editing_enabled: campaign.automated_video_editing_enabled !== undefined ? campaign.automated_video_editing_enabled : false,
        text_overlay_enabled: campaign.text_overlay_enabled !== undefined ? campaign.text_overlay_enabled : false,
        text_overlay_1_enabled: campaign.text_overlay_1_enabled !== undefined ? campaign.text_overlay_1_enabled : false,
        text_overlay_mode: campaign.text_overlay_mode || 'custom',
        text_overlay_custom_text: campaign.text_overlay_custom_text || '',
        text_overlay_category: campaign.text_overlay_category || 'engagement',
        text_overlay_font: campaign.text_overlay_font || 'Proxima Nova Semibold',
        text_overlay_fontSize: campaign.text_overlay_fontSize || 20,
        text_overlay_bold: campaign.text_overlay_bold !== undefined ? campaign.text_overlay_bold : false,
        text_overlay_underline: campaign.text_overlay_underline !== undefined ? campaign.text_overlay_underline : false,
        text_overlay_italic: campaign.text_overlay_italic !== undefined ? campaign.text_overlay_italic : false,
        text_overlay_textCase: campaign.text_overlay_textCase || 'none',
        text_overlay_color: campaign.text_overlay_color || '#000000',
        text_overlay_characterSpacing: campaign.text_overlay_characterSpacing || 0,
        text_overlay_lineSpacing: campaign.text_overlay_lineSpacing || -1,
        text_overlay_alignment: campaign.text_overlay_alignment || 'center',
        text_overlay_style: campaign.text_overlay_style || 'default',
        text_overlay_scale: campaign.text_overlay_scale || 60,
        text_overlay_x_position: campaign.text_overlay_x_position || 50,
        text_overlay_y_position: campaign.text_overlay_y_position || 18,
        text_overlay_rotation: campaign.text_overlay_rotation || 0,
        text_overlay_opacity: campaign.text_overlay_opacity || 100,
        text_overlay_hasStroke: campaign.text_overlay_hasStroke !== undefined ? campaign.text_overlay_hasStroke : false,
        text_overlay_strokeColor: campaign.text_overlay_strokeColor || '#000000',
        text_overlay_strokeThickness: campaign.text_overlay_strokeThickness || 2,
        text_overlay_hasBackground: campaign.text_overlay_hasBackground !== undefined ? campaign.text_overlay_hasBackground : true,
        text_overlay_backgroundColor: campaign.text_overlay_backgroundColor || '#ffffff',
        text_overlay_backgroundOpacity: campaign.text_overlay_backgroundOpacity !== undefined ? campaign.text_overlay_backgroundOpacity : 100,
        text_overlay_backgroundRounded: campaign.text_overlay_backgroundRounded || 7,
        text_overlay_backgroundHeight: campaign.text_overlay_backgroundHeight !== undefined ? campaign.text_overlay_backgroundHeight : 40,
        text_overlay_backgroundWidth: campaign.text_overlay_backgroundWidth !== undefined ? campaign.text_overlay_backgroundWidth : 50,
        text_overlay_backgroundYOffset: campaign.text_overlay_backgroundYOffset || 0,
        text_overlay_backgroundXOffset: campaign.text_overlay_backgroundXOffset || 0,
        text_overlay_backgroundStyle: campaign.text_overlay_backgroundStyle || 'line-width',
        text_overlay_animation: campaign.text_overlay_animation || 'fade_in',
        // Don't copy computed background data - let it regenerate fresh
        text_overlay_connected_background_data: null,
        
        // Text Overlay 2 settings
        text_overlay_2_enabled: campaign.text_overlay_2_enabled !== undefined ? campaign.text_overlay_2_enabled : false,
        text_overlay_2_mode: campaign.text_overlay_2_mode || 'custom',
        text_overlay_2_custom_text: campaign.text_overlay_2_custom_text || '',
        text_overlay_2_category: campaign.text_overlay_2_category || 'engagement',
        text_overlay_2_font: campaign.text_overlay_2_font || 'Proxima Nova Semibold',
        text_overlay_2_customFontName: campaign.text_overlay_2_customFontName || '',
        text_overlay_2_fontSize: campaign.text_overlay_2_fontSize || 20,
        text_overlay_2_bold: campaign.text_overlay_2_bold !== undefined ? campaign.text_overlay_2_bold : false,
        text_overlay_2_underline: campaign.text_overlay_2_underline !== undefined ? campaign.text_overlay_2_underline : false,
        text_overlay_2_italic: campaign.text_overlay_2_italic !== undefined ? campaign.text_overlay_2_italic : false,
        text_overlay_2_textCase: campaign.text_overlay_2_textCase || 'none',
        text_overlay_2_color: campaign.text_overlay_2_color || '#000000',
        text_overlay_2_characterSpacing: campaign.text_overlay_2_characterSpacing || 0,
        text_overlay_2_lineSpacing: campaign.text_overlay_2_lineSpacing || -1,
        text_overlay_2_alignment: campaign.text_overlay_2_alignment || 'center',
        text_overlay_2_style: campaign.text_overlay_2_style || 'default',
        text_overlay_2_scale: campaign.text_overlay_2_scale || 60,
        text_overlay_2_x_position: campaign.text_overlay_2_x_position || 30,
        text_overlay_2_y_position: campaign.text_overlay_2_y_position || 55,
        text_overlay_2_rotation: campaign.text_overlay_2_rotation || 0,
        text_overlay_2_opacity: campaign.text_overlay_2_opacity || 100,
        text_overlay_2_hasStroke: campaign.text_overlay_2_hasStroke !== undefined ? campaign.text_overlay_2_hasStroke : false,
        text_overlay_2_strokeColor: campaign.text_overlay_2_strokeColor || '#000000',
        text_overlay_2_strokeThickness: campaign.text_overlay_2_strokeThickness || 2,
        text_overlay_2_hasBackground: campaign.text_overlay_2_hasBackground !== undefined ? campaign.text_overlay_2_hasBackground : true,
        text_overlay_2_backgroundColor: campaign.text_overlay_2_backgroundColor || '#ffffff',
        text_overlay_2_backgroundOpacity: campaign.text_overlay_2_backgroundOpacity !== undefined ? campaign.text_overlay_2_backgroundOpacity : 100,
        text_overlay_2_backgroundRounded: campaign.text_overlay_2_backgroundRounded || 7,
        text_overlay_2_backgroundHeight: campaign.text_overlay_2_backgroundHeight !== undefined ? campaign.text_overlay_2_backgroundHeight : 40,
        text_overlay_2_backgroundWidth: campaign.text_overlay_2_backgroundWidth !== undefined ? campaign.text_overlay_2_backgroundWidth : 50,
        text_overlay_2_backgroundYOffset: campaign.text_overlay_2_backgroundYOffset || 0,
        text_overlay_2_backgroundXOffset: campaign.text_overlay_2_backgroundXOffset || 0,
        text_overlay_2_backgroundStyle: campaign.text_overlay_2_backgroundStyle || 'line-width',
        text_overlay_2_animation: campaign.text_overlay_2_animation || 'fade_in',
        // Don't copy computed background data - let it regenerate fresh
        text_overlay_2_connected_background_data: null,
        
        // Text Overlay 3 settings
        text_overlay_3_enabled: campaign.text_overlay_3_enabled !== undefined ? campaign.text_overlay_3_enabled : false,
        text_overlay_3_mode: campaign.text_overlay_3_mode || 'custom',
        text_overlay_3_custom_text: campaign.text_overlay_3_custom_text || '',
        text_overlay_3_category: campaign.text_overlay_3_category || 'engagement',
        text_overlay_3_font: campaign.text_overlay_3_font || 'Proxima Nova Semibold',
        text_overlay_3_customFontName: campaign.text_overlay_3_customFontName || '',
        text_overlay_3_fontSize: campaign.text_overlay_3_fontSize || 20,
        text_overlay_3_bold: campaign.text_overlay_3_bold !== undefined ? campaign.text_overlay_3_bold : false,
        text_overlay_3_underline: campaign.text_overlay_3_underline !== undefined ? campaign.text_overlay_3_underline : false,
        text_overlay_3_italic: campaign.text_overlay_3_italic !== undefined ? campaign.text_overlay_3_italic : false,
        text_overlay_3_textCase: campaign.text_overlay_3_textCase || 'none',
        text_overlay_3_color: campaign.text_overlay_3_color || '#000000',
        text_overlay_3_characterSpacing: campaign.text_overlay_3_characterSpacing || 0,
        text_overlay_3_lineSpacing: campaign.text_overlay_3_lineSpacing || -1,
        text_overlay_3_alignment: campaign.text_overlay_3_alignment || 'center',
        text_overlay_3_style: campaign.text_overlay_3_style || 'default',
        text_overlay_3_scale: campaign.text_overlay_3_scale || 60,
        text_overlay_3_x_position: campaign.text_overlay_3_x_position || 70,
        text_overlay_3_y_position: campaign.text_overlay_3_y_position || 65,
        text_overlay_3_rotation: campaign.text_overlay_3_rotation || 0,
        text_overlay_3_opacity: campaign.text_overlay_3_opacity || 100,
        text_overlay_3_hasStroke: campaign.text_overlay_3_hasStroke !== undefined ? campaign.text_overlay_3_hasStroke : false,
        text_overlay_3_strokeColor: campaign.text_overlay_3_strokeColor || '#000000',
        text_overlay_3_strokeThickness: campaign.text_overlay_3_strokeThickness || 2,
        text_overlay_3_hasBackground: campaign.text_overlay_3_hasBackground !== undefined ? campaign.text_overlay_3_hasBackground : true,
        text_overlay_3_backgroundColor: campaign.text_overlay_3_backgroundColor || '#ffffff',
        text_overlay_3_backgroundOpacity: campaign.text_overlay_3_backgroundOpacity !== undefined ? campaign.text_overlay_3_backgroundOpacity : 100,
        text_overlay_3_backgroundRounded: campaign.text_overlay_3_backgroundRounded || 7,
        text_overlay_3_backgroundHeight: campaign.text_overlay_3_backgroundHeight !== undefined ? campaign.text_overlay_3_backgroundHeight : 40,
        text_overlay_3_backgroundWidth: campaign.text_overlay_3_backgroundWidth !== undefined ? campaign.text_overlay_3_backgroundWidth : 50,
        text_overlay_3_backgroundYOffset: campaign.text_overlay_3_backgroundYOffset || 0,
        text_overlay_3_backgroundXOffset: campaign.text_overlay_3_backgroundXOffset || 0,
        text_overlay_3_backgroundStyle: campaign.text_overlay_3_backgroundStyle || 'line-width',
        text_overlay_3_animation: campaign.text_overlay_3_animation || 'fade_in',
        // Don't copy computed background data - let it regenerate fresh
        text_overlay_3_connected_background_data: null,
        
        // Caption settings
        captions_enabled: campaign.captions_enabled !== undefined ? campaign.captions_enabled : false,
        captions_style: campaign.captions_style || 'tiktok_classic',
        captions_position: campaign.captions_position || 'bottom_center',
        captions_size: campaign.captions_size || 'medium',
        captions_highlight_keywords: campaign.captions_highlight_keywords !== undefined ? campaign.captions_highlight_keywords : true,
        // New extended caption fields
        captions_template: campaign.captions_template || 'tiktok_classic',
        captions_fontSize: campaign.captions_fontSize || 32,
        captions_fontFamily: campaign.captions_fontFamily || 'Montserrat-Bold',
        captions_x_position: campaign.captions_x_position || 50,
        captions_y_position: campaign.captions_y_position || 85,
        captions_color: campaign.captions_color || '#FFFFFF',
        captions_hasStroke: campaign.captions_hasStroke !== undefined ? campaign.captions_hasStroke : true,
        captions_strokeColor: campaign.captions_strokeColor || '#000000',
        captions_strokeWidth: campaign.captions_strokeWidth || 2,
        captions_hasBackground: campaign.captions_hasBackground || false,
        captions_backgroundColor: campaign.captions_backgroundColor || '#000000',
        captions_backgroundOpacity: campaign.captions_backgroundOpacity || 0.8,
        captions_animation: campaign.captions_animation || 'none',
        captions_max_words_per_segment: campaign.captions_max_words_per_segment || 4,
        captions_allCaps: campaign.captions_allCaps || false,
        captions_processing_method: campaign.captions_processing_method || 'auto',
        
        // Music settings
        music_enabled: campaign.music_enabled !== undefined ? campaign.music_enabled : false,
        music_track_id: campaign.music_track_id || 'random_upbeat',
        music_volume: campaign.music_volume !== undefined ? campaign.music_volume : 0.6,
        music_fade_duration: campaign.music_fade_duration !== undefined ? campaign.music_fade_duration : 2.0,
        // Exact script feature
        useExactScript: campaign.useExactScript || false,
        // Add randomized video specific fields - defensive approach (try nested, fall back to flattened)
        sourceDirectory: campaign.random_video_settings?.source_directory || campaign.source_directory || '',
        totalClips: campaign.random_video_settings?.total_clips || campaign.total_clips || '',
        hookVideo: campaign.random_video_settings?.hook_video || campaign.hook_video || '',
        originalVolume: (campaign.random_video_settings?.original_volume !== undefined ? campaign.random_video_settings.original_volume : campaign.original_volume !== undefined ? campaign.original_volume : 0.6),
        voiceAudioVolume: (campaign.random_video_settings?.voice_audio_volume !== undefined ? campaign.random_video_settings.voice_audio_volume : campaign.voice_audio_volume !== undefined ? campaign.voice_audio_volume : 1.0),
        isEdit: true  // Flag to indicate this is an edit operation
      };


      // Open the modal with prefilled data
      setEditCampaignData(formData);
      setCampaignName(formData.name || '');
      setCurrentCampaignType(formData.campaignType || 'avatar');
      setIsModalOpen(true);
    } catch (error) {
      console.error('Error preparing campaign for edit:', error);
      setApiError({
        message: error.message || 'Failed to edit campaign',
        guidance: 'Please try again or check the campaign data.',
        severity: 'error'
      });
    }
  };
  
  const handleDuplicateCampaign = async (campaignId) => {
    try {
      // Find the campaign to duplicate
      const campaign = campaigns.find(c => c.id === campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }
      
      // Find the avatar related to this campaign - first try by ID, then by path
      let avatar = null;
      if (campaign.avatar_id) {
        avatar = avatars.find(a => a.id === campaign.avatar_id);
      }
      if (!avatar && campaign.avatar_video_path) {
        avatar = avatars.find(a => a.filePath === campaign.avatar_video_path);
      }
      
      // Find the script related to this campaign - first try by ID, then by path
      let script = null;
      if (campaign.script_id) {
        script = scripts.find(s => s.id === campaign.script_id);
      }
      if (!script && campaign.example_script_file) {
        script = scripts.find(s => s.filePath === campaign.example_script_file);
      }
      
      // Find the clip related to this campaign (optional)
      let clip = null;
      if (campaign.product_clip_id) {
        clip = clips.find(c => c.id === campaign.product_clip_id);
      }
      
      // Prefill the form with campaign data (excluding ID for duplication)
      const formData = {
        name: `${campaign.name} (Copy)`,
        campaignType: campaign.campaign_type === 'randomized' ? 'randomized' : 'avatar', // Properly preserve campaign type
        avatarId: avatar ? avatar.id : '',
        scriptId: script ? script.id : '',
        clipId: clip ? clip.id : '',
        prompt: campaign.prompt || '',
        persona: campaign.persona,
        setting: campaign.setting,
        emotion: campaign.emotion,
        product: campaign.product,
        hook: campaign.hook,
        elevenlabs_voice_id: campaign.elevenlabs_voice_id,
        // Add voice ID fields for randomized campaigns
        elevenlabsVoiceId: campaign.elevenlabs_voice_id,
        useCustomVoice: (() => {
          // More robust custom voice detection
          const voiceId = campaign.elevenlabs_voice_id;
          if (!voiceId) return false;
          
          const presetVoices = [
            "EXAVITQu4vr4xnSDxMaL", // Rachel
            "VR6AewLTigWG4xSOukaG", // Drew  
            "pNInz6obpgDQGcFmaJgB", // Adam
            "jBpfuIE2acCO8z3wKNLl"  // Bella
          ];
          
          const isCustom = !presetVoices.includes(voiceId);
          console.log('Duplicate Campaign - Voice ID detection:', {
            voiceId,
            isCustom,
            presetVoices,
            stored_use_custom_voice: campaign.use_custom_voice
          });
          
          return isCustom;
        })(),
        custom_voice_id: (() => {
          const voiceId = campaign.elevenlabs_voice_id;
          if (!voiceId) return '';
          
          const presetVoices = [
            "EXAVITQu4vr4xnSDxMaL", // Rachel
            "VR6AewLTigWG4xSOukaG", // Drew  
            "pNInz6obpgDQGcFmaJgB", // Adam
            "jBpfuIE2acCO8z3wKNLl"  // Bella
          ];
          
          // If it's not a preset voice, it's the custom voice ID
          return presetVoices.includes(voiceId) ? '' : voiceId;
        })(),
        trigger_keywords: Array.isArray(campaign.trigger_keywords) 
          ? campaign.trigger_keywords.join(', ') 
          : campaign.trigger_keywords || '',
        language: campaign.language || 'English',
        enhance_for_elevenlabs: campaign.enhance_for_elevenlabs !== undefined ? campaign.enhance_for_elevenlabs : true,
        brand_name: campaign.brand_name || '',
        remove_silence: campaign.remove_silence !== undefined ? campaign.remove_silence : true,
        output_volume_enabled: campaign.output_volume_enabled !== undefined ? campaign.output_volume_enabled : false,
        output_volume_level: campaign.output_volume_level !== undefined ? campaign.output_volume_level : 0.5,
        use_randomization: campaign.use_randomization !== undefined ? campaign.use_randomization : false,
        randomization_intensity: campaign.randomization_intensity || 'none',
        // Overlay settings - properly extract from overlay_settings object
        use_overlay: campaign.use_overlay || false,
        overlay_placement: campaign.overlay_settings?.placements?.[0] || 'middle_left',
        overlay_size_min: campaign.overlay_settings?.size_range?.[0] !== undefined ? campaign.overlay_settings.size_range[0] : 0.25,
        overlay_size_max: campaign.overlay_settings?.size_range?.[1] !== undefined ? campaign.overlay_settings.size_range[1] : 0.4,
        overlay_max_duration: campaign.overlay_settings?.maximum_overlay_duration !== undefined ? campaign.overlay_settings.maximum_overlay_duration : 5.0,
        // Enhanced video settings - Load all flat properties from backend
        enhancedVideoSettings: campaign.enhancedVideoSettings || null,
        automated_video_editing_enabled: campaign.automated_video_editing_enabled !== undefined ? campaign.automated_video_editing_enabled : false,
        text_overlay_enabled: campaign.text_overlay_enabled !== undefined ? campaign.text_overlay_enabled : false,
        text_overlay_1_enabled: campaign.text_overlay_1_enabled !== undefined ? campaign.text_overlay_1_enabled : false,
        text_overlay_mode: campaign.text_overlay_mode || 'custom',
        text_overlay_custom_text: campaign.text_overlay_custom_text || '',
        text_overlay_category: campaign.text_overlay_category || 'engagement',
        text_overlay_font: campaign.text_overlay_font || 'Proxima Nova Semibold',
        text_overlay_fontSize: campaign.text_overlay_fontSize || 20,
        text_overlay_bold: campaign.text_overlay_bold !== undefined ? campaign.text_overlay_bold : false,
        text_overlay_underline: campaign.text_overlay_underline !== undefined ? campaign.text_overlay_underline : false,
        text_overlay_italic: campaign.text_overlay_italic !== undefined ? campaign.text_overlay_italic : false,
        text_overlay_textCase: campaign.text_overlay_textCase || 'none',
        text_overlay_color: campaign.text_overlay_color || '#000000',
        text_overlay_characterSpacing: campaign.text_overlay_characterSpacing || 0,
        text_overlay_lineSpacing: campaign.text_overlay_lineSpacing || -1,
        text_overlay_alignment: campaign.text_overlay_alignment || 'center',
        text_overlay_style: campaign.text_overlay_style || 'default',
        text_overlay_scale: campaign.text_overlay_scale || 60,
        text_overlay_x_position: campaign.text_overlay_x_position || 50,
        text_overlay_y_position: campaign.text_overlay_y_position || 18,
        text_overlay_rotation: campaign.text_overlay_rotation || 0,
        text_overlay_opacity: campaign.text_overlay_opacity || 100,
        text_overlay_hasStroke: campaign.text_overlay_hasStroke !== undefined ? campaign.text_overlay_hasStroke : false,
        text_overlay_strokeColor: campaign.text_overlay_strokeColor || '#000000',
        text_overlay_strokeThickness: campaign.text_overlay_strokeThickness || 2,
        text_overlay_hasBackground: campaign.text_overlay_hasBackground !== undefined ? campaign.text_overlay_hasBackground : true,
        text_overlay_backgroundColor: campaign.text_overlay_backgroundColor || '#ffffff',
        text_overlay_backgroundOpacity: campaign.text_overlay_backgroundOpacity !== undefined ? campaign.text_overlay_backgroundOpacity : 100,
        text_overlay_backgroundRounded: campaign.text_overlay_backgroundRounded || 7,
        text_overlay_backgroundHeight: campaign.text_overlay_backgroundHeight !== undefined ? campaign.text_overlay_backgroundHeight : 40,
        text_overlay_backgroundWidth: campaign.text_overlay_backgroundWidth !== undefined ? campaign.text_overlay_backgroundWidth : 50,
        text_overlay_backgroundYOffset: campaign.text_overlay_backgroundYOffset || 0,
        text_overlay_backgroundXOffset: campaign.text_overlay_backgroundXOffset || 0,
        text_overlay_backgroundStyle: campaign.text_overlay_backgroundStyle || 'line-width',
        text_overlay_animation: campaign.text_overlay_animation || 'fade_in',
        // Don't copy computed background data - let it regenerate fresh
        text_overlay_connected_background_data: null,
        
        // Text Overlay 2 settings
        text_overlay_2_enabled: campaign.text_overlay_2_enabled !== undefined ? campaign.text_overlay_2_enabled : false,
        text_overlay_2_mode: campaign.text_overlay_2_mode || 'custom',
        text_overlay_2_custom_text: campaign.text_overlay_2_custom_text || '',
        text_overlay_2_category: campaign.text_overlay_2_category || 'engagement',
        text_overlay_2_font: campaign.text_overlay_2_font || 'Proxima Nova Semibold',
        text_overlay_2_customFontName: campaign.text_overlay_2_customFontName || '',
        text_overlay_2_fontSize: campaign.text_overlay_2_fontSize || 20,
        text_overlay_2_bold: campaign.text_overlay_2_bold !== undefined ? campaign.text_overlay_2_bold : false,
        text_overlay_2_underline: campaign.text_overlay_2_underline !== undefined ? campaign.text_overlay_2_underline : false,
        text_overlay_2_italic: campaign.text_overlay_2_italic !== undefined ? campaign.text_overlay_2_italic : false,
        text_overlay_2_textCase: campaign.text_overlay_2_textCase || 'none',
        text_overlay_2_color: campaign.text_overlay_2_color || '#000000',
        text_overlay_2_characterSpacing: campaign.text_overlay_2_characterSpacing || 0,
        text_overlay_2_lineSpacing: campaign.text_overlay_2_lineSpacing || -1,
        text_overlay_2_alignment: campaign.text_overlay_2_alignment || 'center',
        text_overlay_2_style: campaign.text_overlay_2_style || 'default',
        text_overlay_2_scale: campaign.text_overlay_2_scale || 60,
        text_overlay_2_x_position: campaign.text_overlay_2_x_position || 30,
        text_overlay_2_y_position: campaign.text_overlay_2_y_position || 55,
        text_overlay_2_rotation: campaign.text_overlay_2_rotation || 0,
        text_overlay_2_opacity: campaign.text_overlay_2_opacity || 100,
        text_overlay_2_hasStroke: campaign.text_overlay_2_hasStroke !== undefined ? campaign.text_overlay_2_hasStroke : false,
        text_overlay_2_strokeColor: campaign.text_overlay_2_strokeColor || '#000000',
        text_overlay_2_strokeThickness: campaign.text_overlay_2_strokeThickness || 2,
        text_overlay_2_hasBackground: campaign.text_overlay_2_hasBackground !== undefined ? campaign.text_overlay_2_hasBackground : true,
        text_overlay_2_backgroundColor: campaign.text_overlay_2_backgroundColor || '#ffffff',
        text_overlay_2_backgroundOpacity: campaign.text_overlay_2_backgroundOpacity !== undefined ? campaign.text_overlay_2_backgroundOpacity : 100,
        text_overlay_2_backgroundRounded: campaign.text_overlay_2_backgroundRounded || 7,
        text_overlay_2_backgroundHeight: campaign.text_overlay_2_backgroundHeight !== undefined ? campaign.text_overlay_2_backgroundHeight : 40,
        text_overlay_2_backgroundWidth: campaign.text_overlay_2_backgroundWidth !== undefined ? campaign.text_overlay_2_backgroundWidth : 50,
        text_overlay_2_backgroundYOffset: campaign.text_overlay_2_backgroundYOffset || 0,
        text_overlay_2_backgroundXOffset: campaign.text_overlay_2_backgroundXOffset || 0,
        text_overlay_2_backgroundStyle: campaign.text_overlay_2_backgroundStyle || 'line-width',
        text_overlay_2_animation: campaign.text_overlay_2_animation || 'fade_in',
        // Don't copy computed background data - let it regenerate fresh
        text_overlay_2_connected_background_data: null,
        
        // Text Overlay 3 settings
        text_overlay_3_enabled: campaign.text_overlay_3_enabled !== undefined ? campaign.text_overlay_3_enabled : false,
        text_overlay_3_mode: campaign.text_overlay_3_mode || 'custom',
        text_overlay_3_custom_text: campaign.text_overlay_3_custom_text || '',
        text_overlay_3_category: campaign.text_overlay_3_category || 'engagement',
        text_overlay_3_font: campaign.text_overlay_3_font || 'Proxima Nova Semibold',
        text_overlay_3_customFontName: campaign.text_overlay_3_customFontName || '',
        text_overlay_3_fontSize: campaign.text_overlay_3_fontSize || 20,
        text_overlay_3_bold: campaign.text_overlay_3_bold !== undefined ? campaign.text_overlay_3_bold : false,
        text_overlay_3_underline: campaign.text_overlay_3_underline !== undefined ? campaign.text_overlay_3_underline : false,
        text_overlay_3_italic: campaign.text_overlay_3_italic !== undefined ? campaign.text_overlay_3_italic : false,
        text_overlay_3_textCase: campaign.text_overlay_3_textCase || 'none',
        text_overlay_3_color: campaign.text_overlay_3_color || '#000000',
        text_overlay_3_characterSpacing: campaign.text_overlay_3_characterSpacing || 0,
        text_overlay_3_lineSpacing: campaign.text_overlay_3_lineSpacing || -1,
        text_overlay_3_alignment: campaign.text_overlay_3_alignment || 'center',
        text_overlay_3_style: campaign.text_overlay_3_style || 'default',
        text_overlay_3_scale: campaign.text_overlay_3_scale || 60,
        text_overlay_3_x_position: campaign.text_overlay_3_x_position || 70,
        text_overlay_3_y_position: campaign.text_overlay_3_y_position || 65,
        text_overlay_3_rotation: campaign.text_overlay_3_rotation || 0,
        text_overlay_3_opacity: campaign.text_overlay_3_opacity || 100,
        text_overlay_3_hasStroke: campaign.text_overlay_3_hasStroke !== undefined ? campaign.text_overlay_3_hasStroke : false,
        text_overlay_3_strokeColor: campaign.text_overlay_3_strokeColor || '#000000',
        text_overlay_3_strokeThickness: campaign.text_overlay_3_strokeThickness || 2,
        text_overlay_3_hasBackground: campaign.text_overlay_3_hasBackground !== undefined ? campaign.text_overlay_3_hasBackground : true,
        text_overlay_3_backgroundColor: campaign.text_overlay_3_backgroundColor || '#ffffff',
        text_overlay_3_backgroundOpacity: campaign.text_overlay_3_backgroundOpacity !== undefined ? campaign.text_overlay_3_backgroundOpacity : 100,
        text_overlay_3_backgroundRounded: campaign.text_overlay_3_backgroundRounded || 7,
        text_overlay_3_backgroundHeight: campaign.text_overlay_3_backgroundHeight !== undefined ? campaign.text_overlay_3_backgroundHeight : 40,
        text_overlay_3_backgroundWidth: campaign.text_overlay_3_backgroundWidth !== undefined ? campaign.text_overlay_3_backgroundWidth : 50,
        text_overlay_3_backgroundYOffset: campaign.text_overlay_3_backgroundYOffset || 0,
        text_overlay_3_backgroundXOffset: campaign.text_overlay_3_backgroundXOffset || 0,
        text_overlay_3_backgroundStyle: campaign.text_overlay_3_backgroundStyle || 'line-width',
        text_overlay_3_animation: campaign.text_overlay_3_animation || 'fade_in',
        // Don't copy computed background data - let it regenerate fresh
        text_overlay_3_connected_background_data: null,
        
        // Caption settings
        captions_enabled: campaign.captions_enabled !== undefined ? campaign.captions_enabled : false,
        captions_style: campaign.captions_style || 'tiktok_classic',
        captions_position: campaign.captions_position || 'bottom_center',
        captions_size: campaign.captions_size || 'medium',
        captions_highlight_keywords: campaign.captions_highlight_keywords !== undefined ? campaign.captions_highlight_keywords : true,
        // New extended caption fields
        captions_template: campaign.captions_template || 'tiktok_classic',
        captions_fontSize: campaign.captions_fontSize || 32,
        captions_fontFamily: campaign.captions_fontFamily || 'Montserrat-Bold',
        captions_x_position: campaign.captions_x_position || 50,
        captions_y_position: campaign.captions_y_position || 85,
        captions_color: campaign.captions_color || '#FFFFFF',
        captions_hasStroke: campaign.captions_hasStroke !== undefined ? campaign.captions_hasStroke : true,
        captions_strokeColor: campaign.captions_strokeColor || '#000000',
        captions_strokeWidth: campaign.captions_strokeWidth || 2,
        captions_hasBackground: campaign.captions_hasBackground || false,
        captions_backgroundColor: campaign.captions_backgroundColor || '#000000',
        captions_backgroundOpacity: campaign.captions_backgroundOpacity || 0.8,
        captions_animation: campaign.captions_animation || 'none',
        captions_max_words_per_segment: campaign.captions_max_words_per_segment || 4,
        captions_allCaps: campaign.captions_allCaps || false,
        captions_processing_method: campaign.captions_processing_method || 'auto',
        
        // Music settings
        music_enabled: campaign.music_enabled !== undefined ? campaign.music_enabled : false,
        music_track_id: campaign.music_track_id || 'random_upbeat',
        music_volume: campaign.music_volume !== undefined ? campaign.music_volume : 0.6,
        music_fade_duration: campaign.music_fade_duration !== undefined ? campaign.music_fade_duration : 2.0,
        // Exact script feature
        useExactScript: campaign.useExactScript || false,
        // Add randomized video specific fields - defensive approach (try nested, fall back to flattened)
        sourceDirectory: campaign.random_video_settings?.source_directory || campaign.source_directory || '',
        totalClips: campaign.random_video_settings?.total_clips || campaign.total_clips || '',
        hookVideo: campaign.random_video_settings?.hook_video || campaign.hook_video || '',
        originalVolume: (campaign.random_video_settings?.original_volume !== undefined ? campaign.random_video_settings.original_volume : campaign.original_volume !== undefined ? campaign.original_volume : 0.6),
        voiceAudioVolume: (campaign.random_video_settings?.voice_audio_volume !== undefined ? campaign.random_video_settings.voice_audio_volume : campaign.voice_audio_volume !== undefined ? campaign.voice_audio_volume : 1.0),
        isDuplicate: true  // Flag to indicate this is a duplicate operation
      };

      console.log('Duplicate Campaign - Original campaign type:', campaign.campaign_type);
      console.log('Duplicate Campaign - Form data campaign type:', formData.campaignType);
      console.log('Duplicate Campaign - Full campaign object:', {
        id: campaign.id,
        name: campaign.name,
        campaign_type: campaign.campaign_type,
        avatar_id: campaign.avatar_id,
        nested_source_directory: campaign.random_video_settings?.source_directory,
        flattened_source_directory: campaign.source_directory
      });
      console.log('Duplicate Campaign - Randomized video settings:', {
        nested_source_directory: campaign.random_video_settings?.source_directory,
        flattened_source_directory: campaign.source_directory,
        nested_total_clips: campaign.random_video_settings?.total_clips,
        flattened_total_clips: campaign.total_clips,
        formData_sourceDirectory: formData.sourceDirectory,
        formData_totalClips: formData.totalClips,
        formData_hookVideo: formData.hookVideo,
        formData_originalVolume: formData.originalVolume,
        formData_voiceAudioVolume: formData.voiceAudioVolume
      });
      console.log('Duplicate Campaign - Voice ID fields:', {
        elevenlabs_voice_id: campaign.elevenlabs_voice_id,
        elevenlabsVoiceId: formData.elevenlabsVoiceId,
        useCustomVoice: formData.useCustomVoice,
        custom_voice_id: formData.custom_voice_id
      });

      // Open the modal with prefilled data
      setEditCampaignData(formData);
      setCampaignName(formData.name || '');
      setCurrentCampaignType(formData.campaignType || 'avatar');
      setIsModalOpen(true);
    } catch (error) {
      console.error('Error duplicating campaign:', error);
      setApiError({
        message: error.message || 'Failed to duplicate campaign',
        guidance: 'Please try again or check the campaign data.',
        severity: 'error'
      });
    }
  };
  
  // Handle dropdown positioning and outside clicks
  const handleDropdownToggle = (campaignId, event) => {
    if (openDropdown === campaignId) {
      setOpenDropdown(null);
      return;
    }
    
    const rect = event.currentTarget.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + window.scrollY,
      left: rect.right - 160 + window.scrollX // 160px is dropdown width
    });
    setOpenDropdown(campaignId);
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdown && !event.target.closest('.dropdown-container')) {
        setOpenDropdown(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdown]);
  
  // Dropdown component
  const DropdownMenu = ({ campaignId, isOpen, onClose }) => {
    if (!isOpen) return null;
    
    return createPortal(
      <div 
        className="dropdown-container fixed z-[9999]"
        style={{ 
          top: dropdownPosition.top,
          left: dropdownPosition.left
        }}
      >
        <div className={`w-40 rounded-xl border shadow-xl ${
          darkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'
        }`}>
          <div className="p-2 space-y-1">
            <button
              onClick={() => {
                handleEditCampaign(campaignId);
                onClose();
              }}
              className={`block px-3 py-2 text-sm w-full text-left rounded-lg transition-all duration-200 ${
                darkMode 
                  ? 'text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100'
                  : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              Edit
            </button>
            <button
              onClick={() => {
                handleDuplicateCampaign(campaignId);
                onClose();
              }}
              className={`block px-3 py-2 text-sm w-full text-left rounded-lg transition-all duration-200 ${
                darkMode 
                  ? 'text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100'
                  : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              Duplicate
            </button>
            <button
              onClick={() => {
                setCampaignToDelete(campaignId);
                setIsDeleteModalOpen(true);
                onClose();
              }}
              className={`block px-3 py-2 text-sm w-full text-left rounded-lg transition-all duration-200 ${
                darkMode 
                  ? 'text-error-400 hover:bg-error-500/10'
                  : 'text-error-600 hover:bg-error-50'
              }`}
            >
              Delete
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };
  
  return (
    <motion.div
      className="space-y-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Top section with title and actions */}
      <div className="flex flex-wrap justify-between items-start gap-6">
        <div>
          <h1 className={`text-3xl font-semibold tracking-tight ${darkMode ? 'text-neutral-100' : 'text-neutral-900'}`}>
            Campaigns
          </h1>
          <p className={`mt-2 text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
            Manage and run your content generation campaigns
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Run Selected button - only show if there are selections */}
          {getSelectedCount() > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Button
                variant="secondary"
                icon={<PlayIcon className="h-4 w-4" />}
                onClick={handleRunSelectedCampaigns}
                disabled={isRunningMultiple || isLoading}
                isLoading={isRunningMultiple}
              >
                Run Selected ({getSelectedCount()})
              </Button>
            </motion.div>
          )}
          
          {/* Run Selected 10x button - only show if there are selections */}
          {getSelectedCount() > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Button
                variant="ghost"
                icon={<PlayIcon className="h-4 w-4" />}
                onClick={handleRunSelected10x}
                disabled={isRunningMultiple || isLoading}
                isLoading={isRunningMultiple}
                className="whitespace-nowrap"
              >
                Run Selected 10x ({getSelectedCount() * 10})
              </Button>
            </motion.div>
          )}
          
          <Button
            variant="primary"
            icon={<PlusIcon className="h-4 w-4" />}
            onClick={() => setIsModalOpen(true)}
          >
            Create Campaign
          </Button>
        </div>
      </div>
      
      {/* Show running progress if running multiple campaigns */}
      {isRunningMultiple && (
        <motion.div 
          className={`p-6 rounded-xl border ${darkMode ? 'bg-neutral-800/50 border-neutral-700' : 'bg-neutral-50 border-neutral-200'}`}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className={`text-sm font-medium ${darkMode ? 'text-neutral-200' : 'text-neutral-800'}`}>
              Running campaigns
            </p>
            <span className={`text-xs ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
              {runningProgress.current}/{runningProgress.total}
            </span>
          </div>
          <div className={`w-full rounded-full h-2 ${darkMode ? 'bg-neutral-700' : 'bg-neutral-200'}`}>
            <motion.div 
              className="bg-accent-500 h-2 rounded-full" 
              initial={{ width: 0 }}
              animate={{ width: `${(runningProgress.current / runningProgress.total) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </motion.div>
      )}
      
      {/* Error message */}
      {apiError && (
        <motion.div 
          className={`p-4 rounded-xl border ${
            (typeof apiError === 'object' && apiError.severity === 'warning')
              ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800'
              : 'bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-300 border border-error-200 dark:border-error-800'
          }`}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-start space-x-3">
            <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${
              (typeof apiError === 'object' && apiError.severity === 'warning')
                ? 'bg-yellow-100 dark:bg-yellow-800' 
                : 'bg-error-100 dark:bg-error-800'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                (typeof apiError === 'object' && apiError.severity === 'warning') ? 'bg-yellow-500' : 'bg-error-500'
              }`} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">
                {typeof apiError === 'object' ? apiError.message : apiError}
              </p>
              {typeof apiError === 'object' && apiError.guidance && (
                <p className="text-xs mt-1 opacity-90">{apiError.guidance}</p>
              )}
            </div>
          </div>
        </motion.div>
      )}
      
      {/* Empty state */}
      {!isLoading && campaigns.length === 0 ? (
        <motion.div 
          className={`text-center py-16 rounded-xl border-2 border-dashed ${darkMode ? 'bg-neutral-800/30 border-neutral-700' : 'bg-neutral-50 border-neutral-300'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className={`mx-auto w-12 h-12 rounded-xl ${darkMode ? 'bg-neutral-700' : 'bg-neutral-200'} flex items-center justify-center mb-4`}>
            <FolderIcon className={`h-6 w-6 ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`} />
          </div>
          <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-neutral-200' : 'text-neutral-800'}`}>
            No campaigns yet
          </h3>
          <p className={`mb-6 max-w-sm mx-auto ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
            Create your first campaign to start generating content with AI avatars and scripts
          </p>
          <Button
            variant="primary"
            icon={<PlusIcon className="h-4 w-4" />}
            onClick={() => setIsModalOpen(true)}
          >
            Create Campaign
          </Button>
        </motion.div>
      ) : (
        // Campaigns list
        <div className={`rounded-xl border ${darkMode ? 'bg-neutral-800/50 border-neutral-700' : 'bg-white border-neutral-200'} overflow-hidden`}>
          
          {/* Table header */}
          <div className={`px-6 py-4 border-b ${darkMode ? 'border-neutral-700' : 'border-neutral-200'}`}>
            <div className="flex items-center">
              <div className="mr-4">
                <input
                  type="checkbox"
                  className={`h-4 w-4 rounded border-2 focus:ring-2 focus:ring-accent-500/50 transition-all
                    ${darkMode ? 'bg-neutral-700 border-neutral-600' : 'bg-white border-neutral-300'}`}
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                />
              </div>
              <div className="flex-grow grid grid-cols-12 gap-4">
                <div className={`col-span-2 text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>Name & Product</div>
                <div className={`col-span-1 text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>Avatar</div>
                <div className={`col-span-1 text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>Script</div>
                <div className={`col-span-2 text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>Setting</div>
                <div className={`col-span-2 text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>Hook</div>
                <div className={`col-span-1 text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>Created</div>
                <div className={`col-span-2 text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>Actions</div>
              </div>
            </div>
          </div>
          
          {/* Loading state */}
          {isLoading ? (
            <div className="py-12 text-center">
              <div className="flex items-center justify-center space-x-2 mb-4">
                <div className="w-2 h-2 bg-accent-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-accent-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-accent-500 rounded-full animate-bounce"></div>
              </div>
              <p className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                Loading campaigns...
              </p>
            </div>
          ) : (
            // Campaigns list items
            <div className={`divide-y ${darkMode ? 'divide-neutral-700' : 'divide-neutral-200'}`}>
              {paginatedCampaigns.map((campaign) => (
                <motion.div 
                  key={campaign.id}
                  className={`px-6 py-4 transition-all duration-200 ${
                    darkMode 
                      ? 'hover:bg-neutral-800/50' 
                      : 'hover:bg-neutral-50'
                  }`}
                  whileHover={{ scale: 1.001 }}
                  layout
                >
                  <div className="flex items-center">
                    {/* Checkbox */}
                    <div className="mr-4">
                      <input
                        type="checkbox"
                        className={`h-4 w-4 rounded border-2 focus:ring-2 focus:ring-accent-500/50 transition-all
                          ${darkMode ? 'bg-neutral-700 border-neutral-600' : 'bg-white border-neutral-300'}`}
                        checked={!!selectedCampaignIds[campaign.id]}
                        onChange={() => toggleCampaignSelection(campaign.id)}
                      />
                    </div>
                    
                    {/* Campaign details */}
                    <div className="flex-grow grid grid-cols-12 gap-4 items-center">
                      {/* Name & Product */}
                      <div className="col-span-2">
                        <h3 className={`text-sm font-semibold truncate
                          ${darkMode ? 'text-neutral-100' : 'text-neutral-900'}`}>
                          {campaign.name}
                        </h3>
                        <p className={`text-xs mt-1 truncate ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                          {campaign.product}
                        </p>
                      </div>
                      
                      {/* Avatar */}
                      <div className="col-span-1">
                        <p className={`text-sm truncate cursor-pointer hover:text-accent-500 transition-colors ${darkMode ? 'text-neutral-300' : 'text-neutral-700'}`}
                           title={campaign.avatar_id 
                            ? (avatars.find(a => a.id === campaign.avatar_id)?.name || 'Unknown Avatar') 
                            : 'No Avatar'}>
                          {campaign.avatar_id 
                            ? (avatars.find(a => a.id === campaign.avatar_id)?.name || 'Unknown Avatar') 
                            : 'No Avatar'}
                        </p>
                      </div>
                      
                      {/* Script */}
                      <div className="col-span-1">
                        <p className={`text-sm truncate cursor-pointer hover:text-accent-500 transition-colors ${darkMode ? 'text-neutral-300' : 'text-neutral-700'}`}
                           title={campaign.script_id 
                            ? (scripts.find(s => s.id === campaign.script_id)?.name || 'Unknown Script') 
                            : 'No Script'}>
                          {campaign.script_id 
                            ? (scripts.find(s => s.id === campaign.script_id)?.name || 'Unknown Script') 
                            : 'No Script'}
                        </p>
                      </div>
                      
                      {/* Setting */}
                      <div className="col-span-2">
                        <p className={`text-sm truncate cursor-pointer hover:text-accent-500 transition-colors ${darkMode ? 'text-neutral-300' : 'text-neutral-700'}`}
                           title={campaign.setting || 'No Setting'}>
                          {campaign.setting || 'No Setting'}
                        </p>
                      </div>
                      
                      {/* Hook */}
                      <div className="col-span-2">
                        <p className={`text-sm truncate cursor-pointer hover:text-accent-500 transition-colors ${darkMode ? 'text-neutral-300' : 'text-neutral-700'}`}
                           title={campaign.hook || 'No Hook'}>
                          {campaign.hook || 'No Hook'}
                        </p>
                      </div>
                      
                      {/* Created Date */}
                      <div className="col-span-1">
                        <p className={`text-sm truncate cursor-pointer hover:text-accent-500 transition-colors ${darkMode ? 'text-neutral-300' : 'text-neutral-700'}`}
                           title={new Date(campaign.createdAt || campaign.created_at).toLocaleDateString()}>
                          {new Date(campaign.createdAt || campaign.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      
                      {/* Actions */}
                      <div className="col-span-2 flex items-center space-x-2 justify-end">
                        {/* Run Campaign button */}
                        <Button
                          variant="primary"
                          size="sm"
                          icon={<PlayIcon className="h-3.5 w-3.5" />}
                          onClick={() => handleRunCampaign(campaign.id)}
                          isLoading={loadingCampaigns.has(campaign.id)}
                          disabled={loadingCampaigns.has(campaign.id) || isRunningMultiple}
                        >
                          Run
                        </Button>
                        
                        {/* Run 10x button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRun10x(campaign.id)}
                          disabled={isRunningMultiple || isLoading}
                          className="whitespace-nowrap"
                        >
                          10x
                        </Button>
                        
                        {/* Options dropdown button */}
                        <button
                          onClick={(e) => handleDropdownToggle(campaign.id, e)}
                          className={`inline-flex items-center justify-center p-2 rounded-lg transition-all duration-200 hover:bg-neutral-100 dark:hover:bg-neutral-700
                            ${darkMode
                              ? 'text-neutral-400 hover:text-neutral-200'
                              : 'text-neutral-500 hover:text-neutral-700'
                            }`}
                        >
                          <EllipsisVerticalIcon className="h-4 w-4" />
                        </button>
                        
                        {/* Dropdown menu */}
                        <DropdownMenu 
                          campaignId={campaign.id}
                          isOpen={openDropdown === campaign.id}
                          onClose={() => setOpenDropdown(null)}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!isLoading && sortedCampaigns.length > 0 && (
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
                      campaigns per page
                    </span>
                  </div>

                  {/* Page info and controls */}
                  <div className="flex items-center gap-4">
                    <span className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                      Showing {startIndex + 1}-{Math.min(endIndex, sortedCampaigns.length)} of {sortedCampaigns.length}
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
            )}
        </div>
      )}
      
      {/* Delete confirmation modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setCampaignToDelete(null);
        }}
        title={campaignToDelete ? "Delete Campaign" : "Delete Selected Campaigns"}
      >
        <p className={`mb-6 ${darkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
          {campaignToDelete 
            ? "Are you sure you want to delete this campaign? This action cannot be undone."
            : "Are you sure you want to delete the selected campaigns? This action cannot be undone."}
        </p>
        <div className="flex justify-end space-x-3">
          <Button
            variant="ghost"
            onClick={() => {
              setIsDeleteModalOpen(false);
              setCampaignToDelete(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            icon={<TrashIcon className="h-4 w-4" />}
            onClick={handleDeleteSelected}
            isLoading={isLoading}
          >
            Delete
          </Button>
        </div>
      </Modal>
      
      {/* New/Edit Campaign Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editCampaignData ? (editCampaignData.isEdit ? "Edit Campaign" : "Duplicate Campaign") : "Create Campaign"}
        size="full"
        closeButton={false}
        needsScrolling={false}
        headerActions={
          <div className="flex items-center gap-4">
            {/* Campaign Type Toggle Buttons */}
            <div className="flex items-center rounded-md border border-neutral-300 dark:border-neutral-600">
              <button
                type="button"
                onClick={() => setCurrentCampaignType('avatar')}
                className={`px-3 py-1 text-sm font-medium transition-colors ${
                  currentCampaignType === 'avatar'
                    ? darkMode
                      ? 'bg-neutral-700 text-white'
                      : 'bg-neutral-200 text-neutral-900'
                    : darkMode
                      ? 'text-neutral-400 hover:text-neutral-300'
                      : 'text-neutral-600 hover:text-neutral-800'
                }`}
              >
                Avatar
              </button>
              <button
                type="button"
                onClick={() => setCurrentCampaignType('randomized')}
                className={`px-3 py-1 text-sm font-medium transition-colors ${
                  currentCampaignType === 'randomized'
                    ? darkMode
                      ? 'bg-neutral-700 text-white'
                      : 'bg-neutral-200 text-neutral-900'
                    : darkMode
                      ? 'text-neutral-400 hover:text-neutral-300'
                      : 'text-neutral-600 hover:text-neutral-800'
                }`}
              >
                Splice
              </button>
            </div>
            <div className="flex-1 relative">
              <input
                type="text"
                value={campaignName}
                onChange={(e) => {
                  setCampaignName(e.target.value);
                  if (showNameError && e.target.value.trim()) {
                    setShowNameError(false);
                  }
                }}
                placeholder="Campaign Name"
                className={`w-full px-3 py-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500/50 text-sm ${
                  darkMode
                    ? 'bg-neutral-700 border-neutral-600 text-neutral-100 placeholder-neutral-400'
                    : 'bg-white border-neutral-300 text-neutral-900 placeholder-neutral-500'
                }`}
                required
              />
              {showNameError && (
                <div className={`absolute top-full mt-2 left-0 w-64 p-2 text-xs rounded-lg shadow-lg z-50
                  ${darkMode ? 'bg-red-700 text-red-100' : 'bg-red-800 text-white'}`}>
                  Please enter a campaign name
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  darkMode
                    ? 'text-neutral-300 hover:text-neutral-100 hover:bg-neutral-700'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="new-campaign-form"
                className="px-3 py-1 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
              >
                {editCampaignData ? (editCampaignData.isEdit ? "Update Campaign" : "Duplicate Campaign") : "Create Campaign"}
              </button>
            </div>
          </div>
        }
      >
        <NewCampaignForm
          onSubmit={handleNewCampaign}
          onCancel={() => setIsModalOpen(false)}
          initialData={editCampaignData}
          name={campaignName}
          onNameChange={setCampaignName}
          campaignType={currentCampaignType}
          onCampaignTypeChange={setCurrentCampaignType}
        />
      </Modal>
    </motion.div>
  );
}

export default CampaignsPage;
