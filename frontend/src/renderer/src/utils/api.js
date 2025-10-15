/**
 * Utility functions for making API requests to the Flask backend
 */

// Determine if we're running in Electron
const isElectron = () => {
  return window && window.electron;
};

/**
 * Create a properly formatted local file URL for Electron
 * @param {string} filePath - The local file path
 * @returns {string} Properly formatted local file URL
 */
export const createLocalFileUrl = (filePath) => {
  if (!filePath || !isElectron()) {
    return filePath;
  }

  // Handle Windows paths properly
  if (filePath.includes('\\') || filePath.match(/^[A-Za-z]:/)) {
    // Normalize path separators to forward slashes for URL
    let normalizedPath = filePath.replace(/\\/g, '/');
    
    // Ensure Windows drive letter format is maintained (C:/ not C/)
    if (normalizedPath.match(/^[A-Za-z]:/)) {
      // Path already has proper drive letter format like "C:/path"
    } else if (normalizedPath.match(/^[A-Za-z]\//)) {
      // Fix missing colon after drive letter "C/path" -> "C:/path"
      normalizedPath = normalizedPath.charAt(0) + ':' + normalizedPath.substring(1);
    }
    
    // Encode the path properly for URL
    const encodedPath = encodeURI(normalizedPath);
    return `local-file://${encodedPath}`;
  }
  
  // Unix-like paths
  const encodedPath = encodeURI(filePath);
  return `local-file://${encodedPath}`;
};

// API Constants
export const API_URL = 'http://localhost:2026'; // Updated to the Flask server port

/**
 * MassUGC API key is now managed server-side through secure storage.
 * These functions are kept for compatibility but will return empty values
 * since MassUGC API key is handled differently.
 */

/**
 * Legacy Zyra API key functions - deprecated
 * @deprecated Use MassUGC API key management instead
 * @returns {string} Empty string (MassUGC API keys are managed server-side)
 */
const getZyraApiKey = () => {
  // MassUGC API keys are managed server-side, not in localStorage
  return '';
};

/**
 * Legacy Zyra API key setter - deprecated  
 * @deprecated Use setMassUGCApiKey instead
 * @param {string} key - The API key to store
 */
export const setZyraApiKey = (key) => {
  console.warn('setZyraApiKey is deprecated. Use setMassUGCApiKey instead.');
  // No-op - MassUGC API keys are handled server-side
};

/**
 * Legacy Zyra API key getter - deprecated
 * @deprecated MassUGC API keys are managed server-side
 * @returns {string} Empty string
 */
export const getStoredZyraApiKey = () => {
  return '';
};

/**
 * Create default headers for API requests
 * MassUGC API authentication is now handled server-side
 * @returns {Object} Headers object
 */
const createHeaders = (contentType = 'application/json') => {
  const headers = {
    'Content-Type': contentType
  };
  
  // MassUGC API authentication is handled server-side through secure storage
  // No need to include API keys in client requests anymore
  
  return headers;
};

/**
 * Handle API response errors, especially 403 for missing/invalid MassUGC API key
 * @param {Response} response - The fetch response
 * @returns {Promise<any>} Throws error with appropriate message
 */
const handleApiError = async (response) => {
  if (response.status === 403) {
    const errorText = await response.text();
    if (errorText.includes('MassUGC API key') || errorText.includes('API key')) {
      throw new Error('MassUGC API key validation failed. Please check your API key in Settings.');
    }
    throw new Error(`Access forbidden: ${errorText}`);
  }
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }
};

// Smart timeout function for different operations
const getTimeoutForOperation = (url) => {
  if (url.includes('/run') || url.includes('/campaigns') || url.includes('/job')) {
    return 300000; // 5 minutes for job submission/campaign operations
  }
  if (url.includes('/status') || url.includes('/progress')) {
    return 30000;  // 30 seconds for status checks
  }
  return 60000;    // 60 seconds for other operations
};

/**
 * Make a GET request to the API
 * @param {string} endpoint - The API endpoint
 * @param {Object} options - Additional fetch options
 * @returns {Promise<any>} Response data
 */
