/**
 * DataService - Professional data layer for MassUGC Desktop App
 * 
 * Handles all CRUD operations for campaigns, avatars, scripts, and clips.
 * Reads/writes directly to YAML files in the user's config directory.
 * 
 * Architecture:
 * - Direct file system access (no HTTP overhead)
 * - Atomic writes with backup/rollback
 * - Comprehensive error handling
 * - Structured logging
 * - Data validation
 * 
 * @module DataService
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

/**
 * @typedef {Object} Campaign
 * @property {string} id - Unique identifier
 * @property {string} job_name - Campaign name
 * @property {string} product - Product name
 * @property {string} persona - Creator persona
 * @property {string} setting - Video setting
 * @property {string} emotion - Emotional tone
 * @property {string} hook - Hook style
 * @property {string} elevenlabs_voice_id - ElevenLabs voice ID
 * @property {string} language - Language code
 * @property {string} avatar_id - Avatar ID
 * @property {string} avatar_video_path - Path to avatar video
 * @property {string} script_id - Script ID
 * @property {string} example_script_file - Path to script file
 * @property {string} brand_name - Brand name (optional)
 * @property {boolean} remove_silence - Remove silence flag
 * @property {boolean} enhance_for_elevenlabs - ElevenLabs enhancement flag
 * @property {string} created_at - ISO timestamp
 */

/**
 * @typedef {Object} Avatar
 * @property {string} id - Unique identifier
 * @property {string} name - Avatar name
 * @property {string} origin_language - Origin language
 * @property {string} file_path - Path to avatar video file
 * @property {string} thumbnail_path - Path to thumbnail image
 * @property {string} elevenlabs_voice_id - ElevenLabs voice ID
 * @property {string} gender - Gender (Male/Female/Other)
 * @property {string} created_at - ISO timestamp
 */

/**
 * @typedef {Object} Script
 * @property {string} id - Unique identifier
 * @property {string} name - Script name/filename
 * @property {string} file_path - Path to script file
 * @property {number} size - File size in bytes
 * @property {string} created_at - ISO timestamp
 */

/**
 * @typedef {Object} Clip
 * @property {string} id - Unique identifier
 * @property {string} name - Clip name/filename
 * @property {string} file_path - Path to clip file
 * @property {number} size - File size in bytes
 * @property {string} created_at - ISO timestamp
 */

/**
 * DataService class for managing application data
 */
class DataService {
  /**
   * Creates a new DataService instance
   * @param {string} configDir - Path to config directory (defaults to ~/.zyra-video-agent)
   */
  constructor(configDir = null) {
    // Use same config directory as Flask backend
    this.configDir = configDir || path.join(os.homedir(), '.zyra-video-agent');
    
    // Define file paths
    this.campaignsPath = path.join(this.configDir, 'campaigns.yaml');
    this.avatarsPath = path.join(this.configDir, 'avatars.yaml');
    this.scriptsPath = path.join(this.configDir, 'scripts.yaml');
    this.clipsPath = path.join(this.configDir, 'clips.yaml');
    
    // Ensure config directory exists
    this._ensureConfigDir();
    
    console.log('[DataService] Initialized with config directory:', this.configDir);
  }

  /**
   * Ensures the config directory exists
   * @private
   */
  _ensureConfigDir() {
    try {
      if (!fsSync.existsSync(this.configDir)) {
        fsSync.mkdirSync(this.configDir, { recursive: true });
        console.log('[DataService] Created config directory:', this.configDir);
      }
    } catch (error) {
      console.error('[DataService] Failed to create config directory:', error);
      throw new Error(`Failed to create config directory: ${error.message}`);
    }
  }

