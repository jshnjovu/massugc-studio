/**
 * Electron Data Service
 * 
 * Clean wrapper around Electron IPC for data operations.
 * Replaces HTTP API calls with direct IPC communication for instant performance.
 * 
 * Architecture:
 * React Component → electronDataService → IPC → Electron Main → DataService → YAML File
 * 
 * This replaces:
 * React Component → HTTP API → Flask → YAML File
 * 
 * @module electronDataService
 */

/**
 * Check if Electron IPC is available
 * @returns {boolean}
 */
const isElectronAvailable = () => {
  return typeof window !== 'undefined' && window.electron && window.electron.ipcRenderer;
};

/**
 * Electron Data Service - Direct IPC communication for data operations
 */
const electronDataService = {
  // ==================== CAMPAIGNS ====================

  /**
   * Get all campaigns
   * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
   */
  async getCampaigns() {
    if (!isElectronAvailable()) {
      throw new Error('Electron IPC not available');
    }
    return await window.electron.ipcRenderer.invoke('data:get-campaigns');
  },

  /**
   * Get a single campaign by ID
   * @param {string} id - Campaign ID
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async getCampaign(id) {
    if (!isElectronAvailable()) {
      throw new Error('Electron IPC not available');
    }
    return await window.electron.ipcRenderer.invoke('data:get-campaign', id);
  },

  /**
   * Create a new campaign
   * @param {Object} campaignData - Campaign data
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async createCampaign(campaignData) {
    if (!isElectronAvailable()) {
      throw new Error('Electron IPC not available');
    }
    return await window.electron.ipcRenderer.invoke('data:create-campaign', campaignData);
  },

  /**
   * Update an existing campaign
   * @param {string} id - Campaign ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async updateCampaign(id, updates) {
    if (!isElectronAvailable()) {
      throw new Error('Electron IPC not available');
    }
    return await window.electron.ipcRenderer.invoke('data:update-campaign', id, updates);
  },

  /**
   * Delete a campaign
   * @param {string} id - Campaign ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deleteCampaign(id) {
    if (!isElectronAvailable()) {
      throw new Error('Electron IPC not available');
    }
    return await window.electron.ipcRenderer.invoke('data:delete-campaign', id);
  },

  // ==================== AVATARS ====================

  /**
   * Get all avatars
   * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
   */
  async getAvatars() {
    if (!isElectronAvailable()) {
      throw new Error('Electron IPC not available');
    }
    return await window.electron.ipcRenderer.invoke('data:get-avatars');
  },

  /**
   * Create a new avatar
   * @param {Object} avatarData - Avatar data
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async createAvatar(avatarData) {
    if (!isElectronAvailable()) {
      throw new Error('Electron IPC not available');
    }
    return await window.electron.ipcRenderer.invoke('data:create-avatar', avatarData);
  },

  /**
   * Delete an avatar
   * @param {string} id - Avatar ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deleteAvatar(id) {
    if (!isElectronAvailable()) {
      throw new Error('Electron IPC not available');
    }
    return await window.electron.ipcRenderer.invoke('data:delete-avatar', id);
  },

  // ==================== SCRIPTS ====================

  /**
   * Get all scripts
   * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
   */
  async getScripts() {
    if (!isElectronAvailable()) {
      throw new Error('Electron IPC not available');
    }
    return await window.electron.ipcRenderer.invoke('data:get-scripts');
  },

  /**
   * Create a new script
   * @param {Object} scriptData - Script data
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async createScript(scriptData) {
    if (!isElectronAvailable()) {
      throw new Error('Electron IPC not available');
    }
    return await window.electron.ipcRenderer.invoke('data:create-script', scriptData);
  },

  /**
   * Delete a script
   * @param {string} id - Script ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deleteScript(id) {
    if (!isElectronAvailable()) {
      throw new Error('Electron IPC not available');
    }
    return await window.electron.ipcRenderer.invoke('data:delete-script', id);
  },

  // ==================== CLIPS ====================

  /**
   * Get all clips
   * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
   */
  async getClips() {
    if (!isElectronAvailable()) {
      throw new Error('Electron IPC not available');
    }
    return await window.electron.ipcRenderer.invoke('data:get-clips');
  },

  /**
   * Create a new clip
   * @param {Object} clipData - Clip data
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async createClip(clipData) {
    if (!isElectronAvailable()) {
      throw new Error('Electron IPC not available');
    }
    return await window.electron.ipcRenderer.invoke('data:create-clip', clipData);
  },

  /**
   * Delete a clip
   * @param {string} id - Clip ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deleteClip(id) {
    if (!isElectronAvailable()) {
      throw new Error('Electron IPC not available');
    }
    return await window.electron.ipcRenderer.invoke('data:delete-clip', id);
  },
};

export default electronDataService;