export const apiGet = async (endpoint, options = {}) => {
  try {
    
    // Add timeout to avoid hanging requests
    const controller = new AbortController();
    const fullUrl = `${API_URL}/${endpoint.replace(/^\//, '')}`;
    const timeoutId = setTimeout(() => controller.abort(), getTimeoutForOperation(fullUrl)); // Smart timeout based on operation type
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: createHeaders(),
      signal: controller.signal,
      ...options
    });
    
    clearTimeout(timeoutId);

    await handleApiError(response);
    return response.json();
  } catch (error) {
    console.error(`Network error accessing ${endpoint}:`, error);
    
    // Provide specific error messages for common network issues
    if (error.name === 'AbortError') {
      throw new Error('API request timed out. The server may be unresponsive.');
    }
    
    if (error.message && error.message.includes('Failed to fetch')) {
      throw new Error(`Cannot connect to API server. Please check if the backend server is running.`);
    }
    
    throw error;
  }
};

/**
 * Make a POST request to the API
 * @param {string} endpoint - The API endpoint
 * @param {Object|FormData} data - The data to send
 * @param {boolean} isFormData - Whether the data is FormData
 * @param {Object} options - Additional fetch options
 * @returns {Promise<any>} Response data
 */
export const apiPost = async (endpoint, data, isFormData = false, options = {}) => {
  try {
    const headers = isFormData ? {} : createHeaders();
    
    // MassUGC API authentication is handled server-side
    // No need to add API keys to FormData headers
    
    const body = isFormData ? data : JSON.stringify(data);
    
    const response = await fetch(`${API_URL}/${endpoint.replace(/^\//, '')}`, {
      method: 'POST',
      headers,
      body,
      ...options
    });

    await handleApiError(response);
    return response.json();
  } catch (error) {
    console.error(`Network error in POST to ${endpoint}:`, error);
    // Handle "Failed to fetch" network errors specifically
    if (error.message === 'Failed to fetch') {
      throw new Error('Cannot connect to API server. Please check if the backend server is running.');
    }
    throw error;
  }
};

/**
 * Make a PUT request to the API
 * @param {string} endpoint - The API endpoint
 * @param {Object} data - The data to send
 * @param {Object} options - Additional fetch options
 * @returns {Promise<any>} Response data
 */
export const apiPut = async (endpoint, data, options = {}) => {
  try {
    const response = await fetch(`${API_URL}/${endpoint.replace(/^\//, '')}`, {
      method: 'PUT',
      headers: createHeaders(),
      body: JSON.stringify(data),
      ...options
    });

    await handleApiError(response);
    return response.json();
  } catch (error) {
    console.error(`Network error in PUT to ${endpoint}:`, error);
    if (error.message === 'Failed to fetch') {
      throw new Error('Cannot connect to API server. Please check if the backend server is running.');
    }
    throw error;
  }
};

/**
 * Make a DELETE request to the API
 * @param {string} endpoint - The API endpoint
 * @param {Object} options - Additional fetch options
 * @returns {Promise<any>} Response data
 */
export const apiDelete = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_URL}/${endpoint.replace(/^\//, '')}`, {
      method: 'DELETE',
      headers: createHeaders(),
      ...options
    });

    await handleApiError(response);

    // Handle 204 No Content response
    if (response.status === 204) {
      return { success: true };
    }

    return response.json();
  } catch (error) {
    console.error(`Network error in DELETE to ${endpoint}:`, error);
    if (error.message === 'Failed to fetch') {
      throw new Error('Cannot connect to API server. Please check if the backend server is running.');
    }
    throw error;
  }
};

/**
 * Fetch campaigns from the backend
 * @returns {Promise<Array>} List of campaigns
 */
export const fetchCampaigns = async () => {
  try {
    return await apiGet('campaigns');
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    throw error;
  }
};

/**
 * Add a new campaign
 * @param {FormData|Object} data - Form data or JSON object with campaign details
 * @param {boolean} isFormData - Whether the data is FormData (true) or JSON (false)
 * @returns {Promise<Object>} New campaign object
 */
export const addCampaign = async (data, isFormData = true) => {
  try {
    console.log('📤 [addCampaign] Called with isFormData:', isFormData);
    
    // Log the data being sent
    if (isFormData && data instanceof FormData) {
      console.log('📋 [addCampaign] FormData contents:');
      for (let [key, value] of data.entries()) {
        if (value instanceof File) {
          console.log(`  ${key}:`, `[File: ${value.name}, size: ${value.size} bytes]`);
        } else {
          console.log(`  ${key}:`, value);
        }
      }
    } else {
      console.log('📋 [addCampaign] JSON data:', JSON.stringify(data, null, 2));
    }
    
    return await apiPost('campaigns', data, isFormData);
  } catch (error) {
    console.error('Error adding campaign:', error);
    throw error;
  }
};