  /**
   * Reads a YAML file and returns parsed data
   * @private
   * @param {string} filePath - Path to YAML file
   * @param {string} dataKey - Key to extract from YAML (e.g., 'jobs', 'avatars')
   * @returns {Promise<Array>} Parsed data array
   */
  async _readYAML(filePath, dataKey) {
    try {
      // Check if file exists
      if (!fsSync.existsSync(filePath)) {
        console.log(`[DataService] File not found, creating: ${filePath}`);
        await this._writeYAML(filePath, dataKey, []);
        return [];
      }

      const content = await fs.readFile(filePath, 'utf8');
      const data = yaml.load(content) || {};
      return data[dataKey] || [];
    } catch (error) {
      console.error(`[DataService] Failed to read ${filePath}:`, error);
      throw new Error(`Failed to read ${dataKey}: ${error.message}`);
    }
  }

  /**
   * Writes data to a YAML file with atomic write (write to temp, then rename)
   * @private
   * @param {string} filePath - Path to YAML file
   * @param {string} dataKey - Key to use in YAML (e.g., 'jobs', 'avatars')
   * @param {Array} data - Data array to write
   * @returns {Promise<void>}
   */
  async _writeYAML(filePath, dataKey, data) {
    const tempPath = `${filePath}.tmp`;
    const backupPath = `${filePath}.backup`;

    try {
      // Create backup if file exists
      if (fsSync.existsSync(filePath)) {
        await fs.copyFile(filePath, backupPath);
      }

      // Write to temporary file first (atomic write)
      const yamlContent = yaml.dump({ [dataKey]: data });
      await fs.writeFile(tempPath, yamlContent, 'utf8');

      // Rename temp file to actual file (atomic operation on most filesystems)
      await fs.rename(tempPath, filePath);

      console.log(`[DataService] Successfully wrote ${data.length} ${dataKey} to ${filePath}`);
    } catch (error) {
      // Restore from backup if write failed
      if (fsSync.existsSync(backupPath)) {
        await fs.copyFile(backupPath, filePath);
        console.log(`[DataService] Restored ${filePath} from backup after write failure`);
      }

      console.error(`[DataService] Failed to write ${filePath}:`, error);
      throw new Error(`Failed to write ${dataKey}: ${error.message}`);
    } finally {
      // Clean up temp and backup files
      try {
        if (fsSync.existsSync(tempPath)) await fs.unlink(tempPath);
        if (fsSync.existsSync(backupPath)) await fs.unlink(backupPath);
      } catch (cleanupError) {
        console.warn('[DataService] Failed to cleanup temp files:', cleanupError);
      }
    }
  }

  // ==================== CAMPAIGNS ====================

  /**
   * Retrieves all campaigns from the YAML file
   * @returns {Promise<Array<Campaign>>} Array of campaign objects
   * @throws {Error} If YAML file is corrupted or unreadable
   */
  async getCampaigns() {
    console.log('[DataService] Getting all campaigns');
    return await this._readYAML(this.campaignsPath, 'jobs');
  }

  /**
   * Retrieves a single campaign by ID
   * @param {string} id - Campaign ID
   * @returns {Promise<Campaign|null>} Campaign object or null if not found
   */
  async getCampaignById(id) {
    console.log('[DataService] Getting campaign:', id);
    const campaigns = await this.getCampaigns();
    return campaigns.find(c => c.id === id) || null;
  }

