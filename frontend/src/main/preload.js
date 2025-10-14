const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Create app data directories if they don't exist
const appDataPath = path.join(os.homedir(), '.zyra-video-agent/ZyraData');

// Ensure directories exist
try {
  if (!fs.existsSync(appDataPath)) {
    fs.mkdirSync(appDataPath, { recursive: true });
    console.log('Created ZyraData directory');
  }
} catch (err) {
  console.error('Error creating app directories:', err);
}

// Log useful info about files for debugging
const logFileInfo = (file) => {
  if (!file) {
    console.log('File is null or undefined');
    return;
  }
  
  console.log('File info:');
  console.log('- Type:', typeof file);
  
  if (typeof file === 'string') {
    console.log('- Is path string, exists:', fs.existsSync(file));
    return;
  }
  
  if (Buffer.isBuffer(file)) {
    console.log('- Is Buffer, length:', file.length);
    return;
  }
  
  if (typeof file === 'object') {
    console.log('- Is object with properties:', Object.keys(file));
    if (file.path) console.log('- Path:', file.path, 'exists:', fs.existsSync(file.path));
    if (file.name) console.log('- Name:', file.name);
    if (file.size !== undefined) console.log('- Size:', file.size);
    if (file.type) console.log('- MIME Type:', file.type);
  }
};

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    ipcRenderer: {
      invoke: (channel, ...args) => {
        // Whitelist of allowed IPC channels
        const validChannels = [
          'select-file-dialog',
          'read-text-file',
          'handle-file-object',
          'save-file-dialog',
          'delete-file',
          'check-api-connectivity',
          'test-file-exists',
          'copy-file-to-exports',
          'show-in-folder',
          'restart-backend',
          'check-backend-status',
          'restart-app',
          'show-file-picker',
          'show-directory-picker',
          'download-app-log',
          'get-log-info',
          'open-external'
        ];
        if (validChannels.includes(channel)) {
          return ipcRenderer.invoke(channel, ...args);
        }
        throw new Error(`Unauthorized IPC channel: ${channel}`);
      }
    },
    saveFile: (sourcePath, suggestedName) => {
      // In a full implementation, this would trigger a save dialog
      // For now, we'll create a simple implementation that copies the file
      // to the user's downloads folder
      const downloadsPath = path.join(process.env.HOME || process.env.USERPROFILE, 'Downloads');
      const destPath = path.join(downloadsPath, suggestedName);
      
      try {
        // Create a readable stream from the source file
        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, destPath);
          console.log(`File saved to: ${destPath}`);
          return true;
        } else {
          console.error(`Source file not found: ${sourcePath}`);
          return false;
        }
      } catch (err) {
        console.error('Error saving file:', err);
        return false;
      }
    },
    getAppVersion: () => process.env.npm_package_version,
    getSystemInfo: () => ({
      platform: process.platform,
      arch: process.arch,
      versions: process.versions
    }),
    // Save a file to one of our app directories
    saveFileToAppDir: (fileData, fileName) => {
      try {
        console.log('saveFileToAppDir called with:', { fileName, dirType });
        logFileInfo(fileData);
        
        // Determine target directory
        let targetDir = appDataPath;
        
        // Create file path and write file
        const filePath = path.join(targetDir, fileName);
        console.log('Saving to path:', filePath);
        
        // Handle file data based on whether it's a path or buffer
        if (typeof fileData === 'string' && fs.existsSync(fileData)) {
          // If fileData is a path to an existing file, copy it
          console.log('Copying file from path:', fileData);
          fs.copyFileSync(fileData, filePath);
          console.log('File copy complete');
        } else if (Buffer.isBuffer(fileData)) {
          // If fileData is a buffer, write it directly
          console.log('Writing buffer to file, length:', fileData.length);
          fs.writeFileSync(filePath, fileData);
          console.log('Buffer write complete');
        } else if (fileData instanceof ArrayBuffer || (fileData.buffer && fileData.buffer instanceof ArrayBuffer)) {
          // Handle ArrayBuffer or TypedArray
          console.log('Converting ArrayBuffer to Buffer and writing');
          const buffer = Buffer.from(fileData);
          fs.writeFileSync(filePath, buffer);
          console.log('ArrayBuffer write complete');
        } else if (typeof fileData === 'object' && fileData.path) {
          // Handle File or object with path
          console.log('Object has path property, copying from:', fileData.path);
          fs.copyFileSync(fileData.path, filePath);
          console.log('Object path copy complete');
        } else if (fileData && typeof fileData === 'object') {
          // Last resort: try to JSON serialize the object
          console.log('Attempting to handle object data:', typeof fileData, Object.keys(fileData));
          
          // If it seems to be a File-like object, but no built-in way to read it
          throw new Error(`File object could not be processed - no supported path or format: ${JSON.stringify(Object.keys(fileData))}`);
        } else if (typeof fileData === 'string') {
          // If fileData is a string but not a path, treat as text content
          console.log('Writing string as text content, length:', fileData.length);
          fs.writeFileSync(filePath, fileData, 'utf8');
          console.log('String write complete');
        } else {
          throw new Error('Invalid file data format: ' + (typeof fileData));
        }
        
        return { success: true, path: filePath };
      } catch (err) {
        console.error('Error saving file to app directory:', err);
        return { success: false, error: err.message };
      }
    },
    // Read a file from our app directories
    readFileFromAppDir: (fileName) => {
      try {
        // Determine source directory
        let sourceDir = appDataPath;
        
        // Create file path and read file
        const filePath = path.join(sourceDir, fileName);
        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`);
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        return { success: true, content, path: filePath };
      } catch (err) {
        console.error('Error reading file from app directory:', err);
        return { success: false, error: err.message };
      }
    },
    // Get a list of files in a directory
    listFilesInDir: (dirType) => {
      try {
        // Determine source directory
        let sourceDir = appDataPath;

        // Read directory contents
        const files = fs.readdirSync(sourceDir);
        return { success: true, files };
      } catch (err) {
        console.error('Error listing files in directory:', err);
        return { success: false, error: err.message };
      }
    },
    // Expose fs module for file operations
    fs: {
      readFileSync: (filePath) => {
        try {
          return fs.readFileSync(filePath);
        } catch (error) {
          console.error('Error reading file:', error);
          throw error;
        }
      },
      existsSync: (filePath) => {
        return fs.existsSync(filePath);
      }
    }
  }
);

// DOM ready event
window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  for (const dependency of ['chrome', 'node', 'electron']) {
    replaceText(`${dependency}-version`, process.versions[dependency]);
  }
});

// Add listeners for backend logging
ipcRenderer.on('backend-log', (event, message) => {
  console.log(`[Main Process] ${message}`);
});

ipcRenderer.on('backend-error', (event, message) => {
  console.error(`[Main Process] ${message}`);
}); 