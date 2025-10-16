import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useStore } from '../store';
import { apiGet } from '../utils/api';
import ConnectedTextBackground from './ConnectedTextBackground';

// Styled slider component helper
const StyledSlider = ({ label, value, onChange, min = 0, max = 100, step = 1, suffix = '', disabled = false, darkMode = false }) => {
  const percentage = ((value - min) / (max - min)) * 100;
  
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className={`text-xs ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
          {label}
        </label>
        <span className={`text-xs font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
          {suffix.includes('% of video height') ? `${parseFloat(value).toFixed(1)}${suffix}` : `${value}${suffix}`}
        </span>
      </div>
      <div className="relative">
        {/* Track background */}
        <div className={`absolute top-1/2 -translate-y-1/2 w-full h-1 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`}>
          {/* Filled portion */}
          <div 
            className={`absolute h-full rounded-full ${darkMode ? 'bg-accent-500' : 'bg-accent-600'}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {/* Invisible range input */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="relative w-full h-1 opacity-0 cursor-pointer z-10"
        />
        {/* Custom thumb */}
        <div 
          className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow-md pointer-events-none ${darkMode ? 'bg-white border-gray-600' : 'bg-white border-gray-400'} border`}
          style={{ left: `${percentage}%`, transform: 'translateX(-50%) translateY(-50%)' }}
        />
      </div>
    </div>
  );
};