  /**
   * Creates a new campaign
   * @param {Campaign} campaignData - Campaign data object
   * @returns {Promise<Campaign>} Created campaign with ID
   * @throws {Error} If campaign creation fails
   */
  async createCampaign(campaignData) {
    console.log('[DataService] Creating campaign:', campaignData.job_name);
    
    try {
      const campaigns = await this.getCampaigns();
      
      // Generate ID if not provided
      if (!campaignData.id) {
        campaignData.id = `campaign-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      }
      
      // Add timestamp if not provided
      if (!campaignData.created_at) {
        campaignData.created_at = new Date().toISOString();
      }
      
      // Add new campaign
      campaigns.push(campaignData);
      
      // Write back to file
      await this._writeYAML(this.campaignsPath, 'jobs', campaigns);
      
      console.log('[DataService] Campaign created successfully:', campaignData.id);
      return campaignData;
    } catch (error) {
      console.error('[DataService] Failed to create campaign:', error);
      throw new Error(`Failed to create campaign: ${error.message}`);
    }
  }

  /**
   * Updates an existing campaign
   * @param {string} id - Campaign ID
   * @param {Partial<Campaign>} updates - Fields to update
   * @returns {Promise<Campaign>} Updated campaign
   * @throws {Error} If campaign not found or update fails
   */
  async updateCampaign(id, updates) {
    console.log('[DataService] Updating campaign:', id);
    
    try {
      const campaigns = await this.getCampaigns();
      const index = campaigns.findIndex(c => c.id === id);
      
      if (index === -1) {
        throw new Error(`Campaign not found: ${id}`);
      }
      
      // Merge updates
      campaigns[index] = { ...campaigns[index], ...updates };
      
      // Write back to file
      await this._writeYAML(this.campaignsPath, 'jobs', campaigns);
      
      console.log('[DataService] Campaign updated successfully:', id);
      return campaigns[index];
    } catch (error) {
      console.error('[DataService] Failed to update campaign:', error);
      throw new Error(`Failed to update campaign: ${error.message}`);
    }
  }

  /**
   * Deletes a campaign by ID
   * @param {string} id - Campaign ID
   * @returns {Promise<boolean>} True if deleted successfully
   * @throws {Error} If deletion fails
   */
  async deleteCampaign(id) {
    console.log('[DataService] Deleting campaign:', id);
    
    try {
      const campaigns = await this.getCampaigns();
      const filtered = campaigns.filter(c => c.id !== id);
      
      if (filtered.length === campaigns.length) {
        throw new Error(`Campaign not found: ${id}`);
      }
      
      await this._writeYAML(this.campaignsPath, 'jobs', filtered);
      
      console.log('[DataService] Campaign deleted successfully:', id);
      return true;
    } catch (error) {
      console.error('[DataService] Failed to delete campaign:', error);
      throw new Error(`Failed to delete campaign: ${error.message}`);
    }
  }

  // ==================== AVATARS ====================

  /**
   * Retrieves all avatars from the YAML file
   * @returns {Promise<Array<Avatar>>} Array of avatar objects
   */
  async getAvatars() {
    console.log('[DataService] Getting all avatars');
    return await this._readYAML(this.avatarsPath, 'avatars');
  }

  /**
   * Creates a new avatar
   * @param {Avatar} avatarData - Avatar data object
   * @returns {Promise<Avatar>} Created avatar with ID
   */
  async createAvatar(avatarData) {
    console.log('[DataService] Creating avatar:', avatarData.name);
    
    try {
      const avatars = await this.getAvatars();
      
      // Generate ID if not provided
      if (!avatarData.id) {
        avatarData.id = `avatar-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      }
      
      // Add timestamp if not provided
      if (!avatarData.created_at) {
        avatarData.created_at = new Date().toISOString();
      }
      
      avatars.push(avatarData);
      await this._writeYAML(this.avatarsPath, 'avatars', avatars);
      
      console.log('[DataService] Avatar created successfully:', avatarData.id);
      return avatarData;
    } catch (error) {
      console.error('[DataService] Failed to create avatar:', error);
      throw new Error(`Failed to create avatar: ${error.message}`);
    }
  }

  /**
   * Deletes an avatar by ID
   * @param {string} id - Avatar ID
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteAvatar(id) {
    console.log('[DataService] Deleting avatar:', id);
    
    try {
      const avatars = await this.getAvatars();
      const filtered = avatars.filter(a => a.id !== id);
      
      if (filtered.length === avatars.length) {
        throw new Error(`Avatar not found: ${id}`);
      }
      
      await this._writeYAML(this.avatarsPath, 'avatars', filtered);
      
      console.log('[DataService] Avatar deleted successfully:', id);
      return true;
    } catch (error) {
      console.error('[DataService] Failed to delete avatar:', error);
      throw new Error(`Failed to delete avatar: ${error.message}`);
    }
  }

  // ==================== SCRIPTS ====================

  /**
   * Retrieves all scripts from the YAML file
   * @returns {Promise<Array<Script>>} Array of script objects
   */
  async getScripts() {
    console.log('[DataService] Getting all scripts');
    return await this._readYAML(this.scriptsPath, 'scripts');
  }