/**
 * Update a campaign
 * @param {string} campaignId - ID of the campaign to update
 * @param {Object} data - Updated campaign data
 * @returns {Promise<Object>} Updated campaign object
 */
export const updateCampaign = async (campaignId, data) => {
  try {
    console.log('📤 [updateCampaign] Updating campaign:', campaignId);
    console.log('📋 [updateCampaign] Update data:', JSON.stringify(data, null, 2));
    
    return await apiPut(`campaigns/${campaignId}`, data);
  } catch (error) {
    console.error('❌ [updateCampaign] Error:', error);
    throw error;
  }
};

/**
 * Duplicate a campaign using server-side duplication
 * @param {string} campaignId - ID of the campaign to duplicate
 * @param {Object} options - Duplication options
 * @param {string} options.job_name - Optional new name for the duplicate campaign
 * @returns {Promise<Object>} Duplication result with original_id, duplicate_id, and duplicate campaign data
 */
export const duplicateCampaign = async (campaignId, options = {}) => {
  try {
    console.log('🔄 [duplicateCampaign] Duplicating campaign:', campaignId);
    console.log('📋 [duplicateCampaign] Options:', JSON.stringify(options, null, 2));
    
    const result = await apiPost(`campaigns/${campaignId}/duplicate`, options, false);
    
    if (!result.success) {
      throw new Error(result.error || 'Duplication failed');
    }
    
    console.log('✅ [duplicateCampaign] Success:', {
      original_id: result.original_id,
      duplicate_id: result.duplicate_id,
      warning: result.warning
    });
    
    return result;
  } catch (error) {
    console.error('❌ [duplicateCampaign] Error:', error);
    
    // Extract specific error details if available
    if (error.message && error.message.includes('corrupted data')) {
      throw new Error(`Cannot duplicate campaign: ${error.message}`);
    }
    
    throw error;
  }
};

/**
 * Delete a campaign
 * @param {string} campaignId - ID of the campaign to delete
 * @returns {Promise<Object>} Success status
 */
export const deleteCampaign = async (campaignId) => {
  try {
    return await apiDelete(`campaigns/${campaignId}`);
  } catch (error) {
    console.error('Error deleting campaign:', error);
    throw error;
  }
};

/**
 * Run a campaign job
 * @param {string} campaignId - ID of the campaign to run
 * @returns {Promise<Object>} Job status with run_id
 */
export const runCampaign = async (campaignId) => {
  try {
    const formData = new FormData();
    formData.append('campaign_id', campaignId);
    return await apiPost('run-job', formData, true);
  } catch (error) {
    console.error('Error running campaign:', error);
    throw error;
  }
};

/**
 * Run multiple campaigns in sequence with a delay
 * @param {Array<string>} campaignIds - Array of campaign IDs to run
 * @param {number} delayMs - Delay between campaign launches in milliseconds
 * @param {Function} onCampaignStart - Callback for when each campaign starts
 * @param {Function} onCampaignComplete - Callback for when each campaign completes (with result)
 * @returns {Promise<Array>} Array of responses from each campaign
 */
