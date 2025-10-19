import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Button from './Button';
import EnhancedVideoSettings from './EnhancedVideoSettings';
import { generateConnectedBackgroundData } from '../utils/connectedBackgroundGenerator';
import { 
  ArrowUpTrayIcon, 
  UserCircleIcon, 
  DocumentTextIcon,
  SpeakerWaveIcon,
  FaceSmileIcon,
  BuildingStorefrontIcon,
  HashtagIcon
} from '@heroicons/react/24/outline';
import { useStore } from '../store';

function NewCampaignForm({ onSubmit, onCancel, initialData = null, name, onNameChange, campaignType, onCampaignTypeChange, avatars: avatarsProp, scripts: scriptsProp, clips: clipsProp }) {
  const [isLoading, setIsLoading] = useState(false);
  const initializedRef = useRef(false);
  const [videoDimensions, setVideoDimensions] = useState({ width: 1080, height: 1920 });

  // Helper functions for percentage-based font sizing
  const pixelToPercentage = (pixelSize, videoHeight) => {
    return (pixelSize / videoHeight) * 100;
  };

  const getFontPercentage = (pixelSize) => {
    return pixelToPercentage(pixelSize || 20, videoDimensions.height);
  };
  
  
  const [form, setForm] = useState({
    // Campaign type selection
    campaignType: campaignType || initialData?.campaignType || 'avatar', // 'avatar' or 'splice'
    // Avatar-based fields
    avatarId: initialData?.avatarId || '',
    scriptId: initialData?.scriptId || '',
    clipId: initialData?.clipId || '',
    // Splice video fields
    sourceDirectory: initialData?.sourceDirectory || '',
    totalClips: initialData?.totalClips || '',
    hookVideo: initialData?.hookVideo || '',
    originalVolume: initialData?.originalVolume !== undefined ? initialData.originalVolume : 0.6,
    voiceAudioVolume: initialData?.voiceAudioVolume !== undefined ? initialData.voiceAudioVolume : 1.0,
    
    // NEW Splice features
    splice_use_voiceover: initialData?.splice_use_voiceover !== undefined ? initialData.splice_use_voiceover : true,
    splice_duration_source: initialData?.splice_duration_source || 'voiceover',
    splice_target_duration: initialData?.splice_target_duration || 30,
    splice_canvas_width: initialData?.splice_canvas_width !== undefined ? initialData.splice_canvas_width : 1080,
    splice_canvas_height: initialData?.splice_canvas_height !== undefined ? initialData.splice_canvas_height : 1920,
    splice_crop_mode: initialData?.splice_crop_mode || 'center',
    splice_clip_duration_mode: initialData?.splice_clip_duration_mode || 'full',
    splice_clip_duration_fixed: initialData?.splice_clip_duration_fixed || 5.0,
    splice_clip_duration_min: initialData?.splice_clip_duration_min || 3.0,
    splice_clip_duration_max: initialData?.splice_clip_duration_max || 8.0,
    // Common fields
    persona: initialData?.persona || '',
    setting: initialData?.setting || '',
    emotion: initialData?.emotion || 'neutral',
    product: initialData?.product || '',
    hook: initialData?.hook || '',
    elevenlabs_voice_id: (() => {
      const voiceId = initialData?.elevenlabsVoiceId || initialData?.elevenlabs_voice_id;
      if (!voiceId) return 'EXAVITQu4vr4xnSDxMaL'; // Default to Rachel only if no voice ID
      
      // Return the voice ID as-is (don't reset custom voices to Rachel)
      return voiceId;
    })(),
    language: initialData?.language || 'English',
    brand_name: initialData?.brand_name || '',
    trigger_keywords: initialData?.trigger_keywords || '',
    remove_silence: initialData?.remove_silence !== undefined ? initialData.remove_silence : true,
    output_volume_enabled: initialData?.output_volume_enabled !== undefined ? initialData.output_volume_enabled : false,
    output_volume_level: initialData?.output_volume_level !== undefined ? initialData.output_volume_level : 0.25,
    enhance_for_elevenlabs: initialData?.enhance_for_elevenlabs !== undefined ? initialData.enhance_for_elevenlabs : true,
    use_randomization: initialData?.use_randomization !== undefined ? initialData.use_randomization : false,
    randomization_intensity: initialData?.randomization_intensity || 'none',
    // Overlay settings
    use_overlay: initialData?.use_overlay !== undefined ? initialData.use_overlay : false,
    overlay_placement: initialData?.overlay_placement || 'middle_left',
    overlay_size_min: initialData?.overlay_size_min !== undefined ? initialData.overlay_size_min : 0.25,
    overlay_size_max: initialData?.overlay_size_max !== undefined ? initialData.overlay_size_max : 0.4,
    overlay_max_duration: initialData?.overlay_max_duration !== undefined ? initialData.overlay_max_duration : 5.0,
    // Enhanced video settings - Legacy method (flat properties like avatarId)
    text_overlay_enabled: initialData?.text_overlay_enabled !== undefined ? initialData.text_overlay_enabled : false,
    text_overlay_1_enabled: initialData?.text_overlay_1_enabled !== undefined ? initialData.text_overlay_1_enabled : false,
    text_overlay_mode: initialData?.text_overlay_mode || 'custom',
    text_overlay_custom_text: initialData?.text_overlay_custom_text || '',
    text_overlay_category: initialData?.text_overlay_category || 'engagement',
    text_overlay_font: initialData?.text_overlay_font || 'Proxima Nova Semibold',
    text_overlay_fontSize: initialData?.text_overlay_fontSize || 58,
    text_overlay_bold: initialData?.text_overlay_bold !== undefined ? initialData.text_overlay_bold : false,
    text_overlay_underline: initialData?.text_overlay_underline !== undefined ? initialData.text_overlay_underline : false,
    text_overlay_italic: initialData?.text_overlay_italic !== undefined ? initialData.text_overlay_italic : false,
    text_overlay_textCase: initialData?.text_overlay_textCase || 'none',
    text_overlay_color: initialData?.text_overlay_color || '#000000',
    text_overlay_characterSpacing: initialData?.text_overlay_characterSpacing || 0,
    text_overlay_lineSpacing: initialData?.text_overlay_lineSpacing || -1,
    text_overlay_alignment: initialData?.text_overlay_alignment || 'center',
    text_overlay_style: initialData?.text_overlay_style || 'default',
    text_overlay_scale: initialData?.text_overlay_scale || 100,
    text_overlay_x_position: initialData?.text_overlay_x_position || 50,
    text_overlay_y_position: initialData?.text_overlay_y_position || 18,
    text_overlay_rotation: initialData?.text_overlay_rotation || 0,
    text_overlay_opacity: initialData?.text_overlay_opacity || 100,
    text_overlay_hasStroke: initialData?.text_overlay_hasStroke !== undefined ? initialData.text_overlay_hasStroke : false,
    text_overlay_strokeColor: initialData?.text_overlay_strokeColor || '#000000',
    text_overlay_strokeThickness: initialData?.text_overlay_strokeThickness || 2,
    text_overlay_hasBackground: initialData?.text_overlay_hasBackground !== undefined ? initialData.text_overlay_hasBackground : true,
    text_overlay_backgroundColor: initialData?.text_overlay_backgroundColor || '#ffffff',
    text_overlay_backgroundOpacity: initialData?.text_overlay_backgroundOpacity !== undefined ? initialData.text_overlay_backgroundOpacity : 100,
    text_overlay_backgroundRounded: initialData?.text_overlay_backgroundRounded || 20,
    text_overlay_backgroundHeight: initialData?.text_overlay_backgroundHeight !== undefined ? initialData.text_overlay_backgroundHeight : 40,
    text_overlay_backgroundWidth: initialData?.text_overlay_backgroundWidth !== undefined ? initialData.text_overlay_backgroundWidth : 50,
    text_overlay_backgroundYOffset: initialData?.text_overlay_backgroundYOffset || 0,
    text_overlay_backgroundXOffset: initialData?.text_overlay_backgroundXOffset || 0,
    text_overlay_backgroundStyle: initialData?.text_overlay_backgroundStyle || 'line-width',
    text_overlay_animation: initialData?.text_overlay_animation || 'fade_in',
    text_overlay_connected_background_data: initialData?.text_overlay_connected_background_data,
    
    // Text Overlay 2 settings
    text_overlay_2_enabled: initialData?.text_overlay_2_enabled !== undefined ? initialData.text_overlay_2_enabled : false,
    text_overlay_2_mode: initialData?.text_overlay_2_mode || 'custom',
    text_overlay_2_custom_text: initialData?.text_overlay_2_custom_text || '',
    text_overlay_2_category: initialData?.text_overlay_2_category || 'engagement',
    text_overlay_2_font: initialData?.text_overlay_2_font || 'Proxima Nova Semibold',
    text_overlay_2_customFontName: initialData?.text_overlay_2_customFontName || '',
    text_overlay_2_fontSize: initialData?.text_overlay_2_fontSize || 58,
    text_overlay_2_bold: initialData?.text_overlay_2_bold !== undefined ? initialData.text_overlay_2_bold : false,
    text_overlay_2_underline: initialData?.text_overlay_2_underline !== undefined ? initialData.text_overlay_2_underline : false,
    text_overlay_2_italic: initialData?.text_overlay_2_italic !== undefined ? initialData.text_overlay_2_italic : false,
    text_overlay_2_textCase: initialData?.text_overlay_2_textCase || 'none',
    text_overlay_2_color: initialData?.text_overlay_2_color || '#000000',
    text_overlay_2_characterSpacing: initialData?.text_overlay_2_characterSpacing || 0,
    text_overlay_2_lineSpacing: initialData?.text_overlay_2_lineSpacing || -1,
    text_overlay_2_alignment: initialData?.text_overlay_2_alignment || 'center',
    text_overlay_2_style: initialData?.text_overlay_2_style || 'default',
    text_overlay_2_scale: initialData?.text_overlay_2_scale || 100,
    text_overlay_2_x_position: initialData?.text_overlay_2_x_position || 50,
    text_overlay_2_y_position: initialData?.text_overlay_2_y_position || 55,
    text_overlay_2_rotation: initialData?.text_overlay_2_rotation || 0,
    text_overlay_2_opacity: initialData?.text_overlay_2_opacity || 100,
    text_overlay_2_hasStroke: initialData?.text_overlay_2_hasStroke !== undefined ? initialData.text_overlay_2_hasStroke : false,
    text_overlay_2_strokeColor: initialData?.text_overlay_2_strokeColor || '#000000',
    text_overlay_2_strokeThickness: initialData?.text_overlay_2_strokeThickness || 2,
    text_overlay_2_hasBackground: initialData?.text_overlay_2_hasBackground !== undefined ? initialData.text_overlay_2_hasBackground : true,
    text_overlay_2_backgroundColor: initialData?.text_overlay_2_backgroundColor || '#ffffff',
    text_overlay_2_backgroundOpacity: initialData?.text_overlay_2_backgroundOpacity !== undefined ? initialData.text_overlay_2_backgroundOpacity : 100,
    text_overlay_2_backgroundRounded: initialData?.text_overlay_2_backgroundRounded || 20,
    text_overlay_2_backgroundHeight: initialData?.text_overlay_2_backgroundHeight !== undefined ? initialData.text_overlay_2_backgroundHeight : 40,
    text_overlay_2_backgroundWidth: initialData?.text_overlay_2_backgroundWidth !== undefined ? initialData.text_overlay_2_backgroundWidth : 50,
    text_overlay_2_backgroundYOffset: initialData?.text_overlay_2_backgroundYOffset || 0,
    text_overlay_2_backgroundXOffset: initialData?.text_overlay_2_backgroundXOffset || 0,
    text_overlay_2_backgroundStyle: initialData?.text_overlay_2_backgroundStyle || 'line-width',
    text_overlay_2_animation: initialData?.text_overlay_2_animation || 'fade_in',
    text_overlay_2_connected_background_data: initialData?.text_overlay_2_connected_background_data,

    // Text Overlay 3 settings
    text_overlay_3_enabled: initialData?.text_overlay_3_enabled !== undefined ? initialData.text_overlay_3_enabled : false,
    text_overlay_3_mode: initialData?.text_overlay_3_mode || 'custom',
    text_overlay_3_custom_text: initialData?.text_overlay_3_custom_text || '',
    text_overlay_3_category: initialData?.text_overlay_3_category || 'engagement',
    text_overlay_3_font: initialData?.text_overlay_3_font || 'Proxima Nova Semibold',
    text_overlay_3_customFontName: initialData?.text_overlay_3_customFontName || '',
    text_overlay_3_fontSize: initialData?.text_overlay_3_fontSize || 58,
    text_overlay_3_bold: initialData?.text_overlay_3_bold !== undefined ? initialData.text_overlay_3_bold : false,
    text_overlay_3_underline: initialData?.text_overlay_3_underline !== undefined ? initialData.text_overlay_3_underline : false,
    text_overlay_3_italic: initialData?.text_overlay_3_italic !== undefined ? initialData.text_overlay_3_italic : false,
    text_overlay_3_textCase: initialData?.text_overlay_3_textCase || 'none',
    text_overlay_3_color: initialData?.text_overlay_3_color || '#000000',
    text_overlay_3_characterSpacing: initialData?.text_overlay_3_characterSpacing || 0,
    text_overlay_3_lineSpacing: initialData?.text_overlay_3_lineSpacing || -1,
    text_overlay_3_alignment: initialData?.text_overlay_3_alignment || 'center',
    text_overlay_3_style: initialData?.text_overlay_3_style || 'default',
    text_overlay_3_scale: initialData?.text_overlay_3_scale || 100,
    text_overlay_3_x_position: initialData?.text_overlay_3_x_position || 50,
    text_overlay_3_y_position: initialData?.text_overlay_3_y_position || 70,
    text_overlay_3_rotation: initialData?.text_overlay_3_rotation || 0,
    text_overlay_3_opacity: initialData?.text_overlay_3_opacity || 100,
    text_overlay_3_hasStroke: initialData?.text_overlay_3_hasStroke !== undefined ? initialData.text_overlay_3_hasStroke : false,
    text_overlay_3_strokeColor: initialData?.text_overlay_3_strokeColor || '#000000',
    text_overlay_3_strokeThickness: initialData?.text_overlay_3_strokeThickness || 2,
    text_overlay_3_hasBackground: initialData?.text_overlay_3_hasBackground !== undefined ? initialData.text_overlay_3_hasBackground : true,
    text_overlay_3_backgroundColor: initialData?.text_overlay_3_backgroundColor || '#ffffff',
    text_overlay_3_backgroundOpacity: initialData?.text_overlay_3_backgroundOpacity !== undefined ? initialData.text_overlay_3_backgroundOpacity : 100,
    text_overlay_3_backgroundRounded: initialData?.text_overlay_3_backgroundRounded || 20,
    text_overlay_3_backgroundHeight: initialData?.text_overlay_3_backgroundHeight !== undefined ? initialData.text_overlay_3_backgroundHeight : 40,
    text_overlay_3_backgroundWidth: initialData?.text_overlay_3_backgroundWidth !== undefined ? initialData.text_overlay_3_backgroundWidth : 50,
    text_overlay_3_backgroundYOffset: initialData?.text_overlay_3_backgroundYOffset || 0,
    text_overlay_3_backgroundXOffset: initialData?.text_overlay_3_backgroundXOffset || 0,
    text_overlay_3_backgroundStyle: initialData?.text_overlay_3_backgroundStyle || 'line-width',
    text_overlay_3_animation: initialData?.text_overlay_3_animation || 'fade_in',
    text_overlay_3_connected_background_data: initialData?.text_overlay_3_connected_background_data,
    // Music settings
    music_enabled: initialData?.music_enabled !== undefined ? initialData.music_enabled : false,
    music_track_id: initialData?.music_track_id || 'random_upbeat',
    music_volume: initialData?.music_volume !== undefined ? initialData.music_volume : 0.6,
    music_fade_duration: initialData?.music_fade_duration !== undefined ? initialData.music_fade_duration : 2.0,
    // Master toggle for automated video editing features
    automated_video_editing_enabled: initialData?.automated_video_editing_enabled !== undefined ? initialData.automated_video_editing_enabled : false,
    // Exact script feature
    useExactScript: initialData?.useExactScript !== undefined ? initialData.useExactScript : false,
    
    // Caption settings - initialize from saved campaign data
    captions_enabled: initialData?.captions_enabled !== undefined ? initialData.captions_enabled : false,
    captions_style: initialData?.captions_style || 'tiktok_classic',
    captions_position: initialData?.captions_position || 'bottom_center',
    captions_size: initialData?.captions_size || 'medium',
    captions_highlight_keywords: initialData?.captions_highlight_keywords !== undefined ? initialData.captions_highlight_keywords : true,
    captions_processing_method: initialData?.captions_processing_method || 'auto',
    captions_template: initialData?.captions_template || 'tiktok_classic',
    captions_fontSize: initialData?.captions_fontSize || 58,
    captions_fontFamily: initialData?.captions_fontFamily || 'Montserrat-Bold',
    captions_x_position: initialData?.captions_x_position !== undefined ? initialData.captions_x_position : 50,
    captions_y_position: initialData?.captions_y_position !== undefined ? initialData.captions_y_position : 85,
    captions_color: initialData?.captions_color || '#FFFFFF',
    captions_hasStroke: initialData?.captions_hasStroke !== undefined ? initialData.captions_hasStroke : true,
    captions_strokeColor: initialData?.captions_strokeColor || '#000000',
    captions_strokeWidth: initialData?.captions_strokeWidth || 3,
    captions_hasBackground: initialData?.captions_hasBackground !== undefined ? initialData.captions_hasBackground : false,
    captions_backgroundColor: initialData?.captions_backgroundColor || '#000000',
    captions_backgroundOpacity: initialData?.captions_backgroundOpacity !== undefined ? initialData.captions_backgroundOpacity : 0.8,
    captions_animation: initialData?.captions_animation || 'none',
    captions_max_words_per_segment: initialData?.captions_max_words_per_segment || 4,
    captions_allCaps: initialData?.captions_allCaps || false,
    caption_source: initialData?.caption_source || 'voiceover',
    // Voice selection options
    useCustomVoice: (() => {
      // If initialData has explicit useCustomVoice flag, use it
      if (initialData?.useCustomVoice !== undefined) {
        return initialData.useCustomVoice;
      }
      // Otherwise, determine if it's custom by checking if the voice ID matches presets
      const voiceId = initialData?.elevenlabsVoiceId || initialData?.elevenlabs_voice_id;
      if (!voiceId) return false;
      
      const presetVoices = [
        "EXAVITQu4vr4xnSDxMaL", // Rachel
        "VR6AewLTigWG4xSOukaG", // Drew  
        "pNInz6obpgDQGcFmaJgB", // Adam
        "jBpfuIE2acCO8z3wKNLl"  // Bella
      ];
      
      return !presetVoices.includes(voiceId);
    })(),
    custom_voice_id: (() => {
      // If we have explicit custom_voice_id, use it
      if (initialData?.custom_voice_id) {
        return initialData.custom_voice_id;
      }
      // Otherwise, if the voice ID is custom (not in presets), use it as custom_voice_id
      const voiceId = initialData?.elevenlabsVoiceId || initialData?.elevenlabs_voice_id;
      if (!voiceId) return '';
      
      const presetVoices = [
        "EXAVITQu4vr4xnSDxMaL", // Rachel
        "VR6AewLTigWG4xSOukaG", // Drew  
        "pNInz6obpgDQGcFmaJgB", // Adam
        "jBpfuIE2acCO8z3wKNLl"  // Bella
      ];
      
      return presetVoices.includes(voiceId) ? '' : voiceId;
    })(),
    // Preserve edit flags if they exist
    isEdit: initialData?.isEdit || false,
    isDuplicate: initialData?.isDuplicate || false,
    id: initialData?.id || null, // Store campaign ID for edit operations
  });
  
  
  // Get avatars and scripts from global store
  // Use props if provided, otherwise fallback to Zustand (for compatibility)
  const avatarsFromStore = useStore(state => state.avatars);
  const scriptsFromStore = useStore(state => state.scripts);
  const clipsFromStore = useStore(state => state.clips);
  const darkMode = useStore(state => state.darkMode);
  
  // Use props if available, otherwise use store
  const avatars = avatarsProp || avatarsFromStore;
  const scripts = scriptsProp || scriptsFromStore;
  const clips = clipsProp || clipsFromStore;
  
  // All avatars from React Query are already backend avatars
  const backendAvatars = avatars;

  // Effect to sync campaignType from props or initialData
  useEffect(() => {
    // Priority: campaignType prop > initialData.campaignType > current form value
    const targetType = campaignType || initialData?.campaignType;
    
    
    if (targetType && targetType !== form.campaignType) {
      console.log(`[NewCampaignForm] Syncing campaign type: ${form.campaignType} → ${targetType}`);
      setForm(prev => ({
        ...prev,
        campaignType: targetType
      }));
    }
  }, [campaignType, initialData?.campaignType]);

  // Effect to update voice ID when avatar changes (Avatar campaigns only)
  useEffect(() => {
    if (form.campaignType === 'avatar' && form.avatarId) {
      const selectedAvatar = avatars.find(a => a.id === form.avatarId);
      if (selectedAvatar && selectedAvatar.elevenlabs_voice_id) {
        setForm(prev => ({
          ...prev,
          elevenlabs_voice_id: selectedAvatar.elevenlabs_voice_id
        }));
      }
    }
  }, [form.avatarId, avatars, form.campaignType]);

  // Video dimensions are now received from EnhancedVideoSettings via callback
  // This ensures dimensions work for both avatar and splice campaigns
  const handleVideoDimensionsDetected = (dimensions) => {
    setVideoDimensions({
      width: dimensions.width,
      height: dimensions.height
    });
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked} = e.target;

    // Handle bulk updates for text overlays and captions
    if (type === 'bulk' && (name === 'BULK_UPDATE_TEXT_OVERLAYS' || name === 'BULK_UPDATE_TEMPLATE' || name === 'BULK_UPDATE_CAPTIONS')) {
      setForm(prevForm => ({
        ...prevForm,
        ...value
      }));
      return;
    }
    
    // Handle special validation for overlay size inputs
    if (name === 'overlay_size_min' || name === 'overlay_size_max') {
      const numValue = parseFloat(value);
      
      // Allow empty string for typing, and validate range 0.0-1.0
      if (value !== '' && (numValue < 0.0 || numValue > 1.0)) {
        return; // Only block if outside 0.0-1.0 range
      }
      
      // Additional validation for min/max relationship - only if both values are valid numbers
      if (value !== '' && !isNaN(numValue)) {
        const otherFieldName = name === 'overlay_size_min' ? 'overlay_size_max' : 'overlay_size_min';
        const otherValue = parseFloat(form[otherFieldName]);
        
        if (!isNaN(otherValue)) {
          if (name === 'overlay_size_min' && numValue > otherValue) {
            return; // Don't allow min to be greater than max
          }
          if (name === 'overlay_size_max' && numValue < otherValue) {
            return; // Don't allow max to be less than min
          }
        }
      }
    }
    
    const newForm = {
      ...form,
      [name]: type === 'checkbox' ? checked : value,
    };

    setForm(newForm);

    // Notify parent of campaign type changes
    if (name === 'campaignType' && onCampaignTypeChange) {
      onCampaignTypeChange(value);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      if (form.campaignType === 'avatar') {
        // Avatar-based campaign validation
        const selectedAvatar = avatars.find(a => a.id === form.avatarId);
        
        if (!selectedAvatar) {
          throw new Error('Selected avatar not found');
        }
        
        // Get script file
        const selectedScript = scripts.find(s => s.id === form.scriptId);
        if (!selectedScript) {
          throw new Error('Selected script not found');
        }
        
        // Get selected clip (optional)
        let selectedClip = null;
        if (form.clipId) {
          selectedClip = clips.find(c => c.id === form.clipId);
          if (!selectedClip) {
            console.warn('Selected clip not found:', form.clipId);
          }
        }
        
        // Validate overlay settings
        if (form.use_overlay && !selectedClip) {
          throw new Error('A product clip is required when overlay is enabled');
        }
        
        // Process trigger keywords into an array
        const triggerKeywords = form.trigger_keywords
          ? form.trigger_keywords.split(',').map(kw => kw.trim()).filter(kw => kw.length > 0)
          : [];
        

        // Pass the complete payload for avatar campaign
        const avatarJobData = {
          ...form,
          name,
          campaignType: 'avatar',
          trigger_keywords: triggerKeywords,
          // Pass both ID and path for avatar
          avatarId: selectedAvatar.id,
          avatarVideo: selectedAvatar.filePath,
          // Pass both ID and path for script
          scriptId: selectedScript.id,
          scriptFile: selectedScript.filePath || selectedScript.content,
          // Pass clip information if selected
          clipId: selectedClip ? selectedClip.id : null,
          productClipPath: selectedClip ? selectedClip.filePath : null,
          // For avatar campaigns, always use the avatar's voice ID
          elevenlabsVoiceId: selectedAvatar.elevenlabs_voice_id,
          // Convert booleans explicitly
          removeSilence: form.remove_silence === true,
          outputVolumeEnabled: form.output_volume_enabled === true,
          outputVolumeLevel: parseFloat(form.output_volume_level),
          enhanceForElevenlabs: form.enhance_for_elevenlabs === true,
          brandName: form.brand_name,
          // Overlay settings
          useOverlay: form.use_overlay,
          overlaySettings: form.use_overlay ? {
            placements: [form.overlay_placement],
            size_range: [parseFloat(form.overlay_size_min), parseFloat(form.overlay_size_max)],
            maximum_overlay_duration: parseFloat(form.overlay_max_duration)
          } : null,
          // Exact script feature
          useExactScript: form.useExactScript === true,
          // Enhanced video settings (structured format with design-space support)
          automated_video_editing_enabled: true,
          enhanced_settings: {
            text_overlays: [
              // Text overlay 1
              {
                enabled: form.text_overlay_enabled === true,
                mode: form.text_overlay_mode,
                custom_text: form.text_overlay_custom_text,
                category: form.text_overlay_category,
                font: form.text_overlay_font,
                fontSize: form.text_overlay_fontSize,
                bold: form.text_overlay_bold === true,
                underline: form.text_overlay_underline === true,
                italic: form.text_overlay_italic === true,
                textCase: form.text_overlay_textCase,
                color: form.text_overlay_color,
                characterSpacing: form.text_overlay_characterSpacing,
                lineSpacing: form.text_overlay_lineSpacing,
                alignment: form.text_overlay_alignment,
                style: form.text_overlay_style,
                scale: form.text_overlay_scale,
                position: form.text_overlay_position || 'top_center',
                rotation: form.text_overlay_rotation,
                opacity: form.text_overlay_opacity,
                hasStroke: form.text_overlay_hasStroke === true,
                strokeColor: form.text_overlay_strokeColor,
                strokeThickness: form.text_overlay_strokeThickness,
                hasBackground: form.text_overlay_hasBackground === true,
                backgroundColor: form.text_overlay_backgroundColor,
                backgroundOpacity: form.text_overlay_backgroundOpacity,
                backgroundRounded: form.text_overlay_backgroundRounded,
                backgroundStyle: form.text_overlay_backgroundStyle,
                backgroundHeight: form.text_overlay_backgroundHeight,
                backgroundWidth: form.text_overlay_backgroundWidth,
                backgroundYOffset: form.text_overlay_backgroundYOffset,
                backgroundXOffset: form.text_overlay_backgroundXOffset,
                animation: form.text_overlay_hasBackground ? form.text_overlay_animation : 'none',
                connected_background_data: (() => {
                  // Generate fresh at submission time for line-width style
                  if (form.text_overlay_hasBackground && form.text_overlay_backgroundStyle === 'line-width' && form.text_overlay_custom_text) {
                    return generateConnectedBackgroundData({
                      text: form.text_overlay_custom_text,
                      backgroundColor: form.text_overlay_backgroundColor,
                      backgroundOpacity: form.text_overlay_backgroundOpacity,
                      backgroundRounded: form.text_overlay_backgroundRounded,
                      backgroundHeight: form.text_overlay_backgroundHeight,
                      backgroundWidth: form.text_overlay_backgroundWidth,
                      lineSpacing: form.text_overlay_lineSpacing,
                      fontSize: form.text_overlay_fontSize,
                      style: {
                        fontWeight: form.text_overlay_bold ? 'bold' : 'normal',
                        fontStyle: form.text_overlay_italic ? 'italic' : 'normal',
                        fontFamily: form.text_overlay_font === 'custom' ? form.text_overlay_customFontName || 'System' : form.text_overlay_font || 'System',
                        color: form.text_overlay_color
                      }
                    });
                  }
                  return null;
                })(),
                // Design-space fields
                designWidth: videoDimensions.width,
                designHeight: videoDimensions.height,
                xPct: form.text_overlay_x_position || 50,
                yPct: form.text_overlay_y_position || 18,
                anchor: 'center',
                safeMarginsPct: { left: 4.0, right: 4.0, top: 5.0, bottom: 12.0 },
                font_size: (getFontPercentage(form.text_overlay_fontSize) / 100) * videoDimensions.height,
                borderPx: form.text_overlay_strokeThickness || 2,
                shadowPx: 0,
                lineSpacingPx: form.text_overlay_lineSpacing || 4,
                wrapWidthPct: 90
              },
              // Text overlay 2
              {
                enabled: form.text_overlay_2_enabled === true,
                mode: form.text_overlay_2_mode,
                custom_text: form.text_overlay_2_custom_text,
                category: form.text_overlay_2_category,
                font: form.text_overlay_2_font,
                customFontName: form.text_overlay_2_customFontName,
                fontSize: form.text_overlay_2_fontSize,
                bold: form.text_overlay_2_bold === true,
                underline: form.text_overlay_2_underline === true,
                italic: form.text_overlay_2_italic === true,
                textCase: form.text_overlay_2_textCase,
                color: form.text_overlay_2_color,
                characterSpacing: form.text_overlay_2_characterSpacing,
                lineSpacing: form.text_overlay_2_lineSpacing,
                alignment: form.text_overlay_2_alignment,
                style: form.text_overlay_2_style,
                scale: form.text_overlay_2_scale,
                position: form.text_overlay_2_position || 'middle_left',
                rotation: form.text_overlay_2_rotation,
                opacity: form.text_overlay_2_opacity,
                hasStroke: form.text_overlay_2_hasStroke === true,
                strokeColor: form.text_overlay_2_strokeColor,
                strokeThickness: form.text_overlay_2_strokeThickness,
                hasBackground: form.text_overlay_2_hasBackground === true,
                backgroundColor: form.text_overlay_2_backgroundColor,
                backgroundOpacity: form.text_overlay_2_backgroundOpacity,
                backgroundRounded: form.text_overlay_2_backgroundRounded,
                backgroundStyle: form.text_overlay_2_backgroundStyle,
                backgroundHeight: form.text_overlay_2_backgroundHeight,
                backgroundWidth: form.text_overlay_2_backgroundWidth,
                backgroundYOffset: form.text_overlay_2_backgroundYOffset,
                backgroundXOffset: form.text_overlay_2_backgroundXOffset,
                animation: form.text_overlay_2_hasBackground ? form.text_overlay_2_animation : 'none',
                connected_background_data: (() => {
                  // Generate fresh at submission time for line-width style
                  if (form.text_overlay_2_hasBackground && form.text_overlay_2_backgroundStyle === 'line-width' && form.text_overlay_2_custom_text) {
                    return generateConnectedBackgroundData({
                      text: form.text_overlay_2_custom_text,
                      backgroundColor: form.text_overlay_2_backgroundColor,
                      backgroundOpacity: form.text_overlay_2_backgroundOpacity,
                      backgroundRounded: form.text_overlay_2_backgroundRounded,
                      backgroundHeight: form.text_overlay_2_backgroundHeight,
                      backgroundWidth: form.text_overlay_2_backgroundWidth,
                      lineSpacing: form.text_overlay_2_lineSpacing,
                      fontSize: form.text_overlay_2_fontSize,
                      style: {
                        fontWeight: form.text_overlay_2_bold ? 'bold' : 'normal',
                        fontStyle: form.text_overlay_2_italic ? 'italic' : 'normal',
                        fontFamily: form.text_overlay_2_font === 'custom' ? form.text_overlay_2_customFontName || 'System' : form.text_overlay_2_font || 'System',
                        color: form.text_overlay_2_color
                      }
                    });
                  }
                  return null;
                })(),
                // Design-space fields
                designWidth: videoDimensions.width,
                designHeight: videoDimensions.height,
                xPct: form.text_overlay_2_x_position || 30,
                yPct: form.text_overlay_2_y_position || 35,
                anchor: 'center',
                safeMarginsPct: { left: 4.0, right: 4.0, top: 5.0, bottom: 12.0 },
                font_size: (getFontPercentage(form.text_overlay_2_fontSize) / 100) * videoDimensions.height,
                borderPx: form.text_overlay_2_strokeThickness || 2,
                shadowPx: 0,
                lineSpacingPx: form.text_overlay_2_lineSpacing || 4,
                wrapWidthPct: 90
              },
              // Text overlay 3
              {
                enabled: form.text_overlay_3_enabled === true,
                mode: form.text_overlay_3_mode,
                custom_text: form.text_overlay_3_custom_text,
                category: form.text_overlay_3_category,
                font: form.text_overlay_3_font,
                customFontName: form.text_overlay_3_customFontName,
                fontSize: form.text_overlay_3_fontSize,
                bold: form.text_overlay_3_bold === true,
                underline: form.text_overlay_3_underline === true,
                italic: form.text_overlay_3_italic === true,
                textCase: form.text_overlay_3_textCase,
                color: form.text_overlay_3_color,
                characterSpacing: form.text_overlay_3_characterSpacing,
                lineSpacing: form.text_overlay_3_lineSpacing,
                alignment: form.text_overlay_3_alignment,
                style: form.text_overlay_3_style,
                scale: form.text_overlay_3_scale,
                position: form.text_overlay_3_position || 'bottom_right',
                rotation: form.text_overlay_3_rotation,
                opacity: form.text_overlay_3_opacity,
                hasStroke: form.text_overlay_3_hasStroke === true,
                strokeColor: form.text_overlay_3_strokeColor,
                strokeThickness: form.text_overlay_3_strokeThickness,
                hasBackground: form.text_overlay_3_hasBackground === true,
                backgroundColor: form.text_overlay_3_backgroundColor,
                backgroundOpacity: form.text_overlay_3_backgroundOpacity,
                backgroundRounded: form.text_overlay_3_backgroundRounded,
                backgroundStyle: form.text_overlay_3_backgroundStyle,
                backgroundHeight: form.text_overlay_3_backgroundHeight,
                backgroundWidth: form.text_overlay_3_backgroundWidth,
                backgroundYOffset: form.text_overlay_3_backgroundYOffset,
                backgroundXOffset: form.text_overlay_3_backgroundXOffset,
                animation: form.text_overlay_3_hasBackground ? form.text_overlay_3_animation : 'none',
                connected_background_data: (() => {
                  // Generate fresh at submission time for line-width style
                  if (form.text_overlay_3_hasBackground && form.text_overlay_3_backgroundStyle === 'line-width' && form.text_overlay_3_custom_text) {
                    return generateConnectedBackgroundData({
                      text: form.text_overlay_3_custom_text,
                      backgroundColor: form.text_overlay_3_backgroundColor,
                      backgroundOpacity: form.text_overlay_3_backgroundOpacity,
                      backgroundRounded: form.text_overlay_3_backgroundRounded,
                      backgroundHeight: form.text_overlay_3_backgroundHeight,
                      backgroundWidth: form.text_overlay_3_backgroundWidth,
                      lineSpacing: form.text_overlay_3_lineSpacing,
                      fontSize: form.text_overlay_3_fontSize,
                      style: {
                        fontWeight: form.text_overlay_3_bold ? 'bold' : 'normal',
                        fontStyle: form.text_overlay_3_italic ? 'italic' : 'normal',
                        fontFamily: form.text_overlay_3_font === 'custom' ? form.text_overlay_3_customFontName || 'System' : form.text_overlay_3_font || 'System',
                        color: form.text_overlay_3_color
                      }
                    });
                  }
                  return null;
                })(),
                // Design-space fields
                designWidth: videoDimensions.width,
                designHeight: videoDimensions.height,
                xPct: form.text_overlay_3_x_position || 70,
                yPct: form.text_overlay_3_y_position || 65,
                anchor: 'center',
                safeMarginsPct: { left: 4.0, right: 4.0, top: 5.0, bottom: 12.0 },
                font_size: (getFontPercentage(form.text_overlay_3_fontSize) / 100) * videoDimensions.height,
                borderPx: form.text_overlay_3_strokeThickness || 2,
                shadowPx: 0,
                lineSpacingPx: form.text_overlay_3_lineSpacing || 4,
                wrapWidthPct: 90
              }
            ],
            captions: {
              enabled: form.captions_enabled === true,
              template: form.captions_style || 'tiktok_classic',
              fontSize: (getFontPercentage(form.captions_fontSize) / 100) * videoDimensions.height,
              fontFamily: form.captions_fontFamily || 'Montserrat-Bold',
              x_position: form.captions_x_position || 50,
              y_position: form.captions_y_position || 85,
              color: form.captions_color || '#FFFFFF',
              hasStroke: form.captions_hasStroke !== undefined ? form.captions_hasStroke : true,
              strokeColor: form.captions_strokeColor || '#000000',
              strokeWidth: form.captions_strokeWidth || 2,
              max_words_per_segment: form.captions_max_words_per_segment || 4,
              allCaps: form.captions_allCaps || false,
              highlight_keywords: form.captions_highlight_keywords === true,
              processing_method: form.captions_processing_method,
              // Design-space fields
              designWidth: videoDimensions.width,
              designHeight: videoDimensions.height,
              xPct: form.captions_x_position || 50,
              yPct: form.captions_y_position || 85,
              anchor: 'center',
              safeMarginsPct: { left: 4.0, right: 4.0, top: 5.0, bottom: 12.0 },
              fontPx: form.captions_fontSize,
              borderPx: form.captions_hasStroke ? (form.captions_strokeWidth || 2) : 0,
              shadowPx: 0,
              hasBackground: form.captions_hasBackground || false,
              backgroundColor: form.captions_backgroundColor || '#000000',
              backgroundOpacity: form.captions_backgroundOpacity || 0.8,
              animation: form.captions_animation || 'none'
            },
            music: {
              enabled: form.music_enabled === true,
              track_id: form.music_track_id,
              volume: form.music_volume || 1.0,
              fade_duration: form.music_fade_duration !== undefined ? form.music_fade_duration : 2.0
            },
            // Caption source (voiceover or music) - primarily for splice, but include for consistency
            caption_source: form.caption_source || 'voiceover'
          },
          // Pass through edit flags
          isEdit: form.isEdit,
          isDuplicate: form.isDuplicate,
          id: form.id, // Pass through ID for edit operations
        };


        onSubmit(avatarJobData);

      } else if (form.campaignType === 'splice') {
        // Splice video campaign validation
        if (!form.sourceDirectory) {
          throw new Error('Source directory is required for splice video generation');
        }
        
        // NEW: Enhanced Splice validation
        if (form.splice_use_voiceover) {
          // Script required if using voiceover
          const selectedScript = scripts.find(s => s.id === form.scriptId);
          if (!selectedScript) {
            throw new Error('Script is required when voiceover is enabled');
          }
        } else {
          // Manual duration required if no voiceover
          if (form.splice_duration_source === 'manual' && !form.splice_target_duration) {
            throw new Error('Manual duration is required when voiceover is disabled');
          }
        }
        
        // Validate per-clip duration settings
        if (form.splice_clip_duration_mode === 'fixed' && !form.splice_clip_duration_fixed) {
          throw new Error('Fixed duration per clip is required');
        }
        
        if (form.splice_clip_duration_mode === 'random') {
          if (!form.splice_clip_duration_min || !form.splice_clip_duration_max) {
            throw new Error('Random duration range (min/max) is required');
          }
          if (form.splice_clip_duration_min >= form.splice_clip_duration_max) {
            throw new Error('Min duration must be less than max duration');
          }
        }
        
        // Get script file (if using voiceover)
        let selectedScript = null;
        if (form.splice_use_voiceover) {
          selectedScript = scripts.find(s => s.id === form.scriptId);
        }
        
        // Get selected clip (optional, but required if overlay is enabled)
        let selectedClip = null;
        if (form.clipId) {
          selectedClip = clips.find(c => c.id === form.clipId);
          if (!selectedClip) {
            console.warn('Selected clip not found:', form.clipId);
          }
        }
        
        // Validate overlay settings for splice campaigns
        if (form.use_overlay && !selectedClip) {
          throw new Error('A product clip is required when overlay is enabled for splice video campaigns');
        }
        
        // Process trigger keywords into an array
        const triggerKeywords = form.trigger_keywords
          ? form.trigger_keywords.split(',').map(kw => kw.trim()).filter(kw => kw.length > 0)
          : [];
        
        // Pass the complete payload for splice campaign
        const spliceJobData = {
          ...form,
          name,
          campaignType: 'splice',
          trigger_keywords: triggerKeywords,
          // Pass script information
          scriptId: selectedScript ? selectedScript.id : null,
          scriptFile: selectedScript ? (selectedScript.filePath || selectedScript.content) : null,
          // Pass clip information if selected (for overlay)
          clipId: selectedClip ? selectedClip.id : null,
          productClipPath: selectedClip ? selectedClip.filePath : null,
          // Pass voice ID with correct snake_case (use dummy if voiceover disabled)
          elevenlabs_voice_id: form.splice_use_voiceover ? (form.elevenlabs_voice_id || 'none') : 'none',
          // Convert booleans explicitly
          outputVolumeEnabled: form.output_volume_enabled === true,
          outputVolumeLevel: parseFloat(form.output_volume_level),
          enhanceForElevenlabs: form.enhance_for_elevenlabs === true,
          brandName: form.brand_name,
          // Overlay settings (NEW - now properly passed for splice campaigns)
          useOverlay: form.use_overlay,
          overlaySettings: form.use_overlay ? {
            placements: [form.overlay_placement],
            size_range: [parseFloat(form.overlay_size_min), parseFloat(form.overlay_size_max)],
            maximum_overlay_duration: parseFloat(form.overlay_max_duration)
          } : null,
          // Exact script feature
          useExactScript: form.useExactScript === true,
          // Enhanced video settings (structured format with design-space support)
          automated_video_editing_enabled: true,
          enhanced_settings: {
            text_overlays: [
              // Text overlay 1
              {
                enabled: form.text_overlay_enabled === true,
                mode: form.text_overlay_mode,
                custom_text: form.text_overlay_custom_text,
                category: form.text_overlay_category,
                font: form.text_overlay_font,
                fontSize: form.text_overlay_fontSize,
                bold: form.text_overlay_bold === true,
                underline: form.text_overlay_underline === true,
                italic: form.text_overlay_italic === true,
                textCase: form.text_overlay_textCase,
                color: form.text_overlay_color,
                characterSpacing: form.text_overlay_characterSpacing,
                lineSpacing: form.text_overlay_lineSpacing,
                alignment: form.text_overlay_alignment,
                style: form.text_overlay_style,
                scale: form.text_overlay_scale,
                position: form.text_overlay_position || 'top_center',
                rotation: form.text_overlay_rotation,
                opacity: form.text_overlay_opacity,
                hasStroke: form.text_overlay_hasStroke === true,
                strokeColor: form.text_overlay_strokeColor,
                strokeThickness: form.text_overlay_strokeThickness,
                hasBackground: form.text_overlay_hasBackground === true,
                backgroundColor: form.text_overlay_backgroundColor,
                backgroundOpacity: form.text_overlay_backgroundOpacity,
                backgroundRounded: form.text_overlay_backgroundRounded,
                backgroundStyle: form.text_overlay_backgroundStyle,
                backgroundHeight: form.text_overlay_backgroundHeight,
                backgroundWidth: form.text_overlay_backgroundWidth,
                backgroundYOffset: form.text_overlay_backgroundYOffset,
                backgroundXOffset: form.text_overlay_backgroundXOffset,
                animation: form.text_overlay_hasBackground ? form.text_overlay_animation : 'none',
                connected_background_data: (() => {
                  // Generate fresh at submission time for line-width style
                  if (form.text_overlay_hasBackground && form.text_overlay_backgroundStyle === 'line-width' && form.text_overlay_custom_text) {
                    return generateConnectedBackgroundData({
                      text: form.text_overlay_custom_text,
                      backgroundColor: form.text_overlay_backgroundColor,
                      backgroundOpacity: form.text_overlay_backgroundOpacity,
                      backgroundRounded: form.text_overlay_backgroundRounded,
                      backgroundHeight: form.text_overlay_backgroundHeight,
                      backgroundWidth: form.text_overlay_backgroundWidth,
                      lineSpacing: form.text_overlay_lineSpacing,
                      fontSize: form.text_overlay_fontSize,
                      style: {
                        fontWeight: form.text_overlay_bold ? 'bold' : 'normal',
                        fontStyle: form.text_overlay_italic ? 'italic' : 'normal',
                        fontFamily: form.text_overlay_font === 'custom' ? form.text_overlay_customFontName || 'System' : form.text_overlay_font || 'System',
                        color: form.text_overlay_color
                      }
                    });
                  }
                  return null;
                })(),
                // Design-space fields
                designWidth: videoDimensions.width,
                designHeight: videoDimensions.height,
                xPct: form.text_overlay_x_position || 50,
                yPct: form.text_overlay_y_position || 18,
                anchor: 'center',
                safeMarginsPct: { left: 4.0, right: 4.0, top: 5.0, bottom: 12.0 },
                font_size: (getFontPercentage(form.text_overlay_fontSize) / 100) * videoDimensions.height,
                borderPx: form.text_overlay_strokeThickness || 2,
                shadowPx: 0,
                lineSpacingPx: form.text_overlay_lineSpacing || 4,
                wrapWidthPct: 90
              },
              // Text overlay 2
              {
                enabled: form.text_overlay_2_enabled === true,
                mode: form.text_overlay_2_mode,
                custom_text: form.text_overlay_2_custom_text,
                category: form.text_overlay_2_category,
                font: form.text_overlay_2_font,
                customFontName: form.text_overlay_2_customFontName,
                fontSize: form.text_overlay_2_fontSize,
                bold: form.text_overlay_2_bold === true,
                underline: form.text_overlay_2_underline === true,
                italic: form.text_overlay_2_italic === true,
                textCase: form.text_overlay_2_textCase,
                color: form.text_overlay_2_color,
                characterSpacing: form.text_overlay_2_characterSpacing,
                lineSpacing: form.text_overlay_2_lineSpacing,
                alignment: form.text_overlay_2_alignment,
                style: form.text_overlay_2_style,
                scale: form.text_overlay_2_scale,
                position: form.text_overlay_2_position || 'middle_left',
                rotation: form.text_overlay_2_rotation,
                opacity: form.text_overlay_2_opacity,
                hasStroke: form.text_overlay_2_hasStroke === true,
                strokeColor: form.text_overlay_2_strokeColor,
                strokeThickness: form.text_overlay_2_strokeThickness,
                hasBackground: form.text_overlay_2_hasBackground === true,
                backgroundColor: form.text_overlay_2_backgroundColor,
                backgroundOpacity: form.text_overlay_2_backgroundOpacity,
                backgroundRounded: form.text_overlay_2_backgroundRounded,
                backgroundStyle: form.text_overlay_2_backgroundStyle,
                backgroundHeight: form.text_overlay_2_backgroundHeight,
                backgroundWidth: form.text_overlay_2_backgroundWidth,
                backgroundYOffset: form.text_overlay_2_backgroundYOffset,
                backgroundXOffset: form.text_overlay_2_backgroundXOffset,
                animation: form.text_overlay_2_hasBackground ? form.text_overlay_2_animation : 'none',
                connected_background_data: (() => {
                  // Generate fresh at submission time for line-width style
                  if (form.text_overlay_2_hasBackground && form.text_overlay_2_backgroundStyle === 'line-width' && form.text_overlay_2_custom_text) {
                    return generateConnectedBackgroundData({
                      text: form.text_overlay_2_custom_text,
                      backgroundColor: form.text_overlay_2_backgroundColor,
                      backgroundOpacity: form.text_overlay_2_backgroundOpacity,
                      backgroundRounded: form.text_overlay_2_backgroundRounded,
                      backgroundHeight: form.text_overlay_2_backgroundHeight,
                      backgroundWidth: form.text_overlay_2_backgroundWidth,
                      lineSpacing: form.text_overlay_2_lineSpacing,
                      fontSize: form.text_overlay_2_fontSize,
                      style: {
                        fontWeight: form.text_overlay_2_bold ? 'bold' : 'normal',
                        fontStyle: form.text_overlay_2_italic ? 'italic' : 'normal',
                        fontFamily: form.text_overlay_2_font === 'custom' ? form.text_overlay_2_customFontName || 'System' : form.text_overlay_2_font || 'System',
                        color: form.text_overlay_2_color
                      }
                    });
                  }
                  return null;
                })(),
                // Design-space fields
                designWidth: videoDimensions.width,
                designHeight: videoDimensions.height,
                xPct: form.text_overlay_2_x_position || 30,
                yPct: form.text_overlay_2_y_position || 35,
                anchor: 'center',
                safeMarginsPct: { left: 4.0, right: 4.0, top: 5.0, bottom: 12.0 },
                font_size: (getFontPercentage(form.text_overlay_2_fontSize) / 100) * videoDimensions.height,
                borderPx: form.text_overlay_2_strokeThickness || 2,
                shadowPx: 0,
                lineSpacingPx: form.text_overlay_2_lineSpacing || 4,
                wrapWidthPct: 90
              },
              // Text overlay 3
              {
                enabled: form.text_overlay_3_enabled === true,
                mode: form.text_overlay_3_mode,
                custom_text: form.text_overlay_3_custom_text,
                category: form.text_overlay_3_category,
                font: form.text_overlay_3_font,
                customFontName: form.text_overlay_3_customFontName,
                fontSize: form.text_overlay_3_fontSize,
                bold: form.text_overlay_3_bold === true,
                underline: form.text_overlay_3_underline === true,
                italic: form.text_overlay_3_italic === true,
                textCase: form.text_overlay_3_textCase,
                color: form.text_overlay_3_color,
                characterSpacing: form.text_overlay_3_characterSpacing,
                lineSpacing: form.text_overlay_3_lineSpacing,
                alignment: form.text_overlay_3_alignment,
                style: form.text_overlay_3_style,
                scale: form.text_overlay_3_scale,
                position: form.text_overlay_3_position || 'bottom_right',
                rotation: form.text_overlay_3_rotation,
                opacity: form.text_overlay_3_opacity,
                hasStroke: form.text_overlay_3_hasStroke === true,
                strokeColor: form.text_overlay_3_strokeColor,
                strokeThickness: form.text_overlay_3_strokeThickness,
                hasBackground: form.text_overlay_3_hasBackground === true,
                backgroundColor: form.text_overlay_3_backgroundColor,
                backgroundOpacity: form.text_overlay_3_backgroundOpacity,
                backgroundRounded: form.text_overlay_3_backgroundRounded,
                backgroundStyle: form.text_overlay_3_backgroundStyle,
                backgroundHeight: form.text_overlay_3_backgroundHeight,
                backgroundWidth: form.text_overlay_3_backgroundWidth,
                backgroundYOffset: form.text_overlay_3_backgroundYOffset,
                backgroundXOffset: form.text_overlay_3_backgroundXOffset,
                animation: form.text_overlay_3_hasBackground ? form.text_overlay_3_animation : 'none',
                connected_background_data: (() => {
                  // Generate fresh at submission time for line-width style
                  if (form.text_overlay_3_hasBackground && form.text_overlay_3_backgroundStyle === 'line-width' && form.text_overlay_3_custom_text) {
                    return generateConnectedBackgroundData({
                      text: form.text_overlay_3_custom_text,
                      backgroundColor: form.text_overlay_3_backgroundColor,
                      backgroundOpacity: form.text_overlay_3_backgroundOpacity,
                      backgroundRounded: form.text_overlay_3_backgroundRounded,
                      backgroundHeight: form.text_overlay_3_backgroundHeight,
                      backgroundWidth: form.text_overlay_3_backgroundWidth,
                      lineSpacing: form.text_overlay_3_lineSpacing,
                      fontSize: form.text_overlay_3_fontSize,
                      style: {
                        fontWeight: form.text_overlay_3_bold ? 'bold' : 'normal',
                        fontStyle: form.text_overlay_3_italic ? 'italic' : 'normal',
                        fontFamily: form.text_overlay_3_font === 'custom' ? form.text_overlay_3_customFontName || 'System' : form.text_overlay_3_font || 'System',
                        color: form.text_overlay_3_color
                      }
                    });
                  }
                  return null;
                })(),
                // Design-space fields
                designWidth: videoDimensions.width,
                designHeight: videoDimensions.height,
                xPct: form.text_overlay_3_x_position || 70,
                yPct: form.text_overlay_3_y_position || 65,
                anchor: 'center',
                safeMarginsPct: { left: 4.0, right: 4.0, top: 5.0, bottom: 12.0 },
                font_size: (getFontPercentage(form.text_overlay_3_fontSize) / 100) * videoDimensions.height,
                borderPx: form.text_overlay_3_strokeThickness || 2,
                shadowPx: 0,
                lineSpacingPx: form.text_overlay_3_lineSpacing || 4,
                wrapWidthPct: 90
              }
            ],
            captions: {
              enabled: form.captions_enabled === true,
              template: form.captions_style || 'tiktok_classic',
              fontSize: (getFontPercentage(form.captions_fontSize) / 100) * videoDimensions.height,
              fontFamily: form.captions_fontFamily || 'Montserrat-Bold',
              x_position: form.captions_x_position || 50,
              y_position: form.captions_y_position || 85,
              color: form.captions_color || '#FFFFFF',
              hasStroke: form.captions_hasStroke !== undefined ? form.captions_hasStroke : true,
              strokeColor: form.captions_strokeColor || '#000000',
              strokeWidth: form.captions_strokeWidth || 2,
              max_words_per_segment: form.captions_max_words_per_segment || 4,
              allCaps: form.captions_allCaps || false,
              highlight_keywords: form.captions_highlight_keywords === true,
              processing_method: form.captions_processing_method,
              // Design-space fields
              designWidth: videoDimensions.width,
              designHeight: videoDimensions.height,
              xPct: form.captions_x_position || 50,
              yPct: form.captions_y_position || 85,
              anchor: 'center',
              safeMarginsPct: { left: 4.0, right: 4.0, top: 5.0, bottom: 12.0 },
              fontPx: form.captions_fontSize,
              borderPx: form.captions_hasStroke ? (form.captions_strokeWidth || 2) : 0,
              shadowPx: 0,
              hasBackground: form.captions_hasBackground || false,
              backgroundColor: form.captions_backgroundColor || '#000000',
              backgroundOpacity: form.captions_backgroundOpacity || 0.8,
              animation: form.captions_animation || 'none'
            },
            music: {
              enabled: form.music_enabled === true,
              track_id: form.music_track_id,
              volume: form.music_volume || 1.0,
              fade_duration: form.music_fade_duration !== undefined ? form.music_fade_duration : 2.0
            },
            // Caption source (voiceover or music) - Splice mode feature
            caption_source: form.caption_source || 'voiceover'
          },
          // Enhanced Splice video settings
          randomVideoSettings: {
            source_directory: form.sourceDirectory,
            total_clips: form.totalClips ? parseInt(form.totalClips) : null,
            hook_video: form.hookVideo || null,
            original_volume: parseFloat(form.originalVolume),
            voice_audio_volume: parseFloat(form.voiceAudioVolume),
            
            // NEW Splice features
            use_voiceover: form.splice_use_voiceover,
            duration_source: form.splice_duration_source,
            target_duration: form.splice_target_duration ? parseFloat(form.splice_target_duration) : null,
            
            canvas_width: parseInt(form.splice_canvas_width || 1080),
            canvas_height: parseInt(form.splice_canvas_height || 1920),
            crop_mode: form.splice_crop_mode || 'center',
            
            clip_duration_mode: form.splice_clip_duration_mode || 'full',
            clip_duration_fixed: form.splice_clip_duration_fixed ? parseFloat(form.splice_clip_duration_fixed) : null,
            clip_duration_range: form.splice_clip_duration_mode === 'random' ? [
              parseFloat(form.splice_clip_duration_min || 3),
              parseFloat(form.splice_clip_duration_max || 8)
            ] : null,
          },
          // Pass through edit flags
          isEdit: form.isEdit,
          isDuplicate: form.isDuplicate,
          id: form.id, // Pass through ID for edit operations
        };

        // Debug: Background settings for each text overlay
        spliceJobData.enhanced_settings.text_overlays.forEach((overlay, i) => {
          const bgEnabled = overlay.hasBackground;
          const bgStyle = overlay.backgroundStyle;
          const hasConnectedData = !!overlay.connected_background_data;

          // Log ALL settings being sent for overlays without backgrounds
          if (!bgEnabled) {

            // Show what the actual text will look like
          }
        });
        

        onSubmit(spliceJobData);

      } else {
        throw new Error('Invalid campaign type selected');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Check if current voice matches the avatar's voice
  const isVoiceFromAvatar = () => {
    if (!form.avatarId) return false;
    
    const selectedAvatar = avatars.find(a => a.id === form.avatarId);
    return selectedAvatar && 
           selectedAvatar.elevenlabs_voice_id && 
           selectedAvatar.elevenlabs_voice_id === form.elevenlabs_voice_id;
  };

  // Handle file browsing for directories and files
  const handleBrowseSourceDirectory = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true; // Allow directory selection
    input.onchange = (e) => {
      if (e.target.files.length > 0) {
        // Get the directory path from the first file
        const firstFile = e.target.files[0];
        const directoryPath = firstFile.webkitRelativePath.split('/')[0];
        // Get the full path by removing the filename from the first file's path
        const fullPath = firstFile.path ? firstFile.path.replace('/' + firstFile.name, '') : directoryPath;
        setForm(prev => ({ ...prev, sourceDirectory: fullPath }));
      }
    };
    input.click();
  };

  const handleBrowseHookVideo = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*'; // Accept video files
    input.onchange = (e) => {
      if (e.target.files.length > 0) {
        const file = e.target.files[0];
        const filePath = file.path || file.name; // Use file.path if available (Electron), otherwise file.name
        setForm(prev => ({ ...prev, hookVideo: filePath }));
      }
    };
    input.click();
  };
  
  return (
    <form id="new-campaign-form" onSubmit={handleSubmit} className="space-y-2">
      
      {/* Enhanced Video Settings */}
      <div>
        <EnhancedVideoSettings
          form={form}
          onChange={handleInputChange}
          disabled={isLoading}
          selectedAvatar={avatars.find(avatar => avatar.id === form.avatarId)}
          selectedScript={scripts.find(script => script.id === form.scriptId)}
          backendAvatars={backendAvatars}
          scripts={scripts}
          clips={clips}
          onVideoDimensionsDetected={handleVideoDimensionsDetected}
        />
      </div>
      
    </form>
  );
}

export default NewCampaignForm;