  /**
   * Creates a new script
   * @param {Script} scriptData - Script data object
   * @returns {Promise<Script>} Created script with ID
   */
  async createScript(scriptData) {
    console.log('[DataService] Creating script:', scriptData.name);
    
    try {
      const scripts = await this.getScripts();
      
      // Generate ID if not provided
      if (!scriptData.id) {
        scriptData.id = `script-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      }
      
      // Add timestamp if not provided
      if (!scriptData.created_at) {
        scriptData.created_at = new Date().toISOString();
      }
      
      scripts.push(scriptData);
      await this._writeYAML(this.scriptsPath, 'scripts', scripts);
      
      console.log('[DataService] Script created successfully:', scriptData.id);
      return scriptData;
    } catch (error) {
      console.error('[DataService] Failed to create script:', error);
      throw new Error(`Failed to create script: ${error.message}`);
    }
  }

  /**
   * Deletes a script by ID
   * @param {string} id - Script ID
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteScript(id) {
    console.log('[DataService] Deleting script:', id);
    
    try {
      const scripts = await this.getScripts();
      const filtered = scripts.filter(s => s.id !== id);
      
      if (filtered.length === scripts.length) {
        throw new Error(`Script not found: ${id}`);
      }
      
      await this._writeYAML(this.scriptsPath, 'scripts', filtered);
      
      console.log('[DataService] Script deleted successfully:', id);
      return true;
    } catch (error) {
      console.error('[DataService] Failed to delete script:', error);
      throw new Error(`Failed to delete script: ${error.message}`);
    }
  }

  // ==================== CLIPS ====================

  /**
   * Retrieves all clips from the YAML file
   * @returns {Promise<Array<Clip>>} Array of clip objects
   */
  async getClips() {
    console.log('[DataService] Getting all clips');
    return await this._readYAML(this.clipsPath, 'clips');
  }

  /**
   * Creates a new clip
   * @param {Clip} clipData - Clip data object
   * @returns {Promise<Clip>} Created clip with ID
   */
  async createClip(clipData) {
    console.log('[DataService] Creating clip:', clipData.name);
    
    try {
      const clips = await this.getClips();
      
      // Generate ID if not provided
      if (!clipData.id) {
        clipData.id = `clip-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      }
      
      // Add timestamp if not provided
      if (!clipData.created_at) {
        clipData.created_at = new Date().toISOString();
      }
      
      clips.push(clipData);
      await this._writeYAML(this.clipsPath, 'clips', clips);
      
      console.log('[DataService] Clip created successfully:', clipData.id);
      return clipData;
    } catch (error) {
      console.error('[DataService] Failed to create clip:', error);
      throw new Error(`Failed to create clip: ${error.message}`);
    }
  }

  /**
   * Deletes a clip by ID
   * @param {string} id - Clip ID
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteClip(id) {
    console.log('[DataService] Deleting clip:', id);
    
    try {
      const clips = await this.getClips();
      const filtered = clips.filter(c => c.id !== id);
      
      if (filtered.length === clips.length) {
        throw new Error(`Clip not found: ${id}`);
      }
      
      await this._writeYAML(this.clipsPath, 'clips', filtered);
      
      console.log('[DataService] Clip deleted successfully:', id);
      return true;
    } catch (error) {
      console.error('[DataService] Failed to delete clip:', error);
      throw new Error(`Failed to delete clip: ${error.message}`);
    }
  }
}

// Export singleton instance
module.exports = new DataService();

