import React, { useState } from 'react';
import Button from './Button';
import { SparklesIcon, DocumentTextIcon, CheckCircleIcon, ExclamationTriangleIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { useStore } from '../store';
import { generateScript } from '../utils/api';

function ScriptGeneratorForm({ onSubmit, onCancel }) {
  const darkMode = useStore(state => state.darkMode);
  
  const [form, setForm] = useState({
    product: '',
    persona: 'Tech Reviewer',
    emotion: 'enthusiastic',
    hook: '',
    brand_name: '',
    language: 'English',
    setting: 'Studio',
    name: '',
    example_scripts: ''
  });
  
  const [generatedScript, setGeneratedScript] = useState('');
  const [editedScript, setEditedScript] = useState('');
  const [generatedScriptData, setGeneratedScriptData] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [hasManualEdits, setHasManualEdits] = useState(false);
  const [showEditWarning, setShowEditWarning] = useState(false);
  
  // Predefined options
  const personaOptions = [
    'Tech Reviewer',
    'Fitness Enthusiast', 
    'Beauty Guru',
    'Lifestyle Influencer',
    'Business Expert',
    'Health Coach',
    'Fashion Expert',
    'Food Blogger',
    'Travel Vlogger',
    'Gaming Creator'
  ];
  
  const emotionOptions = [
    'enthusiastic',
    'excited',
    'calm',
    'confident',
    'friendly',
    'professional',
    'casual',
    'urgent',
    'curious',
    'inspiring'
  ];
  
  const languageOptions = [
    'English',
    'Spanish',
    'French',
    'German',
    'Italian',
    'Portuguese',
    'Dutch',
    'Polish',
    'Russian',
    'Japanese'
  ];
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Auto-generate script name if product changes
    if (name === 'product' && value) {
      setForm(prev => ({
        ...prev,
        name: `${value} Script - ${new Date().toLocaleDateString()}`
      }));
    }
  };

  const handleScriptEdit = (e) => {
    const newValue = e.target.value;
    setEditedScript(newValue);
    
    // Mark as manually edited if content differs from generated
    if (newValue !== generatedScript && !hasManualEdits) {
      setHasManualEdits(true);
    }
  };

  const getCurrentScript = () => {
    return hasManualEdits ? editedScript : generatedScript;
  };

  const handleGenerateWithWarning = () => {
    if (hasManualEdits) {
      setShowEditWarning(true);
    } else {
      handleGenerate();
    }
  };

  const confirmRegenerate = () => {
    setShowEditWarning(false);
    setHasManualEdits(false);
    handleGenerate();
  };

  const cancelRegenerate = () => {
    setShowEditWarning(false);
  };
  
  const handleGenerate = async () => {
    if (!form.product.trim()) {
      setError('Product name is required');
      return;
    }
    
    setIsGenerating(true);
    setError('');
    setGeneratedScript('');
    setEditedScript('');
    setHasManualEdits(false);
    
    try {
      const generateParams = {
        product: form.product.trim(),
        persona: form.persona,
        emotion: form.emotion,
        hook: form.hook.trim() || undefined,
        brand_name: form.brand_name.trim() || undefined,
        language: form.language,
        setting: form.setting,
        name: form.name.trim() || undefined,
        enhance_for_elevenlabs: true
      };

      // Add example scripts if provided
      if (form.example_scripts.trim()) {
        generateParams.example_scripts = form.example_scripts.trim();
      }

      const response = await generateScript(generateParams);
      
      const scriptContent = response.script_content;
      setGeneratedScript(scriptContent);
      setEditedScript(scriptContent);
      setGeneratedScriptData(response);
      
    } catch (error) {
      console.error('Error generating script:', error);
      setError(error.message || 'Failed to generate script');
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleSave = async () => {
    const currentScript = getCurrentScript();
    if (!currentScript || !generatedScriptData) {
      setError('No script to save');
      return;
    }
    
    setIsSaving(true);
    setError('');
    
    try {
      // Create modified script data with current content
      const scriptToSave = {
        ...generatedScriptData,
        script_content: currentScript
      };
      
      // The script is already saved by the backend, we just need to notify the parent
      // to refresh the scripts list with the script data
      onSubmit(scriptToSave);
      setSuccess(true);
      
      // Auto-close after success
      setTimeout(() => {
        onCancel();
      }, 1500);
      
    } catch (error) {
      console.error('Error saving script:', error);
      setError(error.message || 'Failed to save script');
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className="flex h-[600px]">
      {/* Left Pane - Form */}
      <div className="w-1/2 pr-6 border-r border-primary-200 dark:border-dark-600 overflow-y-auto">
        <div className="space-y-4">
          {/* Product Name */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
              Product Name *
            </label>
            <input
              type="text"
              name="product"
              value={form.product}
              onChange={handleInputChange}
              className={`w-full rounded-md px-3 py-2 text-sm border focus:ring-2 focus:ring-green-500 focus:border-green-500
                ${darkMode 
                  ? 'bg-dark-600 border-dark-500 text-primary-100 placeholder-primary-400'
                  : 'bg-white border-primary-300 text-primary-900 placeholder-primary-500'
                }`}
              placeholder="e.g., iPhone 15 Pro, Nike Air Max, Green Tea Extract"
            />
          </div>
          
          {/* Persona */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
              Creator Persona
            </label>
            <select
              name="persona"
              value={form.persona}
              onChange={handleInputChange}
              className={`w-full rounded-md px-3 py-2 text-sm border focus:ring-2 focus:ring-green-500 focus:border-green-500
                ${darkMode 
                  ? 'bg-dark-600 border-dark-500 text-primary-100'
                  : 'bg-white border-primary-300 text-primary-900'
                }`}
            >
              {personaOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          
          {/* Emotion/Tone */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
              Tone & Emotion
            </label>
            <select
              name="emotion"
              value={form.emotion}
              onChange={handleInputChange}
              className={`w-full rounded-md px-3 py-2 text-sm border focus:ring-2 focus:ring-green-500 focus:border-green-500
                ${darkMode 
                  ? 'bg-dark-600 border-dark-500 text-primary-100'
                  : 'bg-white border-primary-300 text-primary-900'
                }`}
            >
              {emotionOptions.map(option => (
                <option key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
          </div>
          
          {/* Hook Style */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
              Hook Style (Optional)
            </label>
            <input
              type="text"
              name="hook"
              value={form.hook}
              onChange={handleInputChange}
              className={`w-full rounded-md px-3 py-2 text-sm border focus:ring-2 focus:ring-green-500 focus:border-green-500
                ${darkMode 
                  ? 'bg-dark-600 border-dark-500 text-primary-100 placeholder-primary-400'
                  : 'bg-white border-primary-300 text-primary-900 placeholder-primary-500'
                }`}
              placeholder="e.g., Start with a personal story, Ask a question, Share a problem"
            />
          </div>
          
          {/* Brand Name */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
              Brand Name (Optional)
            </label>
            <input
              type="text"
              name="brand_name"
              value={form.brand_name}
              onChange={handleInputChange}
              className={`w-full rounded-md px-3 py-2 text-sm border focus:ring-2 focus:ring-green-500 focus:border-green-500
                ${darkMode 
                  ? 'bg-dark-600 border-dark-500 text-primary-100 placeholder-primary-400'
                  : 'bg-white border-primary-300 text-primary-900 placeholder-primary-500'
                }`}
              placeholder="e.g., Apple, Nike, Your Company Name"
            />
          </div>
          
          {/* Language */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
              Language
            </label>
            <select
              name="language"
              value={form.language}
              onChange={handleInputChange}
              className={`w-full rounded-md px-3 py-2 text-sm border focus:ring-2 focus:ring-green-500 focus:border-green-500
                ${darkMode 
                  ? 'bg-dark-600 border-dark-500 text-primary-100'
                  : 'bg-white border-primary-300 text-primary-900'
                }`}
            >
              {languageOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          {/* Example Scripts */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
              Example Scripts (Optional)
            </label>
            <textarea
              name="example_scripts"
              value={form.example_scripts}
              onChange={handleInputChange}
              rows={4}
              className={`w-full rounded-md px-3 py-2 text-sm border focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none
                ${darkMode 
                  ? 'bg-dark-600 border-dark-500 text-primary-100 placeholder-primary-400'
                  : 'bg-white border-primary-300 text-primary-900 placeholder-primary-500'
                }`}
              placeholder="Paste example scripts here to help AI understand your preferred style and format..."
            />
            <p className={`text-xs mt-1 ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
              Providing example scripts helps the AI generate content in your preferred style and format.
            </p>
          </div>
          
          {/* Script Name */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}>
              Script Name (Auto-generated)
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleInputChange}
              className={`w-full rounded-md px-3 py-2 text-sm border focus:ring-2 focus:ring-green-500 focus:border-green-500
                ${darkMode 
                  ? 'bg-dark-600 border-dark-500 text-primary-100 placeholder-primary-400'
                  : 'bg-white border-primary-300 text-primary-900 placeholder-primary-500'
                }`}
              placeholder="Auto-generated from product name"
            />
          </div>
          
          {/* Generate Button */}
          <div className="pt-4">
            <Button
              variant="success"
              size="lg"
              isFullWidth
              isLoading={isGenerating}
              onClick={handleGenerateWithWarning}
              disabled={!form.product.trim()}
              icon={<SparklesIcon className="h-5 w-5" />}
            >
              {isGenerating ? 'Generating Script...' : 'Generate Script'}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Right Pane - Preview */}
      <div className="w-1/2 pl-6 flex flex-col h-[600px]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <DocumentTextIcon className="h-6 w-6 text-primary-500" />
            <h3 className={`text-lg font-semibold ${darkMode ? 'text-primary-200' : 'text-primary-800'}`}>
              Script Preview
            </h3>
            {hasManualEdits && (
              <div className="flex items-center space-x-1 text-orange-500">
                <PencilSquareIcon className="h-4 w-4" />
                <span className="text-xs font-medium">Edited</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm flex items-center space-x-2 flex-shrink-0">
            <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        
        {/* Success Message */}
        {success && (
          <div className="mb-4 p-3 rounded-md bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm flex items-center space-x-2 flex-shrink-0">
            <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
            <span>Script saved successfully!</span>
          </div>
        )}

        {/* Edit Warning Modal */}
        {showEditWarning && (
          <div className="mb-4 p-4 rounded-md bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-sm flex-shrink-0">
            <div className="flex items-start space-x-2">
              <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium mb-2">You have manual edits</p>
                <p className="text-xs mb-3">Regenerating will replace your current edits. Are you sure you want to continue?</p>
                <div className="flex space-x-2">
                  <Button
                    variant="tertiary"
                    size="sm"
                    onClick={cancelRegenerate}
                  >
                    Keep Edits
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={confirmRegenerate}
                  >
                    Regenerate
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Preview Area - Fixed height with internal scrolling */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0">
            {isGenerating ? (
              <div className={`flex items-center justify-center h-full min-h-[200px] rounded-md border
                ${darkMode 
                  ? 'bg-dark-600 border-dark-500 text-primary-200'
                  : 'bg-neutral-100 border-primary-200 text-primary-800'
                }`}>
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-3"></div>
                  <span className="text-sm">Generating your script...</span>
                </div>
              </div>
            ) : generatedScript ? (
              <div className="h-full">
                <textarea
                  value={getCurrentScript()}
                  onChange={handleScriptEdit}
                  className={`w-full h-full rounded-md border p-4 text-sm leading-relaxed resize-none focus:ring-2 focus:ring-green-500 focus:border-green-500
                    ${darkMode 
                      ? 'bg-dark-600 border-dark-500 text-primary-200 placeholder-primary-400'
                      : 'bg-neutral-100 border-primary-200 text-primary-800 placeholder-primary-500'
                    }`}
                  placeholder="Your generated script will appear here..."
                  spellCheck="false"
                />
                <p className={`text-xs mt-2 ${darkMode ? 'text-primary-400' : 'text-primary-500'}`}>
                  You can edit the script directly in the text area above. Changes will be preserved when saving.
                </p>
              </div>
            ) : (
              <div className={`flex items-center justify-center h-full min-h-[200px] text-center rounded-md border
                ${darkMode 
                  ? 'bg-dark-600 border-dark-500 text-primary-200'
                  : 'bg-neutral-100 border-primary-200 text-primary-800'
                }`}>
                <div>
                  <SparklesIcon className="h-12 w-12 mx-auto mb-4 text-primary-400" />
                  <p className="text-primary-500 dark:text-primary-400">
                    Fill out the form and click "Generate Script" to see your AI-generated script here.
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {/* Action Buttons - Fixed at bottom */}
          <div className="flex justify-end space-x-3 mt-4 flex-shrink-0">
            <Button
              variant="tertiary"
              onClick={onCancel}
            >
              Cancel
            </Button>
            
            {generatedScript && !success && (
              <>
                <Button
                  variant="secondary"
                  onClick={handleGenerateWithWarning}
                  disabled={isGenerating || !form.product.trim()}
                  icon={<SparklesIcon className="h-4 w-4" />}
                >
                  Regenerate
                </Button>
                
                <Button
                  variant="primary"
                  onClick={handleSave}
                  isLoading={isSaving}
                  icon={<DocumentTextIcon className="h-4 w-4" />}
                >
                  Save Script
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScriptGeneratorForm; 