export const runMultipleCampaigns = async (campaignIds, delayMs = 250, onCampaignStart = () => {}, onCampaignComplete = () => {}) => {
  const results = [];
  
  for (let i = 0; i < campaignIds.length; i++) {
    const campaignId = campaignIds[i];
    
    // Callback to indicate this campaign is starting
    onCampaignStart(campaignId, i, campaignIds.length);
    
    try {
      // Run the campaign
      const formData = new FormData();
      formData.append('campaign_id', campaignId);
      const response = await apiPost('run-job', formData, true);
      const result = { campaignId, response, success: true };
      results.push(result);
      
      // Immediate callback for successful completion
      onCampaignComplete(result);
    } catch (error) {
      console.error(`Error running campaign ${campaignId}:`, error);
      const result = { campaignId, error, success: false };
      results.push(result);
      
      // Immediate callback for failed completion
      onCampaignComplete(result);
    }
    
    // Add delay before next campaign (but not after the last one)
    if (i < campaignIds.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
};

/**
 * Create an EventSource for all job progress updates
 * @returns {EventSource} EventSource object for monitoring all job progress
 */
export const createBroadcastEventSource = () => {
  return new EventSource(`${API_URL}/events`);
};

/**
 * Fetch application settings
 * @returns {Promise<Object>} Settings object
 */
export const fetchSettings = async () => {
  try {
    return await apiGet('api/settings');
  } catch (error) {
    console.error('Error fetching settings:', error);
    throw error;
  }
};

/**
 * Save application settings
 * @param {FormData} formData - Form data with settings
 * @returns {Promise<Object>} Success status
 */
export const saveSettings = async (formData) => {
  try {
    return await apiPost('api/settings', formData, true);
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
};

/**
 * Test configuration - validate all API keys and services
 * @param {Object} testData - Configuration data to test
 * @returns {Promise<Object>} Test results for each service
 */
export const testConfiguration = async (testData) => {
  try {
    return await apiPost('api/test-configuration', testData);
  } catch (error) {
    console.error('Error testing configuration:', error);
    throw error;
  }
};

/**
 * Generate debug report with system information and recent errors
 * @returns {Promise<Object>} Comprehensive debug report
 */
export const generateDebugReport = async () => {
  try {
    return await apiPost('api/debug-report', {});
  } catch (error) {
    console.error('Error generating debug report:', error);
    throw error;
  }
};

/**
 * Fetch backend avatars
 * @returns {Promise<Array>} List of backend avatars
 */
export const fetchBackendAvatars = async () => {
  try {
    const response = await apiGet('avatars');
    return response.avatars || [];
  } catch (error) {
    console.error('Error fetching backend avatars:', error);
    throw error;
  }
};

/**
 * Add a new avatar to the backend
 * @param {FormData} formData - Form data with avatar details and file
 * @returns {Promise<Object>} New avatar object
 */
export const addBackendAvatar = async (formData) => {
  try {
    return await apiPost('avatars', formData, true);
  } catch (error) {
    console.error('Error adding avatar:', error);
    throw error;
  }
};

/**
 * Delete an avatar from the backend
 * @param {string} avatarId - ID of the avatar to delete
 * @returns {Promise<Object>} Success status
 */
export const deleteBackendAvatar = async (avatarId) => {
  try {
    return await apiDelete(`avatars/${avatarId}`);
  } catch (error) {
    console.error('Error deleting avatar:', error);
    throw error;
  }
};

/**
 * Fetch scripts from the backend
 * @returns {Promise<Array>} List of scripts
 */
export const fetchBackendScripts = async () => {
  try {
    const response = await apiGet('scripts');
    return response.scripts || [];
  } catch (error) {
    console.error('Error fetching backend scripts:', error);
    throw error;
  }
};

/**
 * Add a new script to the backend
 * @param {FormData} formData - Form data with script details and file
 * @returns {Promise<Object>} New script object
 */
export const addBackendScript = async (formData) => {
  try {
    return await apiPost('scripts', formData, true);
  } catch (error) {
    console.error('Error adding script:', error);
    throw error;
  }
};

/**
 * Delete a script from the backend
 * @param {string} scriptId - ID of the script to delete
 * @returns {Promise<Object>} Success status
 */
export const deleteBackendScript = async (scriptId) => {
  try {
    return await apiDelete(`scripts/${scriptId}`);
  } catch (error) {
    console.error('Error deleting script:', error);
    throw error;
  }
};

/**
 * Generate a new script using AI
 * @param {Object} params - Script generation parameters
 * @param {string} params.product - Product name
 * @param {string} params.persona - Creator persona
 * @param {string} params.emotion - Emotional tone
 * @param {string} params.hook - Hook style (optional)
 * @param {string} params.brand_name - Brand name (optional)
 * @param {string} params.language - Language (optional, defaults to English)
 * @param {boolean} params.enhance_for_elevenlabs - SSML enhancement (optional)
 * @param {string} params.setting - Setting (optional)
 * @param {string} params.name - Script name (optional)
 * @param {string} params.example_scripts - Example scripts for style reference (optional)
 * @returns {Promise<Object>} Generated script object with content
 */
export const generateScript = async (params) => {
  try {
    return await apiPost('scripts/generate', params);
  } catch (error) {
    console.error('Error generating script:', error);
    throw error;
  }
};

/**
 * Fetch clips from the backend
 * @returns {Promise<Array>} List of clips
 */
export const fetchBackendClips = async () => {
  try {
    const response = await apiGet('clips');
    return response.clips || [];
  } catch (error) {
    console.error('Error fetching backend clips:', error);
    throw error;
  }
};

/**
 * Add a new clip to the backend
 * @param {FormData} formData - Form data with clip details and file
 * @returns {Promise<Object>} New clip object
 */
export const addBackendClip = async (formData) => {
  try {
    return await apiPost('clips', formData, true);
  } catch (error) {
    console.error('Error adding clip:', error);
    throw error;
  }
};

/**
 * Delete a clip from the backend
 * @param {string} clipId - ID of the clip to delete
 * @returns {Promise<Object>} Success status
 */
export const deleteBackendClip = async (clipId) => {
  try {
    return await apiDelete(`clips/${clipId}`);
  } catch (error) {
    console.error('Error deleting clip:', error);
    throw error;
  }
};

/**
 * Get current job queue status
 * @returns {Promise<Object>} Queue status information
 */
export const getQueueStatus = async () => {
  try {
    return await apiGet('queue/status');
  } catch (error) {
    console.error('Error getting queue status:', error);
    throw error;
  }
};

/**
 * Manually trigger queue cleanup
 * @returns {Promise<Object>} Cleanup result
 */
export const cleanupQueue = async () => {
  try {
    return await apiPost('queue/cleanup', {});
  } catch (error) {
    console.error('Error cleaning up queue:', error);
    throw error;
  }
};

/**
 * Cancel a specific job
 * @param {string} runId - Run ID of the job to cancel
 * @returns {Promise<Object>} Cancellation result
 */
export const cancelJob = async (runId) => {
  try {
    return await apiPost(`queue/cancel/${runId}`, {});
  } catch (error) {
    console.error(`Error cancelling job ${runId}:`, error);
    throw error;
  }
};

/**
 * Cancel all active and queued jobs
 * @returns {Promise<Object>} Cancellation result
 */
export const cancelAllJobs = async () => {
  try {
    return await apiPost('queue/cancel-all', {});
  } catch (error) {
    console.error('Error cancelling all jobs:', error);
    throw error;
  }
};

/**
 * Get failure patterns and circuit breaker status
 * @returns {Promise<Object>} Failure patterns information
 */
export const getFailurePatterns = async () => {
  try {
    return await apiGet('queue/failure-patterns');
  } catch (error) {
    console.error('Error getting failure patterns:', error);
    throw error;
  }
};

/**
 * Reset circuit breaker for specific pattern or all patterns
 * @param {string} [patternKey] - Optional specific pattern to reset
 * @returns {Promise<Object>} Reset result
 */
export const resetCircuitBreaker = async (patternKey = null) => {
  try {
    const data = patternKey ? { pattern_key: patternKey } : {};
    return await apiPost('queue/reset-circuit-breaker', data);
  } catch (error) {
    console.error('Error resetting circuit breaker:', error);
    throw error;
  }
};

/**
 * Clear validation cache to force re-validation
 * @returns {Promise<Object>} Clear result
 */
export const clearValidationCache = async () => {
  try {
    return await apiPost('queue/clear-validation-cache', {});
  } catch (error) {
    console.error('Error clearing validation cache:', error);
    throw error;
  }
};

/**
 * Set MassUGC API key
 * @param {string} apiKey - The MassUGC API key
 * @returns {Promise<Object>} Success status and user info
 */
export const setMassUGCApiKey = async (apiKey) => {
  try {
    return await apiPost('api/massugc/api-key', { api_key: apiKey });
  } catch (error) {
    console.error('Error setting MassUGC API key:', error);
    throw error;
  }
};

/**
 * Get MassUGC API key status
 * @returns {Promise<Object>} API key status and user info
 */
export const getMassUGCApiKeyStatus = async () => {
  try {
    return await apiGet('api/massugc/api-key');
  } catch (error) {
    console.error('Error getting MassUGC API key status:', error);
    throw error;
  }
};

/**
 * Remove MassUGC API key
 * @returns {Promise<Object>} Success status
 */
export const removeMassUGCApiKey = async () => {
  try {
    return await apiDelete('api/massugc/api-key');
  } catch (error) {
    console.error('Error removing MassUGC API key:', error);
    throw error;
  }
};

/**
 * Get MassUGC usage statistics
 * @returns {Promise<Object>} Usage statistics
 */
export const getMassUGCUsage = async () => {
  try {
    return await apiGet('api/massugc/usage');
  } catch (error) {
    console.error('Error getting MassUGC usage:', error);
    throw error;
  }
};

/**
 * Generate video using MassUGC API
 * @param {File} audioFile - Audio file
 * @param {File} imageFile - Image file
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Job status with ID
 */
export const generateMassUGCVideo = async (audioFile, imageFile, options = {}) => {
  try {
    const formData = new FormData();
    formData.append('audio', audioFile);
    formData.append('image', imageFile);
    if (Object.keys(options).length > 0) {
      formData.append('options', JSON.stringify(options));
    }
    
    return await apiPost('api/massugc/generate-video', formData, true);
  } catch (error) {
    console.error('Error generating MassUGC video:', error);
    throw error;
  }
};

/**
 * Get MassUGC job status
 * @param {string} jobId - Job ID
 * @returns {Promise<Object>} Job status
 */
export const getMassUGCJobStatus = async (jobId) => {
  try {
    return await apiGet(`api/massugc/job-status/${jobId}`);
  } catch (error) {
    console.error(`Error getting MassUGC job status for ${jobId}:`, error);
    throw error;
  }
};

// ─── Google Drive API Functions ───────────────────────────────────────────

/**
 * Get Google Drive connection status
 * @returns {Promise<Object>} Connection status and user info
 */
export const getDriveStatus = async () => {
  try {
    return await apiGet('api/drive/status');
  } catch (error) {
    console.error('Error getting Drive status:', error);
    throw error;
  }
};

/**
 * Initiate Google Drive connection
 * @returns {Promise<Object>} Auth URL for OAuth flow
 */
export const connectGoogleDrive = async () => {
  try {
    const response = await apiGet('api/drive/connect');
    if (response.auth_url) {
      // Open OAuth URL in browser or Electron window
      if (isElectron() && window.electron.openExternal) {
        window.electron.openExternal(response.auth_url);
      } else {
        window.open(response.auth_url, '_blank');
      }
    }
    return response;
  } catch (error) {
    console.error('Error connecting Google Drive:', error);
    throw error;
  }
};

/**
 * Disconnect Google Drive
 * @returns {Promise<Object>} Disconnect status
 */
export const disconnectGoogleDrive = async () => {
  try {
    return await apiPost('api/drive/disconnect', {});
  } catch (error) {
    console.error('Error disconnecting Google Drive:', error);
    throw error;
  }
};

/**
 * Toggle Google Drive upload on/off
 * @param {boolean} enabled - Whether to enable Drive uploads
 * @returns {Promise<Object>} Toggle status
 */
export const toggleDriveUpload = async (enabled) => {
  try {
    return await apiPost('api/drive/toggle-upload', { enabled });
  } catch (error) {
    console.error('Error toggling Drive upload:', error);
    throw error;
  }
};

export default {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  setZyraApiKey,
  getZyraApiKey,
  getStoredZyraApiKey,
  fetchCampaigns,
  addCampaign,
  updateCampaign,
  duplicateCampaign,
  deleteCampaign,
  runCampaign,
  runMultipleCampaigns,
  createBroadcastEventSource,
  fetchSettings,
  saveSettings,
  testConfiguration,
  generateDebugReport,
  fetchBackendAvatars,
  addBackendAvatar,
  deleteBackendAvatar,
  fetchBackendScripts,
  addBackendScript,
  deleteBackendScript,
  generateScript,
  fetchBackendClips,
  addBackendClip,
  deleteBackendClip,
  getQueueStatus,
  cleanupQueue,
  cancelJob,
  cancelAllJobs,
  getFailurePatterns,
  resetCircuitBreaker,
  clearValidationCache,
  
  // MassUGC API functions
  setMassUGCApiKey,
  getMassUGCApiKeyStatus,
  removeMassUGCApiKey,
  getMassUGCUsage,
  generateMassUGCVideo,
  getMassUGCJobStatus,
  
  API_URL
}; 