const EnhancedVideoSettings = ({
  form = {},
  onChange = () => {},
  disabled = false,
  selectedAvatar = null,
  selectedScript = null,
  backendAvatars = [],
  scripts = [],
  clips = [],
  onVideoDimensionsDetected = () => {} 
}) => {
  // State to store connected background export data
  const [connectedBackgroundData, setConnectedBackgroundData] = useState({});
  // Connect toggle to form data - use a master enabled field
  const isExpanded = true;

  const [musicLibrary, setMusicLibrary] = useState(null);
  const [availableTracks, setAvailableTracks] = useState([]);
  const [textOverlayExpanded, setTextOverlayExpanded] = useState({
    text1: false,
    text2: false,
    text3: false
  });
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [showTemplateNameModal, setShowTemplateNameModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [selectedTemplatePreview, setSelectedTemplatePreview] = useState(null);
  
  // Comprehensive template system state
  const [editingTemplates, setEditingTemplates] = useState([]);
  const [editingTemplateMode, setEditingTemplateMode] = useState('browse');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [selectedEditingTemplate, setSelectedEditingTemplate] = useState(null);

  // Video editor active tab state
  const [activeEditorTab, setActiveEditorTab] = useState(() =>
    form?.campaignType === 'splice' ? 'splice' : 'scripting'
  );

  // Zoom and pan state variables
  const [canvasZoom, setCanvasZoom] = useState(100);
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [gridMode, setGridMode] = useState('grid'); // 'none', 'grid', 'guides', 'both'
  const [showGridDropdown, setShowGridDropdown] = useState(false);
  const [snapToGuides, setSnapToGuides] = useState(true);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const gridButtonRef = useRef(null);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const [artboardSize, setArtboardSize] = useState({ width: 300, height: 533 }); // Default fallback

  const darkMode = useStore(state => state.darkMode);

  // Zoom levels and functions
  const zoomLevels = [25, 50, 75, 100, 125, 150, 200, 300, 400];

  const handleZoomIn = () => {
    const currentIndex = zoomLevels.indexOf(canvasZoom);
    if (currentIndex < zoomLevels.length - 1) {
      setCanvasZoom(zoomLevels[currentIndex + 1]);
    }
  };

  const handleZoomOut = () => {
    const currentIndex = zoomLevels.indexOf(canvasZoom);
    if (currentIndex > 0) {
      setCanvasZoom(zoomLevels[currentIndex - 1]);
    }
  };

  const handleZoomFit = () => {
    setCanvasZoom(100);
    setCanvasPan({ x: 0, y: 0 });
  };

  // Mouse wheel zoom with reduced sensitivity
  const handleWheel = (e) => {
    e.preventDefault();
    const scrollSensitivity = 0.002; // Much lower sensitivity for smoother zoom

    const deltaMultiplier = e.deltaY > 0 ? -1 : 1;
    const zoomChange = canvasZoom * scrollSensitivity * Math.abs(e.deltaY) * deltaMultiplier;
    const newZoom = Math.max(25, Math.min(400, canvasZoom + zoomChange));

    setCanvasZoom(Math.round(newZoom));
  };

  // Pan functionality
  const handleMouseDown = (e) => {
    if (canvasZoom > 100) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - canvasPan.x, y: e.clientY - canvasPan.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning && canvasZoom > 100) {
      let newX = e.clientX - panStart.x;
      let newY = e.clientY - panStart.y;

      // Auto-snap to center guides if enabled
      if (snapToGuides && (gridMode === 'guides' || gridMode === 'both')) {
        const snapThreshold = 10; // pixels
        if (Math.abs(newX) < snapThreshold) newX = 0; // Snap to center X
        if (Math.abs(newY) < snapThreshold) newY = 0; // Snap to center Y
      }

      setCanvasPan({ x: newX, y: newY });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Get actual video dimensions when metadata loads
  const handleVideoLoadedMetadata = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const actualWidth = video.videoWidth;
      const actualHeight = video.videoHeight;

      // Scale down to a reasonable preview size while maintaining aspect ratio
      const maxPreviewWidth = 400;
      const aspectRatio = actualWidth / actualHeight;

      let previewWidth, previewHeight;
      if (aspectRatio > 1) {
        // Landscape
        previewWidth = Math.min(maxPreviewWidth, actualWidth * 0.3);
        previewHeight = previewWidth / aspectRatio;
      } else {
        // Portrait or square
        previewHeight = Math.min(maxPreviewWidth / aspectRatio, actualHeight * 0.3);
        previewWidth = previewHeight * aspectRatio;
      }

      setArtboardSize({
        width: Math.round(previewWidth),
        height: Math.round(previewHeight),
        actualWidth,
        actualHeight
      });

      // Notify parent component of actual video dimensions
      onVideoDimensionsDetected({
        width: actualWidth,
        height: actualHeight
      });
    }
  };

  // Update active tab when campaign type changes (only on campaign type change, not tab change)
  useEffect(() => {
    if (form?.campaignType === 'splice' && activeEditorTab !== 'splice') {
      setActiveEditorTab('splice');
    } else if (form?.campaignType === 'avatar' && activeEditorTab === 'splice') {
      setActiveEditorTab('scripting');
    }
  }, [form?.campaignType]); // Removed activeEditorTab from dependencies
  
  // Update artboard size for Splice canvas dimensions
  useEffect(() => {
    if (form?.campaignType === 'splice') {
      // Removed debug logging
      
      const width = parseInt(form.splice_canvas_width) || 1080;
      const height = parseInt(form.splice_canvas_height) || 1920;
      
      // Canvas update
      
      // Calculate preview size (max 400px width, maintain aspect ratio)
      const maxPreviewWidth = 400;
      const aspectRatio = width / height;
      
      let previewWidth, previewHeight;
      if (aspectRatio > 1) {
        // Landscape
        previewWidth = Math.min(maxPreviewWidth, width * 0.3);
        previewHeight = previewWidth / aspectRatio;
      } else {
        // Portrait or square
        previewHeight = Math.min(maxPreviewWidth / aspectRatio, height * 0.3);
        previewWidth = previewHeight * aspectRatio;
      }
      
      const newArtboard = {
        width: Math.round(previewWidth),
        height: Math.round(previewHeight),
        actualWidth: width,
        actualHeight: height
      };
      
      // Setting artboard
      
      setArtboardSize(newArtboard);
    }
  }, [form?.campaignType, form?.splice_canvas_width, form?.splice_canvas_height]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showGridDropdown && !event.target.closest('.grid-dropdown')) {
        setShowGridDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showGridDropdown]);

  // Manual wheel event listener to avoid passive event warnings
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheelEvent = (e) => {
      e.preventDefault();
      const scrollSensitivity = 0.002;

      const deltaMultiplier = e.deltaY > 0 ? -1 : 1;
      const zoomChange = canvasZoom * scrollSensitivity * Math.abs(e.deltaY) * deltaMultiplier;
      const newZoom = Math.max(25, Math.min(400, canvasZoom + zoomChange));

      setCanvasZoom(Math.round(newZoom));
    };

    canvas.addEventListener('wheel', handleWheelEvent, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheelEvent);
  }, [canvasZoom]);

  // Reset artboard size when avatar changes
  useEffect(() => {
    if (!selectedAvatar || !selectedAvatar.filePath) {
      setArtboardSize({ width: 300, height: 533 }); // Reset to default
    }
  }, [selectedAvatar]);

  // Load music library and templates when component mounts
  useEffect(() => {
    loadMusicLibrary();
    loadSavedTemplates();
    loadEditingTemplates();
  }, []);

  // Temporarily removed useEffect to debug toggle issue

  const loadSavedTemplates = () => {
    const templates = JSON.parse(localStorage.getItem('textOverlayTemplates') || '[]');
    setSavedTemplates(templates);
  };

  const loadMusicLibrary = async () => {
    try {
      const response = await apiGet('/api/enhancements/music/library');
      setMusicLibrary(response);
      
      // Flatten tracks from all categories
      let allTracks = [];
      Object.values(response.tracks_by_category || {}).forEach(categoryTracks => {
        allTracks = allTracks.concat(categoryTracks);
      });
      setAvailableTracks(allTracks);
    } catch (error) {
      console.error('Failed to load music library:', error);
      setAvailableTracks([]);
    }
  };

  // Simple wrapper to create form input changes
  const handleSettingChange = (section, property, value, overlayIndex = null) => {
    // Convert nested property to flat form property name
    let formPropertyName = `${section}_${property}`;

    // Handle background toggle changes
    if (section.includes('text_overlay') && property === 'hasBackground') {
      // Extract overlay index from section name
      let overlayIdx;
      if (section === 'text_overlay') {
        overlayIdx = 1;
      } else {
        const match = section.match(/text_overlay_(\d+)/);
        overlayIdx = match ? parseInt(match[1]) : 1;
      }

      if (!value) {
        // If disabling background, clear connected background data
        setConnectedBackgroundData(prev => ({
          ...prev,
          [overlayIdx]: null
        }));
      } else {
        // If enabling background, automatically set backgroundStyle to 'line-width'
        const stylePropertyName = section + '_backgroundStyle';
        onChange({
          target: {
            name: stylePropertyName,
            value: 'line-width',
            type: 'text'
          }
        });
      }
    }

    onChange({
      target: {
        name: formPropertyName,
        value: value,
        type: typeof value === 'boolean' ? 'checkbox' : 'text',
        checked: value
      }
    });
  };
  

  // Handle connected background export data
  const handleConnectedBackgroundExport = (index, exportData) => {
    if (!exportData) {
      return;
    }

    // Store the export data in state
    setConnectedBackgroundData(prev => ({
      ...prev,
      [index]: exportData
    }));

    // Also update the form to include connected background data
    const prefix = index === 1 ? 'text_overlay' : `text_overlay_${index}`;
    onChange({
      target: {
        name: `${prefix}_connected_background_data`,
        value: exportData,
        type: 'connected_background'
      }
    });

  };

  const handleTextOverlayToggle = (e) => {
    // Simply toggle the master text overlay enable/disable
    // Don't interfere with individual text overlay enabled states
    onChange(e);
  };

  const handleSaveTemplate = () => {
    setNewTemplateName('');
    setShowTemplateNameModal(true);
  };

  const handleSaveTemplateConfirm = () => {
    if (!newTemplateName.trim()) return;

    // Extract all text overlay settings
    const template = {
      id: Date.now().toString(),
      name: newTemplateName.trim(),
      createdAt: new Date().toISOString(),
      textOverlays: [1, 2, 3].map(index => {
        const settings = getTextOverlaySettings(index);
        return {
          enabled: settings.enabled,
          custom_text: settings.custom_text,
          font: settings.font,
          fontSize: settings.fontSize,
          bold: settings.bold,
          underline: settings.underline,
          italic: settings.italic,
          color: settings.color,
          characterSpacing: settings.characterSpacing,
          lineSpacing: settings.lineSpacing,
          alignment: settings.alignment,
          style: settings.style,
          scale: settings.scale,
          x_position: settings.x_position,
          y_position: settings.y_position,
          rotation: settings.rotation,
          opacity: settings.opacity,
          hasStroke: settings.hasStroke,
          strokeColor: settings.strokeColor,
          strokeThickness: settings.strokeThickness,
          hasBackground: settings.hasBackground,
          backgroundColor: settings.backgroundColor,
          backgroundOpacity: settings.backgroundOpacity,
          backgroundRounded: settings.backgroundRounded,
          backgroundHeight: settings.backgroundHeight,
          backgroundWidth: settings.backgroundWidth,
          backgroundXOffset: settings.backgroundXOffset,
          backgroundStyle: settings.backgroundStyle,
          animation: settings.animation
        };
      })
    };

    // Save to localStorage
    const existingTemplates = JSON.parse(localStorage.getItem('textOverlayTemplates') || '[]');
    existingTemplates.push(template);
    localStorage.setItem('textOverlayTemplates', JSON.stringify(existingTemplates));
    
    // Refresh the templates list
    loadSavedTemplates();
    
    // Close modal and reset
    setShowTemplateNameModal(false);
    setNewTemplateName('');
  };

  const handleApplyTemplate = (template) => {
    if (!template || !template.textOverlays) return;

    // Build the bulk update object
    const updates = {};
    
    template.textOverlays.forEach((overlay, index) => {
      const overlayIndex = index + 1;
      const prefix = overlayIndex === 1 ? 'text_overlay' : `text_overlay_${overlayIndex}`;
      
      // Apply all settings from the template
      Object.entries(overlay).forEach(([key, value]) => {
        updates[`${prefix}_${key}`] = value;
      });
    });

    // Apply the template using bulk update
    const syntheticEvent = {
      target: {
        name: 'BULK_UPDATE_TEMPLATE',
        value: updates,
        type: 'bulk'
      }
    };
    onChange(syntheticEvent);
  };

  const handleDeleteTemplate = (templateId) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    const templates = JSON.parse(localStorage.getItem('textOverlayTemplates') || '[]');
    const filteredTemplates = templates.filter(t => t.id !== templateId);
    localStorage.setItem('textOverlayTemplates', JSON.stringify(filteredTemplates));
    loadSavedTemplates();
  };

  // ========== Comprehensive Editing Template Functions ==========
  
  const loadEditingTemplates = () => {
    const templates = JSON.parse(localStorage.getItem('automatedEditingTemplates') || '[]');
    setEditingTemplates(templates);
  };

  const saveEditingTemplate = () => {
    if (!newTemplateName.trim()) {
      return; // Just return silently if no name
    }

    const template = {
      id: `template-${Date.now()}`,
      name: newTemplateName.trim(),
      description: newTemplateDescription.trim() || 'No description',
      createdAt: new Date().toISOString(),
      settings: {
        // Copy ALL form fields that are editing-related
        ...Object.fromEntries(
          Object.entries(form).filter(([key]) => 
            key.startsWith('automated_video_editing_') ||
            key.startsWith('text_overlay') ||
            key.startsWith('captions_') ||
            key.startsWith('music_')
          )
        )
      }
    };

    // Save to localStorage
    const existingTemplates = JSON.parse(localStorage.getItem('automatedEditingTemplates') || '[]');
    existingTemplates.push(template);
    localStorage.setItem('automatedEditingTemplates', JSON.stringify(existingTemplates));
    
    // Reset and reload
    setNewTemplateName('');
    setNewTemplateDescription('');
    setEditingTemplateMode('browse');
    loadEditingTemplates();
  };

  const loadEditingTemplate = (templateId) => {
    const templates = JSON.parse(localStorage.getItem('automatedEditingTemplates') || '[]');
    const template = templates.find(t => t.id === templateId);
    
    if (template && template.settings) {
      // Apply ALL settings from the template
      Object.keys(template.settings).forEach(key => {
        const value = template.settings[key];
        onChange({ 
          target: { 
            name: key, 
            value: value,
            type: typeof value === 'boolean' ? 'checkbox' : 'text',
            checked: value
          } 
        });
      });
      
      setSelectedEditingTemplate(template);
    }
  };

  const handleApplyEditingTemplate = (template) => {
    if (!template || !template.settings) return;

    // Apply the template using bulk update (same as text templates)
    const syntheticEvent = {
      target: {
        name: 'BULK_UPDATE_TEMPLATE',
        value: template.settings,
        type: 'bulk'
      }
    };
    onChange(syntheticEvent);
    
    // Clear the selection after applying
    setSelectedEditingTemplate(null);
  };

  const deleteEditingTemplate = (templateId) => {
    const templates = JSON.parse(localStorage.getItem('automatedEditingTemplates') || '[]');
    const filteredTemplates = templates.filter(t => t.id !== templateId);
    localStorage.setItem('automatedEditingTemplates', JSON.stringify(filteredTemplates));
    loadEditingTemplates();
    
    if (selectedEditingTemplate?.id === templateId) {
      setSelectedEditingTemplate(null);
    }
  };

  // Helper function to get text overlay settings for a specific index
  const getTextOverlaySettings = (index) => {
    const prefix = index === 1 ? 'text_overlay' : `text_overlay_${index}`;
    // For text 1, use text_overlay_1_enabled to avoid collision with master toggle
    const enabledKey = index === 1 ? 'text_overlay_1_enabled' : `${prefix}_enabled`;
    const xPos = form[`${prefix}_x_position`] || (index === 1 ? 50 : index === 2 ? 30 : 70);
    const yPos = form[`${prefix}_y_position`] || (index === 1 ? 18 : index === 2 ? 35 : 65);

    return {
      enabled: form[enabledKey] || false,
      mode: form[`${prefix}_mode`] || 'custom',
      custom_text: form[`${prefix}_custom_text`] || '',
      category: form[`${prefix}_category`] || 'engagement',
      font: form[`${prefix}_font`] || 'System',
      customFontName: form[`${prefix}_customFontName`] || '',
      fontSize: form[`${prefix}_fontSize`] || 20,
      bold: form[`${prefix}_bold`] || false,
      underline: form[`${prefix}_underline`] || false,
      italic: form[`${prefix}_italic`] || false,
      textCase: form[`${prefix}_textCase`] || 'none',
      color: form[`${prefix}_color`] || '#000000',
      characterSpacing: form[`${prefix}_characterSpacing`] || 0,
      lineSpacing: form[`${prefix}_lineSpacing`] || -1,
      alignment: form[`${prefix}_alignment`] || 'center',
      style: form[`${prefix}_style`] || 'default',
      scale: form[`${prefix}_scale`] || 100,
      x_position: xPos,
      y_position: yPos,
      rotation: form[`${prefix}_rotation`] || 0,
      opacity: form[`${prefix}_opacity`] || 100,
      hasStroke: form[`${prefix}_hasStroke`] !== undefined ? form[`${prefix}_hasStroke`] : false,
      strokeColor: form[`${prefix}_strokeColor`] || '#000000',
      strokeThickness: form[`${prefix}_strokeThickness`] || 2,
      hasBackground: form[`${prefix}_hasBackground`] !== undefined ? form[`${prefix}_hasBackground`] : true,
      backgroundColor: form[`${prefix}_backgroundColor`] || '#ffffff',
      backgroundOpacity: form[`${prefix}_backgroundOpacity`] !== undefined ? form[`${prefix}_backgroundOpacity`] : 100,
      backgroundRounded: form[`${prefix}_backgroundRounded`] || 7,
      backgroundStyle: form[`${prefix}_backgroundStyle`] || 'line-width',
      backgroundHeight: form[`${prefix}_backgroundHeight`] !== undefined ? form[`${prefix}_backgroundHeight`] : 40,
      backgroundWidth: form[`${prefix}_backgroundWidth`] !== undefined ? form[`${prefix}_backgroundWidth`] : 50,
      backgroundYOffset: form[`${prefix}_backgroundYOffset`] || 0,
      backgroundXOffset: form[`${prefix}_backgroundXOffset`] || 0,
      animation: form[`${prefix}_animation`] || 'fade_in',
      // Design-space fields for unified scaling model
      designWidth: designWidth,
      designHeight: designHeight,
      xPct: xPos,
      yPct: yPos,
      anchor: 'center',
      safeMarginsPct: { left: 4, right: 4, top: 5, bottom: 12 },
      font_size: getFontPixelsFromPercentage(getFontPercentage(form[`${prefix}_fontSize`])),
      borderPx: form[`${prefix}_hasStroke`] ? (form[`${prefix}_strokeThickness`] || 2) : 0,
      shadowPx: 2,
      lineSpacingPx: Math.max(0, (form[`${prefix}_lineSpacing`] || -1) + 5),
      wrapWidthPct: 80
    };
  };

  // Get design space dimensions from artboard (actual video dimensions)
  const designWidth = artboardSize?.actualWidth || 1080;
  const designHeight = artboardSize?.actualHeight || 1920;

  // Helper functions for percentage-based font sizing
  const pixelToPercentage = (pixelSize, videoHeight) => {
    return (pixelSize / videoHeight) * 100;
  };

  const percentageToPixel = (percentage, videoHeight) => {
    return (percentage / 100) * videoHeight;
  };

  const getFontPercentage = (pixelSize) => {
    return pixelToPercentage(pixelSize || 20, designHeight);
  };

  const getFontPixelsFromPercentage = (percentage) => {
    return percentageToPixel(percentage, designHeight);
  };

  // Temporary: reconstruct currentSettings from form for parts not yet converted
  const currentSettings = {
    text_overlay: getTextOverlaySettings(1),
    text_overlay_2: getTextOverlaySettings(2),
    text_overlay_3: getTextOverlaySettings(3),
    captions: {
      enabled: form.captions_enabled || false,
      template: form.captions_template || 'tiktok_classic',
      fontFamily: form.captions_fontFamily || 'Montserrat-Bold',
      x_position: form.captions_x_position || 50,
      y_position: form.captions_y_position || 85,
      color: form.captions_color || '#FFFFFF',
      hasStroke: form.captions_hasStroke !== undefined ? form.captions_hasStroke : true,
      strokeColor: form.captions_strokeColor || '#000000',
      strokeWidth: form.captions_strokeWidth || 3,
      hasBackground: form.captions_hasBackground || false,
      backgroundColor: form.captions_backgroundColor || '#000000',
      backgroundOpacity: form.captions_backgroundOpacity || 0.8,
      animation: form.captions_animation || 'none',
      highlight_keywords: form.captions_highlight_keywords !== undefined ? form.captions_highlight_keywords : true,
      max_words_per_segment: form.captions_max_words_per_segment || 4,
      allCaps: form.captions_allCaps || false,
      // Design-space fields for unified scaling model
      designWidth: designWidth,
      designHeight: designHeight,
      xPct: form.captions_x_position || 50,
      yPct: form.captions_y_position || 85,
      anchor: 'center',
      safeMarginsPct: { left: 4, right: 4, top: 5, bottom: 12 },
      fontSize: getFontPixelsFromPercentage(getFontPercentage(form.captions_fontSize)),
      borderPx: form.captions_hasStroke ? (form.captions_strokeWidth || 3) : 0,
      shadowPx: 0,
      // Keep legacy properties for backward compatibility
      style: form.captions_style || 'tiktok_classic',
      position: form.captions_position || 'bottom_center',
      size: form.captions_size || 'medium',
      processing_method: form.captions_processing_method || 'auto'
    },
    music: {
      enabled: form.music_enabled || false,
      track_id: form.music_track_id || 'random_upbeat',
      volume: form.music_volume !== undefined ? form.music_volume : 0.6,
      fade_duration: form.music_fade_duration !== undefined ? form.music_fade_duration : 2.0
    }
  };

  // Helper functions for preview positioning and styling
  const getOverlayPosition = () => {
    const x = form.text_overlay_x_position || 50;
    const y = form.text_overlay_y_position || 50;
    return {
      left: `${x}%`,
      top: `${y}%`
    };
  };

  const getCaptionPosition = (position) => {
    const positions = {
      'top_center': 'top-12 left-1/2 transform -translate-x-1/2',
      'middle_center': 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2',
      'bottom_center': 'bottom-12 left-1/2 transform -translate-x-1/2'
    };
    return positions[position] || positions['bottom_center'];
  };

  const getCaptionSize = (size) => {
    const sizes = {
      'small': 'text-xs',
      'medium': 'text-sm',
      'large': 'text-base'
    };
    return sizes[size] || sizes['medium'];
  };

  const getCaptionStyle = (style) => {
    const styles = {
      'tiktok_classic': 'text-white drop-shadow-lg',
      'bold_statement': 'text-yellow-400 font-extrabold drop-shadow-lg',
      'minimal_clean': 'text-white',
      'neon_glow': 'text-cyan-300 drop-shadow-glow',
      'typewriter': 'text-white font-mono',
      'pop_up': 'text-white font-bold animate-bounce',
      'slide_up': 'text-white'
    };
    return styles[style] || styles['tiktok_classic'];
  };

  const getTemplatePreview = (category) => {
    const templates = {
      'engagement': 'Try this!',
      'curiosity': 'Wait for it...',
      'urgency': 'Limited time!',
      'emotion': 'Amazing!',
      'question': 'Did you know?',
      'trending': 'POV:'
    };
    return templates[category] || 'Try this!';
  };

  return (
    <div>
        <div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Settings Panel */}
            <div className="lg:col-span-2 space-y-4">


          {/* Text Overlays Section - Moved to Video Editor */}
          <div className="hidden">
            <div className="flex items-center mt-2 mb-4">
              <input
                type="checkbox"
                id="textOverlayEnabledOld"
                name="text_overlay_enabled_old"
                checked={false}
                className="h-4 w-4 rounded border-primary-300 text-accent-600 focus:ring-accent-500"
                disabled={true}
              />
              <label htmlFor="textOverlayEnabledOld" className={`ml-2 block text-sm ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                Moved to Video Editor
              </label>
            </div>

            {false && (
              <div className={`rounded-lg p-4 ${darkMode ? 'bg-neutral-900' : 'bg-neutral-100'}`}>
                {/* Tab Navigation */}
                <div className="flex mb-4">
                  <button
                    type="button"
                    onClick={() => onChange({target: {name: 'text_overlay_mode', value: 'custom', type: 'text'}})}
                    className={`flex-1 py-2 text-sm font-medium rounded-l-md transition-colors
                      ${(form.text_overlay_mode || 'custom') === 'custom'
                        ? darkMode ? 'bg-zinc-700 text-primary-100' : 'bg-white text-primary-900'
                        : darkMode ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-200 text-gray-600'
                      }`}
                  >
                    Custom
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({target: {name: 'text_overlay_mode', value: 'ai_generated', type: 'text'}})}
                    className={`flex-1 py-2 text-sm font-medium rounded-r-md transition-colors
                      ${form.text_overlay_mode === 'ai_generated'
                        ? darkMode ? 'bg-zinc-700 text-primary-100' : 'bg-white text-primary-900'
                        : darkMode ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-200 text-gray-600'
                      }`}
                  >
                    AI Generated
                  </button>
                </div>

                {/* Multiple Custom Text Overlays */}
                {(form.text_overlay_mode || 'custom') === 'custom' && (
                  <div className="space-y-3">
                    {[1, 2, 3].map((index) => {
                      const overlaySettings = getTextOverlaySettings(index);
                      const isExpanded = textOverlayExpanded[index] ?? false;
                      
                      return (
                        <div
                          key={index}
                          className={`border rounded-lg ${darkMode ? 'border-zinc-600 bg-zinc-800' : 'border-gray-300 bg-white'}`}
                        >
                          {/* Card Header */}
                          <div
                            className={`p-3 flex items-center justify-between cursor-pointer select-none ${darkMode ? 'hover:bg-zinc-700' : 'hover:bg-gray-50'} rounded-t-lg`}
                            onClick={() => setTextOverlayExpanded(prev => ({ ...prev, [index]: !isExpanded }))}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={overlaySettings.enabled}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  // For text 1, use text_overlay_1_enabled to avoid collision with master toggle
                                  const fieldName = index === 1 ? 'text_overlay_1' : `text_overlay_${index}`;
                                  handleSettingChange(fieldName, 'enabled', e.target.checked);
                                }}
                                className="h-4 w-4 rounded border-primary-300 text-accent-600 focus:ring-accent-500"
                                disabled={disabled}
                              />
                              <span className={`font-medium text-sm ${darkMode ? 'text-primary-200' : 'text-primary-800'}`}>
                                Text {index}
                              </span>
                              {overlaySettings.custom_text && (
                                <span className={`text-xs px-2 py-1 rounded ${darkMode ? 'bg-zinc-700 text-zinc-300' : 'bg-gray-100 text-gray-600'}`}>
                                  {overlaySettings.custom_text.substring(0, 20)}{overlaySettings.custom_text.length > 20 ? '...' : ''}
                                </span>
                              )}
                            </div>
                            <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>

                          {/* Collapsible Content */}
                          {isExpanded && (
                            <div className={`p-3 pt-3 border-t ${darkMode ? 'border-zinc-600' : 'border-gray-200'}`}>
                              <div className="space-y-4">
                                {/* Text Input */}
                                <textarea
                                  name={`text_overlay${index === 1 ? '' : `_${index}`}_custom_text`}
                                  value={overlaySettings.custom_text || ''}
                                  onChange={onChange}
                                  placeholder="Enter your text... (Shift+Enter for new line)"
                                  rows={3}
                                  className={`w-full px-3 py-2 rounded-md text-sm resize-none
                                    ${darkMode
                                      ? 'border-zinc-600 text-primary-100 placeholder-zinc-400'
                                      : 'bg-white border-gray-300 text-primary-900 placeholder-gray-400'
                                    } border`}
                                  style={{ backgroundColor: darkMode ? '#303030' : undefined }}
                                  disabled={disabled}
                                />

                                {/* Font Selection */}
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <label className={`text-xs ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                                      Font
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const message = `📝 FONT GUIDE:

🎯 PREMIUM FONTS:
• Purchase fonts from Adobe, Google, Monotype, etc.
• Install .otf/.ttf/.woff files on your system
• Restart this app → Font options will work!

📁 CUSTOM FONTS (Any Font):
1. Install any font on your system
2. Select "🎨 Custom Font..." from dropdown
3. Type the exact font name as it appears in your system
4. Examples: "SF Pro Display", "Avenir Next", "Helvetica Neue"

💡 HOW TO FIND FONT NAMES:
• Mac: Font Book app → Shows exact names
• Windows: Settings → Fonts → Shows font names
• The name must match EXACTLY (including spaces)

✨ INCLUDED FONTS:
• Inter → Modern, readable
• Montserrat → Clean, geometric
• Poppins → Friendly, rounded
• Plus all your system fonts!

🔥 PRO TIP: Try common variations like "FontName Bold", "FontName Light", "FontName Semibold"`;
                                        alert(message);
                                      }}
                                      className={`text-xs px-1 py-0.5 rounded ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'}`}
                                      title="Font Help"
                                    >
                                      ?
                                    </button>
                                  </div>
                                  <select
                                    name={`text_overlay${index === 1 ? '' : `_${index}`}_font`}
                                    value={overlaySettings.font || 'System'}
                                    onChange={onChange}
                                    className={`w-full rounded-md text-sm px-3 py-2
                                      ${darkMode 
                                        ? 'bg-zinc-700 border-zinc-600 text-primary-100'
                                        : 'bg-white border-gray-300 text-primary-900'
                                      } border`}
                                    disabled={disabled}
                                  >
                                    <option value="System">System</option>
                                    <option value="Proxima Nova, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif">Proxima Nova</option>
                                    <option value="ProximaNova-Semibold, Proxima Nova Semibold, ProximaNovA-Semibold, Proxima Nova Semi Bold, Proxima Nova, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif">Proxima Nova Semibold</option>
                                    <option value="ProximaNova-Bold">Proxima Nova Bold</option>
                                    <option value="ProximaNova-Light">Proxima Nova Light</option>
                                    <option value="Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif">Inter</option>
                                    <option value="Poppins, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif">Poppins</option>
                                    <option value="Montserrat, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif">Montserrat</option>
                                    <option value="Arial">Arial</option>
                                    <option value="Helvetica">Helvetica</option>
                                    <option value="Impact">Impact</option>
                                    <option value="Georgia">Georgia</option>
                                    <option value="custom">🎨 Custom Font...</option>
                                  </select>
                                  
                                  {/* Custom Font Input */}
                                  {overlaySettings.font === 'custom' && (
                                    <div className="mt-2">
                                      <input
                                        type="text"
                                        placeholder="Enter exact font name (e.g., Proxima Nova Condensed)"
                                        value={overlaySettings.customFontName || ''}
                                        onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'customFontName', e.target.value)}
                                        className={`w-full px-3 py-2 rounded-md text-sm border
                                          ${darkMode 
                                            ? 'bg-zinc-700 border-zinc-600 text-primary-100 placeholder-zinc-400'
                                            : 'bg-white border-gray-300 text-primary-900 placeholder-gray-400'
                                          }`}
                                        disabled={disabled}
                                      />
                                      <p className={`text-xs mt-1 ${darkMode ? 'text-zinc-400' : 'text-gray-500'}`}>
                                        Font must be installed on your system
                                      </p>
                                    </div>
                                  )}
                                </div>

                                {/* Font Size */}
                                <StyledSlider
                                  label="Font size"
                                  value={getFontPercentage(overlaySettings.fontSize)}
                                  onChange={(e) => {
                                    const percentage = parseFloat(e.target.value);
                                    const pixelSize = Math.round(getFontPixelsFromPercentage(percentage));
                                    handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'fontSize', pixelSize);
                                  }}
                                  min={0.5}
                                  max={15.0}
                                  step={0.1}
                                  suffix="% of video height"
                                  disabled={disabled}
                                  darkMode={darkMode}
                                />

                                {/* Text Formatting */}
                                <div>
                                  <label className={`block text-xs mb-2 ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                                    Pattern
                                  </label>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'bold', !overlaySettings.bold)}
                                      className={`px-3 py-1 text-sm font-bold rounded
                                        ${overlaySettings.bold
                                          ? darkMode ? 'bg-zinc-600 text-primary-100' : 'bg-white text-primary-900 border border-gray-400'
                                          : darkMode ? 'bg-zinc-700 text-zinc-400' : 'bg-gray-100 text-gray-600'
                                        }`}
                                    >
                                      B
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'underline', !overlaySettings.underline)}
                                      className={`px-3 py-1 text-sm underline rounded
                                        ${overlaySettings.underline
                                          ? darkMode ? 'bg-zinc-600 text-primary-100' : 'bg-white text-primary-900 border border-gray-400'
                                          : darkMode ? 'bg-zinc-700 text-zinc-400' : 'bg-gray-100 text-gray-600'
                                        }`}
                                    >
                                      U
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'italic', !overlaySettings.italic)}
                                      className={`px-3 py-1 text-sm italic rounded
                                        ${overlaySettings.italic
                                          ? darkMode ? 'bg-zinc-600 text-primary-100' : 'bg-white text-primary-900 border border-gray-400'
                                          : darkMode ? 'bg-zinc-700 text-zinc-400' : 'bg-gray-100 text-gray-600'
                                        }`}
                                    >
                                      I
                                    </button>
                                  </div>
                                </div>


                                {/* Color Picker */}
                                <div>
                                  <label className={`block text-xs mb-2 ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                                    Color
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="color"
                                      value={overlaySettings.color || '#000000'}
                                      onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'color', e.target.value)}
                                      className="w-10 h-10 rounded cursor-pointer"
                                    />
                                    <input
                                      type="text"
                                      value={overlaySettings.color || '#000000'}
                                      onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'color', e.target.value)}
                                      className={`flex-1 px-2 py-1 rounded text-sm ${darkMode ? 'bg-zinc-700 text-zinc-300' : 'bg-gray-100 text-gray-700'}`}
                                    />
                                  </div>
                                </div>

                                {/* Stroke Section */}
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <input
                                      type="checkbox"
                                      checked={overlaySettings.hasStroke || false}
                                      onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'hasStroke', e.target.checked)}
                                      className="w-4 h-4"
                                    />
                                    <label className={`text-xs ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                                      Text Stroke
                                    </label>
                                  </div>

                                  {overlaySettings.hasStroke && (
                                    <div className="ml-6 space-y-3">
                                      {/* Stroke Color */}
                                      <div>
                                        <label className={`block text-xs mb-1 ${darkMode ? 'text-primary-500' : 'text-primary-500'}`}>
                                          Stroke Color
                                        </label>
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="color"
                                            value={overlaySettings.strokeColor || '#000000'}
                                            onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'strokeColor', e.target.value)}
                                            className="w-8 h-8 rounded cursor-pointer"
                                          />
                                          <input
                                            type="text"
                                            value={overlaySettings.strokeColor || '#000000'}
                                            onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'strokeColor', e.target.value)}
                                            className={`flex-1 px-2 py-1 rounded text-sm ${darkMode ? 'bg-zinc-700 text-zinc-300 border-zinc-600' : 'bg-white text-gray-700 border-gray-300'} border`}
                                          />
                                        </div>
                                      </div>

                                      {/* Stroke Thickness */}
                                      <StyledSlider
                                        label="Stroke Size"
                                        value={overlaySettings.strokeThickness || 2}
                                        onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'strokeThickness', parseFloat(e.target.value))}
                                        min={0.5}
                                        max={8}
                                        step={0.5}
                                        suffix=""
                                        disabled={disabled}
                                        darkMode={darkMode}
                                      />
                                    </div>
                                  )}
                                </div>

                                {/* Character & Line Spacing */}
                                <div className="grid grid-cols-2 gap-3">
                                  <StyledSlider
                                    label="Character"
                                    value={Math.round(((overlaySettings.characterSpacing || 0) / 20) * 100)}
                                    onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'characterSpacing', Math.round((parseInt(e.target.value) / 100) * 20))}
                                    min={0}
                                    max={100}
                                    suffix="%"
                                    disabled={disabled}
                                    darkMode={darkMode}
                                  />
                                  <StyledSlider
                                    label="Line"
                                    value={Math.round(((overlaySettings.lineSpacing || 0) + 4) / 24 * 100)}
                                    onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'lineSpacing', Math.round((parseInt(e.target.value) / 100) * 24 - 4))}
                                    min={0}
                                    max={100}
                                    suffix="%"
                                    disabled={disabled}
                                    darkMode={darkMode}
                                  />
                                </div>

                                {/* Alignment */}
                                <div>
                                  <label className={`block text-xs mb-2 ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                                    Alignment
                                  </label>
                                  <div className="flex gap-1">
                                    {['left', 'center', 'right', 'justify'].map((align) => (
                                      <button
                                        key={align}
                                        type="button"
                                        onClick={() => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'alignment', align)}
                                        className={`flex-1 py-1 px-2 text-xs rounded
                                          ${overlaySettings.alignment === align
                                            ? darkMode ? 'bg-zinc-600 text-primary-100' : 'bg-white text-primary-900 border border-gray-400'
                                            : darkMode ? 'bg-zinc-700 text-zinc-400' : 'bg-gray-100 text-gray-600'
                                          }`}
                                      >
                                        {align === 'left' && '⬅'}
                                        {align === 'center' && '⬌'}
                                        {align === 'right' && '➡'}
                                        {align === 'justify' && '☰'}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {/* Preset Styles Grid */}
                                <div>
                                  <label className={`block text-xs mb-2 ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                                    Preset style
                                  </label>
                                  <div className="grid grid-cols-5 gap-2">
                                    {['default', 'bold_yellow', 'gradient_purple', 'outline_white', 'shadow_black', 
                                      'neon_pink', 'retro_orange', 'minimal_gray', 'glitch_cyan', 'vintage_brown'].map((style) => (
                                      <button
                                        key={style}
                                        type="button"
                                        onClick={() => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'style', style)}
                                        className={`aspect-square rounded-md border-2 flex items-center justify-center text-xs font-bold
                                          ${overlaySettings.style === style
                                            ? 'border-accent-500'
                                            : darkMode ? 'border-dark-600' : 'border-neutral-300'
                                          }
                                          ${darkMode ? 'bg-dark-700' : 'bg-neutral-200'}`}
                                      >
                                        Aa
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {/* Transform Section */}
                                <div>
                                  <label className={`block text-xs mb-2 ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                                    Transform
                                  </label>
                                  
                                  {/* Scale - Hide for connected backgrounds (line-width style) */}
                                  {overlaySettings.backgroundStyle !== 'line-width' && (
                                    <div className="mb-3">
                                      <StyledSlider
                                        label="Scale"
                                        value={overlaySettings.scale || 100}
                                        onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'scale', parseInt(e.target.value))}
                                        min={50}
                                        max={200}
                                        suffix="%"
                                        disabled={disabled}
                                        darkMode={darkMode}
                                      />
                                    </div>
                                  )}

                                  {/* Position */}
                                  <div className="grid grid-cols-2 gap-3">
                                    <StyledSlider
                                      label="X"
                                      value={overlaySettings.x_position || 50}
                                      onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'x_position', parseInt(e.target.value))}
                                      min={1}
                                      max={100}
                                      suffix=""
                                      disabled={disabled}
                                      darkMode={darkMode}
                                    />
                                    <StyledSlider
                                      label="Y"
                                      value={overlaySettings.y_position || 50}
                                      onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'y_position', parseInt(e.target.value))}
                                      min={1}
                                      max={100}
                                      suffix=""
                                      disabled={disabled}
                                      darkMode={darkMode}
                                    />
                                  </div>
                                </div>

                                {/* Background Section */}
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <input
                                      type="checkbox"
                                      checked={overlaySettings.hasBackground || false}
                                      onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'hasBackground', e.target.checked)}
                                      className="w-4 h-4"
                                    />
                                    <label className={`text-xs ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                                      Background
                                    </label>
                                  </div>

                                  {overlaySettings.hasBackground && (
                                    <div className="ml-6 space-y-3">
                                      {/* Background Style is always line-width (connected backgrounds) */}

                                      {/* Background Color */}
                                      <div>
                                        <label className={`block text-xs mb-1 ${darkMode ? 'text-primary-500' : 'text-primary-500'}`}>
                                          Color
                                        </label>
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="color"
                                            value={overlaySettings.backgroundColor || '#ffffff'}
                                            onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'backgroundColor', e.target.value)}
                                            className="w-8 h-8 rounded cursor-pointer"
                                          />
                                          <input
                                            type="text"
                                            value={overlaySettings.backgroundColor || '#ffffff'}
                                            onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'backgroundColor', e.target.value)}
                                            className={`flex-1 px-2 py-1 rounded text-sm ${darkMode ? 'bg-zinc-700 text-zinc-300 border-zinc-600' : 'bg-white text-gray-700 border-gray-300'} border`}
                                          />
                                        </div>
                                      </div>

                                      {/* Background Opacity */}
                                      <StyledSlider
                                        label="Opacity"
                                        value={overlaySettings.backgroundOpacity || 100}
                                        onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'backgroundOpacity', parseInt(e.target.value))}
                                        min={0}
                                        max={100}
                                        suffix="%"
                                        disabled={disabled}
                                        darkMode={darkMode}
                                      />

                                      {/* Rounded Rectangle */}
                                      <StyledSlider
                                        label="Rounded rectangle"
                                        value={overlaySettings.backgroundRounded || 7}
                                        onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'backgroundRounded', parseInt(e.target.value))}
                                        min={1}
                                        max={30}
                                        suffix="px"
                                        disabled={disabled}
                                        darkMode={darkMode}
                                      />

                                      {/* Background Size */}
                                      <div className="grid grid-cols-2 gap-3">
                                        <StyledSlider
                                          label="Height"
                                          value={overlaySettings.backgroundHeight !== undefined ? overlaySettings.backgroundHeight : 50}
                                          onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'backgroundHeight', parseInt(e.target.value))}
                                          min={1}
                                          max={200}
                                          suffix="%"
                                          disabled={disabled}
                                          darkMode={darkMode}
                                        />
                                        <StyledSlider
                                          label="Width"
                                          value={overlaySettings.backgroundWidth !== undefined ? overlaySettings.backgroundWidth : 50}
                                          onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'backgroundWidth', parseInt(e.target.value))}
                                          min={1}
                                          max={200}
                                          suffix="%"
                                          disabled={disabled}
                                          darkMode={darkMode}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                  </div>
                )}

                {/* Text Templates Tab */}
                {currentSettings.text_overlay.mode === 'templates' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-3">
                      <label className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                        Saved Text Templates ({savedTemplates.length})
                      </label>
                      <button
                        type="button"
                        onClick={loadSavedTemplates}
                        className={`text-xs px-2 py-1 rounded ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'}`}
                        title="Refresh Templates"
                      >
                        🔄 Refresh
                      </button>
                    </div>
                    
                    {savedTemplates.length === 0 ? (
                      <div className={`text-center py-12 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        <p className="text-sm mb-2">No text templates saved yet</p>
                        <p className="text-xs">Switch to Custom tab and click "Save as Template" to create your first text template</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-2">
                        {savedTemplates.map((template) => (
                          <div
                            key={template.id}
                            className={`border rounded-lg overflow-hidden transition-all hover:shadow-lg cursor-pointer ${
                              selectedTemplatePreview?.id === template.id 
                                ? darkMode ? 'border-accent-500 ring-2 ring-accent-500' : 'border-accent-400 ring-2 ring-accent-400'
                                : darkMode ? 'border-zinc-600' : 'border-gray-300'
                            } ${darkMode ? 'bg-zinc-800' : 'bg-white'}`}
                            onClick={() => setSelectedTemplatePreview(template)}
                          >
                            {/* Template Preview - 9:16 aspect ratio */}
                            <div className="relative w-full" style={{ paddingBottom: '177.78%' }}>
                              <div className={`absolute inset-0 ${darkMode ? 'bg-zinc-900' : 'bg-gray-100'}`}>
                                {/* Dotted pattern background */}
                                <div 
                                  className="absolute inset-0 opacity-20"
                                  style={{
                                    backgroundImage: `radial-gradient(circle, ${darkMode ? '#666' : '#999'} 1px, transparent 1px)`,
                                    backgroundSize: '10px 10px'
                                  }}
                                />
                                
                                {/* Text overlays preview */}
                                {template.textOverlays.map((overlay, index) => (
                                  overlay.enabled && (
                                    <div
                                      key={index}
                                      className="absolute"
                                      style={{
                                        left: `${overlay.x_position || 50}%`,
                                        top: `${overlay.y_position || 50}%`,
                                        transform: 'translate(-50%, -50%)',
                                        fontSize: `${(overlay.fontSize || 20) * 0.35}px`,
                                        color: overlay.color || '#000000',
                                        fontWeight: overlay.bold ? 'bold' : 'normal',
                                        fontStyle: overlay.italic ? 'italic' : 'normal',
                                        textDecoration: overlay.underline ? 'underline' : 'none',
                                        textAlign: overlay.alignment || 'center',
                                        opacity: (overlay.opacity || 100) / 100,
                                        fontFamily: overlay.font || 'System',
                                        maxWidth: '80%',
                                        wordWrap: 'break-word',
                                        whiteSpace: 'pre-wrap',
                                        textShadow: overlay.hasStroke ? `${overlay.strokeThickness || 1}px ${overlay.strokeThickness || 1}px 0 ${overlay.strokeColor || '#000000'}` : 'none'
                                      }}
                                    >
                                      {overlay.hasBackground && (
                                        <div
                                          className="absolute inset-0 rounded"
                                          style={{
                                            backgroundColor: overlay.backgroundColor || '#ffffff',
                                            opacity: (overlay.backgroundOpacity || 100) / 100,
                                            padding: '2px 6px',
                                            margin: '-2px -6px',
                                            borderRadius: `${overlay.backgroundRounded || 0}px`,
                                            zIndex: -1
                                          }}
                                        />
                                      )}
                                      <span style={{ fontSize: 'inherit' }}>
                                        {overlay.custom_text && overlay.custom_text.trim() !== '' 
                                          ? overlay.custom_text 
                                          : `Sample Text ${index + 1}`}
                                      </span>
                                    </div>
                                  )
                                ))}
                              </div>
                            </div>
                            
                            {/* Template Info */}
                            <div className="p-2">
                              <h3 className={`font-medium text-xs truncate ${darkMode ? 'text-primary-200' : 'text-primary-800'}`}>
                                {template.name}
                              </h3>
                              <p className={`text-xs mt-1 ${darkMode ? 'text-primary-500' : 'text-primary-500'}`}>
                                {template.textOverlays.filter(t => t.enabled).length} active
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Selected Template Actions */}
                    {selectedTemplatePreview && (
                      <div className={`flex items-center justify-between p-3 rounded-lg border ${
                        darkMode ? 'bg-zinc-800 border-zinc-600' : 'bg-gray-50 border-gray-300'
                      }`}>
                        <div>
                          <p className={`text-sm font-medium ${darkMode ? 'text-primary-200' : 'text-primary-800'}`}>
                            {selectedTemplatePreview.name}
                          </p>
                          <p className={`text-xs ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                            Created {new Date(selectedTemplatePreview.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              handleApplyTemplate(selectedTemplatePreview);
                              setSelectedTemplatePreview(null);
                            }}
                            className={`px-4 py-1.5 text-sm font-medium rounded ${
                              darkMode ? 'bg-accent-600 hover:bg-accent-700 text-white' : 'bg-accent-500 hover:bg-accent-600 text-white'
                            }`}
                          >
                            Apply Template
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleDeleteTemplate(selectedTemplatePreview.id);
                              setSelectedTemplatePreview(null);
                            }}
                            className={`px-3 py-1.5 text-sm rounded ${
                              darkMode ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
                            }`}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* AI Generated Tab */}
                {currentSettings.text_overlay.mode === 'ai_generated' && (
                  <div className="space-y-3">
                    <p className={`text-sm ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                      AI will generate contextual text based on your video content and script.
                    </p>
                    <div className={`p-3 rounded-md ${darkMode ? 'bg-dark-700' : 'bg-neutral-200'}`}>
                      <p className={`text-xs ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                        Example: If your script mentions a product benefit, AI might generate "Game Changer!" or "You Need This!"
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>


            
            </div>

            {/* Removed old preview panel - content moved to Video Editor section */}
            <div className="lg:col-span-1 hidden">
              <div className={`rounded-md p-4 sticky top-4 ${darkMode ? 'bg-neutral-900' : 'bg-neutral-100'}`}>
                <div className="hidden" style={{
                  backgroundImage: selectedAvatar && selectedAvatar.filePath 
                    ? 'none'
                    : darkMode 
                      ? 'repeating-linear-gradient(45deg, rgba(156, 163, 175, 0.1) 0px, rgba(156, 163, 175, 0.1) 1px, transparent 1px, transparent 8px)'
                      : 'repeating-linear-gradient(45deg, rgba(107, 114, 128, 0.1) 0px, rgba(107, 114, 128, 0.1) 1px, transparent 1px, transparent 8px)'
                }}>
                  
                  {/* Avatar Background */}
                  {selectedAvatar && selectedAvatar.filePath ? (
                    <video 
                      className="w-full h-full object-cover"
                      muted
                      loop
                      playsInline
                      autoPlay
                      src={window.electron ? `file://${selectedAvatar.filePath}` : selectedAvatar.filePath}
                    />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center`}>
                      <p className={`text-sm text-center px-2 ${darkMode ? 'text-content-300' : 'text-content-700'}`}>
                        Select an avatar to see preview
                      </p>
                    </div>
                  )}
                  
                  {/* Multiple Text Overlays Preview */}
                  {[1, 2, 3].map((index) => {
                    // Show selected template preview - either text template or editing template
                    let overlaySettings;
                    
                    if (selectedEditingTemplate && selectedEditingTemplate.settings) {
                      // Use the exact same logic as getTextOverlaySettings but with template data
                      const prefix = index === 1 ? 'text_overlay' : `text_overlay_${index}`;
                      const enabledKey = index === 1 ? 'text_overlay_1_enabled' : `${prefix}_enabled`;
                      
                      overlaySettings = {
                        enabled: selectedEditingTemplate.settings[enabledKey] || false,
                        mode: selectedEditingTemplate.settings[`${prefix}_mode`] || 'custom',
                        custom_text: selectedEditingTemplate.settings[`${prefix}_custom_text`] || '',
                        category: selectedEditingTemplate.settings[`${prefix}_category`] || 'engagement',
                        font: selectedEditingTemplate.settings[`${prefix}_font`] || 'System',
                        customFontName: selectedEditingTemplate.settings[`${prefix}_customFontName`] || '',
                        fontSize: selectedEditingTemplate.settings[`${prefix}_fontSize`] || 20,
                        bold: selectedEditingTemplate.settings[`${prefix}_bold`] || false,
                        underline: selectedEditingTemplate.settings[`${prefix}_underline`] || false,
                        italic: selectedEditingTemplate.settings[`${prefix}_italic`] || false,
                        textCase: selectedEditingTemplate.settings[`${prefix}_textCase`] || 'none',
                        color: selectedEditingTemplate.settings[`${prefix}_color`] || '#000000',
                        characterSpacing: selectedEditingTemplate.settings[`${prefix}_characterSpacing`] || 0,
                        lineSpacing: selectedEditingTemplate.settings[`${prefix}_lineSpacing`] || -1,
                        alignment: selectedEditingTemplate.settings[`${prefix}_alignment`] || 'center',
                        style: selectedEditingTemplate.settings[`${prefix}_style`] || 'default',
                        scale: selectedEditingTemplate.settings[`${prefix}_scale`] || 100,
                        x_position: selectedEditingTemplate.settings[`${prefix}_x_position`] || 50,
                        y_position: selectedEditingTemplate.settings[`${prefix}_y_position`] || 50,
                        rotation: selectedEditingTemplate.settings[`${prefix}_rotation`] || 0,
                        opacity: selectedEditingTemplate.settings[`${prefix}_opacity`] || 100,
                        hasStroke: selectedEditingTemplate.settings[`${prefix}_hasStroke`] || false,
                        strokeColor: selectedEditingTemplate.settings[`${prefix}_strokeColor`] || '#000000',
                        strokeThickness: selectedEditingTemplate.settings[`${prefix}_strokeThickness`] || 2,
                        hasBackground: selectedEditingTemplate.settings[`${prefix}_hasBackground`] || false,
                        backgroundColor: selectedEditingTemplate.settings[`${prefix}_backgroundColor`] || '#ffffff',
                        backgroundOpacity: selectedEditingTemplate.settings[`${prefix}_backgroundOpacity`] || 100,
                        backgroundRounded: selectedEditingTemplate.settings[`${prefix}_backgroundRounded`] || 0,
                        backgroundHeight: selectedEditingTemplate.settings[`${prefix}_backgroundHeight`] || 50,
                        backgroundWidth: selectedEditingTemplate.settings[`${prefix}_backgroundWidth`] || 50,
                        backgroundXOffset: selectedEditingTemplate.settings[`${prefix}_backgroundXOffset`] || 0,
                        backgroundYOffset: selectedEditingTemplate.settings[`${prefix}_backgroundYOffset`] || 0,
                        backgroundStyle: selectedEditingTemplate.settings[`${prefix}_backgroundStyle`] || 'basic'
                      };
                    } else if (currentSettings.text_overlay.mode === 'templates' && selectedTemplatePreview) {
                      // Show text template preview
                      overlaySettings = selectedTemplatePreview.textOverlays[index - 1];
                    } else {
                      // Show current form settings
                      overlaySettings = getTextOverlaySettings(index);
                    }
                    
                    if (!overlaySettings || !overlaySettings.enabled) {
                      return null;
                    }

                    // Calculate proper scaling based on artboard dimensions
                    // Use height-based scaling to match backend's percentage-of-height calculation
                    const previewScale = artboardSize.height / (artboardSize.actualHeight || 1920);
                    const zoomScale = canvasZoom / 100;
                    const combinedScale = previewScale * zoomScale;

                    return (
                      <div
                        key={index}
                        className="absolute"
                        style={{
                          left: `${overlaySettings.x_position || 50}%`,
                          top: `${overlaySettings.y_position || 50}%`,
                          fontSize: `${(overlaySettings.fontSize || 20) * combinedScale}px`,
                          fontWeight: overlaySettings.bold ? 'bold' : 'normal',
                          fontStyle: overlaySettings.italic ? 'italic' : 'normal',
                          textDecoration: overlaySettings.underline ? 'underline' : 'none',
                          color: overlaySettings.color || '#000000',
                          fontFamily: overlaySettings.font === 'custom' ? overlaySettings.customFontName || 'System' : overlaySettings.font || 'System',
                          letterSpacing: `${(overlaySettings.characterSpacing || 0) * combinedScale}px`,
                          lineHeight: `${100 + (overlaySettings.lineSpacing || 0) * 5}%`,
                          textAlign: overlaySettings.alignment || 'center',
                          backgroundColor: overlaySettings.hasBackground && overlaySettings.backgroundStyle !== 'line-width'
                            ? `${overlaySettings.backgroundColor}${Math.round((overlaySettings.backgroundOpacity !== undefined ? overlaySettings.backgroundOpacity : 100) * 2.55).toString(16).padStart(2, '0')}` 
                            : 'transparent',
                          borderRadius: overlaySettings.hasBackground && overlaySettings.backgroundStyle !== 'line-width'
                            ? `${(overlaySettings.backgroundRounded || 0) * combinedScale}px`
                            : '0px',
                          padding: overlaySettings.hasBackground && overlaySettings.backgroundStyle !== 'line-width'
                            ? `${Math.round(((overlaySettings.backgroundHeight || 50) / 5) * combinedScale)}px ${Math.round(((overlaySettings.backgroundWidth || 50) / 3) * combinedScale)}px`
                            : '0px',
                          marginTop: overlaySettings.hasBackground
                            ? `${(overlaySettings.backgroundYOffset || 0) * combinedScale}px`
                            : '0px',
                          marginLeft: overlaySettings.hasBackground
                            ? `${(overlaySettings.backgroundXOffset || 0) * combinedScale}px`
                            : '0px',
                          WebkitTextStroke: overlaySettings.hasStroke
                            ? `${(overlaySettings.strokeThickness || 2) * combinedScale}px ${overlaySettings.strokeColor || '#000000'}`
                            : 'none',
                          opacity: (overlaySettings.opacity || 100) / 100,
                          transform: `translate(-50%, -50%) scale(${(overlaySettings.scale || 100) / 100}) rotate(${overlaySettings.rotation || 0}deg)`,
                          position: 'absolute',
                          display: 'inline-block',
                          whiteSpace: 'pre',
                          zIndex: index // Ensure proper layering
                        }}
                      >
                        {(() => {
                          let text = '';
                          // If we're previewing an editing template, use its text
                          if (selectedEditingTemplate && selectedEditingTemplate.settings) {
                            text = overlaySettings.custom_text || '';
                          } else if (currentSettings.text_overlay.mode === 'templates' && selectedTemplatePreview) {
                            text = overlaySettings.custom_text || `Text ${index}`;
                          } else if (currentSettings.text_overlay.mode === 'custom' && overlaySettings.custom_text) {
                            text = overlaySettings.custom_text;
                          } else if (currentSettings.text_overlay.mode === 'custom') {
                            text = '';
                          } else if (currentSettings.text_overlay.mode === 'templates') {
                            text = getTemplatePreview(currentSettings.text_overlay.category);
                          } else {
                            text = 'AI Generated Text';
                          }
                          
                          // For line-width mode, show placeholder text (no ConnectedTextBackground in hidden section)
                          if (overlaySettings.hasBackground && overlaySettings.backgroundStyle === 'line-width' && text) {
                            return text;
                          }
                          
                          return text;
                        })()}
                      </div>
                    );
                  })}
                  
                  {/* Caption Preview */}
                  {currentSettings.captions.enabled && (
                    <div 
                      className="absolute text-center"
                      style={{
                        // Match backend ASS positioning logic: Y determines region, X is always centered in backend
                        left: `${currentSettings.captions.x_position || 50}%`,
                        top: `${currentSettings.captions.y_position || 50}%`,
                        transform: 'translate(-50%, -50%)',
                        fontSize: `${(currentSettings.captions.fontSize || 58) * 0.8}px`,
                        fontFamily: currentSettings.captions.fontFamily || 'Montserrat-Bold',
                        color: currentSettings.captions.color || '#FFFFFF',
                        width: '85%',
                        maxWidth: 'none',
                        whiteSpace: 'normal',
                        wordBreak: 'normal',
                        overflowWrap: 'normal',
                        ...(currentSettings.captions.hasStroke ? {
                          WebkitTextStroke: `${Math.min(currentSettings.captions.strokeWidth / 3, 2)}px ${currentSettings.captions.strokeColor}`,
                          WebkitTextFillColor: currentSettings.captions.color,
                          paintOrder: 'stroke fill'
                        } : {}),
                        ...(currentSettings.captions.hasBackground && {
                          backgroundColor: `${currentSettings.captions.backgroundColor}${Math.round(currentSettings.captions.backgroundOpacity * 255).toString(16).padStart(2, '0')}`,
                          padding: '2px 4px',
                          borderRadius: '2px'
                        })
                      }}
                    >
{(() => {
                        const wordsPerSegment = currentSettings.captions.max_words_per_segment || 4;
                        const sampleWords = ['This', 'is', 'how', 'captions', 'appear', 'with', 'different', 'word', 'counts', 'per', 'segment', 'for', 'better', 'control', 'and', 'timing'];
                        const text = sampleWords.slice(0, wordsPerSegment).join(' ');
                        return currentSettings.captions.allCaps ? text.toUpperCase() : text;
                      })()}
                    </div>
                  )}
                  
                </div>


                {/* Save as Template Button */}
                {!showTemplateNameModal && (
                  <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                    <button
                      type="button"
                      onClick={() => setShowTemplateNameModal(true)}
                      className={`w-full px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                        disabled 
                          ? darkMode ? 'bg-zinc-700 text-zinc-400' : 'bg-gray-300 text-gray-500'
                          : darkMode ? 'bg-zinc-600 hover:bg-zinc-500 text-zinc-200' : 'bg-gray-400 hover:bg-gray-500 text-white'
                      }`}
                      disabled={disabled}
                    >
                      Save as Template
                    </button>
                  </div>
                )}

                {/* Template Name Input Modal */}
                {showTemplateNameModal && (
                  <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600 space-y-3">
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                        Template Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Professional Sales Video"
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        className={`w-full px-3 py-2 text-sm rounded border ${
                          darkMode 
                            ? 'bg-zinc-800 text-white border-zinc-700 focus:border-accent-500' 
                            : 'bg-white text-gray-900 border-gray-300 focus:border-accent-500'
                        }`}
                        disabled={disabled}
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (newTemplateName.trim()) {
                            saveEditingTemplate();
                            setShowTemplateNameModal(false);
                          }
                        }}
                        disabled={disabled || !newTemplateName.trim()}
                        className={`flex-1 px-3 py-1.5 text-sm font-medium rounded ${
                          disabled || !newTemplateName.trim()
                            ? darkMode ? 'bg-zinc-700 text-zinc-400' : 'bg-gray-300 text-gray-500'
                            : darkMode ? 'bg-zinc-600 hover:bg-zinc-500 text-zinc-200' : 'bg-gray-400 hover:bg-gray-500 text-white'
                        }`}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowTemplateNameModal(false);
                          setNewTemplateName('');
                        }}
                        className={`flex-1 px-3 py-1.5 text-sm rounded ${
                          darkMode ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        }`}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

      {/* Template Name Modal */}
      {showTemplateNameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`rounded-lg p-6 max-w-md w-full mx-4 ${darkMode ? 'bg-zinc-800 border-zinc-600' : 'bg-white border-gray-300'} border`}>
            <h3 className={`text-lg font-medium mb-4 ${darkMode ? 'text-primary-200' : 'text-primary-800'}`}>
              Save Template
            </h3>
            <div className="mb-4">
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                Template Name
              </label>
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && newTemplateName.trim()) {
                    saveEditingTemplate();
                    setShowTemplateNameModal(false);
                  }
                }}
                placeholder="Enter template name..."
                className={`w-full px-3 py-2 rounded-md border ${
                  darkMode 
                    ? 'bg-zinc-700 border-zinc-600 text-primary-100 placeholder-zinc-400' 
                    : 'bg-white border-gray-300 text-primary-900 placeholder-gray-400'
                }`}
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowTemplateNameModal(false)}
                className={`px-4 py-2 text-sm rounded-md ${
                  darkMode 
                    ? 'bg-zinc-600 hover:bg-zinc-700 text-primary-200' 
                    : 'bg-gray-200 hover:bg-gray-300 text-primary-700'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (newTemplateName.trim()) {
                    saveEditingTemplate();
                    setShowTemplateNameModal(false);
                  }
                }}
                disabled={!newTemplateName.trim()}
                className={`px-4 py-2 text-sm rounded-md ${
                  !newTemplateName.trim()
                    ? darkMode ? 'bg-zinc-600 text-zinc-400' : 'bg-gray-300 text-gray-500'
                    : darkMode ? 'bg-accent-600 hover:bg-accent-700 text-white' : 'bg-accent-500 hover:bg-accent-600 text-white'
                }`}
              >
                Save Template
              </button>
            </div>
          </div>

        </div>
      )}

      {/* Video Editor Layout - Always visible */}
      <div className="border-t border-primary-200/20 dark:border-primary-800/20">

        <div className="grid grid-cols-3 gap-4 min-h-[740px]">
          {/* Left Panel - Options */}
          <div className={`rounded-xl border ${
            darkMode
              ? 'border-zinc-600'
              : 'bg-neutral-100 border-gray-300'
          } overflow-hidden`} style={{ height: '730px', backgroundColor: darkMode ? '#262626' : undefined }}>
            <div className="flex flex-col h-full">
              {/* Navigation Bar */}
              <div className={`border-b ${darkMode ? 'border-zinc-600' : 'border-gray-300 bg-gray-200'} px-2 py-1.5`} style={{ backgroundColor: darkMode ? '#303030' : undefined }}>
                <div className="flex items-center space-x-1 overflow-x-auto">
                  {[
                    ...(form.campaignType === 'splice' ? [{ id: 'splice', label: 'Splice', active: activeEditorTab === 'splice', icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 4v10a2 2 0 002 2h6a2 2 0 002-2V8M9 8h6m-3-4v4m0 4v4" />
                      </svg>
                    )}] : []),
                    { id: 'scripting', label: 'Scripting', active: activeEditorTab === 'scripting', icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    )},
                    { id: 'templates', label: 'Templates', active: activeEditorTab === 'templates', icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )},
                    { id: 'audio', label: 'Audio', active: activeEditorTab === 'audio', icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M9 12a3 3 0 106 0v5a3 3 0 11-6 0V7a3 3 0 016 0v5z" />
                      </svg>
                    )},
                    { id: 'clipping', label: 'Clipping', active: activeEditorTab === 'clipping', icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 4v10a2 2 0 002 2h6a2 2 0 002-2V8M9 8h6" />
                      </svg>
                    )},
                    { id: 'captions', label: 'Captions', active: activeEditorTab === 'captions', icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                    )},
                    { id: 'broll', label: 'B-roll', active: activeEditorTab === 'broll', icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )},
                    { id: 'filters', label: 'Filters', active: activeEditorTab === 'filters', icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                    )}
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveEditorTab(item.id)}
                      className={`flex flex-col items-center justify-center w-[60px] px-2 py-1.5 rounded-md transition-colors
                        ${item.active
                          ? darkMode
                            ? 'bg-zinc-700 text-zinc-200 border border-zinc-600'
                            : 'bg-white text-gray-900 border border-gray-400'
                          : darkMode
                            ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-300'
                            : 'hover:bg-gray-200 text-gray-600 hover:text-gray-700'
                        }`}
                    >
                      <div className="mb-0.5">{item.icon}</div>
                      <span className="text-xs font-normal text-[10px] whitespace-nowrap">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 p-4 overflow-y-auto overflow-x-visible relative">
                {activeEditorTab === 'splice' && (
                  <div className="flex flex-col h-full">
                    {/* Splice Settings Header */}
                    <div className="mb-4">
                      <h3 className={`text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                        Splice Mode Settings
                      </h3>
                    </div>

                    {/* Splice Mode Content - Professional Controls */}
                    <div className="space-y-6">
                      
                      {/* Source Settings Section - MOVED TO TOP */}
                      <div className="space-y-3">
                        <h4 className={`text-sm font-semibold ${darkMode ? 'text-primary-200' : 'text-primary-800'}`}>
                          Source Settings
                        </h4>
                        
                        {/* Source Directory */}
                        <div>
                          <label htmlFor="sourceDirectory" className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                            Clips Directory <span className="text-red-500">*</span>
                          </label>
                          <div className="mt-1 flex">
                            <input
                              type="text"
                              name="sourceDirectory"
                              id="sourceDirectory"
                              required={form.campaignType === 'splice'}
                              value={form.sourceDirectory}
                              onChange={onChange}
                              placeholder="/path/to/video/clips/folder"
                              className={`block w-full rounded-l-md shadow-sm focus:border-accent-500 focus:ring-accent-500 sm:text-sm
                                ${darkMode
                                  ? 'bg-neutral-700 border-neutral-600 text-primary-100 placeholder-primary-400'
                                  : 'border-primary-300 text-primary-900 placeholder-primary-400'
                                }`}
                            />
                            <button
                              type="button"
                              className={`inline-flex items-center px-3 py-2 border border-l-0 rounded-r-md text-sm font-medium
                                ${darkMode
                                  ? 'bg-neutral-700 border-neutral-600 text-primary-200 hover:bg-neutral-600'
                                  : 'bg-neutral-100 border-primary-300 text-primary-700 hover:bg-neutral-200'
                                }`}
                              onClick={async () => {
                                try {
                                  const result = await window.electron.ipcRenderer.invoke('show-directory-picker', {
                                    title: 'Select Video Clips Directory'
                                  });
                                  
                                  if (result && !result.canceled && result.filePaths && result.filePaths[0]) {
                                    onChange({target: {name: 'sourceDirectory', value: result.filePaths[0]}});
                                  }
                                } catch (error) {
                                  console.error('Error selecting directory:', error);
                                }
                              }}
                            >
                              Browse
                            </button>
                          </div>
                        </div>
                        
                        {/* Max Clips */}
                        <div>
                          <label htmlFor="totalClips" className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                            Max Clips to Use (optional)
                          </label>
                          <input
                            type="number"
                            name="totalClips"
                            id="totalClips"
                            min="1"
                            max="100"
                            value={form.totalClips}
                            onChange={onChange}
                            placeholder="Leave empty to use all clips"
                            className={`mt-1 block w-32 rounded-md shadow-sm focus:border-accent-500 focus:ring-accent-500 sm:text-sm
                              ${darkMode
                                ? 'bg-neutral-700 border-neutral-600 text-primary-100'
                                : 'border-primary-300 text-primary-900'
                              }`}
                          />
                        </div>
                        
                        {/* Hook Video */}
                        <div>
                          <label htmlFor="hookVideo" className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                            Hook Video (optional first clip)
                          </label>
                          <div className="mt-1 flex">
                            <input
                              type="text"
                              name="hookVideo"
                              id="hookVideo"
                              value={form.hookVideo}
                              onChange={onChange}
                              placeholder="/path/to/hook/video.mp4"
                              className={`block w-full rounded-l-md shadow-sm focus:border-accent-500 focus:ring-accent-500 sm:text-sm
                                ${darkMode
                                  ? 'bg-neutral-700 border-neutral-600 text-primary-100 placeholder-primary-400'
                                  : 'border-primary-300 text-primary-900 placeholder-primary-400'
                                }`}
                            />
                            <button
                              type="button"
                              className={`inline-flex items-center px-3 py-2 border border-l-0 rounded-r-md text-sm font-medium
                                ${darkMode
                                  ? 'bg-neutral-700 border-neutral-600 text-primary-200 hover:bg-neutral-600'
                                  : 'bg-neutral-100 border-primary-300 text-primary-700 hover:bg-neutral-200'
                                }`}
                              onClick={async () => {
                                try {
                                  const result = await window.electron.ipcRenderer.invoke('show-file-picker', {
                                    title: 'Select Hook Video',
                                    filters: [
                                      { name: 'Video Files', extensions: ['mp4', 'mov', 'mkv', 'avi', 'webm', 'hevc', 'm4v'] },
                                      { name: 'All Files', extensions: ['*'] }
                                    ]
                                  });
                                  
                                  if (result && !result.canceled && result.filePaths && result.filePaths[0]) {
                                    onChange({target: {name: 'hookVideo', value: result.filePaths[0]}});
                                  }
                                } catch (error) {
                                  console.error('Error selecting file:', error);
                                }
                              }}
                            >
                              Browse
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Voiceover Control Section */}
                      <div className="space-y-3">
                        <h4 className={`text-sm font-semibold ${darkMode ? 'text-primary-200' : 'text-primary-800'}`}>
                          Voiceover Settings
                        </h4>
                        
                        {/* Use Voiceover Toggle */}
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            name="splice_use_voiceover"
                            id="splice_use_voiceover"
                            checked={form.splice_use_voiceover !== false}
                            onChange={(e) => onChange({target: {name: 'splice_use_voiceover', value: e.target.checked}})}
                            className="h-4 w-4 rounded border-primary-300 text-accent-600 focus:ring-accent-500"
                          />
                          <label htmlFor="splice_use_voiceover" className={`text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                            Generate AI voiceover
                          </label>
                        </div>
                        
                        {/* Voice Selection (from avatars) */}
                        {form.splice_use_voiceover !== false && (
                          <div>
                            <label className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'} mb-2`}>
                              Voice Selection
                            </label>
                            <select
                              name="elevenlabs_voice_id"
                              value={form.elevenlabs_voice_id}
                              onChange={onChange}
                              className={`block w-full rounded-md shadow-sm focus:border-accent-500 focus:ring-accent-500 sm:text-sm
                                ${darkMode
                                  ? 'bg-neutral-700 border-neutral-600 text-primary-100'
                                  : 'border-primary-300 text-primary-900'
                                }`}
                            >
                              <option value="">Select a voice...</option>
                              {backendAvatars && backendAvatars.length > 0 ? (
                                backendAvatars.map((avatar) => (
                                  <option key={avatar.id} value={avatar.elevenlabs_voice_id || avatar.voice_id || avatar.id}>
                                    {avatar.name} {avatar.elevenlabs_voice_id ? `(${avatar.elevenlabs_voice_id.substring(0, 8)}...)` : ''}
                                  </option>
                                ))
                              ) : (
                                <option value="" disabled>No avatars available</option>
                              )}
                            </select>
                            <p className={`mt-1 text-xs ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
                              Uses voice ID from selected avatar
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Audio Volume Controls */}
                      <div className="space-y-3">
                        <h4 className={`text-sm font-semibold ${darkMode ? 'text-primary-200' : 'text-primary-800'}`}>
                          Audio Mixing
                        </h4>
                        
                        <div className="grid grid-cols-2 gap-4">
                          {/* Original Clip Audio Volume */}
                          <div>
                            <label htmlFor="originalVolume" className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                              Clip Audio Volume
                            </label>
                            <input
                              type="number"
                              name="originalVolume"
                              id="originalVolume"
                              min="0"
                              max="1"
                              step="0.1"
                              value={form.originalVolume}
                              onChange={onChange}
                              className={`mt-1 block w-full rounded-md shadow-sm focus:border-accent-500 focus:ring-accent-500 sm:text-sm
                                ${darkMode
                                  ? 'bg-neutral-700 border-neutral-600 text-primary-100'
                                  : 'border-primary-300 text-primary-900'
                                }`}
                            />
                            <p className={`mt-1 text-xs ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
                              0.0 = mute, 1.0 = normal
                            </p>
                          </div>

                          {/* Voiceover Audio Volume */}
                          {form.splice_use_voiceover !== false && (
                            <div>
                              <label htmlFor="voiceAudioVolume" className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                                Voiceover Volume
                              </label>
                              <input
                                type="number"
                                name="voiceAudioVolume"
                                id="voiceAudioVolume"
                                min="0"
                                max="2"
                                step="0.1"
                                value={form.voiceAudioVolume}
                                onChange={onChange}
                                className={`mt-1 block w-full rounded-md shadow-sm focus:border-accent-500 focus:ring-accent-500 sm:text-sm
                                  ${darkMode
                                    ? 'bg-neutral-700 border-neutral-600 text-primary-100'
                                    : 'border-primary-300 text-primary-900'
                                  }`}
                              />
                              <p className={`mt-1 text-xs ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
                                0.0 = mute, 1.0 = normal, 2.0 = boost
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Duration Control Section */}
                      <div className="space-y-3">
                        <h4 className={`text-sm font-semibold ${darkMode ? 'text-primary-200' : 'text-primary-800'}`}>
                          Duration Control
                        </h4>
                        
                        {/* Duration Source Radio Group */}
                        <div className="space-y-2">
                          <div className="flex items-center space-x-3">
                            <input
                              type="radio"
                              name="splice_duration_source"
                              value="voiceover"
                              id="duration_voiceover"
                              checked={form.splice_duration_source === 'voiceover'}
                              disabled={form.splice_use_voiceover === false}
                              onChange={onChange}
                              className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-primary-300"
                            />
                            <label htmlFor="duration_voiceover" className={`text-sm ${form.splice_use_voiceover === false ? 'text-gray-400' : darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                              Use voiceover length
                            </label>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            <input
                              type="radio"
                              name="splice_duration_source"
                              value="music"
                              id="duration_music"
                              checked={form.splice_duration_source === 'music'}
                              disabled={!form.music_enabled}
                              onChange={onChange}
                              className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-primary-300"
                            />
                            <label htmlFor="duration_music" className={`text-sm ${!form.music_enabled ? 'text-gray-400' : darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                              Use background music length
                            </label>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            <input
                              type="radio"
                              name="splice_duration_source"
                              value="manual"
                              id="duration_manual"
                              checked={form.splice_duration_source === 'manual' || (!form.splice_use_voiceover && !form.music_enabled)}
                              onChange={onChange}
                              className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-primary-300"
                            />
                            <label htmlFor="duration_manual" className={`text-sm ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                              Manual duration
                            </label>
                          </div>
                        </div>
                        
                        {/* Manual Duration Input */}
                        {(form.splice_duration_source === 'manual' || (!form.splice_use_voiceover && !form.music_enabled)) && (
                          <div>
                            <label className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                              Duration (seconds)
                            </label>
                            <input
                              type="number"
                              name="splice_target_duration"
                              min="5"
                              max="300"
                              value={form.splice_target_duration || 30}
                              onChange={onChange}
                              className={`mt-1 block w-32 rounded-md shadow-sm focus:border-accent-500 focus:ring-accent-500 sm:text-sm
                                ${darkMode
                                  ? 'bg-neutral-700 border-neutral-600 text-primary-100'
                                  : 'border-primary-300 text-primary-900'
                                }`}
                            />
                          </div>
                        )}
                      </div>

                      {/* Canvas & Output Section */}
                      <div className="space-y-3">
                        <h4 className={`text-sm font-semibold ${darkMode ? 'text-primary-200' : 'text-primary-800'}`}>
                          Canvas & Output
                        </h4>
                        
                        {/* Canvas Size */}
                        <div>
                          <label className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'} mb-2`}>
                            Canvas Size
                          </label>
                          
                          {/* Canvas Inputs */}
                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <div>
                              <label className={`text-xs ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>Width</label>
                              <input
                                type="number"
                                name="splice_canvas_width"
                                min="240"
                                max="4096"
                                value={form.splice_canvas_width || 1080}
                                onChange={onChange}
                                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm
                                  ${darkMode
                                    ? 'bg-neutral-700 border-neutral-600 text-primary-100'
                                    : 'border-primary-300 text-primary-900'
                                  }`}
                              />
                            </div>
                            <div>
                              <label className={`text-xs ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>Height</label>
                              <input
                                type="number"
                                name="splice_canvas_height"
                                min="240"
                                max="4096"
                                value={form.splice_canvas_height || 1920}
                                onChange={onChange}
                                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm
                                  ${darkMode
                                    ? 'bg-neutral-700 border-neutral-600 text-primary-100'
                                    : 'border-primary-300 text-primary-900'
                                  }`}
                              />
                            </div>
                          </div>
                        </div>
                        
                        {/* Crop Mode */}
                        <div>
                          <label className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'} mb-2`}>
                            Clip Fitting
                          </label>
                          <select
                            name="splice_crop_mode"
                            value={form.splice_crop_mode || 'center'}
                            onChange={onChange}
                            className={`block w-full rounded-md shadow-sm focus:border-accent-500 focus:ring-accent-500 sm:text-sm
                              ${darkMode
                                ? 'bg-neutral-700 border-neutral-600 text-primary-100'
                                : 'border-primary-300 text-primary-900'
                              }`}
                          >
                            <option value="center">Center Crop (fills canvas)</option>
                            <option value="fill">Fill (stretch to fit)</option>
                            <option value="fit">Fit (add black bars)</option>
                          </select>
                          <p className={`mt-1 text-xs ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
                            How clips are resized to fit the canvas
                          </p>
                        </div>
                      </div>

                      {/* Per-Clip Duration Section */}
                      <div className="space-y-3">
                        <h4 className={`text-sm font-semibold ${darkMode ? 'text-primary-200' : 'text-primary-800'}`}>
                          Clip Duration Control
                        </h4>
                        
                        <div className="space-y-2">
                          <div className="flex items-center space-x-3">
                            <input
                              type="radio"
                              name="splice_clip_duration_mode"
                              value="full"
                              id="clip_duration_full"
                              checked={form.splice_clip_duration_mode === 'full' || !form.splice_clip_duration_mode}
                              onChange={onChange}
                              className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-primary-300"
                            />
                            <label htmlFor="clip_duration_full" className={`text-sm ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                              Use full clip duration
                            </label>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            <input
                              type="radio"
                              name="splice_clip_duration_mode"
                              value="fixed"
                              id="clip_duration_fixed"
                              checked={form.splice_clip_duration_mode === 'fixed'}
                              onChange={onChange}
                              className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-primary-300"
                            />
                            <label htmlFor="clip_duration_fixed" className={`text-sm ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                              Fixed duration per clip
                            </label>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            <input
                              type="radio"
                              name="splice_clip_duration_mode"
                              value="random"
                              id="clip_duration_random"
                              checked={form.splice_clip_duration_mode === 'random'}
                              onChange={onChange}
                              className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-primary-300"
                            />
                            <label htmlFor="clip_duration_random" className={`text-sm ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                              Random duration range
                            </label>
                          </div>
                        </div>
                        
                        {/* Fixed Duration Input */}
                        {form.splice_clip_duration_mode === 'fixed' && (
                          <div>
                            <label className={`text-xs ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                              Seconds per clip
                            </label>
                            <input
                              type="number"
                              name="splice_clip_duration_fixed"
                              min="0.5"
                              max="60"
                              step="0.5"
                              value={form.splice_clip_duration_fixed || 5}
                              onChange={onChange}
                              className={`mt-1 block w-32 rounded-md shadow-sm sm:text-sm
                                ${darkMode
                                  ? 'bg-neutral-700 border-neutral-600 text-primary-100'
                                  : 'border-primary-300 text-primary-900'
                                }`}
                            />
                          </div>
                        )}
                        
                        {/* Random Duration Range */}
                        {form.splice_clip_duration_mode === 'random' && (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className={`text-xs ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>Min seconds</label>
                              <input
                                type="number"
                                name="splice_clip_duration_min"
                                min="0.5"
                                max="60"
                                step="0.5"
                                value={form.splice_clip_duration_min || 3}
                                onChange={onChange}
                                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm
                                  ${darkMode
                                    ? 'bg-neutral-700 border-neutral-600 text-primary-100'
                                    : 'border-primary-300 text-primary-900'
                                  }`}
                              />
                            </div>
                            <div>
                              <label className={`text-xs ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>Max seconds</label>
                              <input
                                type="number"
                                name="splice_clip_duration_max"
                                min="0.5"
                                max="60"
                                step="0.5"
                                value={form.splice_clip_duration_max || 8}
                                onChange={onChange}
                                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm
                                  ${darkMode
                                    ? 'bg-neutral-700 border-neutral-600 text-primary-100'
                                    : 'border-primary-300 text-primary-900'
                                  }`}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                )}

                {activeEditorTab === 'templates' && (
                  <div className="flex flex-col h-full">
                    {/* Templates Header */}
                    <div className="mb-4">
                      <h3 className={`text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                        Editing Templates
                      </h3>
                    </div>

                    <div className="flex items-center justify-between mb-3">
                      <label className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                        Saved Templates ({editingTemplates.length})
                      </label>
                      <button
                        type="button"
                        onClick={loadEditingTemplates}
                        className={`text-xs px-2 py-1 rounded ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'}`}
                        title="Refresh Templates"
                      >
                        🔄 Refresh
                      </button>
                    </div>

                    {editingTemplates.length === 0 ? (
                      <div className={`text-center py-12 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        <p className="text-sm mb-2">No templates saved yet</p>
                        <p className="text-xs">Save your first editing template in the Video Preview section</p>
                      </div>
                    ) : (
                      <div className="flex-1 min-h-0">
                        <div className="grid grid-cols-3 gap-3 max-h-full overflow-y-auto pr-2">
                        {editingTemplates.map((template) => (
                          <div
                            key={template.id}
                            className={`border rounded-lg overflow-hidden transition-all hover:shadow-lg cursor-pointer ${
                              selectedEditingTemplate?.id === template.id
                                ? darkMode ? 'border-accent-500 ring-2 ring-accent-500' : 'border-accent-400 ring-2 ring-accent-400'
                                : darkMode ? 'border-zinc-600' : 'border-gray-300'
                            } ${darkMode ? 'bg-zinc-800' : 'bg-white'}`}
                            onClick={() => setSelectedEditingTemplate(selectedEditingTemplate?.id === template.id ? null : template)}
                          >
                            {/* Template Preview - 9:16 aspect ratio */}
                            <div className="relative w-full" style={{ paddingBottom: '177.78%' }}>
                              <div className={`absolute inset-0 ${darkMode ? 'bg-zinc-900' : 'bg-gray-100'}`}>
                                {/* Dotted pattern background */}
                                <div
                                  className="absolute inset-0 opacity-20"
                                  style={{
                                    backgroundImage: `radial-gradient(circle, ${darkMode ? '#666' : '#999'} 1px, transparent 1px)`,
                                    backgroundSize: '10px 10px'
                                  }}
                                />

                                {/* Text overlays preview */}
                                {template.settings?.text_overlay_enabled && (
                                  <>
                                    {/* Text overlay 1 */}
                                    {template.settings?.text_overlay_custom_text && (
                                      <div
                                        className="absolute"
                                        style={{
                                          left: `${template.settings?.text_overlay_x_position || 50}%`,
                                          top: `${template.settings?.text_overlay_y_position || 30}%`,
                                          transform: 'translate(-50%, -50%)',
                                          fontSize: `${(template.settings?.text_overlay_fontSize || 20) * 0.15}px`,
                                          color: template.settings?.text_overlay_color || '#ffffff',
                                          fontWeight: template.settings?.text_overlay_bold ? 'bold' : 'normal',
                                          fontStyle: template.settings?.text_overlay_italic ? 'italic' : 'normal',
                                          textAlign: template.settings?.text_overlay_alignment || 'center',
                                          maxWidth: '80%',
                                          wordWrap: 'break-word',
                                          whiteSpace: 'pre-wrap',
                                          textShadow: template.settings?.text_overlay_hasStroke ? `1px 1px 0 ${template.settings?.text_overlay_strokeColor || '#000000'}` : 'none'
                                        }}
                                      >
                                        {template.settings?.text_overlay_hasBackground && (
                                          <div
                                            className="absolute inset-0 rounded"
                                            style={{
                                              backgroundColor: template.settings?.text_overlay_backgroundColor || '#000000',
                                              opacity: (template.settings?.text_overlay_backgroundOpacity || 50) / 100,
                                              padding: '1px 3px',
                                              margin: '-1px -3px',
                                              borderRadius: `${(template.settings?.text_overlay_backgroundRounded || 0) * 0.5}px`,
                                              zIndex: -1
                                            }}
                                          />
                                        )}
                                        <span style={{ fontSize: 'inherit' }}>
                                          {template.settings.text_overlay_custom_text}
                                        </span>
                                      </div>
                                    )}
                                    {/* Text overlay 2 */}
                                    {template.settings?.text_overlay_2_custom_text && (
                                      <div
                                        className="absolute"
                                        style={{
                                          left: `${template.settings?.text_overlay_2_x_position || 50}%`,
                                          top: `${template.settings?.text_overlay_2_y_position || 50}%`,
                                          transform: 'translate(-50%, -50%)',
                                          fontSize: `${(template.settings?.text_overlay_2_fontSize || 20) * 0.15}px`,
                                          color: template.settings?.text_overlay_2_color || '#ffffff',
                                          fontWeight: template.settings?.text_overlay_2_bold ? 'bold' : 'normal',
                                          fontStyle: template.settings?.text_overlay_2_italic ? 'italic' : 'normal',
                                          textAlign: template.settings?.text_overlay_2_alignment || 'center',
                                          maxWidth: '80%',
                                          wordWrap: 'break-word',
                                          whiteSpace: 'pre-wrap',
                                          textShadow: template.settings?.text_overlay_2_hasStroke ? `1px 1px 0 ${template.settings?.text_overlay_2_strokeColor || '#000000'}` : 'none'
                                        }}
                                      >
                                        {template.settings?.text_overlay_2_hasBackground && (
                                          <div
                                            className="absolute inset-0 rounded"
                                            style={{
                                              backgroundColor: template.settings?.text_overlay_2_backgroundColor || '#000000',
                                              opacity: (template.settings?.text_overlay_2_backgroundOpacity || 50) / 100,
                                              padding: '1px 3px',
                                              margin: '-1px -3px',
                                              borderRadius: `${(template.settings?.text_overlay_2_backgroundRounded || 0) * 0.5}px`,
                                              zIndex: -1
                                            }}
                                          />
                                        )}
                                        <span style={{ fontSize: 'inherit' }}>
                                          {template.settings.text_overlay_2_custom_text}
                                        </span>
                                      </div>
                                    )}
                                    {/* Text overlay 3 */}
                                    {template.settings?.text_overlay_3_custom_text && (
                                      <div
                                        className="absolute"
                                        style={{
                                          left: `${template.settings?.text_overlay_3_x_position || 50}%`,
                                          top: `${template.settings?.text_overlay_3_y_position || 70}%`,
                                          transform: 'translate(-50%, -50%)',
                                          fontSize: `${(template.settings?.text_overlay_3_fontSize || 20) * 0.15}px`,
                                          color: template.settings?.text_overlay_3_color || '#ffffff',
                                          fontWeight: template.settings?.text_overlay_3_bold ? 'bold' : 'normal',
                                          fontStyle: template.settings?.text_overlay_3_italic ? 'italic' : 'normal',
                                          textAlign: template.settings?.text_overlay_3_alignment || 'center',
                                          maxWidth: '80%',
                                          wordWrap: 'break-word',
                                          whiteSpace: 'pre-wrap',
                                          textShadow: template.settings?.text_overlay_3_hasStroke ? `1px 1px 0 ${template.settings?.text_overlay_3_strokeColor || '#000000'}` : 'none'
                                        }}
                                      >
                                        {template.settings?.text_overlay_3_hasBackground && (
                                          <div
                                            className="absolute inset-0 rounded"
                                            style={{
                                              backgroundColor: template.settings?.text_overlay_3_backgroundColor || '#000000',
                                              opacity: (template.settings?.text_overlay_3_backgroundOpacity || 50) / 100,
                                              padding: '1px 3px',
                                              margin: '-1px -3px',
                                              borderRadius: `${(template.settings?.text_overlay_3_backgroundRounded || 0) * 0.5}px`,
                                              zIndex: -1
                                            }}
                                          />
                                        )}
                                        <span style={{ fontSize: 'inherit' }}>
                                          {template.settings.text_overlay_3_custom_text}
                                        </span>
                                      </div>
                                    )}
                                  </>
                                )}

                                {/* Captions preview */}
                                {template.settings?.captions_enabled && (
                                  <div
                                    className="absolute"
                                    style={{
                                      left: '50%',
                                      bottom: template.settings?.captions_position === 'top' ? '85%' : '15%',
                                      transform: 'translateX(-50%)',
                                      fontSize: `${(template.settings?.captions_fontSize || 58) * 0.15}px`,
                                      color: template.settings?.captions_color || '#ffffff',
                                      textAlign: 'center',
                                      maxWidth: '80%',
                                      wordWrap: 'break-word',
                                      whiteSpace: 'pre-wrap',
                                      textShadow: template.settings?.captions_hasStroke ? `1px 1px 0 ${template.settings?.captions_strokeColor || '#000000'}` : 'none'
                                    }}
                                  >
                                    {template.settings?.captions_hasBackground && (
                                      <div
                                        className="absolute inset-0 rounded"
                                        style={{
                                          backgroundColor: template.settings?.captions_backgroundColor || '#000000',
                                          opacity: (template.settings?.captions_backgroundOpacity || 50) / 100,
                                          padding: '1px 3px',
                                          margin: '-1px -3px',
                                          borderRadius: '2px',
                                          zIndex: -1
                                        }}
                                      />
                                    )}
                                    <span style={{ fontSize: 'inherit' }}>
                                      Sample Caption
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Template Info */}
                            <div className="p-1">
                              <h3 className={`font-medium text-xs truncate ${darkMode ? 'text-primary-200' : 'text-primary-800'}`}>
                                {template.name}
                              </h3>
                            </div>
                          </div>
                        ))}
                        </div>
                      </div>
                    )}

                    {/* Selected Template Actions */}
                    {selectedEditingTemplate && (
                      <div className={`flex items-center justify-between p-3 rounded-lg border ${
                        darkMode ? 'bg-zinc-800 border-zinc-600' : 'bg-gray-50 border-gray-300'
                      }`}>
                        <div>
                          <p className={`text-sm font-medium ${darkMode ? 'text-primary-200' : 'text-primary-800'}`}>
                            {selectedEditingTemplate.name}
                          </p>
                          <p className={`text-xs ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                            Created {new Date(selectedEditingTemplate.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              handleApplyEditingTemplate(selectedEditingTemplate);
                              setSelectedEditingTemplate(null);
                            }}
                            className={`px-3 py-1 text-xs font-medium rounded ${
                              darkMode ? 'bg-accent-600 hover:bg-accent-700 text-white' : 'bg-accent-500 hover:bg-accent-600 text-white'
                            }`}
                          >
                            Apply
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleDeleteEditingTemplate(selectedEditingTemplate.id);
                              setSelectedEditingTemplate(null);
                            }}
                            className={`px-2 py-1 text-xs rounded ${
                              darkMode ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
                            }`}
                          >
                            Del
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Captions Tab */}
                {activeEditorTab === 'captions' && (
                  <div className="space-y-4">
                    {/* Captions Header */}
                    <div className="mb-4">
                      <h3 className={`text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                        Auto Captions
                      </h3>
                    </div>

                    {/* Enable Auto Captions */}
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="captionsEnabledEditor"
                        name="captions_enabled"
                        checked={form.captions_enabled || false}
                        onChange={onChange}
                        className="h-4 w-4 rounded border-primary-300 text-accent-600 focus:ring-accent-500"
                        disabled={disabled}
                      />
                      <label htmlFor="captionsEnabledEditor" className={`ml-2 block text-sm ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                        Enable Auto Captions
                      </label>
                    </div>

                    {/* Caption Source Selector (Splice mode only) */}
                    {form?.campaignType === 'splice' && currentSettings.captions.enabled && (
                      <div className="mt-3">
                        <label className={`block text-xs mb-2 ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                          Caption Source
                        </label>
                        <select
                          name="caption_source"
                          value={form.caption_source || 'voiceover'}
                          onChange={(e) => onChange({ target: { name: 'caption_source', value: e.target.value }})}
                          className={`w-full px-3 py-2 border rounded-lg text-sm
                            ${darkMode
                              ? 'bg-zinc-800 border-zinc-600 text-primary-100'
                              : 'bg-white border-gray-300 text-primary-900'
                            }`}
                          disabled={disabled}
                        >
                          <option value="voiceover">Voiceover Audio</option>
                          <option value="music">Background Music</option>
                        </select>
                        {form.caption_source === 'music' && !form.music_enabled && (
                          <p className={`text-xs mt-1 ${darkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                            ⚠️ Background music must be enabled to use as caption source
                          </p>
                        )}
                        <p className={`text-xs mt-1 ${darkMode ? 'text-zinc-400' : 'text-gray-500'}`}>
                          {form.caption_source === 'music'
                            ? 'Captions will be generated from background music lyrics/audio'
                            : 'Captions will be generated from voiceover narration'}
                        </p>
                      </div>
                    )}

                    {currentSettings.captions.enabled && (
                      <div className="space-y-4">
                        {/* Caption Template Previews */}
                        <div>
                          <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                            Caption Templates
                          </label>
                          <div className="grid grid-cols-4 gap-2">
                            {[
                              { id: 'brown_fox', preview: 'Three words\nper segment', fontSize: 28, fontFamily: 'ProximaNova-Semibold, Proxima Nova Semibold, ProximaNovA-Semibold, Proxima Nova Semi Bold, Proxima Nova, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif', x_position: 50, y_position: 75, color: '#FFFFFF', hasStroke: true, strokeColor: '#000000', strokeWidth: 3, hasBackground: false, allCaps: false, max_words_per_segment: 3 },
                              { id: 'quick_yellow', preview: 'QUICK\nYELLOW', fontSize: 22, fontFamily: 'Arial-Black', x_position: 50, y_position: 85, color: '#000000', hasStroke: false, strokeColor: '#000000', strokeWidth: 0, hasBackground: true, backgroundColor: '#FFFF00', backgroundOpacity: 0.8 },
                              { id: 'netflix_pro', preview: 'NETFLIX\nSTYLE', fontSize: 20, fontFamily: 'Helvetica', x_position: 50, y_position: 90, color: '#FFFFFF', hasStroke: true, strokeColor: '#000000', strokeWidth: 0.5, hasBackground: false },
                              { id: 'gaming_neon', preview: 'GAMING\nNEON', fontSize: 24, fontFamily: 'Arial-Bold', x_position: 50, y_position: 85, color: '#00FFCC', hasStroke: false, strokeColor: '#003344', strokeWidth: 0, hasBackground: true, backgroundColor: '#000000', backgroundOpacity: 0.6 },
                              { id: 'podcast_bold', preview: 'PODCAST\nBOLD', fontSize: 25, fontFamily: 'Impact', x_position: 50, y_position: 75, color: '#FFFFFF', hasStroke: true, strokeColor: '#000000', strokeWidth: 3.5, hasBackground: false, allCaps: true },
                              { id: 'minimal_clean', preview: 'MINIMAL\nCLEAN', fontSize: 18, fontFamily: 'ProximaNova-Semibold, Proxima Nova Semibold, ProximaNovA-Semibold, Proxima Nova Semi Bold, Proxima Nova, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif', x_position: 50, y_position: 85, color: '#FFFFFF', hasStroke: true, strokeColor: '#000000', strokeWidth: 0.5, hasBackground: false },
                              { id: 'purple_pop', preview: 'PURPLE\nPOP', fontSize: 23, fontFamily: 'Bebas Neue', x_position: 50, y_position: 75, color: '#FF00FF', hasStroke: false, strokeColor: '#FFFFFF', strokeWidth: 0, hasBackground: true, backgroundColor: '#FFFFFF', backgroundOpacity: 0.8 },
                              { id: 'retro_style', preview: 'RETRO\nSTYLE', fontSize: 19, fontFamily: 'Courier New', x_position: 50, y_position: 80, color: '#00FF00', hasStroke: false, strokeColor: '#000000', strokeWidth: 0, hasBackground: true, backgroundColor: '#000000', backgroundOpacity: 0.7 },
                              { id: 'fire_alert', preview: 'FIRE\nALERT', fontSize: 21, fontFamily: 'Arial-Black', x_position: 50, y_position: 70, color: '#FFFFFF', hasStroke: false, strokeColor: '#000000', strokeWidth: 0, hasBackground: true, backgroundColor: '#FF4500', backgroundOpacity: 0.9 },
                              { id: 'cool_blue', preview: 'COOL\nBLUE', fontSize: 16, fontFamily: 'Montserrat-Bold', x_position: 50, y_position: 82, color: '#00BFFF', hasStroke: false, strokeColor: '#000080', strokeWidth: 0, hasBackground: true, backgroundColor: '#000080', backgroundOpacity: 0.6 },
                              { id: 'gold_luxury', preview: 'GOLD\nLUXURY', fontSize: 14, fontFamily: 'Times New Roman', x_position: 50, y_position: 78, color: '#FFD700', hasStroke: false, strokeColor: '#000000', strokeWidth: 0, hasBackground: true, backgroundColor: '#000000', backgroundOpacity: 0.8 },
                              { id: 'custom', preview: 'CUSTOM', custom: true }
                            ].map((template) => (
                              <button
                                key={template.id}
                                type="button"
                                onClick={() => {
                                  if (!template.custom) {
                                    const updates = {};
                                    updates['captions_template'] = template.id;
                                    Object.entries(template).forEach(([key, value]) => {
                                      if (key !== 'id' && key !== 'preview' && key !== 'custom') {
                                        updates[`captions_${key}`] = value;
                                      }
                                    });
                                    onChange({
                                      target: {
                                        name: 'BULK_UPDATE_CAPTIONS',
                                        value: updates,
                                        type: 'bulk'
                                      }
                                    });
                                  } else {
                                    handleSettingChange('captions', 'template', template.id);
                                  }
                                }}
                                className={`border rounded-lg overflow-hidden transition-all hover:shadow-lg cursor-pointer ${
                                  currentSettings.captions.template === template.id
                                    ? darkMode ? 'border-accent-500 ring-2 ring-accent-500' : 'border-accent-400 ring-2 ring-accent-400'
                                    : darkMode ? 'border-zinc-600' : 'border-gray-300'
                                } ${darkMode ? 'bg-zinc-800' : 'bg-white'}`}
                                disabled={disabled}
                              >
                                <div className="relative w-full aspect-square">
                                  <div className={`absolute inset-0 ${darkMode ? 'bg-zinc-900' : 'bg-gray-100'}`}>
                                    <div
                                      className="absolute inset-0 opacity-20"
                                      style={{
                                        backgroundImage: `radial-gradient(circle, ${darkMode ? '#666' : '#999'} 1px, transparent 1px)`,
                                        backgroundSize: '8px 8px'
                                      }}
                                    />
                                    {!template.custom ? (
                                      <div className="absolute inset-0 flex items-center justify-center p-1">
                                        <div
                                          className="text-center whitespace-pre-line"
                                          style={{
                                            fontSize: `${Math.max(6, template.fontSize * 0.08)}px`,
                                            fontFamily: template.fontFamily || 'Arial',
                                            fontWeight: 'bold',
                                            lineHeight: '1.1',
                                            ...(template.hasStroke ? {
                                              WebkitTextStroke: `${Math.min(template.strokeWidth * 0.03, 0.2)}px ${template.strokeColor}`,
                                              WebkitTextFillColor: template.color,
                                              paintOrder: 'stroke fill',
                                              color: template.color
                                            } : {
                                              color: template.color
                                            }),
                                            ...(template.hasBackground && {
                                              backgroundColor: `${template.backgroundColor}${Math.round(template.backgroundOpacity * 255).toString(16).padStart(2, '0')}`,
                                              padding: '1px 2px',
                                              borderRadius: '1px'
                                            })
                                          }}
                                        >
                                          Caption
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <span className={`text-xs font-bold ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                                          CUSTOM
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Font Settings */}
                        <div>
                          <label className={`block text-xs mb-2 ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                            Font
                          </label>
                          <select
                            name="captions_fontFamily"
                            value={currentSettings.captions.fontFamily || 'Montserrat-Bold'}
                            onChange={(e) => handleSettingChange('captions', 'fontFamily', e.target.value)}
                            className={`w-full rounded-md text-sm px-3 py-2
                              ${darkMode
                                ? 'border-zinc-600 text-primary-100'
                                : 'bg-white border-gray-300 text-primary-900'
                              } border`}
                            style={{ backgroundColor: darkMode ? '#303030' : undefined }}
                            disabled={disabled}
                          >
                            <option value="ProximaNova-Semibold, Proxima Nova Semibold, ProximaNovA-Semibold, Proxima Nova Semi Bold, Proxima Nova, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif">Proxima Nova Semibold</option>
                            <option value="ProximaNova-Bold">Proxima Nova Bold</option>
                            <option value="Proxima Nova, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif">Proxima Nova</option>
                            <option value="Montserrat-Bold">Montserrat Bold</option>
                            <option value="Inter-Medium">Inter Medium</option>
                            <option value="Roboto-Regular">Roboto Regular</option>
                            <option value="SF-Pro-Bold">SF Pro Bold</option>
                            <option value="Inter-Regular">Inter Regular</option>
                            <option value="Arial">Arial</option>
                            <option value="Helvetica">Helvetica</option>
                            <option value="Impact">Impact</option>
                          </select>
                        </div>

                        {/* Font Size */}
                        <StyledSlider
                          label="Font size"
                          value={getFontPercentage(currentSettings.captions.fontSize)}
                          onChange={(e) => {
                            const percentage = parseFloat(e.target.value);
                            const pixelSize = Math.round(getFontPixelsFromPercentage(percentage));
                            handleSettingChange('captions', 'fontSize', pixelSize);
                          }}
                          min={0.5}
                          max={15.0}
                          step={0.1}
                          suffix="% of video height"
                          disabled={disabled}
                          darkMode={darkMode}
                        />

                        {/* Words per Segment */}
                        <StyledSlider
                          label="Words per segment"
                          value={currentSettings.captions.max_words_per_segment || 4}
                          onChange={(e) => handleSettingChange('captions', 'max_words_per_segment', parseInt(e.target.value))}
                          min={1}
                          max={15}
                          suffix=" words"
                          disabled={disabled}
                          darkMode={darkMode}
                        />

                        {/* All Caps Toggle */}
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={currentSettings.captions.allCaps || false}
                            onChange={(e) => handleSettingChange('captions', 'allCaps', e.target.checked)}
                            className="w-4 h-4"
                            disabled={disabled}
                          />
                          <label className={`text-sm ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                            All caps
                          </label>
                        </div>

                        {/* Position Sliders */}
                        <StyledSlider
                          label="Horizontal position"
                          value={Math.max(currentSettings.captions.x_position || 50, 1)}
                          onChange={(e) => handleSettingChange('captions', 'x_position', Math.max(parseInt(e.target.value), 1))}
                          min={1}
                          max={100}
                          suffix="%"
                          disabled={disabled}
                          darkMode={darkMode}
                        />

                        <StyledSlider
                          label="Vertical position"
                          value={Math.max(currentSettings.captions.y_position || 85, 1)}
                          onChange={(e) => handleSettingChange('captions', 'y_position', Math.max(parseInt(e.target.value), 1))}
                          min={1}
                          max={100}
                          suffix="%"
                          disabled={disabled}
                          darkMode={darkMode}
                        />

                        {/* Text Color */}
                        <div>
                          <label className={`block text-xs mb-2 ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                            Text Color
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={currentSettings.captions.color || '#FFFFFF'}
                              onChange={(e) => handleSettingChange('captions', 'color', e.target.value)}
                              className="w-10 h-10 rounded cursor-pointer"
                              disabled={disabled}
                            />
                            <input
                              type="text"
                              value={currentSettings.captions.color || '#FFFFFF'}
                              onChange={(e) => handleSettingChange('captions', 'color', e.target.value)}
                              className={`flex-1 px-2 py-1 rounded text-sm ${darkMode ? 'text-zinc-300' : 'bg-gray-100 text-gray-700'}`}
                              style={{ backgroundColor: darkMode ? '#303030' : undefined }}
                              disabled={disabled}
                            />
                          </div>
                        </div>

                        {/* Stroke Settings */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="checkbox"
                              checked={currentSettings.captions.hasStroke || false}
                              onChange={(e) => handleSettingChange('captions', 'hasStroke', e.target.checked)}
                              className="w-4 h-4"
                              disabled={disabled}
                            />
                            <label className={`text-xs ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                              Text Stroke
                            </label>
                          </div>
                          {currentSettings.captions.hasStroke && (
                            <div className="space-y-3 ml-6">
                              <div className="flex items-center gap-2">
                                <label className={`text-xs ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                                  Stroke Color
                                </label>
                                <input
                                  type="color"
                                  value={currentSettings.captions.strokeColor || '#000000'}
                                  onChange={(e) => handleSettingChange('captions', 'strokeColor', e.target.value)}
                                  className="w-8 h-8 rounded cursor-pointer"
                                  disabled={disabled}
                                />
                              </div>
                              <StyledSlider
                                label="Stroke Width"
                                value={Math.max(currentSettings.captions.strokeWidth || 3, 0.1)}
                                onChange={(e) => handleSettingChange('captions', 'strokeWidth', Math.max(parseFloat(e.target.value), 0.1))}
                                min={0.1}
                                max={5}
                                step={0.1}
                                suffix="px"
                                disabled={disabled}
                                darkMode={darkMode}
                              />
                            </div>
                          )}
                        </div>

                        {/* Background Settings */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="checkbox"
                              checked={currentSettings.captions.hasBackground || false}
                              onChange={(e) => handleSettingChange('captions', 'hasBackground', e.target.checked)}
                              className="w-4 h-4"
                              disabled={disabled}
                            />
                            <label className={`text-xs ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                              Background Box
                            </label>
                          </div>
                          {currentSettings.captions.hasBackground && (
                            <div className="space-y-3 ml-6">
                              <div className="flex items-center gap-2">
                                <label className={`text-xs ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                                  Background Color
                                </label>
                                <input
                                  type="color"
                                  value={currentSettings.captions.backgroundColor || '#000000'}
                                  onChange={(e) => handleSettingChange('captions', 'backgroundColor', e.target.value)}
                                  className="w-8 h-8 rounded cursor-pointer"
                                  disabled={disabled}
                                />
                              </div>
                              <StyledSlider
                                label="Background Opacity"
                                value={currentSettings.captions.backgroundOpacity !== undefined ? currentSettings.captions.backgroundOpacity : 0.8}
                                onChange={(e) => handleSettingChange('captions', 'backgroundOpacity', parseFloat(e.target.value))}
                                min={0}
                                max={1}
                                step={0.1}
                                suffix=""
                                disabled={disabled}
                                darkMode={darkMode}
                              />
                            </div>
                          )}
                        </div>

                        {/* Highlight Keywords */}
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={currentSettings.captions.highlight_keywords || false}
                            onChange={(e) => handleSettingChange('captions', 'highlight_keywords', e.target.checked)}
                            className="w-4 h-4"
                            disabled={disabled}
                          />
                          <label className={`text-sm ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                            Highlight important keywords
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Clipping Tab */}
                {activeEditorTab === 'clipping' && (
                  <div className="space-y-4">
                    {/* Clipping Header */}
                    <div className="mb-4">
                      <h3 className={`text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                        Clipping Options
                      </h3>
                    </div>

                    {/* AI Auto Clipping */}
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="remove_silence"
                        id="remove_silence"
                        checked={form.remove_silence || false}
                        onChange={onChange}
                        className="h-4 w-4 rounded border-primary-300 text-accent-600 focus:ring-accent-500"
                        disabled={disabled}
                      />
                      <label htmlFor="remove_silence" className={`ml-2 block text-sm ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                        AI Auto Clipping
                      </label>
                    </div>
                  </div>
                )}

                {/* Audio Tab */}
                {activeEditorTab === 'audio' && (
                  <div className="space-y-4">
                    {/* Audio Header */}
                    <div className="mb-4">
                      <h3 className={`text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                        Audio Settings
                      </h3>
                    </div>

                    {/* Output Volume Section */}
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          name="output_volume_enabled"
                          id="output_volume_enabled"
                          checked={form.output_volume_enabled || false}
                          onChange={onChange}
                          className="h-4 w-4 rounded border-primary-300 text-accent-600 focus:ring-accent-500"
                          disabled={disabled}
                        />
                        <label htmlFor="output_volume_enabled" className={`ml-2 block text-sm ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                          Output volume
                        </label>
                      </div>

                      {/* Volume slider - shows when enabled */}
                      {form.output_volume_enabled && (
                        <div className="ml-6 space-y-3">
                          <div className="flex items-center justify-between">
                            <label className={`text-sm ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                              Volume
                            </label>
                            <span className={`text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                              {(() => {
                                // Map slider value to display percentage
                                // 0 = 0%, 0.25 = 100%, 0.5 = 200%, 1.0 = 400%
                                const displayPercent = (form.output_volume_level || 0.25) * 400;
                                if (displayPercent === 0) return '0%';
                                if (displayPercent < 100) return `${Math.round(displayPercent)}%`;
                                // Add "dB" style formatting for values at or above 100%
                                const db = 20 * Math.log10(displayPercent / 100);
                                return `${Math.round(displayPercent)}% (${db >= 0 ? '+' : ''}${db.toFixed(1)}dB)`;
                              })()}
                            </span>
                          </div>
                          <div className="relative">
                            {/* Slider track background */}
                            <div className={`absolute top-1/2 -translate-y-1/2 w-full h-1 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`}>
                              {/* Filled portion of track - originates from 25% mark */}
                              <div
                                className={`absolute h-full rounded-full ${darkMode ? 'bg-accent-500' : 'bg-accent-600'}`}
                                style={{
                                  left: (form.output_volume_level || 0.25) < 0.25 ? `${(form.output_volume_level || 0.25) * 100}%` : '25%',
                                  width: `${Math.abs((form.output_volume_level || 0.25) - 0.25) * 100}%`
                                }}
                              />
                              {/* Tick mark at 25% (normal volume) */}
                              <div
                                className={`absolute top-1/2 -translate-y-1/2 w-0.5 h-3 ${darkMode ? 'bg-gray-500' : 'bg-gray-400'}`}
                                style={{ left: '25%', transform: 'translateX(-50%) translateY(-50%)' }}
                              />
                            </div>
                            {/* Actual range input (invisible but functional) */}
                            <input
                              type="range"
                              name="output_volume_level"
                              min="0"
                              max="1"
                              step="0.01"
                              value={form.output_volume_level || 0.25}
                              onChange={onChange}
                              className="relative w-full h-1 opacity-0 cursor-pointer z-10"
                              disabled={disabled}
                            />
                            {/* Custom thumb */}
                            <div
                              className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full shadow-md pointer-events-none ${darkMode ? 'bg-white border-gray-600' : 'bg-white border-gray-400'} border`}
                              style={{ left: `${(form.output_volume_level || 0.25) * 100}%`, transform: 'translateX(-50%) translateY(-50%)' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Background Music Section */}
                    <div className="pt-4 border-t border-opacity-20">
                      <h4 className={`text-sm font-medium mb-3 ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                        Background Music
                      </h4>
                    </div>

                    {/* Enable Background Music */}
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="musicEnabledEditor"
                        checked={currentSettings.music.enabled}
                        onChange={(e) => handleSettingChange('music', 'enabled', e.target.checked)}
                        className="h-4 w-4 rounded border-primary-300 text-accent-600 focus:ring-accent-500"
                        disabled={disabled}
                      />
                      <label htmlFor="musicEnabledEditor" className={`ml-2 block text-sm ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                        Enable Background Music
                      </label>
                    </div>

                    {currentSettings.music.enabled && (
                      <div className="space-y-4">
                        {/* Track Selection */}
                        <div>
                          <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                            Track Selection
                          </label>
                          <select
                            value={currentSettings.music.track_id}
                            onChange={(e) => handleSettingChange('music', 'track_id', e.target.value)}
                            className={`w-full rounded-md shadow-sm focus:border-accent-500 focus:ring-accent-500 text-sm px-3 py-2
                              ${darkMode
                                ? 'border-zinc-600 text-primary-100'
                                : 'bg-white border-gray-300 text-primary-900'
                              } border`}
                            style={{ backgroundColor: darkMode ? '#303030' : undefined }}
                            disabled={disabled}
                          >
                            <option value="">Select a track...</option>
                            {availableTracks.map((track) => (
                              <option key={track.id} value={track.id}>
                                {track.title} - {track.artist} ({Math.round(track.duration)}s)
                              </option>
                            ))}
                          </select>
                          {availableTracks.length === 0 && (
                            <p className={`mt-2 text-xs ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
                              No music tracks uploaded yet. Upload tracks in the Music tab.
                            </p>
                          )}
                        </div>

                        {/* Volume Slider */}
                        <StyledSlider
                          label="Music Volume"
                          value={currentSettings.music.volume}
                          onChange={(e) => handleSettingChange('music', 'volume', parseFloat(e.target.value))}
                          min={0}
                          max={2}
                          step={0.1}
                          suffix={`% (${Math.round(currentSettings.music.volume * 50)}% of original)`}
                          disabled={disabled}
                          darkMode={darkMode}
                        />
                      </div>
                    )}

                    {/* Enhance for ElevenLabs */}
                    <div className="pt-4 border-t border-opacity-20">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          name="enhance_for_elevenlabs"
                          id="enhance_for_elevenlabs"
                          checked={form.enhance_for_elevenlabs || false}
                          onChange={onChange}
                          className="h-4 w-4 rounded border-primary-300 text-accent-600 focus:ring-accent-500"
                          disabled={disabled}
                        />
                        <label htmlFor="enhance_for_elevenlabs" className={`ml-2 block text-sm ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                          Enhance for ElevenLabs
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Filters Tab */}
                {activeEditorTab === 'filters' && (
                  <div className="space-y-4">
                    {/* Filters Header */}
                    <div className="mb-4">
                      <h3 className={`text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                        Video Filters
                      </h3>
                    </div>

                    {/* Use Randomization */}
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          name="use_randomization"
                          id="use_randomization"
                          checked={form.use_randomization || false}
                          onChange={onChange}
                          className="h-5 w-5 rounded border-primary-300 text-accent-600 focus:ring-accent-500"
                          disabled={disabled}
                        />
                        <label htmlFor="use_randomization" className={`ml-2 block text-sm font-bold ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                          Use randomization
                        </label>
                      </div>
                      <p className={`text-xs ml-7 ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
                        Randomizes the generated video to create variations. Turn off for consistent results.
                      </p>

                      {/* Randomization Intensity - shows when enabled */}
                      {form.use_randomization && (
                        <div className="ml-7 mt-3">
                          <label htmlFor="randomization_intensity" className={`block text-sm ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                            Randomization Intensity
                          </label>
                          <select
                            id="randomization_intensity"
                            name="randomization_intensity"
                            value={form.randomization_intensity || 'medium'}
                            onChange={onChange}
                            className={`mt-1 block w-full rounded-md shadow-sm focus:border-accent-500 focus:ring-accent-500 text-sm px-3 py-2
                              ${darkMode
                                ? 'border-zinc-600 text-primary-100'
                                : 'bg-white border-gray-300 text-primary-900'
                              } border`}
                            style={{ backgroundColor: darkMode ? '#303030' : undefined }}
                            disabled={disabled}
                          >
                            <option value="none">None</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* B-roll Tab */}
                {activeEditorTab === 'broll' && (
                  <div className="space-y-4">
                    {/* B-roll Header */}
                    <div className="mb-4">
                      <h3 className={`text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                        B-roll & Overlay Settings
                      </h3>
                    </div>

                    {/* Use product clip overlay */}
                    <div className="space-y-4">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          name="use_overlay"
                          id="use_overlay"
                          checked={form.use_overlay || false}
                          onChange={onChange}
                          className="h-4 w-4 rounded border-primary-300 text-accent-600 focus:ring-accent-500"
                          disabled={disabled}
                        />
                        <label htmlFor="use_overlay" className={`ml-2 block text-sm font-medium ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                          Use product clip overlay
                        </label>
                      </div>

                      {/* Overlay Configuration - only show when use_overlay is checked */}
                      {form.use_overlay && (
                        <div className="ml-6 space-y-4">
                          {/* Product Clip Selection */}
                          <div>
                            <label htmlFor="clipId" className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                              Product Clip (Required for overlay)
                            </label>
                            <div className="mt-1 relative">
                              <select
                                id="clipId"
                                name="clipId"
                                value={form.clipId || ''}
                                onChange={onChange}
                                required={form.use_overlay}
                                className={`block w-full rounded-md shadow-sm focus:border-accent-500 focus:ring-accent-500 text-sm px-3 py-2 appearance-none
                                  ${darkMode
                                    ? 'border-zinc-600 text-primary-100'
                                    : 'bg-white border-gray-300 text-primary-900'
                                  } border`}
                                style={{ backgroundColor: darkMode ? '#303030' : undefined }}
                                disabled={disabled}
                              >
                                <option value="">Select a product clip</option>
                                {clips && clips.map((clip) => (
                                  <option key={clip.id} value={clip.id}>
                                    {clip.name} - {clip.product}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <p className={`mt-1 text-xs ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
                              A product clip is required when overlay is enabled
                            </p>
                          </div>

                          {/* Trigger Keywords */}
                          <div>
                            <label htmlFor="trigger_keywords" className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                              Trigger Keywords (comma-separated)
                            </label>
                            <div className="mt-1 relative">
                              <input
                                type="text"
                                name="trigger_keywords"
                                id="trigger_keywords"
                                value={form.trigger_keywords || ''}
                                onChange={onChange}
                                className={`block w-full rounded-md shadow-sm focus:border-accent-500 focus:ring-accent-500 text-sm px-3 py-2
                                  ${darkMode
                                    ? 'border-zinc-600 text-primary-100 placeholder-primary-400'
                                    : 'bg-white border-gray-300 text-primary-900 placeholder-primary-400'
                                  } border`}
                                style={{ backgroundColor: darkMode ? '#303030' : undefined }}
                                placeholder="keyword1, keyword2, keyword3"
                                disabled={disabled}
                              />
                            </div>
                            <p className={`mt-1 text-xs ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
                              Words to emphasize in the video and trigger overlay display (optional)
                            </p>
                          </div>

                          {/* Overlay Placement */}
                          <div>
                            <label htmlFor="overlay_placement" className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                              Overlay Placement
                            </label>
                            <select
                              id="overlay_placement"
                              name="overlay_placement"
                              value={form.overlay_placement || 'bottom_right'}
                              onChange={onChange}
                              className={`mt-1 block w-full rounded-md shadow-sm focus:border-accent-500 focus:ring-accent-500 text-sm px-3 py-2
                                ${darkMode
                                  ? 'border-zinc-600 text-primary-100'
                                  : 'bg-white border-gray-300 text-primary-900'
                                } border`}
                              style={{ backgroundColor: darkMode ? '#303030' : undefined }}
                              disabled={disabled}
                            >
                              <option value="top_left">Top Left</option>
                              <option value="top_center">Top Center</option>
                              <option value="top_right">Top Right</option>
                              <option value="middle_left">Middle Left</option>
                              <option value="middle_center">Middle Center</option>
                              <option value="middle_right">Middle Right</option>
                              <option value="bottom_left">Bottom Left</option>
                              <option value="bottom_center">Bottom Center</option>
                              <option value="bottom_right">Bottom Right</option>
                            </select>
                          </div>

                          {/* Size Range */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label htmlFor="overlay_size_min" className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                                Min Size (0.0-1.0)
                              </label>
                              <input
                                type="number"
                                name="overlay_size_min"
                                id="overlay_size_min"
                                min="0"
                                max="1"
                                step="0.01"
                                value={form.overlay_size_min || 0.2}
                                onChange={onChange}
                                className={`mt-1 block w-full rounded-md shadow-sm focus:border-accent-500 focus:ring-accent-500 text-sm px-3 py-2
                                  ${darkMode
                                    ? 'border-zinc-600 text-primary-100'
                                    : 'bg-white border-gray-300 text-primary-900'
                                  } border`}
                                style={{ backgroundColor: darkMode ? '#303030' : undefined }}
                                disabled={disabled}
                              />
                            </div>
                            <div>
                              <label htmlFor="overlay_size_max" className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                                Max Size (0.0-1.0)
                              </label>
                              <input
                                type="number"
                                name="overlay_size_max"
                                id="overlay_size_max"
                                min="0"
                                max="1"
                                step="0.01"
                                value={form.overlay_size_max || 0.4}
                                onChange={onChange}
                                className={`mt-1 block w-full rounded-md shadow-sm focus:border-accent-500 focus:ring-accent-500 text-sm px-3 py-2
                                  ${darkMode
                                    ? 'border-zinc-600 text-primary-100'
                                    : 'bg-white border-gray-300 text-primary-900'
                                  } border`}
                                style={{ backgroundColor: darkMode ? '#303030' : undefined }}
                                disabled={disabled}
                              />
                            </div>
                          </div>

                          {/* Maximum Overlay Duration */}
                          <div>
                            <label htmlFor="overlay_max_duration" className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                              Maximum Overlay Duration (seconds)
                            </label>
                            <input
                              type="number"
                              name="overlay_max_duration"
                              id="overlay_max_duration"
                              min="0.1"
                              step="0.1"
                              value={form.overlay_max_duration || 3.0}
                              onChange={onChange}
                              className={`mt-1 block w-full rounded-md shadow-sm focus:border-accent-500 focus:ring-accent-500 text-sm px-3 py-2
                                ${darkMode
                                  ? 'border-zinc-600 text-primary-100'
                                  : 'bg-white border-gray-300 text-primary-900'
                                } border`}
                              style={{ backgroundColor: darkMode ? '#303030' : undefined }}
                              disabled={disabled}
                            />
                          </div>

                          <p className={`text-xs ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
                            Configure how the product clip overlay appears in the video
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Scripting Tab */}
                {activeEditorTab === 'scripting' && (
                  <div className="space-y-4">
                    {/* Scripting Header */}
                    <div className="mb-4">
                      <div className="flex items-center gap-2">
                        <h3 className={`text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                          Script & Content Settings
                        </h3>
                        <div className="group relative"
                          onMouseEnter={(e) => {
                            const tooltip = e.currentTarget.querySelector('.tooltip');
                            const container = e.currentTarget.closest('.flex-1');
                            if (tooltip && container) {
                              const containerRect = container.getBoundingClientRect();
                              const iconRect = e.currentTarget.getBoundingClientRect();
                              const tooltipWidth = 256; // w-64 = 256px

                              // Calculate space on left and right
                              const spaceOnLeft = iconRect.left - containerRect.left;
                              const spaceOnRight = containerRect.right - iconRect.right;

                              // Position based on available space
                              if (spaceOnRight >= tooltipWidth) {
                                // Enough space on right, position normally
                                tooltip.style.left = '0px';
                                tooltip.style.right = 'auto';
                              } else if (spaceOnLeft >= tooltipWidth) {
                                // Not enough space on right, position on left
                                tooltip.style.right = '0px';
                                tooltip.style.left = 'auto';
                              } else {
                                // Not enough space on either side, center and constrain
                                tooltip.style.left = '50%';
                                tooltip.style.right = 'auto';
                                tooltip.style.transform = 'translateX(-50%)';
                                tooltip.style.maxWidth = `${Math.min(spaceOnLeft + spaceOnRight - 32, 256)}px`;
                              }
                            }
                          }}>
                          <svg className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className={`tooltip absolute top-full mt-2 left-0 w-64 p-2 text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50
                            ${darkMode ? 'bg-zinc-700 text-primary-200' : 'bg-gray-800 text-white'}`}>
                            Just like prompting ChatGPT, but for videos. Like of this like a prompt template for AI to give you videos, based on your creative inputs
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Product */}
                    <div>
                      <label htmlFor="product" className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                        Product
                      </label>
                      <div className="mt-1 relative">
                        <input
                          type="text"
                          name="product"
                          id="product"
                          required
                          value={form.product || ''}
                          onChange={onChange}
                          className={`mt-1 block w-full rounded-md shadow-sm focus:border-accent-500 focus:ring-accent-500 text-sm px-3 py-2
                            ${darkMode
                              ? 'border-zinc-600 text-primary-100 placeholder-primary-400'
                              : 'bg-white border-gray-300 text-primary-900 placeholder-primary-400'
                            } border`}
                          style={{ backgroundColor: darkMode ? '#303030' : undefined }}
                          placeholder="Your Product"
                          disabled={disabled}
                        />
                      </div>
                    </div>

                    {/* Brand Name */}
                    <div>
                      <label htmlFor="brand_name" className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                        Brand Name (optional)
                      </label>
                      <div className="mt-1 relative">
                        <input
                          type="text"
                          name="brand_name"
                          id="brand_name"
                          value={form.brand_name || ''}
                          onChange={onChange}
                          className={`mt-1 block w-full rounded-md shadow-sm focus:border-accent-500 focus:ring-accent-500 text-sm px-3 py-2
                            ${darkMode
                              ? 'border-zinc-600 text-primary-100 placeholder-primary-400'
                              : 'bg-white border-gray-300 text-primary-900 placeholder-primary-400'
                            } border`}
                          style={{ backgroundColor: darkMode ? '#303030' : undefined }}
                          placeholder="Your brand name"
                          disabled={disabled}
                        />
                      </div>
                    </div>

                    {/* Avatar Selection - only show for avatar campaigns */}
                    {form.campaignType === 'avatar' && (
                      <div>
                        <label htmlFor="avatarId" className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                          Select Avatar
                        </label>
                        <div className="mt-1 relative">
                          <select
                            id="avatarId"
                            name="avatarId"
                            required={form.campaignType === 'avatar'}
                            value={form.avatarId || ''}
                            onChange={onChange}
                            className={`block w-full rounded-md shadow-sm focus:border-accent-500 focus:ring-accent-500 text-sm px-3 py-2 appearance-none
                              ${darkMode
                                ? 'border-zinc-600 text-primary-100'
                                : 'bg-white border-gray-300 text-primary-900'
                              } border`}
                            style={{ backgroundColor: darkMode ? '#303030' : undefined }}
                            disabled={disabled}
                          >
                            <option value="">Select a backend avatar</option>
                            {backendAvatars && backendAvatars.length > 0 ? (
                              backendAvatars.map((avatar) => (
                                <option key={avatar.id} value={avatar.id}>
                                  {avatar.name} (ID: {avatar.id.substring(0, 10)}...)
                                </option>
                              ))
                            ) : (
                              <option value="" disabled>No backend avatars available</option>
                            )}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Select Script */}
                    <div>
                      <div className="flex items-center gap-2">
                        <label htmlFor="scriptId" className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                          Select Example Script
                        </label>
                        <div className="group relative"
                          onMouseEnter={(e) => {
                            const tooltip = e.currentTarget.querySelector('.tooltip');
                            const container = e.currentTarget.closest('.flex-1');
                            if (tooltip && container) {
                              const containerRect = container.getBoundingClientRect();
                              const iconRect = e.currentTarget.getBoundingClientRect();
                              const tooltipWidth = 256; // w-64 = 256px

                              // Calculate space on left and right
                              const spaceOnLeft = iconRect.left - containerRect.left;
                              const spaceOnRight = containerRect.right - iconRect.right;

                              // Position based on available space
                              if (spaceOnRight >= tooltipWidth) {
                                // Enough space on right, position normally
                                tooltip.style.left = '0px';
                                tooltip.style.right = 'auto';
                              } else if (spaceOnLeft >= tooltipWidth) {
                                // Not enough space on right, position on left
                                tooltip.style.right = '0px';
                                tooltip.style.left = 'auto';
                              } else {
                                // Not enough space on either side, center and constrain
                                tooltip.style.left = '50%';
                                tooltip.style.right = 'auto';
                                tooltip.style.transform = 'translateX(-50%)';
                                tooltip.style.maxWidth = `${Math.min(spaceOnLeft + spaceOnRight - 32, 256)}px`;
                              }
                            }
                          }}>
                          <svg className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className={`tooltip absolute bottom-full mb-2 left-0 w-64 p-2 text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50
                            ${darkMode ? 'bg-zinc-700 text-primary-200' : 'bg-gray-800 text-white'}`}>
                            Choose a script to anchor AI generation, or enable "Use exact" to use as-is
                          </div>
                        </div>
                      </div>
                      <div className="mt-1 relative">
                        <select
                          id="scriptId"
                          name="scriptId"
                          required
                          value={form.scriptId || ''}
                          onChange={onChange}
                          className={`block w-full rounded-md shadow-sm focus:border-accent-500 focus:ring-accent-500 text-sm px-3 py-2 appearance-none
                            ${darkMode
                              ? 'border-zinc-600 text-primary-100'
                              : 'bg-white border-gray-300 text-primary-900'
                            } border`}
                          style={{ backgroundColor: darkMode ? '#303030' : undefined }}
                          disabled={disabled}
                        >
                          <option value="">Select a script</option>
                          {scripts && scripts.map((script) => (
                            <option key={script.id} value={script.id}>
                              {script.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Use exact script content toggle */}
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="useExactScript"
                          name="useExactScript"
                          checked={form.useExactScript || false}
                          onChange={onChange}
                          className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-gray-300 rounded"
                          disabled={disabled}
                        />
                        <label htmlFor="useExactScript" className={`text-sm ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                          Use exact script content (skip AI generation)
                        </label>
                        <div className="group relative"
                          onMouseEnter={(e) => {
                            const tooltip = e.currentTarget.querySelector('.tooltip');
                            const container = e.currentTarget.closest('.flex-1');
                            if (tooltip && container) {
                              const containerRect = container.getBoundingClientRect();
                              const iconRect = e.currentTarget.getBoundingClientRect();
                              const tooltipWidth = 256; // w-64 = 256px

                              // Calculate space on left and right
                              const spaceOnLeft = iconRect.left - containerRect.left;
                              const spaceOnRight = containerRect.right - iconRect.right;

                              // Position based on available space
                              if (spaceOnRight >= tooltipWidth) {
                                // Enough space on right, position normally
                                tooltip.style.left = '0px';
                                tooltip.style.right = 'auto';
                              } else if (spaceOnLeft >= tooltipWidth) {
                                // Not enough space on right, position on left
                                tooltip.style.right = '0px';
                                tooltip.style.left = 'auto';
                              } else {
                                // Not enough space on either side, center and constrain
                                tooltip.style.left = '50%';
                                tooltip.style.right = 'auto';
                                tooltip.style.transform = 'translateX(-50%)';
                                tooltip.style.maxWidth = `${Math.min(spaceOnLeft + spaceOnRight - 32, 256)}px`;
                              }
                            }
                          }}>
                          <svg className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className={`tooltip absolute bottom-full mb-2 left-0 w-64 p-2 text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50
                            ${darkMode ? 'bg-zinc-700 text-primary-200' : 'bg-gray-800 text-white'}`}>
                            Uses your script exactly as written, bypassing AI modifications
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Hook */}
                    <div>
                      <label htmlFor="hook" className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                        Hook
                      </label>
                      <textarea
                        name="hook"
                        id="hook"
                        required
                        value={form.hook || ''}
                        onChange={onChange}
                        rows={3}
                        className={`mt-1 block w-full rounded-md shadow-sm focus:border-accent-500 focus:ring-accent-500 text-sm px-3 py-2
                          ${darkMode
                            ? 'border-zinc-600 text-primary-100 placeholder-primary-400'
                            : 'bg-white border-gray-300 text-primary-900 placeholder-primary-400'
                          } border`}
                        style={{ backgroundColor: darkMode ? '#303030' : undefined }}
                        placeholder="Are you tired of products that don't deliver?"
                        disabled={disabled}
                      />
                    </div>

                    {/* Persona */}
                    <div>
                      <label htmlFor="persona" className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                        Persona
                      </label>
                      <textarea
                        name="persona"
                        id="persona"
                        required
                        value={form.persona || ''}
                        onChange={onChange}
                        rows={2}
                        className={`mt-1 block w-full rounded-md shadow-sm focus:border-accent-500 focus:ring-accent-500 text-sm px-3 py-2
                          ${darkMode
                            ? 'border-zinc-600 text-primary-100 placeholder-primary-400'
                            : 'bg-white border-gray-300 text-primary-900 placeholder-primary-400'
                          } border`}
                        style={{ backgroundColor: darkMode ? '#303030' : undefined }}
                        placeholder="Friendly marketing expert"
                        disabled={disabled}
                      />
                    </div>

                    {/* Setting */}
                    <div>
                      <label htmlFor="setting" className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                        Setting
                      </label>
                      <input
                        type="text"
                        name="setting"
                        id="setting"
                        required
                        value={form.setting || ''}
                        onChange={onChange}
                        className={`mt-1 block w-full rounded-md shadow-sm focus:border-accent-500 focus:ring-accent-500 text-sm px-3 py-2
                          ${darkMode
                            ? 'border-zinc-600 text-primary-100 placeholder-primary-400'
                            : 'bg-white border-gray-300 text-primary-900 placeholder-primary-400'
                          } border`}
                        style={{ backgroundColor: darkMode ? '#303030' : undefined }}
                        placeholder="Modern office with bright lighting"
                        disabled={disabled}
                      />
                    </div>

                    {/* Emotion */}
                    <div>
                      <label htmlFor="emotion" className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                        Emotion
                      </label>
                      <div className="mt-1 relative">
                        <select
                          id="emotion"
                          name="emotion"
                          required
                          value={form.emotion || 'neutral'}
                          onChange={onChange}
                          className={`block w-full rounded-md shadow-sm focus:border-accent-500 focus:ring-accent-500 text-sm px-3 py-2 appearance-none
                            ${darkMode
                              ? 'border-zinc-600 text-primary-100'
                              : 'bg-white border-gray-300 text-primary-900'
                            } border`}
                          style={{ backgroundColor: darkMode ? '#303030' : undefined }}
                          disabled={disabled}
                        >
                          <option value="neutral">Neutral</option>
                          <option value="happy">Happy</option>
                          <option value="excited">Excited</option>
                          <option value="professional">Professional</option>
                          <option value="enthusiastic">Enthusiastic</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Other tabs placeholder content */}
                {activeEditorTab !== 'templates' && activeEditorTab !== 'captions' && activeEditorTab !== 'audio' && activeEditorTab !== 'clipping' && activeEditorTab !== 'filters' && activeEditorTab !== 'broll' && activeEditorTab !== 'scripting' && activeEditorTab !== 'splice' && (
                  <div className={`flex-1 flex items-center justify-center rounded-lg border-2 border-dashed ${
                    darkMode
                      ? 'border-dark-600/50 bg-dark-800/30'
                      : 'border-primary-200 bg-primary-50/30'
                  } min-h-[200px]`}>
                    <div className="text-center p-4">
                      <div className={`text-sm ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
                        {activeEditorTab.charAt(0).toUpperCase() + activeEditorTab.slice(1)} Panel
                      </div>
                      <div className={`text-xs mt-1 ${darkMode ? 'text-primary-500' : 'text-primary-400'}`}>
                        Coming soon
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Center Panel - Preview */}
          <div className={`relative rounded-xl border ${
            darkMode
              ? 'border-zinc-600'
              : 'bg-neutral-100 border-gray-300'
          } overflow-hidden`} style={{ height: '730px', backgroundColor: darkMode ? '#262626' : undefined }}>
            <div className="flex flex-col h-full relative">
              {/* Navigation Bar */}
              <div className={`border-b ${darkMode ? 'border-zinc-600' : 'border-gray-300 bg-gray-200'} px-2 py-1.5`} style={{ backgroundColor: darkMode ? '#303030' : undefined }}>
                <div className="flex items-center justify-between space-x-1 overflow-x-auto" style={{ minHeight: '44px' }}>
                  <div className={`flex items-center justify-center px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider ${
                    darkMode ? 'text-zinc-300' : 'text-gray-700'
                  }`}>
                    VIDEO PREVIEW
                  </div>

                  {/* Zoom Controls and Resolution Display */}
                  <div className="flex items-center space-x-1 pr-2">
                    <div className={`text-[10px] font-normal normal-case px-1 ${
                      darkMode ? 'text-zinc-400' : 'text-gray-600'
                    }`}>
                      {artboardSize.actualWidth && artboardSize.actualHeight
                        ? `${artboardSize.actualWidth}×${artboardSize.actualHeight}`
                        : 'Loading...'
                      }
                    </div>
                    <span className={`text-xs ${darkMode ? 'text-zinc-400' : 'text-gray-600'} min-w-[40px] text-center`}>
                      {canvasZoom}%
                    </span>
                    <button
                      type="button"
                      onClick={handleZoomFit}
                      className={`p-1 rounded hover:bg-zinc-700 ${darkMode ? 'text-zinc-400' : 'text-gray-600'}`}
                      title="Fit to Screen"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5h-4m4 0v-4m0 4l-5-5" />
                      </svg>
                    </button>
                    {/* Grid Options Dropdown */}
                    <div className="relative grid-dropdown">
                      <button
                        ref={gridButtonRef}
                        type="button"
                        onClick={() => {
                          if (!showGridDropdown && gridButtonRef.current) {
                            const rect = gridButtonRef.current.getBoundingClientRect();
                            setDropdownPosition({
                              top: rect.bottom + 4,
                              left: rect.left
                            });
                          }
                          setShowGridDropdown(!showGridDropdown);
                        }}
                        className={`p-1 rounded hover:bg-zinc-700 ${gridMode !== 'none' ? 'bg-zinc-700' : ''} ${darkMode ? 'text-zinc-400' : 'text-gray-600'} flex items-center`}
                        title="Grid Options"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                        <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {showGridDropdown && (
                        <div className={`fixed w-48 rounded-md shadow-lg ${
                          darkMode ? 'bg-zinc-800 border border-zinc-600' : 'bg-white border border-gray-300'
                        }`} style={{
                          zIndex: 9999,
                          top: `${dropdownPosition.top}px`,
                          left: `${dropdownPosition.left}px`
                        }}>
                          <div className="py-1">
                            <button
                              type="button"
                              onClick={() => { setGridMode('none'); setShowGridDropdown(false); }}
                              className={`w-full text-left px-3 py-2 text-sm ${
                                gridMode === 'none'
                                  ? darkMode ? 'bg-zinc-700 text-zinc-200' : 'bg-gray-100 text-gray-900'
                                  : darkMode ? 'text-zinc-300 hover:bg-zinc-700' : 'text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              No Grid
                            </button>
                            <button
                              type="button"
                              onClick={() => { setGridMode('grid'); setShowGridDropdown(false); }}
                              className={`w-full text-left px-3 py-2 text-sm ${
                                gridMode === 'grid'
                                  ? darkMode ? 'bg-zinc-700 text-zinc-200' : 'bg-gray-100 text-gray-900'
                                  : darkMode ? 'text-zinc-300 hover:bg-zinc-700' : 'text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              Background Grid
                            </button>
                            <button
                              type="button"
                              onClick={() => { setGridMode('guides'); setShowGridDropdown(false); }}
                              className={`w-full text-left px-3 py-2 text-sm ${
                                gridMode === 'guides'
                                  ? darkMode ? 'bg-zinc-700 text-zinc-200' : 'bg-gray-100 text-gray-900'
                                  : darkMode ? 'text-zinc-300 hover:bg-zinc-700' : 'text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              Center Guides
                            </button>
                            <button
                              type="button"
                              onClick={() => { setGridMode('both'); setShowGridDropdown(false); }}
                              className={`w-full text-left px-3 py-2 text-sm ${
                                gridMode === 'both'
                                  ? darkMode ? 'bg-zinc-700 text-zinc-200' : 'bg-gray-100 text-gray-900'
                                  : darkMode ? 'text-zinc-300 hover:bg-zinc-700' : 'text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              Grid + Guides
                            </button>
                            <hr className={`my-1 ${darkMode ? 'border-zinc-600' : 'border-gray-200'}`} />
                            <button
                              type="button"
                              onClick={() => setSnapToGuides(!snapToGuides)}
                              className={`w-full text-left px-3 py-2 text-sm flex items-center ${
                                darkMode ? 'text-zinc-300 hover:bg-zinc-700' : 'text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded mr-2 border-2 flex items-center justify-center ${
                                snapToGuides
                                  ? darkMode ? 'bg-accent-600 border-accent-600' : 'bg-accent-500 border-accent-500'
                                  : darkMode ? 'border-zinc-500' : 'border-gray-400'
                              }`}>
                                {snapToGuides && (
                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                              Auto-snap to center
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 p-4 flex flex-col" style={{ minHeight: 0 }}>
                {/* Canvas Container with event handlers - Fixed size viewport */}
                <div
                  ref={canvasRef}
                  className={`relative rounded-lg overflow-hidden`}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  style={{
                    height: 'calc(100% - 70px)', // Fixed height, leaves room for Save button
                    backgroundColor: '#1A1A1A',
                    cursor: canvasZoom > 100 ? (isPanning ? 'grabbing' : 'grab') : 'default',
                    backgroundImage: (gridMode === 'grid' || gridMode === 'both')
                      ? 'repeating-linear-gradient(0deg, rgba(156, 163, 175, 0.1) 0px, rgba(156, 163, 175, 0.1) 1px, transparent 1px, transparent 20px), repeating-linear-gradient(90deg, rgba(156, 163, 175, 0.1) 0px, rgba(156, 163, 175, 0.1) 1px, transparent 1px, transparent 20px)'
                      : 'none'
                  }}
                >
                  {/* Center Guide Lines */}
                  {(gridMode === 'guides' || gridMode === 'both') && (
                    <>
                      {/* Vertical center line */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-accent-500 opacity-60 pointer-events-none z-10"
                        style={{
                          left: '50%',
                          transform: 'translateX(-50%)'
                        }}
                      />
                      {/* Horizontal center line */}
                      <div
                        className="absolute left-0 right-0 h-0.5 bg-accent-500 opacity-60 pointer-events-none z-10"
                        style={{
                          top: '50%',
                          transform: 'translateY(-50%)'
                        }}
                      />
                    </>
                  )}

                  {/* Zoom/Pan Container */}
                  <div
                    className="flex items-center justify-center h-full"
                    style={{
                      transform: `translate(${canvasPan.x}px, ${canvasPan.y}px)`,
                      transition: isPanning ? 'none' : 'transform 0.2s ease-out'
                    }}
                  >
                    {/* Video Preview Container */}
                    <div
                      className="relative"
                      style={{
                        width: `${artboardSize.width * (canvasZoom / 100)}px`,
                        height: `${artboardSize.height * (canvasZoom / 100)}px`,
                        backgroundImage: (selectedAvatar && selectedAvatar.filePath && form.campaignType !== 'splice')
                          ? 'none'
                          : darkMode
                            ? 'repeating-linear-gradient(45deg, rgba(156, 163, 175, 0.1) 0px, rgba(156, 163, 175, 0.1) 1px, transparent 1px, transparent 8px)'
                            : 'repeating-linear-gradient(45deg, rgba(107, 114, 128, 0.1) 0px, rgba(107, 114, 128, 0.1) 1px, transparent 1px, transparent 8px)'
                      }}
                    >
                      {/* Avatar Background or Splice Canvas */}
                      {selectedAvatar && selectedAvatar.filePath && form.campaignType !== 'splice' ? (
                        <video
                          ref={videoRef}
                          className="w-full h-full object-cover"
                          muted
                          loop
                          playsInline
                          autoPlay
                          onLoadedMetadata={handleVideoLoadedMetadata}
                          src={window.electron ? `file://${selectedAvatar.filePath}` : selectedAvatar.filePath}
                        />
                      ) : form.campaignType === 'splice' ? (
                        <div className="w-full h-full">
                          {/* Empty splice canvas preview */}
                        </div>
                      ) : (
                        <div className={`w-full h-full flex items-center justify-center`}>
                          <p className={`text-sm text-center px-2 ${darkMode ? 'text-content-300' : 'text-content-700'}`}>
                            {form.campaignType === 'splice' ? 'Splice canvas ready' : 'Select an avatar to see preview'}
                          </p>
                        </div>
                      )}

                      {/* Multiple Text Overlays Preview */}
                      {[1, 2, 3].map((index) => {
                  // Show selected template preview - either text template or editing template
                  let overlaySettings;

                  if (selectedEditingTemplate && selectedEditingTemplate.settings) {
                    // Use the exact same logic as getTextOverlaySettings but with template data
                    const prefix = index === 1 ? 'text_overlay' : `text_overlay_${index}`;
                    const enabledKey = index === 1 ? 'text_overlay_1_enabled' : `${prefix}_enabled`;

                    overlaySettings = {
                      enabled: selectedEditingTemplate.settings[enabledKey] || false,
                      mode: selectedEditingTemplate.settings[`${prefix}_mode`] || 'custom',
                      custom_text: selectedEditingTemplate.settings[`${prefix}_custom_text`] || '',
                      category: selectedEditingTemplate.settings[`${prefix}_category`] || 'engagement',
                      font: selectedEditingTemplate.settings[`${prefix}_font`] || 'System',
                      customFontName: selectedEditingTemplate.settings[`${prefix}_customFontName`] || '',
                      fontSize: selectedEditingTemplate.settings[`${prefix}_fontSize`] || 20,
                      bold: selectedEditingTemplate.settings[`${prefix}_bold`] || false,
                      underline: selectedEditingTemplate.settings[`${prefix}_underline`] || false,
                      italic: selectedEditingTemplate.settings[`${prefix}_italic`] || false,
                      textCase: selectedEditingTemplate.settings[`${prefix}_textCase`] || 'none',
                      color: selectedEditingTemplate.settings[`${prefix}_color`] || '#000000',
                      characterSpacing: selectedEditingTemplate.settings[`${prefix}_characterSpacing`] || 0,
                      lineSpacing: selectedEditingTemplate.settings[`${prefix}_lineSpacing`] || -1,
                      alignment: selectedEditingTemplate.settings[`${prefix}_alignment`] || 'center',
                      style: selectedEditingTemplate.settings[`${prefix}_style`] || 'default',
                      scale: selectedEditingTemplate.settings[`${prefix}_scale`] || 100,
                      x_position: selectedEditingTemplate.settings[`${prefix}_x_position`] || 50,
                      y_position: selectedEditingTemplate.settings[`${prefix}_y_position`] || 50,
                      rotation: selectedEditingTemplate.settings[`${prefix}_rotation`] || 0,
                      opacity: selectedEditingTemplate.settings[`${prefix}_opacity`] || 100,
                      hasStroke: selectedEditingTemplate.settings[`${prefix}_hasStroke`] || false,
                      strokeColor: selectedEditingTemplate.settings[`${prefix}_strokeColor`] || '#000000',
                      strokeThickness: selectedEditingTemplate.settings[`${prefix}_strokeThickness`] || 2,
                      hasBackground: selectedEditingTemplate.settings[`${prefix}_hasBackground`] || false,
                      backgroundColor: selectedEditingTemplate.settings[`${prefix}_backgroundColor`] || '#ffffff',
                      backgroundOpacity: selectedEditingTemplate.settings[`${prefix}_backgroundOpacity`] || 100,
                      backgroundRounded: selectedEditingTemplate.settings[`${prefix}_backgroundRounded`] || 0,
                      backgroundHeight: selectedEditingTemplate.settings[`${prefix}_backgroundHeight`] || 50,
                      backgroundWidth: selectedEditingTemplate.settings[`${prefix}_backgroundWidth`] || 50,
                      backgroundXOffset: selectedEditingTemplate.settings[`${prefix}_backgroundXOffset`] || 0,
                      backgroundYOffset: selectedEditingTemplate.settings[`${prefix}_backgroundYOffset`] || 0,
                      backgroundStyle: selectedEditingTemplate.settings[`${prefix}_backgroundStyle`] || 'basic'
                    };
                  } else if (currentSettings.text_overlay.mode === 'templates' && selectedTemplatePreview) {
                    // Show text template preview
                    overlaySettings = selectedTemplatePreview.textOverlays[index - 1];
                  } else {
                    // Show current form settings
                    overlaySettings = getTextOverlaySettings(index);
                  }

                  if (!overlaySettings || !overlaySettings.enabled) {
                    return null;
                  }

                  // Calculate proper scaling based on artboard dimensions
                  // Use height-based scaling to match backend's percentage-of-height calculation
                  const previewScale = artboardSize.height / (artboardSize.actualHeight || 1920);
                  const zoomScale = canvasZoom / 100;
                  const combinedScale = previewScale * zoomScale;

                  return (
                    <div
                      key={index}
                      className="absolute"
                      style={{
                        left: `${overlaySettings.x_position || 50}%`,
                        top: `${overlaySettings.y_position || 50}%`,
                        fontSize: `${(overlaySettings.fontSize || 20) * combinedScale}px`,
                        fontWeight: overlaySettings.bold ? 'bold' : 'normal',
                        fontStyle: overlaySettings.italic ? 'italic' : 'normal',
                        textDecoration: overlaySettings.underline ? 'underline' : 'none',
                        color: overlaySettings.color || '#000000',
                        fontFamily: overlaySettings.font === 'custom' ? overlaySettings.customFontName || 'System' : overlaySettings.font || 'System',
                        letterSpacing: `${(overlaySettings.characterSpacing || 0) * combinedScale}px`,
                        lineHeight: `${100 + (overlaySettings.lineSpacing || 0) * 5}%`,
                        textAlign: overlaySettings.alignment || 'center',
                        backgroundColor: overlaySettings.hasBackground && overlaySettings.backgroundStyle !== 'line-width'
                          ? `${overlaySettings.backgroundColor}${Math.round((overlaySettings.backgroundOpacity !== undefined ? overlaySettings.backgroundOpacity : 100) * 2.55).toString(16).padStart(2, '0')}`
                          : 'transparent',
                        borderRadius: overlaySettings.hasBackground && overlaySettings.backgroundStyle !== 'line-width'
                          ? `${(overlaySettings.backgroundRounded || 0) * combinedScale}px`
                          : '0px',
                        padding: overlaySettings.hasBackground && overlaySettings.backgroundStyle !== 'line-width'
                          ? `${Math.round(((overlaySettings.backgroundHeight || 50) / 5) * combinedScale)}px ${Math.round(((overlaySettings.backgroundWidth || 50) / 3) * combinedScale)}px`
                          : '0px',
                        marginTop: overlaySettings.hasBackground
                          ? `${(overlaySettings.backgroundYOffset || 0) * combinedScale}px`
                          : '0px',
                        marginLeft: overlaySettings.hasBackground
                          ? `${(overlaySettings.backgroundXOffset || 0) * combinedScale}px`
                          : '0px',
                        WebkitTextStroke: overlaySettings.hasStroke
                          ? `${(overlaySettings.strokeThickness || 2) * combinedScale}px ${overlaySettings.strokeColor || '#000000'}`
                          : 'none',
                        opacity: (overlaySettings.opacity || 100) / 100,
                        transform: `translate(-50%, -50%) scale(${(overlaySettings.scale || 100) / 100}) rotate(${overlaySettings.rotation || 0}deg)`,
                        position: 'absolute',
                        display: 'inline-block',
                        whiteSpace: 'pre',
                        zIndex: index // Ensure proper layering
                      }}
                    >
                      {(() => {
                        let text = '';
                        // If we're previewing an editing template, use its text
                        if (selectedEditingTemplate && selectedEditingTemplate.settings) {
                          text = overlaySettings.custom_text || '';
                        } else if (currentSettings.text_overlay.mode === 'templates' && selectedTemplatePreview) {
                          text = overlaySettings.custom_text || `Text ${index}`;
                        } else if (currentSettings.text_overlay.mode === 'custom' && overlaySettings.custom_text) {
                          text = overlaySettings.custom_text;
                        } else if (currentSettings.text_overlay.mode === 'custom') {
                          text = '';
                        } else if (currentSettings.text_overlay.mode === 'templates') {
                          text = getTemplatePreview(currentSettings.text_overlay.category);
                        } else {
                          text = 'AI Generated Text';
                        }

                        // For line-width mode, use ConnectedTextBackground component
                        if (overlaySettings.hasBackground && overlaySettings.backgroundStyle === 'line-width' && text) {
                          return (
                            <ConnectedTextBackground
                              text={text}
                              backgroundColor={overlaySettings.backgroundColor}
                              backgroundOpacity={overlaySettings.backgroundOpacity !== undefined ? overlaySettings.backgroundOpacity : 100}
                              backgroundRounded={(overlaySettings.backgroundRounded || 0) * combinedScale}
                              padding={10}
                              backgroundHeight={overlaySettings.backgroundHeight || 50}
                              backgroundWidth={overlaySettings.backgroundWidth || 50}
                              lineSpacing={overlaySettings.lineSpacing || 0}
                              fontSize={(overlaySettings.fontSize || 20) * combinedScale}
                              actualFontSize={overlaySettings.fontSize || 20}
                              onExport={(exportData) => handleConnectedBackgroundExport(index, exportData)}
                              style={{
                                fontWeight: overlaySettings.bold ? 'bold' : 'normal',
                                fontStyle: overlaySettings.italic ? 'italic' : 'normal',
                                textDecoration: overlaySettings.underline ? 'underline' : 'none',
                                color: overlaySettings.color || '#000000',
                                fontFamily: overlaySettings.font === 'custom' ? overlaySettings.customFontName || 'System' : overlaySettings.font || 'System',
                                letterSpacing: `${overlaySettings.characterSpacing || 0}px`,
                                lineHeight: `${100 + (overlaySettings.lineSpacing || 0) * 5}%`,
                                textAlign: overlaySettings.alignment || 'center',
                                WebkitTextStroke: overlaySettings.hasStroke
                                  ? `${overlaySettings.strokeThickness || 2}px ${overlaySettings.strokeColor || '#000000'}`
                                  : 'none'
                              }}
                            />
                          );
                        }

                        return text;
                      })()}
                    </div>
                    );
                  })}

                  {/* Caption Preview */}
                {currentSettings.captions.enabled && (() => {
                  // Calculate proper scaling based on artboard dimensions
                  // Use height-based scaling to match backend's percentage-of-height calculation
                  const previewScale = artboardSize.height / (artboardSize.actualHeight || 1920);
                  const zoomScale = canvasZoom / 100;
                  const combinedScale = previewScale * zoomScale;

                  return (
                  <div
                    className="absolute text-center"
                    style={{
                      // Match backend ASS positioning logic: Y determines region, X is always centered in backend
                      left: `${currentSettings.captions.x_position || 50}%`,
                      top: `${currentSettings.captions.y_position || 50}%`,
                      transform: 'translate(-50%, -50%)',
                      fontSize: `${(currentSettings.captions.fontSize || 58) * combinedScale}px`,
                      fontFamily: currentSettings.captions.fontFamily || 'Montserrat-Bold',
                      color: currentSettings.captions.color || '#FFFFFF',
                      width: '85%',
                      maxWidth: 'none',
                      whiteSpace: 'normal',
                      wordBreak: 'normal',
                      overflowWrap: 'normal',
                      ...(currentSettings.captions.hasStroke ? {
                        WebkitTextStroke: `${Math.max(1, Math.round(currentSettings.captions.strokeWidth * combinedScale))}px ${currentSettings.captions.strokeColor}`,
                        WebkitTextFillColor: currentSettings.captions.color,
                        paintOrder: 'stroke fill'
                      } : {}),
                      ...(currentSettings.captions.hasBackground && {
                        backgroundColor: `${currentSettings.captions.backgroundColor}${Math.round(currentSettings.captions.backgroundOpacity * 255).toString(16).padStart(2, '0')}`,
                        padding: `${Math.round(2 * combinedScale)}px ${Math.round(4 * combinedScale)}px`,
                        borderRadius: `${Math.round(2 * combinedScale)}px`
                      })
                    }}
                  >
{(() => {
                      const wordsPerSegment = currentSettings.captions.max_words_per_segment || 4;
                      const sampleWords = ['This', 'is', 'how', 'captions', 'appear', 'with', 'different', 'word', 'counts', 'per', 'segment', 'for', 'better', 'control', 'and', 'timing'];
                      const text = sampleWords.slice(0, wordsPerSegment).join(' ');
                      return currentSettings.captions.allCaps ? text.toUpperCase() : text;
                    })()}
                  </div>
                )})()}
                </div>
              </div>
                </div>

                {/* Save as Template Button - Fixed at bottom */}
                <div className={`mt-3 pt-3 border-t flex-shrink-0 ${
                  darkMode ? 'border-zinc-600' : 'border-gray-300'
                }`}>
                {!showTemplateNameModal ? (
                  <button
                    type="button"
                    onClick={() => setShowTemplateNameModal(true)}
                    className={`w-full px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      disabled
                        ? darkMode ? 'bg-zinc-700 text-zinc-400' : 'bg-gray-300 text-gray-500'
                        : darkMode ? 'bg-zinc-600 hover:bg-zinc-500 text-zinc-200' : 'bg-gray-400 hover:bg-gray-500 text-white'
                    }`}
                    disabled={disabled}
                  >
                    Save as Template
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                        Template Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Professional Sales Video"
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        className={`w-full px-3 py-2 text-sm rounded border ${
                          darkMode
                            ? 'bg-zinc-800 text-white border-zinc-700 focus:border-accent-500'
                            : 'bg-white text-gray-900 border-gray-300 focus:border-accent-500'
                        }`}
                        disabled={disabled}
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (newTemplateName.trim()) {
                            saveEditingTemplate();
                            setShowTemplateNameModal(false);
                          }
                        }}
                        disabled={disabled || !newTemplateName.trim()}
                        className={`flex-1 px-3 py-1.5 text-sm font-medium rounded ${
                          disabled || !newTemplateName.trim()
                            ? darkMode ? 'bg-zinc-700 text-zinc-400' : 'bg-gray-300 text-gray-500'
                            : darkMode ? 'bg-zinc-600 hover:bg-zinc-500 text-zinc-200' : 'bg-gray-400 hover:bg-gray-500 text-white'
                        }`}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowTemplateNameModal(false);
                          setNewTemplateName('');
                        }}
                        className={`flex-1 px-3 py-1.5 text-sm rounded ${
                          darkMode ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        }`}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Text Overlay Controls */}
          <div className={`rounded-xl border ${
            darkMode
              ? 'border-zinc-600'
              : 'bg-neutral-100 border-gray-300'
          } overflow-hidden`} style={{ height: '730px', backgroundColor: darkMode ? '#262626' : undefined }}>
            <div className="flex flex-col h-full">
              {/* Navigation Bar */}
              <div className={`border-b ${darkMode ? 'border-zinc-600' : 'border-gray-300 bg-gray-200'} px-2 py-1.5`} style={{ backgroundColor: darkMode ? '#303030' : undefined }}>
                <div className="flex items-center space-x-1 overflow-x-auto" style={{ minHeight: '44px' }}>
                  <div className={`flex flex-col items-center justify-center min-w-[50px] px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider ${
                    darkMode ? 'text-zinc-300' : 'text-gray-700'
                  }`}>
                    TEXT OVERLAYS
                  </div>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4" style={{ minHeight: 0 }}>

                {/* Enable Text Overlays Checkbox */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="textOverlayEnabled"
                    name="text_overlay_enabled"
                    checked={form.text_overlay_enabled || false}
                    onChange={handleTextOverlayToggle}
                    className="h-4 w-4 rounded border-primary-300 text-accent-600 focus:ring-accent-500"
                    disabled={disabled}
                  />
                  <label htmlFor="textOverlayEnabled" className={`ml-2 block text-sm ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                    Enable Text Overlays
                  </label>
                </div>

                {form.text_overlay_enabled && (
                  <div className="space-y-4">
                    {/* Tab Navigation */}
                    <div className="flex">
                      <button
                        type="button"
                        onClick={() => onChange({target: {name: 'text_overlay_mode', value: 'custom', type: 'text'}})}
                        className={`flex-1 py-2 text-sm font-medium rounded-l-md transition-colors
                          ${(form.text_overlay_mode || 'custom') === 'custom'
                            ? darkMode ? 'bg-zinc-700 text-primary-100' : 'bg-white text-primary-900'
                            : darkMode ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-200 text-gray-600'
                          }`}
                      >
                        Custom
                      </button>
                      <button
                        type="button"
                        onClick={() => onChange({target: {name: 'text_overlay_mode', value: 'ai_generated', type: 'text'}})}
                        className={`flex-1 py-2 text-sm font-medium rounded-r-md transition-colors
                          ${form.text_overlay_mode === 'ai_generated'
                            ? darkMode ? 'bg-zinc-700 text-primary-100' : 'bg-white text-primary-900'
                            : darkMode ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-200 text-gray-600'
                          }`}
                      >
                        AI Generated
                      </button>
                    </div>

                    {/* Multiple Custom Text Overlays */}
                    {(form.text_overlay_mode || 'custom') === 'custom' && (
                      <div className="space-y-3">
                        {[1, 2, 3].map((index) => {
                          const overlaySettings = getTextOverlaySettings(index);
                          const isExpanded = textOverlayExpanded[index] ?? false;

                          return (
                            <div
                              key={index}
                              className={`border rounded-lg ${darkMode ? 'border-zinc-600' : 'border-gray-300 bg-white'}`}
                              style={{ backgroundColor: darkMode ? '#1a1a1a' : undefined }}
                            >
                              {/* Card Header */}
                              <div
                                className={`p-2 flex items-center justify-between cursor-pointer select-none ${darkMode ? 'hover:bg-zinc-700' : 'hover:bg-gray-50'} rounded-t-lg`}
                                onClick={() => setTextOverlayExpanded(prev => ({ ...prev, [index]: !isExpanded }))}
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={overlaySettings.enabled}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      const fieldName = index === 1 ? 'text_overlay_1' : `text_overlay_${index}`;
                                      handleSettingChange(fieldName, 'enabled', e.target.checked);
                                    }}
                                    className="h-4 w-4 rounded border-primary-300 text-accent-600 focus:ring-accent-500"
                                    disabled={disabled}
                                  />
                                  <span className={`font-medium text-sm ${darkMode ? 'text-primary-200' : 'text-primary-800'}`}>
                                    Text {index}
                                  </span>
                                  {overlaySettings.custom_text && (
                                    <span className={`text-xs px-1 py-1 rounded ${darkMode ? 'bg-zinc-700 text-zinc-300' : 'bg-gray-100 text-gray-600'}`}>
                                      {overlaySettings.custom_text.substring(0, 10)}{overlaySettings.custom_text.length > 10 ? '...' : ''}
                                    </span>
                                  )}
                                </div>
                                <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </div>

                              {/* Collapsible Content */}
                              {isExpanded && (
                                <div className={`px-3 py-2 pt-2 border-t ${darkMode ? 'border-zinc-600' : 'border-gray-200'} space-y-3`}>
                                  {/* Text Input */}
                                  <textarea
                                    name={`text_overlay${index === 1 ? '' : `_${index}`}_custom_text`}
                                    value={overlaySettings.custom_text || ''}
                                    onChange={onChange}
                                    placeholder="Enter your text... (Shift+Enter for new line)"
                                    rows={3}
                                    className={`w-full px-3 py-2 rounded-md text-sm resize-none
                                      ${darkMode
                                        ? 'border-zinc-600 text-primary-100 placeholder-zinc-400'
                                        : 'bg-white border-gray-300 text-primary-900 placeholder-gray-400'
                                      } border`}
                                    style={{ backgroundColor: darkMode ? '#303030' : undefined }}
                                    disabled={disabled}
                                  />

                                  {/* Font Selection */}
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <label className={`text-xs ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                                        Font
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const message = `📝 FONT GUIDE:

🎯 PREMIUM FONTS:
• Purchase fonts from Adobe, Google, Monotype, etc.
• Install .otf/.ttf/.woff files on your system
• Restart this app → Font options will work!

📁 CUSTOM FONTS (Any Font):
1. Install any font on your system
2. Select "🎨 Custom Font..." from dropdown
3. Type the exact font name as it appears in your system
4. Examples: "SF Pro Display", "Avenir Next", "Helvetica Neue"

💡 HOW TO FIND FONT NAMES:
• Mac: Font Book app → Shows exact names
• Windows: Settings → Fonts → Shows font names
• The name must match EXACTLY (including spaces)

✨ INCLUDED FONTS:
• Inter → Modern, readable
• Montserrat → Clean, geometric
• Poppins → Friendly, rounded
• Plus all your system fonts!

🔥 PRO TIP: Try common variations like "FontName Bold", "FontName Light", "FontName Semibold"`;
                                          alert(message);
                                        }}
                                        className={`text-xs px-1 py-0.5 rounded ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'}`}
                                        title="Font Help"
                                      >
                                        ?
                                      </button>
                                    </div>
                                    <select
                                      name={`text_overlay${index === 1 ? '' : `_${index}`}_font`}
                                      value={overlaySettings.font || 'System'}
                                      onChange={onChange}
                                      className={`w-full rounded-md text-sm px-3 py-2
                                        ${darkMode
                                          ? 'border-zinc-600 text-primary-100'
                                          : 'bg-white border-gray-300 text-primary-900'
                                        } border`}
                                      style={{ backgroundColor: darkMode ? '#303030' : undefined }}
                                      disabled={disabled}
                                    >
                                      <option value="System">System</option>
                                      <option value="Proxima Nova, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif">Proxima Nova</option>
                                      <option value="ProximaNova-Semibold, Proxima Nova Semibold, ProximaNovA-Semibold, Proxima Nova Semi Bold, Proxima Nova, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif">Proxima Nova Semibold</option>
                                      <option value="ProximaNova-Bold">Proxima Nova Bold</option>
                                      <option value="ProximaNova-Light">Proxima Nova Light</option>
                                      <option value="Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif">Inter</option>
                                      <option value="Poppins, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif">Poppins</option>
                                      <option value="Montserrat, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif">Montserrat</option>
                                      <option value="Arial">Arial</option>
                                      <option value="Helvetica">Helvetica</option>
                                      <option value="Impact">Impact</option>
                                      <option value="Georgia">Georgia</option>
                                      <option value="custom">🎨 Custom Font...</option>
                                    </select>

                                    {/* Custom Font Input */}
                                    {overlaySettings.font === 'custom' && (
                                      <div className="mt-2">
                                        <input
                                          type="text"
                                          placeholder="Enter exact font name (e.g., Proxima Nova Condensed)"
                                          value={overlaySettings.customFontName || ''}
                                          onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'customFontName', e.target.value)}
                                          className={`w-full px-3 py-2 rounded-md text-sm border
                                            ${darkMode
                                              ? 'border-zinc-600 text-primary-100 placeholder-zinc-400'
                                              : 'bg-white border-gray-300 text-primary-900 placeholder-gray-400'
                                            }`}
                                          style={{ backgroundColor: darkMode ? '#303030' : undefined }}
                                          disabled={disabled}
                                        />
                                        <p className={`text-xs mt-1 ${darkMode ? 'text-zinc-400' : 'text-gray-500'}`}>
                                          Font must be installed on your system
                                        </p>
                                      </div>
                                    )}
                                  </div>

                                  {/* Font Size */}
                                  <StyledSlider
                                    label="Font size"
                                    value={getFontPercentage(overlaySettings.fontSize)}
                                    onChange={(e) => {
                                      const percentage = parseFloat(e.target.value);
                                      const pixelSize = Math.round(getFontPixelsFromPercentage(percentage));
                                      handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'fontSize', pixelSize);
                                    }}
                                    min={0.5}
                                    max={15.0}
                                    step={0.1}
                                    suffix="% of video height"
                                    disabled={disabled}
                                    darkMode={darkMode}
                                  />

                                  {/* Text Formatting */}
                                  <div>
                                    <label className={`block text-xs mb-2 ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                                      Pattern
                                    </label>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'bold', !overlaySettings.bold)}
                                        className={`px-3 py-1 text-sm font-bold rounded
                                          ${overlaySettings.bold
                                            ? darkMode ? 'bg-zinc-600 text-primary-100' : 'bg-white text-primary-900 border border-gray-400'
                                            : darkMode ? 'bg-zinc-700 text-zinc-400' : 'bg-gray-100 text-gray-600'
                                          }`}
                                      >
                                        B
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'underline', !overlaySettings.underline)}
                                        className={`px-3 py-1 text-sm underline rounded
                                          ${overlaySettings.underline
                                            ? darkMode ? 'bg-zinc-600 text-primary-100' : 'bg-white text-primary-900 border border-gray-400'
                                            : darkMode ? 'bg-zinc-700 text-zinc-400' : 'bg-gray-100 text-gray-600'
                                          }`}
                                      >
                                        U
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'italic', !overlaySettings.italic)}
                                        className={`px-3 py-1 text-sm italic rounded
                                          ${overlaySettings.italic
                                            ? darkMode ? 'bg-zinc-600 text-primary-100' : 'bg-white text-primary-900 border border-gray-400'
                                            : darkMode ? 'bg-zinc-700 text-zinc-400' : 'bg-gray-100 text-gray-600'
                                          }`}
                                      >
                                        I
                                      </button>
                                    </div>
                                  </div>

                                  {/* Color Picker */}
                                  <div>
                                    <label className={`block text-xs mb-2 ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                                      Color
                                    </label>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="color"
                                        value={overlaySettings.color || '#000000'}
                                        onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'color', e.target.value)}
                                        className="w-10 h-10 rounded cursor-pointer"
                                      />
                                      <input
                                        type="text"
                                        value={overlaySettings.color || '#000000'}
                                        onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'color', e.target.value)}
                                        className={`flex-1 px-2 py-1 rounded text-sm ${darkMode ? 'text-zinc-300' : 'bg-gray-100 text-gray-700'}`}
                                        style={{ backgroundColor: darkMode ? '#303030' : undefined }}
                                      />
                                    </div>
                                  </div>

                                  {/* Stroke Section */}
                                  <div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <input
                                        type="checkbox"
                                        checked={overlaySettings.hasStroke || false}
                                        onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'hasStroke', e.target.checked)}
                                        className="w-4 h-4"
                                      />
                                      <label className={`text-xs ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                                        Text Stroke
                                      </label>
                                    </div>

                                    {overlaySettings.hasStroke && (
                                      <div className="ml-6 space-y-3">
                                        {/* Stroke Color */}
                                        <div>
                                          <label className={`block text-xs mb-1 ${darkMode ? 'text-primary-500' : 'text-primary-500'}`}>
                                            Stroke Color
                                          </label>
                                          <div className="flex items-center gap-2">
                                            <input
                                              type="color"
                                              value={overlaySettings.strokeColor || '#000000'}
                                              onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'strokeColor', e.target.value)}
                                              className="w-8 h-8 rounded cursor-pointer"
                                            />
                                            <input
                                              type="text"
                                              value={overlaySettings.strokeColor || '#000000'}
                                              onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'strokeColor', e.target.value)}
                                              className={`flex-1 px-2 py-1 rounded text-sm ${darkMode ? 'text-zinc-300 border-zinc-600' : 'bg-white text-gray-700 border-gray-300'} border`}
                                              style={{ backgroundColor: darkMode ? '#303030' : undefined }}
                                            />
                                          </div>
                                        </div>

                                        {/* Stroke Thickness */}
                                        <StyledSlider
                                          label="Stroke Size"
                                          value={overlaySettings.strokeThickness || 2}
                                          onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'strokeThickness', parseFloat(e.target.value))}
                                          min={0.5}
                                          max={8}
                                          step={0.5}
                                          suffix=""
                                          disabled={disabled}
                                          darkMode={darkMode}
                                        />
                                      </div>
                                    )}
                                  </div>

                                  {/* Character & Line Spacing */}
                                  <div className="grid grid-cols-2 gap-3">
                                    <StyledSlider
                                      label="Character"
                                      value={Math.round(((overlaySettings.characterSpacing || 0) / 20) * 100)}
                                      onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'characterSpacing', Math.round((parseInt(e.target.value) / 100) * 20))}
                                      min={0}
                                      max={100}
                                      suffix="%"
                                      disabled={disabled}
                                      darkMode={darkMode}
                                    />
                                    <StyledSlider
                                      label="Line"
                                      value={Math.round(((overlaySettings.lineSpacing || 0) + 4) / 24 * 100)}
                                      onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'lineSpacing', Math.round((parseInt(e.target.value) / 100) * 24 - 4))}
                                      min={0}
                                      max={100}
                                      suffix="%"
                                      disabled={disabled}
                                      darkMode={darkMode}
                                    />
                                  </div>

                                  {/* Alignment */}
                                  <div>
                                    <label className={`block text-xs mb-2 ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                                      Alignment
                                    </label>
                                    <div className="flex gap-1">
                                      {['left', 'center', 'right', 'justify'].map((align) => (
                                        <button
                                          key={align}
                                          type="button"
                                          onClick={() => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'alignment', align)}
                                          className={`flex-1 py-1 px-2 text-xs rounded
                                            ${overlaySettings.alignment === align
                                              ? darkMode ? 'bg-zinc-600 text-primary-100' : 'bg-white text-primary-900 border border-gray-400'
                                              : darkMode ? 'bg-zinc-700 text-zinc-400' : 'bg-gray-100 text-gray-600'
                                            }`}
                                        >
                                          {align === 'left' && '⬅'}
                                          {align === 'center' && '⬌'}
                                          {align === 'right' && '➡'}
                                          {align === 'justify' && '☰'}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Preset Styles Grid */}
                                  <div>
                                    <label className={`block text-xs mb-2 ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                                      Preset style
                                    </label>
                                    <div className="grid grid-cols-5 gap-1">
                                      {['default', 'bold_yellow', 'gradient_purple', 'outline_white', 'shadow_black',
                                        'neon_pink', 'retro_orange', 'minimal_gray', 'glitch_cyan', 'vintage_brown'].map((style) => (
                                        <button
                                          key={style}
                                          type="button"
                                          onClick={() => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'style', style)}
                                          className={`aspect-square rounded-md border-2 flex items-center justify-center text-xs font-bold
                                            ${overlaySettings.style === style
                                              ? 'border-accent-500'
                                              : darkMode ? 'border-dark-600' : 'border-neutral-300'
                                            }
                                            ${darkMode ? 'bg-dark-700' : 'bg-neutral-200'}`}
                                        >
                                          Aa
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Transform Section */}
                                  <div>
                                    <label className={`block text-xs mb-2 ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                                      Transform
                                    </label>

                                    {/* Scale - Hide for connected backgrounds (line-width style) */}
                                    {overlaySettings.backgroundStyle !== 'line-width' && (
                                      <div className="mb-3">
                                        <StyledSlider
                                          label="Scale"
                                          value={overlaySettings.scale || 100}
                                          onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'scale', parseInt(e.target.value))}
                                          min={50}
                                          max={200}
                                          suffix="%"
                                          disabled={disabled}
                                          darkMode={darkMode}
                                        />
                                      </div>
                                    )}

                                    {/* Position */}
                                    <div className="grid grid-cols-2 gap-3">
                                      <StyledSlider
                                        label="X"
                                        value={overlaySettings.x_position || 50}
                                        onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'x_position', parseInt(e.target.value))}
                                        min={1}
                                        max={100}
                                        suffix=""
                                        disabled={disabled}
                                        darkMode={darkMode}
                                      />
                                      <StyledSlider
                                        label="Y"
                                        value={overlaySettings.y_position || 50}
                                        onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'y_position', parseInt(e.target.value))}
                                        min={1}
                                        max={100}
                                        suffix=""
                                        disabled={disabled}
                                        darkMode={darkMode}
                                      />
                                    </div>
                                  </div>

                                  {/* Background Section */}
                                  <div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <input
                                        type="checkbox"
                                        checked={overlaySettings.hasBackground || false}
                                        onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'hasBackground', e.target.checked)}
                                        className="w-4 h-4"
                                      />
                                      <label className={`text-xs ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                                        Background
                                      </label>
                                    </div>

                                    {overlaySettings.hasBackground && (
                                      <div className="ml-6 space-y-3">
                                        {/* Background Style is always line-width (connected backgrounds) */}

                                        {/* Background Color */}
                                        <div>
                                          <label className={`block text-xs mb-1 ${darkMode ? 'text-primary-500' : 'text-primary-500'}`}>
                                            Color
                                          </label>
                                          <div className="flex items-center gap-2">
                                            <input
                                              type="color"
                                              value={overlaySettings.backgroundColor || '#ffffff'}
                                              onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'backgroundColor', e.target.value)}
                                              className="w-8 h-8 rounded cursor-pointer"
                                            />
                                            <input
                                              type="text"
                                              value={overlaySettings.backgroundColor || '#ffffff'}
                                              onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'backgroundColor', e.target.value)}
                                              className={`flex-1 px-2 py-1 rounded text-sm ${darkMode ? 'bg-zinc-700 text-zinc-300 border-zinc-600' : 'bg-white text-gray-700 border-gray-300'} border`}
                                            />
                                          </div>
                                        </div>

                                        {/* Background Opacity */}
                                        <StyledSlider
                                          label="Opacity"
                                          value={overlaySettings.backgroundOpacity || 100}
                                          onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'backgroundOpacity', parseInt(e.target.value))}
                                          min={0}
                                          max={100}
                                          suffix="%"
                                          disabled={disabled}
                                          darkMode={darkMode}
                                        />

                                        {/* Rounded Rectangle */}
                                        <StyledSlider
                                          label="Rounded rectangle"
                                          value={overlaySettings.backgroundRounded || 7}
                                          onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'backgroundRounded', parseInt(e.target.value))}
                                          min={1}
                                          max={30}
                                          suffix="px"
                                          disabled={disabled}
                                          darkMode={darkMode}
                                        />

                                        {/* Background Size */}
                                        <div className="grid grid-cols-2 gap-3">
                                          <StyledSlider
                                            label="Height"
                                            value={overlaySettings.backgroundHeight !== undefined ? overlaySettings.backgroundHeight : 50}
                                            onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'backgroundHeight', parseInt(e.target.value))}
                                            min={1}
                                            max={200}
                                            suffix="%"
                                            disabled={disabled}
                                            darkMode={darkMode}
                                          />
                                          <StyledSlider
                                            label="Width"
                                            value={overlaySettings.backgroundWidth !== undefined ? overlaySettings.backgroundWidth : 50}
                                            onChange={(e) => handleSettingChange(`text_overlay${index === 1 ? '' : `_${index}`}`, 'backgroundWidth', parseInt(e.target.value))}
                                            min={1}
                                            max={200}
                                            suffix="%"
                                            disabled={disabled}
                                            darkMode={darkMode}
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}

                      </div>
                    )}

                    {/* Text Templates Tab */}
                    {currentSettings.text_overlay.mode === 'templates' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between mb-3">
                          <label className={`block text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                            Saved Text Templates ({savedTemplates.length})
                          </label>
                          <button
                            type="button"
                            onClick={loadSavedTemplates}
                            className={`text-xs px-2 py-1 rounded ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'}`}
                            title="Refresh Templates"
                          >
                            🔄 Refresh
                          </button>
                        </div>

                        {savedTemplates.length === 0 ? (
                          <div className={`text-center py-12 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            <p className="text-sm mb-2">No text templates saved yet</p>
                            <p className="text-xs">Switch to Custom tab and click "Save as Template" to create your first text template</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-2">
                            {savedTemplates.map((template) => (
                              <div
                                key={template.id}
                                className={`border rounded-lg overflow-hidden transition-all hover:shadow-lg cursor-pointer ${
                                  selectedTemplatePreview?.id === template.id
                                    ? darkMode ? 'border-accent-500 ring-2 ring-accent-500' : 'border-accent-400 ring-2 ring-accent-400'
                                    : darkMode ? 'border-zinc-600' : 'border-gray-300'
                                } ${darkMode ? 'bg-zinc-800' : 'bg-white'}`}
                                onClick={() => setSelectedTemplatePreview(template)}
                              >
                                {/* Template Preview - 9:16 aspect ratio */}
                                <div className="relative w-full" style={{ paddingBottom: '177.78%' }}>
                                  <div className={`absolute inset-0 ${darkMode ? 'bg-zinc-900' : 'bg-gray-100'}`}>
                                    {/* Text overlays preview */}
                                    {template.textOverlays.map((overlay, index) => (
                                      overlay.enabled && (
                                        <div
                                          key={index}
                                          className="absolute"
                                          style={{
                                            left: `${overlay.x_position || 50}%`,
                                            top: `${overlay.y_position || 50}%`,
                                            transform: 'translate(-50%, -50%)',
                                            fontSize: `${(overlay.fontSize || 20) * 0.25}px`,
                                            color: overlay.color || '#000000',
                                            fontWeight: overlay.bold ? 'bold' : 'normal',
                                            fontStyle: overlay.italic ? 'italic' : 'normal',
                                            textDecoration: overlay.underline ? 'underline' : 'none',
                                            textAlign: overlay.alignment || 'center',
                                            opacity: (overlay.opacity || 100) / 100,
                                            fontFamily: overlay.font || 'System',
                                            maxWidth: '80%',
                                            wordWrap: 'break-word',
                                            whiteSpace: 'pre-wrap',
                                            textShadow: overlay.hasStroke ? `${overlay.strokeThickness || 1}px ${overlay.strokeThickness || 1}px 0 ${overlay.strokeColor || '#000000'}` : 'none'
                                          }}
                                        >
                                          {overlay.hasBackground && (
                                            <div
                                              className="absolute inset-0 rounded"
                                              style={{
                                                backgroundColor: overlay.backgroundColor || '#ffffff',
                                                opacity: (overlay.backgroundOpacity || 100) / 100,
                                                padding: '1px 3px',
                                                margin: '-1px -3px',
                                                borderRadius: `${overlay.backgroundRounded || 0}px`,
                                                zIndex: -1
                                              }}
                                            />
                                          )}
                                          <span style={{ fontSize: 'inherit' }}>
                                            {overlay.custom_text && overlay.custom_text.trim() !== ''
                                              ? overlay.custom_text.substring(0, 10) + (overlay.custom_text.length > 10 ? '...' : '')
                                              : `T${index + 1}`}
                                          </span>
                                        </div>
                                      )
                                    ))}
                                  </div>
                                </div>

                                {/* Template Info */}
                                <div className="p-2">
                                  <h3 className={`font-medium text-xs truncate ${darkMode ? 'text-primary-200' : 'text-primary-800'}`}>
                                    {template.name}
                                  </h3>
                                  <p className={`text-xs mt-1 ${darkMode ? 'text-primary-500' : 'text-primary-500'}`}>
                                    {template.textOverlays.filter(t => t.enabled).length} active
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Selected Template Actions */}
                        {selectedTemplatePreview && (
                          <div className={`flex items-center justify-between p-3 rounded-lg border ${
                            darkMode ? 'bg-zinc-800 border-zinc-600' : 'bg-gray-50 border-gray-300'
                          }`}>
                            <div>
                              <p className={`text-sm font-medium ${darkMode ? 'text-primary-200' : 'text-primary-800'}`}>
                                {selectedTemplatePreview.name}
                              </p>
                              <p className={`text-xs ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                                Created {new Date(selectedTemplatePreview.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  handleApplyTemplate(selectedTemplatePreview);
                                  setSelectedTemplatePreview(null);
                                }}
                                className={`px-3 py-1 text-xs font-medium rounded ${
                                  darkMode ? 'bg-accent-600 hover:bg-accent-700 text-white' : 'bg-accent-500 hover:bg-accent-600 text-white'
                                }`}
                              >
                                Apply
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleDeleteTemplate(selectedTemplatePreview.id);
                                  setSelectedTemplatePreview(null);
                                }}
                                className={`px-2 py-1 text-xs rounded ${
                                  darkMode ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
                                }`}
                              >
                                Del
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* AI Generated Tab */}
                    {form.text_overlay_mode === 'ai_generated' && (
                      <div className="space-y-3">
                        <p className={`text-sm ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
                          AI will generate contextual text based on your video content and script.
                        </p>
                        <div className={`p-3 rounded-md ${darkMode ? 'bg-dark-700' : 'bg-neutral-200'}`}>
                          <p className={`text-xs ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                            Example: If your script mentions a product benefit, AI might generate "Game Changer!" or "You Need This!"
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedVideoSettings;