import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SunIcon, MoonIcon, ArrowPathIcon, KeyIcon, EyeIcon, EyeSlashIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useStore } from '../store';
import Button from '../components/Button';
import { 
  fetchSettings, 
  saveSettings, 
  testConfiguration, 
  generateDebugReport,
  setMassUGCApiKey,
  getMassUGCApiKeyStatus,
  removeMassUGCApiKey,
  getMassUGCUsage,
  getDriveStatus,
  connectGoogleDrive,
  disconnectGoogleDrive,
  toggleDriveUpload
} from '../utils/api';

function SettingsPage() {
  const darkMode = useStore(state => state.darkMode);
  const toggleDarkMode = useStore(state => state.toggleDarkMode);
  
  const [settings, setSettings] = useState({
    OPENAI_API_KEY: '',
    ELEVENLABS_API_KEY: '',
    DREAMFACE_API_KEY: '',
    GCS_BUCKET_NAME: '',
    GOOGLE_APPLICATION_CREDENTIALS: '',
    OUTPUT_PATH: ''
  });
  const [massugcApiKey, setMassugcApiKeyLocal] = useState('');
  const [massugcApiKeyStatus, setMassugcApiKeyStatus] = useState(null);
  const [massugcUsageStats, setMassugcUsageStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingMassugcApiKey, setIsSavingMassugcApiKey] = useState(false);
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState('info'); // 'info', 'success', 'error'
  const [appVersion, setAppVersion] = useState('1.0.20');
  
  // Visibility state for API key fields
  const [showMassugcApiKey, setShowMassugcApiKey] = useState(false);
  const [showOpenAIApiKey, setShowOpenAIApiKey] = useState(false);
  const [showElevenLabsApiKey, setShowElevenLabsApiKey] = useState(false);
  const [showDreamFaceApiKey, setShowDreamFaceApiKey] = useState(false);
  
  // Visibility state for other sensitive fields
  const [showGcsBucket, setShowGcsBucket] = useState(false);
  const [showGoogleCredentials, setShowGoogleCredentials] = useState(false);
  const [showExportLocation, setShowExportLocation] = useState(false);
  
  // Log download state
  const [logInfo, setLogInfo] = useState({ exists: false });
  const [isDownloadingLog, setIsDownloadingLog] = useState(false);
  
  // Quick test state
  const [isQuickTesting, setIsQuickTesting] = useState(false);
  const [testResults, setTestResults] = useState(null);
  
  // Google Drive state
  const [driveStatus, setDriveStatus] = useState({
    connected: false,
    upload_enabled: false,
    user: null
  });
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  
  // Debug report state
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  
  // Fetch settings and app version on component mount
  useEffect(() => {
    const getSettings = async () => {
      try {
        setIsLoading(true);
        const response = await fetchSettings();
        setSettings(response);
        
        // MassUGC API key is managed server-side, no localStorage handling needed
        
        // Load MassUGC API key status
        loadMassUGCApiKeyStatus();
        
        // Load Google Drive status
        loadDriveStatus();
      } catch (error) {
        console.error('Error fetching settings:', error);
        setMessage('Failed to load settings: ' + error.message);
        setMessageType('error');
      } finally {
        setIsLoading(false);
      }
    };
    
    getSettings();
    
    // Get app version from Electron
    if (window.electron && window.electron.getAppVersion) {
      const version = window.electron.getAppVersion();
      if (version) {
        setAppVersion(version);
      }
    }
    
    // Get log file info
    const getLogInfo = async () => {
      if (window.electron && window.electron.ipcRenderer) {
        try {
          const info = await window.electron.ipcRenderer.invoke('get-log-info');
          setLogInfo(info);
        } catch (error) {
          console.error('Error getting log info:', error);
        }
      }
    };
    
    getLogInfo();
    
    // Listen for window focus to refresh Drive status after OAuth
    const handleFocus = () => {
      loadDriveStatus();
    };
    
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);
  
  const handleSettingChange = (name, value) => {
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  
  const handleMassugcApiKeyChange = (e) => {
    setMassugcApiKeyLocal(e.target.value);
  };
  
  const loadMassUGCApiKeyStatus = async () => {
    try {
      const status = await getMassUGCApiKeyStatus();
      setMassugcApiKeyStatus(status);
      
      if (status.configured && status.valid) {
        // Load usage stats if key is valid
        try {
          const usage = await getMassUGCUsage();
          setMassugcUsageStats(usage);
        } catch (usageError) {
          console.warn('Failed to load MassUGC usage stats:', usageError);
        }
      }
    } catch (error) {
      console.error('Error loading MassUGC API key status:', error);
      setMassugcApiKeyStatus({ configured: false, valid: false });
    }
  };

  // Google Drive functions
  const loadDriveStatus = async () => {
    try {
      const status = await getDriveStatus();
      setDriveStatus(status);
    } catch (error) {
      console.error('Error loading Drive status:', error);
    }
  };

  const handleConnectDrive = async () => {
    try {
      setIsConnectingDrive(true);
      await connectGoogleDrive();
      
      // Start polling immediately and more frequently
      let pollCount = 0;
      const maxPolls = 60; // Poll for 2 minutes max
      
      const checkConnection = setInterval(async () => {
        pollCount++;
        try {
          const status = await getDriveStatus();
          if (status.connected) {
            clearInterval(checkConnection);
            setDriveStatus(status);
            setIsConnectingDrive(false);
            setMessage('Google Drive connected successfully!');
            setMessageType('success');
          } else if (pollCount >= maxPolls) {
            // Timeout after 2 minutes
            clearInterval(checkConnection);
            setIsConnectingDrive(false);
            setMessage('Connection timeout. Please try again.');
            setMessageType('error');
          }
        } catch (pollError) {
          console.warn('Polling error:', pollError);
          // Don't stop polling on error, connection might still succeed
        }
      }, 2000); // Poll every 2 seconds
      
    } catch (error) {
      console.error('Error connecting Drive:', error);
      setMessage('Failed to connect Google Drive');
      setMessageType('error');
      setIsConnectingDrive(false);
    }
  };

  const handleDisconnectDrive = async () => {
    try {
      setIsDriveLoading(true);
      await disconnectGoogleDrive();
      setDriveStatus({ connected: false, upload_enabled: false, user: null });
      setMessage('Google Drive disconnected');
      setMessageType('info');
    } catch (error) {
      console.error('Error disconnecting Drive:', error);
      setMessage('Failed to disconnect Google Drive');
      setMessageType('error');
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleToggleDriveUpload = async (enabled) => {
    try {
      setIsDriveLoading(true);
      await toggleDriveUpload(enabled);
      setDriveStatus(prev => ({ ...prev, upload_enabled: enabled }));
      setMessage(`Google Drive upload ${enabled ? 'enabled' : 'disabled'}`);
      setMessageType('success');
    } catch (error) {
      console.error('Error toggling Drive upload:', error);
      setMessage('Failed to toggle Drive upload');
      setMessageType('error');
    } finally {
      setIsDriveLoading(false);
    }
  };
  
  
  const handleSaveMassugcApiKey = async () => {
    try {
      setIsSavingMassugcApiKey(true);
      
      if (!massugcApiKey.trim()) {
        setMessage('MassUGC API key cannot be empty');
        setMessageType('error');
        return;
      }
      
      // Validate format
      const massugcPattern = /^massugc_[A-Za-z0-9_-]{32}$/;
      if (!massugcPattern.test(massugcApiKey.trim())) {
        setMessage('Invalid MassUGC API key format. Expected: massugc_[32-character-nanoid]');
        setMessageType('error');
        return;
      }
      
      const result = await setMassUGCApiKey(massugcApiKey.trim());
      
      setMessage('MassUGC API key saved successfully!');
      setMessageType('success');
      
      // Reload status and clear the input
      setMassugcApiKeyLocal('');
      await loadMassUGCApiKeyStatus();
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        if (messageType === 'success') {
          setMessage(null);
        }
      }, 3000);
      
    } catch (error) {
      console.error('Error saving MassUGC API key:', error);
      setMessage('Failed to save MassUGC API key: ' + error.message);
      setMessageType('error');
    } finally {
      setIsSavingMassugcApiKey(false);
    }
  };
  
  const handleRemoveMassugcApiKey = async () => {
    try {
      setIsSavingMassugcApiKey(true);
      
      await removeMassUGCApiKey();
      
      setMessage('MassUGC API key removed successfully!');
      setMessageType('success');
      
      // Clear local state
      setMassugcApiKeyLocal('');
      setMassugcApiKeyStatus({ configured: false, valid: false });
      setMassugcUsageStats(null);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        if (messageType === 'success') {
          setMessage(null);
        }
      }, 3000);
      
    } catch (error) {
      console.error('Error removing MassUGC API key:', error);
      setMessage('Failed to remove MassUGC API key: ' + error.message);
      setMessageType('error');
    } finally {
      setIsSavingMassugcApiKey(false);
    }
  };
  
  const handleSaveSettings = async () => {
    try {
      setIsLoading(true);
      
      // Create form data
      const formData = new FormData();
      Object.entries(settings).forEach(([key, value]) => {
        formData.append(key, value);
      });
      
      await saveSettings(formData);
      
      setMessage('Settings saved successfully!');
      setMessageType('success');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        if (messageType === 'success') {
          setMessage(null);
        }
      }, 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage('Failed to save settings: ' + error.message);
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleLocationChange = (e) => {
    updateExportLocation(e.target.value);
  };
  
  // Handle browsing for export location directory
  const handleBrowseExportPath = async () => {
    if (window.electron && window.electron.ipcRenderer) {
      try {
        const result = await window.electron.ipcRenderer.invoke('show-directory-picker', {
          title: 'Select Export Location',
          buttonLabel: 'Select Folder'
        });
        if (result && !result.canceled && result.filePaths && result.filePaths.length > 0) {
          const selectedPath = result.filePaths[0];
          handleSettingChange('OUTPUT_PATH', selectedPath);
        }
      } catch (error) {
        console.error('Error selecting directory:', error);
      }
    } else {
      console.warn('Directory picker not available in this environment');
    }
  };
  
  // Handle browsing for Google credentials file
  const handleBrowseCredentialsFile = async () => {
    if (window.electron && window.electron.ipcRenderer) {
      try {
        const result = await window.electron.ipcRenderer.invoke('show-file-picker', {
          title: 'Select Google Credentials File',
          buttonLabel: 'Select File',
          filters: [
            { name: 'JSON Files', extensions: ['json'] }
          ]
        });
        if (result && !result.canceled && result.filePaths && result.filePaths.length > 0) {
          const selectedPath = result.filePaths[0];
          handleSettingChange('GOOGLE_APPLICATION_CREDENTIALS', selectedPath);
        }
      } catch (error) {
        console.error('Error selecting file:', error);
      }
    } else {
      console.warn('File picker not available in this environment');
    }
  };
  
  // Handle downloading app log
  const handleDownloadLog = async () => {
    if (!window.electron || !window.electron.ipcRenderer) {
      console.warn('Log download not available in this environment');
      return;
    }
    
    try {
      setIsDownloadingLog(true);
      const result = await window.electron.ipcRenderer.invoke('download-app-log');
      
      if (result.success) {
        setMessage('App log downloaded successfully!');
        setMessageType('success');
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          if (messageType === 'success') {
            setMessage(null);
          }
        }, 3000);
      } else if (result.canceled) {
        // User canceled, don't show an error
        return;
      } else {
        setMessage('Failed to download log: ' + (result.error || 'Unknown error'));
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error downloading log:', error);
      setMessage('Failed to download log: ' + error.message);
      setMessageType('error');
    } finally {
      setIsDownloadingLog(false);
    }
  };

  // Handle quick test of all APIs and services
  const handleQuickTest = async () => {
    try {
      setIsQuickTesting(true);
      setTestResults(null);
      setMessage(null);
      
      // Prepare test data with all current settings
      const testData = {
        OPENAI_API_KEY: settings.OPENAI_API_KEY,
        ELEVENLABS_API_KEY: settings.ELEVENLABS_API_KEY,
        DREAMFACE_API_KEY: settings.DREAMFACE_API_KEY,
        GCS_BUCKET_NAME: settings.GCS_BUCKET_NAME,
        GOOGLE_APPLICATION_CREDENTIALS: settings.GOOGLE_APPLICATION_CREDENTIALS,
        MASSUGC_API_KEY: massugcApiKey || (massugcApiKeyStatus?.configured ? '[CONFIGURED]' : '')
      };
      
      // Call the backend test endpoint
      const response = await testConfiguration(testData);
      setTestResults(response);
      
      // Show success message
      const passedTests = Object.values(response).filter(test => test.status === 'success').length;
      const totalTests = Object.keys(response).length;
      
      if (passedTests === totalTests) {
        setMessage(`All tests passed! (${passedTests}/${totalTests}) Your configuration is ready.`);
        setMessageType('success');
      } else {
        setMessage(`${passedTests}/${totalTests} tests passed. Check results below for details.`);
        setMessageType('warning');
      }
      
    } catch (error) {
      console.error('Error running quick test:', error);
      setMessage('Quick test failed: ' + (error.message || 'Unknown error'));
      setMessageType('error');
      setTestResults(null);
    } finally {
      setIsQuickTesting(false);
    }
  };

  // Handle debug report generation and download
  const handleDownloadDebugReport = async () => {
    try {
      setIsGeneratingReport(true);
      setMessage(null);
      
      // Generate debug report from backend
      const reportData = await generateDebugReport();
      
      // Format the report as a readable text file
      const reportText = formatDebugReport(reportData);
      
      // Create filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `massugc-debug-report-${timestamp}.txt`;
      
      // Check if running in Electron environment
      if (window.electron && window.electron.ipcRenderer) {
        try {
          // Electron environment - use IPC for file saving
          const tempPath = await window.electron.ipcRenderer.invoke('save-temp-debug-report', {
            content: reportText,
            filename: filename
          });
          
          if (tempPath) {
            // Now use the save dialog to let user choose final location
            const result = await window.electron.ipcRenderer.invoke('save-file-dialog', {
              sourceFilePath: tempPath,
              suggestedName: filename,
              title: 'Save Debug Report',
              filters: [
                { name: 'Text Files', extensions: ['txt'] },
                { name: 'All Files', extensions: ['*'] }
              ],
              cleanupTemp: true
            });
            
                         if (result.success) {
               setMessage('Debug report downloaded successfully!');
               setMessageType('success');
               
               // Clear success message after 3 seconds
               setTimeout(() => {
                 setMessage(null);
               }, 3000);
             } else if (!result.canceled) {
              setMessage('Failed to save debug report: ' + (result.error || 'Unknown error'));
              setMessageType('error');
            }
          } else {
            setMessage('Failed to generate debug report file');
            setMessageType('error');
          }
        } catch (electronError) {
          console.warn('Electron IPC failed, falling back to browser download:', electronError);
          // Fall back to browser download
          downloadInBrowser(reportText, filename);
        }
      } else {
        // Browser environment - use browser download
        downloadInBrowser(reportText, filename);
      }
      
    } catch (error) {
      console.error('Error generating debug report:', error);
      setMessage('Failed to generate debug report: ' + error.message);
      setMessageType('error');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Helper function for browser-based download
  const downloadInBrowser = (content, filename) => {
    try {
      // Create a blob with the content
      const blob = new Blob([content], { type: 'text/plain' });
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setMessage('Debug report downloaded successfully!');
      setMessageType('success');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    } catch (error) {
      console.error('Browser download failed:', error);
      setMessage('Failed to download debug report: ' + error.message);
      setMessageType('error');
    }
  };

  // Handle opening email client with debug report
  const handleSendToGeekSquad = async () => {
    try {
      setIsGeneratingReport(true);
      setMessage('Generating debug report...');
      setMessageType('info');
      
      // First, generate the debug report
      const reportData = await generateDebugReport();
      
      // Format the report as a readable text file
      const reportText = formatDebugReport(reportData);
      
      // Create filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `massugc-debug-report-${timestamp}.txt`;
      
      // Check if running in Electron environment
      if (window.electron && window.electron.ipcRenderer) {
        try {
          // Electron environment - save file and open email client
          const downloadsPath = await window.electron.ipcRenderer.invoke('get-downloads-path');
          const reportPath = `${downloadsPath}/${filename}`;
          
          // Save the report to downloads folder
          const tempPath = await window.electron.ipcRenderer.invoke('save-temp-debug-report', {
            content: reportText,
            filename: filename
          });
          
          if (!tempPath) {
            throw new Error('Failed to generate debug report file');
          }
          
          // Move to downloads folder
          const saveResult = await window.electron.ipcRenderer.invoke('save-file-dialog', {
            sourceFilePath: tempPath,
            suggestedName: filename,
            defaultPath: reportPath,
            title: 'Save Debug Report',
            filters: [
              { name: 'Text Files', extensions: ['txt'] },
              { name: 'All Files', extensions: ['*'] }
            ],
            cleanupTemp: true
          });
          
          const finalReportPath = saveResult.filePath || reportPath;
          
          // Email details
          const subject = encodeURIComponent('MassUGC Studio - Debug Report');
          const body = encodeURIComponent(`Hi Tech Team,

I'm experiencing an issue with MassUGC Studio and have generated a debug report for your review.

Please find the debug report file attached at:
${finalReportPath}

If the file is not at this location, please let me know and I can send it via another method.

Issue Description:
[Please describe the issue you're experiencing]

Steps to Reproduce:
1. [Step 1]
2. [Step 2]
3. [Step 3]

Thank you for your assistance!`);
          
          // Open default email client
          const emailUrl = `mailto:team@vandelnetwork.com?subject=${subject}&body=${body}`;
          try {
            // Try using Electron's shell.openExternal if available
            await window.electron.ipcRenderer.invoke('open-external', emailUrl);
          } catch (electronEmailError) {
            console.warn('Electron email opening failed, using fallback:', electronEmailError);
            // Fallback to creating a temporary link
            const tempLink = document.createElement('a');
            tempLink.href = emailUrl;
            tempLink.style.display = 'none';
            document.body.appendChild(tempLink);
            tempLink.click();
            document.body.removeChild(tempLink);
          }
          
          setMessage('Debug report downloaded and email client opened! The report is ready to attach.');
          setMessageType('success');
          
          // Clear success message after 5 seconds
          setTimeout(() => {
            setMessage(null);
          }, 5000);
        } catch (electronError) {
          console.warn('Electron functionality failed, using browser fallback:', electronError);
          // Fall back to browser functionality
          openEmailInBrowser(reportText, filename);
        }
      } else {
        // Browser environment - download file and open email
        openEmailInBrowser(reportText, filename);
      }
      
    } catch (error) {
      console.error('Error generating report and opening email:', error);
      setMessage('Failed to prepare debug report: ' + error.message);
      setMessageType('error');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Helper function for browser-based email functionality
  const openEmailInBrowser = (reportText, filename) => {
    try {
      // Download the file in browser
      downloadInBrowser(reportText, filename);
      
      // Email details for browser
      const subject = encodeURIComponent('MassUGC Studio - Debug Report');
      const body = encodeURIComponent(`Hi Tech Team,

I'm experiencing an issue with MassUGC Studio and have generated a debug report for your review.

The debug report file (${filename}) has been downloaded to your default download folder.

Issue Description:
[Please describe the issue you're experiencing]

Steps to Reproduce:
1. [Step 1]
2. [Step 2]
3. [Step 3]

Thank you for your assistance!`);
      
      // Open email client via browser
      const emailUrl = `mailto:team@vandelnetwork.com?subject=${subject}&body=${body}`;
      
      // Create a temporary link element to open email client reliably
      const tempLink = document.createElement('a');
      tempLink.href = emailUrl;
      tempLink.style.display = 'none';
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
      
      setMessage('Debug report downloaded and email template opened! Please attach the downloaded file to your email.');
      setMessageType('success');
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setMessage(null);
      }, 5000);
    } catch (error) {
      console.error('Browser email functionality failed:', error);
      setMessage('Debug report generated, but unable to open email client. Please download the report manually.');
      setMessageType('warning');
    }
  };

  // Format debug report as readable text
  const formatDebugReport = (data) => {
    const lines = [];
    lines.push('='.repeat(80));
    lines.push('MassUGC STUDIO DEBUG REPORT');
    lines.push('='.repeat(80));
    lines.push(`Generated: ${data.report_info?.generated_at || 'Unknown'}`);
    lines.push(`App Version: ${data.report_info?.app_version || 'Unknown'}`);
    lines.push(`Backend Port: ${data.report_info?.backend_port || 'Unknown'}`);
    lines.push('');
    
    // System Health Overview
    lines.push('💻 SYSTEM HEALTH OVERVIEW');
    lines.push('-'.repeat(50));
    if (data.hardware_information) {
      const hw = data.hardware_information;
      const memoryStatus = hw.memory_percent > 85 ? '🔴 HIGH' : 
                          hw.memory_percent > 70 ? '🟡 MEDIUM' : '🟢 GOOD';
      const diskStatus = hw.disk_percent > 90 ? '🔴 CRITICAL' : 
                        hw.disk_percent > 80 ? '🟡 WARNING' : '🟢 GOOD';
      
      lines.push(`Memory Usage: ${memoryStatus} (${hw.memory_percent}% - ${hw.memory_available_gb}GB free)`);
      lines.push(`Disk Usage: ${diskStatus} (${hw.disk_percent}% - ${hw.disk_free_gb}GB free)`);
      lines.push(`CPU Cores: ${hw.cpu_count} available`);
    }
    lines.push('');
    
    // API Status Summary
    lines.push('🔑 API STATUS SUMMARY');
    lines.push('-'.repeat(50));
    if (data.environment_status) {
      Object.entries(data.environment_status).forEach(([key, value]) => {
        if (key.includes('API_KEY')) {
          const status = value === 'NOT SET' ? '🔴 MISSING' : '🟢 SET';
          const service = key.replace('_API_KEY', '').replace('_', ' ');
          lines.push(`${service}: ${status}`);
        }
      });
    }
    lines.push('');
    
    // === DEVELOPER/TECHNICAL SECTION ===
    lines.push('');
    lines.push('='.repeat(80));
    lines.push('🔧 DEVELOPER SECTION (Technical Details)');
    lines.push('='.repeat(80));
    
    // System Information
    lines.push('SYSTEM INFORMATION');
    lines.push('-'.repeat(40));
    if (data.system_information) {
      Object.entries(data.system_information).forEach(([key, value]) => {
        lines.push(`${key}: ${value}`);
      });
    }
    lines.push('');
    
    // Hardware Information (Full Details)
    lines.push('HARDWARE INFORMATION');
    lines.push('-'.repeat(40));
    if (data.hardware_information) {
      Object.entries(data.hardware_information).forEach(([key, value]) => {
        lines.push(`${key}: ${value}`);
      });
    }
    lines.push('');
    
    // Environment Status (Full Details)
    lines.push('ENVIRONMENT STATUS');
    lines.push('-'.repeat(40));
    if (data.environment_status) {
      Object.entries(data.environment_status).forEach(([key, value]) => {
        lines.push(`${key}: ${value}`);
      });
    }
    lines.push('');
    
    // Job Queue Status (Technical)
    lines.push('JOB QUEUE STATUS');
    lines.push('-'.repeat(30));
    lines.push(`Active Jobs: ${data.active_jobs_count || 0}`);
    if (data.job_queue_status) {
      Object.entries(data.job_queue_status).forEach(([key, value]) => {
        lines.push(`${key}: ${value}`);
      });
    }
    lines.push('');
    
    lines.push('='.repeat(60));
    lines.push('END OF REPORT');
    lines.push('='.repeat(60));
    
    return lines.join('\n');
  };
  
  return (
    <motion.div 
      className="space-y-6 max-w-3xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-2xl font-display font-medium">Settings</h2>
      
      {/* Status message */}
      {message && (
        <div className={`rounded-md p-4 ${
          messageType === 'success' ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
          messageType === 'error' ? 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
          'bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
        }`}>
          <p>{message}</p>
        </div>
      )}
      
      <div className={`rounded-xl shadow-sm p-6 space-y-8 border 
        ${darkMode 
          ? 'bg-neutral-800/50 border-neutral-700 shadow-dark-glass' 
          : 'bg-white border-neutral-200'
        }`}>
        {/* API Keys */}
        <div>
          <h3 className={`text-lg font-medium mb-4 
            ${darkMode ? 'text-primary-100' : 'text-primary-900'}`}>
            API Keys
          </h3>
          
          <div className="space-y-4">
            
            {/* MassUGC API Key */}
            <div className={`p-4 rounded-lg border-2 ${darkMode ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-yellow-500/30 bg-yellow-50'}`}>
              <div className="flex items-center mb-2">
                <KeyIcon className={`h-5 w-5 mr-2 ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />
                <label 
                  htmlFor="massugc-api-key" 
                  className={`block text-sm font-medium
                    ${darkMode ? 'text-yellow-300' : 'text-yellow-700'}`}
                >
                  MassUGC API Key
                </label>
              </div>
              
              {/* Current Status */}
              {massugcApiKeyStatus && (
                <div className={`mb-3 p-2 rounded ${
                  massugcApiKeyStatus.configured && massugcApiKeyStatus.valid
                    ? (darkMode ? 'bg-green-900/20 text-green-300' : 'bg-green-50 text-green-700')
                    : (darkMode ? 'bg-yellow-900/20 text-yellow-300' : 'bg-yellow-50 text-yellow-700')
                }`}>
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      massugcApiKeyStatus.configured && massugcApiKeyStatus.valid ? 'bg-green-500' : 'bg-yellow-500'
                    }`} />
                    <span className="text-xs font-medium">
                      {massugcApiKeyStatus.configured && massugcApiKeyStatus.valid ? (
                        <>Connected as {massugcApiKeyStatus.user_info?.email || 'unknown'}</>
                      ) : massugcApiKeyStatus.configured ? (
                        <>Key configured but validation failed: {massugcApiKeyStatus.error}</>
                      ) : (
                        'No API key configured'
                      )}
                    </span>
                  </div>
                </div>
              )}
              
              <div className="flex space-x-2">
                <div className="relative flex-1">
                  <input
                    id="massugc-api-key"
                    type={showMassugcApiKey ? "text" : "password"}
                    value={massugcApiKey}
                    onChange={handleMassugcApiKeyChange}
                    placeholder="Enter your MassUGC API key... (massugc_xxxxx)"
                    className={`w-full pr-10 rounded-md shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm
                      ${darkMode 
                        ? 'bg-surface-dark-warm border-content-600 text-content-100' 
                        : 'bg-surface-light-warm border-content-300 text-content-900'
                      }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowMassugcApiKey(!showMassugcApiKey)}
                    className={`absolute inset-y-0 right-0 pr-3 flex items-center
                      ${darkMode ? 'text-primary-400 hover:text-primary-200' : 'text-primary-500 hover:text-primary-700'}`}
                  >
                    {showMassugcApiKey ? (
                      <EyeSlashIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <Button
                  onClick={handleSaveMassugcApiKey}
                  disabled={isSavingMassugcApiKey || !massugcApiKey.trim()}
                  variant="primary"
                  size="sm"
                  icon={isSavingMassugcApiKey ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : null}
                >
                  {isSavingMassugcApiKey ? 'Saving...' : 'Save'}
                </Button>
                {massugcApiKeyStatus?.configured && (
                  <Button
                    onClick={handleRemoveMassugcApiKey}
                    disabled={isSavingMassugcApiKey}
                    variant="outline"
                    size="sm"
                  >
                    Remove
                  </Button>
                )}
              </div>
              <p className={`mt-2 text-xs ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                Get your API key from cloud.massugc.com (Pro users only)
              </p>
            </div>
            
            {/* OpenAI API Key */}
            <div>
              <label 
                htmlFor="openai-api-key" 
                className={`block text-sm font-medium mb-1
                  ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}
              >
                OpenAI API Key
              </label>
              <div className="relative">
              <input
                id="openai-api-key"
                  type={showOpenAIApiKey ? "text" : "password"}
                value={settings.OPENAI_API_KEY}
                onChange={(e) => handleSettingChange('OPENAI_API_KEY', e.target.value)}
                placeholder="sk-..."
                  className={`w-full pr-10 rounded-md shadow-sm focus:border-crimson-500 focus:ring-crimson-500 sm:text-sm
                  ${darkMode 
                    ? 'bg-surface-dark-warm border-content-600 text-content-100' 
                    : 'bg-surface-light-warm border-content-300 text-content-900'
                  }`}
              />
                <button
                  type="button"
                  onClick={() => setShowOpenAIApiKey(!showOpenAIApiKey)}
                  className={`absolute inset-y-0 right-0 pr-3 flex items-center
                    ${darkMode ? 'text-primary-400 hover:text-primary-200' : 'text-primary-500 hover:text-primary-700'}`}
                >
                  {showOpenAIApiKey ? (
                    <EyeSlashIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            
            {/* ElevenLabs API Key */}
            <div>
              <label 
                htmlFor="elevenlabs-api-key" 
                className={`block text-sm font-medium mb-1
                  ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}
              >
                ElevenLabs API Key
              </label>
              <div className="relative">
              <input
                id="elevenlabs-api-key"
                  type={showElevenLabsApiKey ? "text" : "password"}
                value={settings.ELEVENLABS_API_KEY}
                onChange={(e) => handleSettingChange('ELEVENLABS_API_KEY', e.target.value)}
                  className={`w-full pr-10 rounded-md shadow-sm focus:border-crimson-500 focus:ring-crimson-500 sm:text-sm
                  ${darkMode 
                    ? 'bg-surface-dark-warm border-content-600 text-content-100' 
                    : 'bg-surface-light-warm border-content-300 text-content-900'
                  }`}
              />
                <button
                  type="button"
                  onClick={() => setShowElevenLabsApiKey(!showElevenLabsApiKey)}
                  className={`absolute inset-y-0 right-0 pr-3 flex items-center
                    ${darkMode ? 'text-primary-400 hover:text-primary-200' : 'text-primary-500 hover:text-primary-700'}`}
                >
                  {showElevenLabsApiKey ? (
                    <EyeSlashIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            
            {/* DreamFace API Key */}
            <div>
              <label 
                htmlFor="dreamface-api-key" 
                className={`block text-sm font-medium mb-1
                  ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}
              >
                Lipsync API Key
              </label>
              <div className="relative">
              <input
                id="dreamface-api-key"
                  type={showDreamFaceApiKey ? "text" : "password"}
                value={settings.DREAMFACE_API_KEY}
                onChange={(e) => handleSettingChange('DREAMFACE_API_KEY', e.target.value)}
                  className={`w-full pr-10 rounded-md shadow-sm focus:border-crimson-500 focus:ring-crimson-500 sm:text-sm
                  ${darkMode 
                    ? 'bg-surface-dark-warm border-content-600 text-content-100' 
                    : 'bg-surface-light-warm border-content-300 text-content-900'
                  }`}
              />
                <button
                  type="button"
                  onClick={() => setShowDreamFaceApiKey(!showDreamFaceApiKey)}
                  className={`absolute inset-y-0 right-0 pr-3 flex items-center
                    ${darkMode ? 'text-primary-400 hover:text-primary-200' : 'text-primary-500 hover:text-primary-700'}`}
                >
                  {showDreamFaceApiKey ? (
                    <EyeSlashIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
          
          <div className="mt-6 space-y-4">
            {/* GCS Bucket Name */}
            <div>
              <label 
                htmlFor="gcs-bucket" 
                className={`block text-sm font-medium mb-1
                  ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}
              >
                GCS Bucket Name
              </label>
              <div className="relative">
                <input
                  id="gcs-bucket"
                  type={showGcsBucket ? "text" : "password"}
                  value={settings.GCS_BUCKET_NAME}
                  onChange={(e) => handleSettingChange('GCS_BUCKET_NAME', e.target.value)}
                  className={`w-full rounded-md shadow-sm focus:border-crimson-500 focus:ring-crimson-500 sm:text-sm pr-10
                    ${darkMode 
                      ? 'bg-surface-dark-warm border-content-600 text-content-100' 
                      : 'bg-surface-light-warm border-content-300 text-content-900'
                    }`}
                />
                <button
                  type="button"
                  onClick={() => setShowGcsBucket(!showGcsBucket)}
                  className={`absolute inset-y-0 right-0 pr-3 flex items-center
                    ${darkMode ? 'text-content-400 hover:text-content-200' : 'text-content-600 hover:text-content-800'}`}
                >
                  {showGcsBucket ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
            
            {/* Google Application Credentials */}
            <div>
              <label 
                htmlFor="google-credentials" 
                className={`block text-sm font-medium mb-1
                  ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}
              >
                Google Application Credentials (Path to json file)
              </label>
              <div className="flex">
                <div className="flex-1 relative">
                  <input
                    id="google-credentials"
                    type={showGoogleCredentials ? "text" : "password"}
                    value={settings.GOOGLE_APPLICATION_CREDENTIALS}
                    onChange={(e) => handleSettingChange('GOOGLE_APPLICATION_CREDENTIALS', e.target.value)}
                    placeholder="Path to credentials.json file"
                    className={`w-full rounded-l-md shadow-sm focus:border-crimson-500 focus:ring-crimson-500 sm:text-sm pr-10
                      ${darkMode 
                        ? 'bg-surface-dark-warm border-content-600 text-content-100' 
                        : 'bg-surface-light-warm border-content-300 text-content-900'
                      }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowGoogleCredentials(!showGoogleCredentials)}
                    className={`absolute inset-y-0 right-0 pr-3 flex items-center
                      ${darkMode ? 'text-content-400 hover:text-content-200' : 'text-content-600 hover:text-content-800'}`}
                  >
                    {showGoogleCredentials ? (
                      <EyeSlashIcon className="h-5 w-5" />
                    ) : (
                      <EyeIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>
                <Button 
                  onClick={handleBrowseCredentialsFile}
                  className={`px-4 py-2 rounded-l-none rounded-r-md border-l-0
                    ${darkMode 
                      ? 'border-dark-500' 
                      : 'border-primary-300'
                    }`}
                  variant="secondary"
                  size="sm"
                >
                  Select
                </Button>
              </div>
            </div>
            
            {/* Export Location */}
            <div>
              <label 
                htmlFor="export-location" 
                className={`block text-sm font-medium mb-1
                  ${darkMode ? 'text-primary-300' : 'text-primary-700'}`}
              >
                Export Location
              </label>
              <div className="flex">
                <div className="flex-1 relative">
                  <input
                    id="export-location"
                    type={showExportLocation ? "text" : "password"}
                    name="exportLocation"
                    value={settings.OUTPUT_PATH}
                    onChange={(e) => handleSettingChange('OUTPUT_PATH', e.target.value)}
                    placeholder="Path for exported files"
                    disabled={driveStatus.upload_enabled}
                    className={`w-full rounded-l-md shadow-sm focus:border-crimson-500 focus:ring-crimson-500 sm:text-sm pr-10
                      ${darkMode 
                        ? 'bg-surface-dark-warm border-content-600 text-content-100' 
                        : 'bg-surface-light-warm border-content-300 text-content-900'
                      }`}
                  />
                  {!driveStatus.upload_enabled && (
                    <button
                      type="button"
                      onClick={() => setShowExportLocation(!showExportLocation)}
                      className={`absolute inset-y-0 right-0 pr-3 flex items-center
                        ${darkMode ? 'text-content-400 hover:text-content-200' : 'text-content-600 hover:text-content-800'}`}
                    >
                      {showExportLocation ? (
                        <EyeSlashIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                  )}
                </div>
                <Button 
                  onClick={handleBrowseExportPath}
                  disabled={driveStatus.upload_enabled}
                  className={`px-4 py-2 rounded-l-none rounded-r-md border-l-0
                    ${darkMode 
                      ? 'border-dark-500' 
                      : 'border-primary-300'
                    }`}
                  variant="secondary"
                  size="sm"
                >
                  Browse
                </Button>
              </div>
            </div>
            
            {/* Google Drive Integration */}
            <div className={`mt-6 p-4 rounded-lg border ${
              darkMode 
                ? 'bg-surface-dark-warm border-content-600' 
                : 'bg-surface-light-warm border-content-300'
            }`}>
              <h3 className={`text-lg font-semibold mb-4 ${
                darkMode ? 'text-primary-200' : 'text-primary-800'
              }`}>
                Google Drive Integration
              </h3>
              
              <div className="space-y-4">
                {/* Connection Status */}
                {driveStatus.connected ? (
                  <div className={`p-3 rounded-md ${
                    darkMode ? 'bg-green-900/20 border border-green-700' : 'bg-green-50 border border-green-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`font-medium ${darkMode ? 'text-green-300' : 'text-green-700'}`}>
                          Connected to Google Drive
                        </p>
                        {driveStatus.user && (
                          <p className={`text-sm ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                            {driveStatus.user.email}
                          </p>
                        )}
                      </div>
                      <Button
                        onClick={handleDisconnectDrive}
                        variant="secondary"
                        size="sm"
                        disabled={isDriveLoading}
                      >
                        Disconnect
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className={`p-3 rounded-md ${
                    darkMode ? 'bg-surface-dark border border-content-600' : 'bg-gray-50 border border-gray-200'
                  }`}>
                    <p className={`text-sm mb-3 ${darkMode ? 'text-content-300' : 'text-content-700'}`}>
                      Connect your Google Drive to automatically upload videos to the cloud
                    </p>
                    <Button
                      onClick={handleConnectDrive}
                      variant="primary"
                      disabled={isConnectingDrive}
                    >
                      {isConnectingDrive ? 'Connecting...' : 'Connect Google Drive'}
                    </Button>
                  </div>
                )}
                
                {/* Upload Toggle */}
                {driveStatus.connected && (
                  <div className="flex items-center justify-between">
                    <div>
                      <label className={`text-sm font-medium ${
                        darkMode ? 'text-primary-300' : 'text-primary-700'
                      }`}>
                        Upload Videos to Google Drive
                      </label>
                      <p className={`text-xs mt-1 ${
                        darkMode ? 'text-content-400' : 'text-content-600'
                      }`}>
                        When enabled, videos will be uploaded to Drive instead of local storage
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={driveStatus.upload_enabled}
                        onChange={(e) => handleToggleDriveUpload(e.target.checked)}
                        disabled={isDriveLoading}
                      />
                      <div className={`w-11 h-6 rounded-full peer 
                        ${darkMode 
                          ? 'bg-content-700 peer-checked:bg-crimson-600' 
                          : 'bg-gray-200 peer-checked:bg-crimson-500'
                        } 
                        peer-focus:outline-none peer-focus:ring-4 
                        ${darkMode 
                          ? 'peer-focus:ring-crimson-800' 
                          : 'peer-focus:ring-crimson-300'
                        }
                        after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
                        after:bg-white after:rounded-full after:h-5 after:w-5 
                        after:transition-all peer-checked:after:translate-x-full`}>
                      </div>
                    </label>
                  </div>
                )}
                
                {/* Info about local storage */}
                {driveStatus.connected && driveStatus.upload_enabled && (
                  <div className={`p-2 rounded text-xs ${
                    darkMode ? 'bg-blue-900/20 text-blue-300' : 'bg-blue-50 text-blue-700'
                  }`}>
                    ℹ️ Videos will be uploaded to Drive and local files will be deleted to save space
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex gap-3">
            <Button
              variant="primary"
              onClick={handleSaveSettings}
              disabled={isLoading || isQuickTesting}
              icon={isLoading ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : null}
            >
              {isLoading ? 'Saving...' : 'Save Settings'}
            </Button>
            <Button
              variant="secondary"
              onClick={handleQuickTest}
              disabled={isLoading || isQuickTesting}
              icon={isQuickTesting ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : null}
            >
              {isQuickTesting ? 'Testing...' : 'Quick Test'}
            </Button>
          </div>
          
          {/* Test Results */}
          {testResults && (
            <div className="mt-6">
              <h4 className={`text-md font-medium mb-3 ${darkMode ? 'text-primary-200' : 'text-primary-800'}`}>
                Quick Test Results
              </h4>
              <div className="space-y-2">
                {Object.entries(testResults).map(([service, result]) => (
                  <div 
                    key={service}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      result.status === 'success' 
                        ? (darkMode ? 'bg-green-900/20 border-green-700' : 'bg-green-50 border-green-200')
                        : (darkMode ? 'bg-red-900/20 border-red-700' : 'bg-red-50 border-red-200')
                    }`}
                  >
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-3 ${
                        result.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      <div>
                        <p className={`font-medium ${darkMode ? 'text-primary-200' : 'text-primary-800'}`}>
                          {service.replace(/_/g, ' ').replace(/API/g, 'API')}
                        </p>
                        <p className={`text-sm ${
                          result.status === 'success' 
                            ? (darkMode ? 'text-green-300' : 'text-green-700')
                            : (darkMode ? 'text-red-300' : 'text-red-700')
                        }`}>
                          {result.link ? (
                            <span>
                              Connected - <button
                                onClick={async () => {
                                  if (window.electron && window.electron.ipcRenderer) {
                                    try {
                                      // Electron environment - opens in system browser
                                      await window.electron.ipcRenderer.invoke('open-external', result.link);
                                    } catch (electronError) {
                                      console.warn('Electron open-external failed, using browser fallback:', electronError);
                                      // Fallback to browser method
                                      window.open(result.link, '_blank');
                                    }
                                  } else {
                                    // Browser environment
                                    window.open(result.link, '_blank');
                                  }
                                }}
                                className={`underline hover:no-underline ${
                                  darkMode ? 'text-green-200 hover:text-green-100' : 'text-green-800 hover:text-green-900'
                                }`}
                              >
                                Check Credits Here
                              </button>
                            </span>
                          ) : (
                            result.message
                          )}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded ${
                      result.status === 'success'
                        ? (darkMode ? 'bg-green-800 text-green-200' : 'bg-green-100 text-green-800')
                        : (darkMode ? 'bg-red-800 text-red-200' : 'bg-red-100 text-red-800')
                    }`}>
                      {result.status === 'success' ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Theme Selection */}
        <div className={`pt-6 border-t ${darkMode ? 'border-dark-600' : 'border-primary-200'}`}>
          <h3 className={`text-lg font-medium mb-4 
            ${darkMode ? 'text-primary-100' : 'text-primary-900'}`}>
            Appearance
          </h3>
          <div className="flex space-x-4">
            <motion.button
              onClick={() => !darkMode ? null : toggleDarkMode()}
              className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
                !darkMode 
                  ? 'border-accent-500 bg-accent-500/5' 
                  : 'border-primary-200 dark:border-dark-600 hover:border-primary-400 dark:hover:border-dark-500'
              }`}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <SunIcon className={`h-6 w-6 mb-2 ${darkMode ? 'text-primary-400' : 'text-primary-700'}`} />
              <span className={`text-sm font-medium ${darkMode ? 'text-primary-300' : 'text-primary-900'}`}>Light</span>
            </motion.button>
            
            <motion.button
              onClick={() => darkMode ? null : toggleDarkMode()}
              className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
                darkMode 
                  ? 'border-accent-500 bg-accent-500/5' 
                  : 'border-primary-200 hover:border-primary-400'
              }`}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <MoonIcon className={`h-6 w-6 mb-2 ${darkMode ? 'text-primary-300' : 'text-primary-700'}`} />
              <span className={`text-sm font-medium ${darkMode ? 'text-primary-200' : 'text-primary-900'}`}>Dark</span>
            </motion.button>
          </div>
        </div>
        
        {/* Debug & Support */}
        <div className={`pt-6 border-t ${darkMode ? 'border-dark-600' : 'border-primary-200'}`}>
          <h3 className={`text-lg font-medium mb-4 
            ${darkMode ? 'text-primary-100' : 'text-primary-900'}`}>
            Debug & Support
          </h3>
          <div className="space-y-3">
            <div className={`p-4 rounded-lg border ${darkMode ? 'border-content-600 bg-surface-dark-warm/50' : 'border-content-200 bg-surface-light-warm/50'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className={`font-medium ${darkMode ? 'text-primary-200' : 'text-primary-800'}`}>
                    App Log File
                  </h4>
                  <p className={`text-sm mt-1 ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                    Download your app logs to help our team debug any issues you're experiencing.
                  </p>
                  {logInfo.exists && (
                    <p className={`text-xs mt-2 ${darkMode ? 'text-primary-500' : 'text-primary-500'}`}>
                      Log file size: {logInfo.sizeFormatted} • Last updated: {new Date(logInfo.lastModified).toLocaleString()}
                    </p>
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadLog}
                  disabled={!logInfo.exists || isDownloadingLog}
                  isLoading={isDownloadingLog}
                  icon={<ArrowDownTrayIcon className="h-4 w-4" />}
                >
                  {isDownloadingLog ? 'Downloading...' : 'Download Log'}
                </Button>
              </div>
              {!logInfo.exists && (
                <p className={`text-sm mt-2 ${darkMode ? 'text-primary-500' : 'text-primary-500'}`}>
                  No log file available yet. The app will create one as you use it.
                </p>
              )}
            </div>
            
            {/* Debug Report */}
            <div className={`p-4 rounded-lg border ${darkMode ? 'border-content-600 bg-surface-dark-warm/50' : 'border-content-200 bg-surface-light-warm/50'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className={`font-medium ${darkMode ? 'text-primary-200' : 'text-primary-800'}`}>
                    Debug Report
                  </h4>
                  <p className={`text-sm mt-1 ${darkMode ? 'text-primary-400' : 'text-primary-600'}`}>
                    Generate a comprehensive debug report with system info, recent errors, and configuration details.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDownloadDebugReport}
                    disabled={isGeneratingReport}
                    isLoading={isGeneratingReport}
                    icon={<ArrowDownTrayIcon className="h-4 w-4" />}
                  >
                    {isGeneratingReport ? 'Generating...' : 'Download Report'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSendToGeekSquad}
                    disabled={isGeneratingReport}
                  >
                    Send to Geek Squad
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* App Info */}
        <div className={`pt-4 border-t ${darkMode ? 'border-dark-600' : 'border-primary-200'}`}>
          <div className="flex justify-between text-sm">
            <span className={darkMode ? 'text-primary-400' : 'text-primary-500'}>MassUGC Studio © 2025</span>
            <span className={darkMode ? 'text-primary-400' : 'text-primary-500'}>Version {appVersion}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default SettingsPage;