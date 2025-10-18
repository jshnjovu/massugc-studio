const { app, BrowserWindow, ipcMain, dialog, protocol, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = require('electron-is-dev');
const http = require('http');
const { spawn } = require('child_process');
const os = require('os');

let mainWindow;
let backendProcess = null;
let fallbackFilePath = path.join(app.getPath('temp'), 'zyra-fallback.html');

// Setup logging system
const appDataPath = path.join(os.homedir(), '.zyra-video-agent');
const logFilePath = path.join(appDataPath, 'app.log');

// Ensure app data directory exists
if (!fs.existsSync(appDataPath)) {
  fs.mkdirSync(appDataPath, { recursive: true });
}

// Override console methods to also write to file
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Logging utility function
function writeLog(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...(data && { data })
  };
  
  const logLine = JSON.stringify(logEntry) + '\n';
  
  try {
    // Append to log file
    fs.appendFileSync(logFilePath, logLine);
    
    // Also log to console in development using ORIGINAL console.log to avoid recursion
    if (isDev) {
      originalConsoleLog(`[${level}] ${message}`, data || '');
    }
    
    // Rotate log file if it gets too large (>10MB)
    const stats = fs.statSync(logFilePath);
    if (stats.size > 10 * 1024 * 1024) {
      rotateLogFile();
    }
  } catch (error) {
    originalConsoleError('Failed to write to log file:', error);
  }
}

// Log rotation function
function rotateLogFile() {
  try {
    const backupPath = logFilePath + '.old';
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }
    fs.renameSync(logFilePath, backupPath);
    writeLog('INFO', 'Log file rotated');
  } catch (error) {
    console.error('Failed to rotate log file:', error);
  }
}

console.log = function(...args) {
  originalConsoleLog.apply(console, args);
  writeLog('INFO', args.join(' '));
};

console.error = function(...args) {
  originalConsoleError.apply(console, args);
  writeLog('ERROR', args.join(' '));
};

console.warn = function(...args) {
  originalConsoleWarn.apply(console, args);
  writeLog('WARN', args.join(' '));
};

// IPC handler for downloading app log
ipcMain.handle('download-app-log', async () => {
  try {
    if (!fs.existsSync(logFilePath)) {
      return { success: false, error: 'No log file found' };
    }

    // Show save dialog
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save App Log',
      defaultPath: `massugc-app-log-${new Date().toISOString().split('T')[0]}.log`,
      filters: [
        { name: 'Log Files', extensions: ['log'] },
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    // Copy log file to selected location
    fs.copyFileSync(logFilePath, result.filePath);
    
    writeLog('INFO', 'App log downloaded', { downloadPath: result.filePath });
    
    return { 
      success: true, 
      filePath: result.filePath,
      message: 'Log file saved successfully'
    };
  } catch (error) {
    writeLog('ERROR', 'Failed to download app log', { error: error.message });
    return { success: false, error: error.message };
  }
});

// IPC handler for getting log file info
ipcMain.handle('get-log-info', async () => {
  try {
    if (!fs.existsSync(logFilePath)) {
      return { exists: false };
    }

    const stats = fs.statSync(logFilePath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    return {
      exists: true,
      size: stats.size,
      sizeFormatted: `${sizeInMB} MB`,
      lastModified: stats.mtime.toISOString(),
      path: logFilePath
    };
  } catch (error) {
    writeLog('ERROR', 'Failed to get log info', { error: error.message });
    return { exists: false, error: error.message };
  }
});

// IPC handler for opening external URLs (email client, web browser, etc.)
ipcMain.handle('open-external', async (event, url) => {
  try {
    writeLog('INFO', 'Opening external URL', { url });
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    writeLog('ERROR', 'Failed to open external URL', { url, error: error.message });
    return { success: false, error: error.message };
  }
});

// IPC handler for saving temporary debug report
ipcMain.handle('save-temp-debug-report', async (event, { content, filename }) => {
  try {
    const tempPath = path.join(os.tmpdir(), filename);
    fs.writeFileSync(tempPath, content, 'utf8');
    writeLog('INFO', 'Temporary debug report saved', { tempPath });
    return tempPath;
  } catch (error) {
    writeLog('ERROR', 'Failed to save temporary debug report', { error: error.message });
    return null;
  }
});



// IPC handler for getting downloads path
ipcMain.handle('get-downloads-path', async () => {
  try {
    const downloadsPath = app.getPath('downloads');
    return downloadsPath;
  } catch (error) {
    writeLog('ERROR', 'Failed to get downloads path', { error: error.message });
    return os.homedir(); // Fallback to home directory
  }
});

// Log app startup
writeLog('INFO', 'MassUGC Studio starting', { 
  version: app.getVersion(),
  platform: process.platform,
  arch: process.arch,
  isDev
});

// Create a fallback HTML file that will be shown if we can't load the main UI
function createFallbackFile() {
  try {
    const fallbackHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>MassUGC Studio - Loading Error</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background: #f5f5f7;
          color: #333;
          display: flex;
          flex-direction: column;
          height: 100vh;
          justify-content: center;
          align-items: center;
          text-align: center;
        }
        h1 {
          margin-bottom: 10px;
          color: #333;
        }
        .container {
          max-width: 600px;
          background: white;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        .status {
          margin: 20px 0;
          padding: 10px;
          background: #f0f0f0;
          border-radius: 5px;
          font-family: monospace;
          text-align: left;
          white-space: pre-wrap;
          max-height: 200px;
          overflow-y: auto;
        }
        .success {
          color: #0a0;
        }
        .error {
          color: #d00;
        }
        button {
          background: #0071e3;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 5px;
          font-size: 14px;
          cursor: pointer;
          margin: 10px;
        }
        button:hover {
          background: #0077ed;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>MassUGC Studio</h1>
        <p>There was a problem loading the application interface.</p>
        
        <div class="status">
          Backend process: <span id="backend-status">Checking...</span><br>
          App version: ${app.getVersion()}<br>
          Electron: ${process.versions.electron}<br>
          Chrome: ${process.versions.chrome}<br>
          Node: ${process.versions.node}<br>
          Platform: ${process.platform}<br>
        </div>
        
        <p>The backend process is running, but the application interface could not be loaded.</p>
        
        <div>
          <button id="restart">Restart Application</button>
          <button id="check-backend">Check Backend</button>
        </div>
      </div>
      
      <script>
        const { ipcRenderer } = require('electron');
        
        // Check backend status
        async function checkBackendStatus() {
          try {
            const statusEl = document.getElementById('backend-status');
            
            if (!ipcRenderer) {
              statusEl.textContent = "IPC not available";
              statusEl.className = "error";
              return;
            }
            
            const status = await ipcRenderer.invoke('check-backend-status');
            if (status.running) {
              statusEl.textContent = "Running (PID: " + status.pid + ")";
              statusEl.className = "success";
            } else {
              statusEl.textContent = "Not running";
              statusEl.className = "error";
            }
          } catch (error) {
            document.getElementById('backend-status').textContent = "Error: " + error.message;
            document.getElementById('backend-status').className = "error";
          }
        }
        
        // Add event listeners once DOM is loaded
        document.addEventListener('DOMContentLoaded', () => {
          checkBackendStatus();
          
          document.getElementById('restart').addEventListener('click', () => {
            ipcRenderer.invoke('restart-app');
          });
          
          document.getElementById('check-backend').addEventListener('click', () => {
            checkBackendStatus();
          });
        });
      </script>
    </body>
    </html>
    `;
    
    fs.writeFileSync(fallbackFilePath, fallbackHtml);
    console.log('Fallback file created:', fallbackFilePath);
  } catch (error) {
    console.error('Error creating fallback file:', error);
  }
}

// Function to start the backend process with optimal platform detection
function startBackendProcess() {
  try {
    // Get the correct executable name based on platform
    const executableName = process.platform === 'win32' ? 'ZyraVideoAgentBackend.exe' : 'ZyraVideoAgentBackend';
    
    // Get the correct path to the executable based on environment
    const executablePath = isDev 
      ? path.join(process.cwd(), 'ZyraData/backend', executableName)
      : path.join(process.resourcesPath, 'backend', executableName);
    
    const logMessage = (msg) => {
      console.log(msg);
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('backend-log', msg);
      }
    };
    
    const logError = (msg) => {
      console.error(msg);
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('backend-error', msg);
      }
    };
    
    logMessage(`[Backend] Platform: ${process.platform}`);
    logMessage(`[Backend] Is dev: ${isDev}`);
    logMessage(`[Backend] Executable name: ${executableName}`);
    logMessage(`[Backend] Executable path: ${executablePath}`);
    logMessage(`[Backend] File exists: ${fs.existsSync(executablePath)}`);
    logMessage(`[Backend] Auto-optimization: The executable will automatically detect platform and use:`);
    logMessage(`[Backend]   Windows → Waitress with 20 threads`);
    logMessage(`[Backend]   Linux/macOS → Gunicorn with optimal workers`);
    
    if (!fs.existsSync(executablePath)) {
      logError(`[Backend] Executable not found at: ${executablePath}`);
      return false;
    }
    
    // Get file stats for debugging
    // try {
      // const stats = fs.statSync(executablePath);
      // logMessage(`[Backend] File size: ${stats.size} bytes`);
      // logMessage(`[Backend] File permissions: ${stats.mode.toString(8)}`);
    // } catch (err) {
      // logError(`[Backend] Error getting file stats: ${err.message}`);
    // }
    
    // Make sure the file is executable (important for macOS/Linux)
    if (process.platform !== 'win32') {
      try {
        fs.chmodSync(executablePath, '755');
      } catch (err) {
        logError(`Error setting executable permissions: ${err.message}`);
      }
    }
    
    // logMessage(`[Backend] Starting process...`);
    
    // Launch the backend process with optimal settings
    // The executable automatically detects platform and uses optimal WSGI server
    backendProcess = spawn(executablePath, [], {
      stdio: 'pipe', // Capture stdout and stderr
      shell: false, // Don't use shell to avoid path with spaces issues on Windows
      cwd: path.dirname(executablePath), // Set working directory to executable directory
      env: {
        ...process.env,
        // Ensure production environment for optimal performance
        FLASK_ENV: 'production',
        VIDEO_AGENT_PORT: '2026', // Default port for video processing
        VIDEO_AGENT_THREADS: '20'
      }
    });
    
    // logMessage(`[Backend] Process spawned with PID: ${backendProcess.pid}`);
    
    // Handle stdout
    backendProcess.stdout.on('data', (data) => {
      logMessage(`[Backend stdout]: ${data}`);
    });
    
    // Handle stderr
    backendProcess.stderr.on('data', (data) => {
      logError(`[Backend stderr]: ${data}`);
    });
    
    // Handle process exit
    backendProcess.on('exit', (code, signal) => {
      logMessage(`[Backend] Process exited with code ${code} and signal ${signal}`);
      backendProcess = null;
    });
    
    // Handle process error
    backendProcess.on('error', (err) => {
      logError(`[Backend] Process error: ${err.message}`);
      // logError(`[Backend] Error code: ${err.code}`);
      // logError(`[Backend] Error errno: ${err.errno}`);
      // logError(`[Backend] Error syscall: ${err.syscall}`);
      // logError(`[Backend] Error path: ${err.path}`);
      backendProcess = null;
    });
    
    return true;
  } catch (error) {
    const errorMsg = `[Backend] Failed to start backend process: ${error.message}`;
    console.error(errorMsg);
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('backend-error', errorMsg);
    }
    return false;
  }
}

// Function to stop the backend process
function stopBackendProcess() {
  if (backendProcess) {
    console.log('Stopping backend process...');
    
    try {
      // Try graceful termination first
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', backendProcess.pid, '/f', '/t']);
      } else {
        backendProcess.kill('SIGTERM');
      }
      
      backendProcess = null;
      console.log('Backend process stopped');
    } catch (error) {
      console.error('Error stopping backend process:', error);
    }
  }
}

function createWindow() {
  // console.log('Creating window...');
  // console.log('Current working directory:', process.cwd());
  // console.log('Is Dev?', isDev);
  // console.log('__dirname:', __dirname);
  // console.log('resourcesPath:', process.resourcesPath);
  
  // Create the fallback file first
  createFallbackFile();
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, isDev ? '../../build/icon.icns' : '../../../build/icon.icns'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: !isDev, // Disable webSecurity in development mode
      allowRunningInsecureContent: isDev,
    },
    // titleBarStyle: 'hiddenInset', // More native macOS look
    // trafficLightPosition: { x: 10, y: 10 },
    vibrancy: 'under-window', // Glass effect for Big Sur+
    visualEffectState: 'active',
    backgroundColor: '#00000000', // Transparent background
  });

  // In production, let's verify the path to the frontend files
  let frontendPath = null;
  if (!isDev) {
    // Check both possible locations
    const frontendPaths = [
      path.join(process.resourcesPath, 'dist/index.html'),
      path.join(__dirname, '../../dist/index.html'),
      path.join(__dirname, '../renderer/dist/index.html'),
      path.join(process.resourcesPath, 'src/renderer/dist/index.html'),
      path.resolve(__dirname, '../../dist/index.html')
    ];
    
    // Try to find a valid path
    for (const p of frontendPaths) {
      const exists = fs.existsSync(p);
      
      if (exists) {
        frontendPath = p;
        break;
      }
    }
    
    // Directory structure checked silently
  }

  // Determine which URL to load
  let startUrl;
  if (isDev) {
    startUrl = 'http://localhost:3001';
  } else if (frontendPath) {
    startUrl = `file://${frontendPath}`;
  } else {
    // If no frontend path is found, use the fallback
    startUrl = `file://${fallbackFilePath}`;
    console.error('No frontend file found! Using fallback HTML.');
  }

  // Add error handler for page load failures
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`Failed to load: ${errorCode} - ${errorDescription}`);
    
    // If loading failed and we're not using the fallback, try the fallback
    if (startUrl !== `file://${fallbackFilePath}`) {
      mainWindow.loadURL(`file://${fallbackFilePath}`);
    }
  });

  mainWindow.loadURL(startUrl);
  
  // Show developer tools for debugging
  if (isDev || process.env.DEBUG_PROD) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // Smart file existence checking function
  function smartFileExists(filePath) {
    try {
      // 1. Try original path first
      if (fs.existsSync(filePath)) {
        return { exists: true, resolvedPath: filePath };
      }
      
      // 2. Try URL-decoded version (for legacy files with spaces)
      const decoded = decodeURIComponent(filePath);
      if (decoded !== filePath && fs.existsSync(decoded)) {
        return { exists: true, resolvedPath: decoded };
      }
      
      // 3. Try sanitized version (spaces to underscores)
      const sanitized = decoded.replace(/\s+/g, '_');
      if (sanitized !== decoded && fs.existsSync(sanitized)) {
        return { exists: true, resolvedPath: sanitized };  
      }
      
      return { exists: false, resolvedPath: null };
    } catch (error) {
      console.error('Error in smartFileExists:', error);
      return { exists: false, resolvedPath: null };
    }
  }

  // Enhanced file resolution for requests
  mainWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    const { method, url, resourceType } = details;
    
    // For file URLs, silently resolve paths for files with spaces
    if (url.startsWith('file://')) {
      const originalFilePath = url.replace('file://', '');
      smartFileExists(originalFilePath); // Just resolve, don't log
    }
    
    callback({ cancel: false });
  });
  
  // Log all web request completions
  mainWindow.webContents.session.webRequest.onCompleted((details) => {
    const { method, url, statusCode, fromCache } = details;
    // console.log(`[Completed] ${method} ${url} - Status: ${statusCode}, FromCache: ${fromCache}`);
  });
  
  // Log all web request errors with minimal information
  mainWindow.webContents.session.webRequest.onErrorOccurred((details) => {
    const { method, url, error, resourceType } = details;
    // Only log actual errors, not file resolution attempts
    if (!url.startsWith('file://')) {
      console.error(`[Error] ${method} ${url} (${resourceType}) - Error: ${error}`);
    }
  });
}

// Handle file save dialog - supports both debug reports and general file saving
ipcMain.handle('save-file-dialog', async (event, options) => {
  try {
    const { sourceFilePath, sourceUrl, suggestedName, defaultPath, title, filters, cleanupTemp } = options;
    
    // Determine title and filters based on the file type
    const dialogTitle = title || 'Save File';
    const dialogFilters = filters || [
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ];
    
    // Show save dialog
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: dialogTitle,
      defaultPath: defaultPath || path.join(app.getPath('downloads'), suggestedName || 'download'),
      buttonLabel: 'Save',
      filters: dialogFilters
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true, message: 'Save canceled' };
    }

    // Handle file copy based on what was provided
    if (sourceFilePath) {
      // Direct file system access
      if (fs.existsSync(sourceFilePath)) {
        fs.copyFileSync(sourceFilePath, filePath);
        
        // Clean up temporary file if requested (for debug reports)
        if (cleanupTemp) {
          try {
            fs.unlinkSync(sourceFilePath);
            writeLog('INFO', 'Cleaned up temporary file', { sourceFilePath });
          } catch (cleanupError) {
            writeLog('WARN', 'Failed to clean up temporary file', { sourceFilePath, error: cleanupError.message });
          }
        }
        
        writeLog('INFO', 'File saved via dialog', { filePath, sourceFilePath });
        return { success: true, filePath, message: 'File saved successfully' };
      } else {
        return { success: false, message: `Source file not found: ${sourceFilePath}` };
      }
    } else if (sourceUrl) {
      // Download from URL - legacy support, not used in new code
      console.warn('Using deprecated sourceUrl parameter');
      return { success: false, message: 'URL downloads are not supported' };
    } else {
      return { success: false, message: 'No source file path or URL provided' };
    }
  } catch (error) {
    writeLog('ERROR', 'Failed to show save dialog', { error: error.message });
    console.error('Error saving file:', error);
    return { success: false, message: error.message };
  }
});

// Handle file selection dialog
ipcMain.handle('select-file-dialog', async (event, options) => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: options.title || 'Select File',
      buttonLabel: options.buttonLabel || 'Select',
      filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
      properties: ['openFile']
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, message: 'File selection canceled' };
    }

    return { success: true, filePath: filePaths[0] };
  } catch (error) {
    console.error('Error selecting file:', error);
    return { success: false, message: error.message };
  }
});

// Handler for the file picker dialog
ipcMain.handle('show-file-picker', async (event, options = {}) => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: options.title || 'Select File',
      buttonLabel: options.buttonLabel || 'Select',
      filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
      properties: ['openFile']
    });

    if (canceled || filePaths.length === 0) {
      return { canceled: true };
    }

    return { filePaths, canceled: false };
  } catch (error) {
    console.error('Error showing file picker:', error);
    return { error: error.message, canceled: true };
  }
});

// Handler for the directory picker dialog
ipcMain.handle('show-directory-picker', async (event, options = {}) => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: options.title || 'Select Folder',
      buttonLabel: options.buttonLabel || 'Select',
      properties: ['openDirectory']
    });

    if (canceled || filePaths.length === 0) {
      return { canceled: true };
    }

    return { filePaths, canceled: false };
  } catch (error) {
    console.error('Error showing directory picker:', error);
    return { error: error.message, canceled: true };
  }
});

// Handle reading text file
ipcMain.handle('read-text-file', async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, message: 'File not found' };
    }

    const content = fs.readFileSync(filePath, 'utf8');
    return { success: true, content };
  } catch (error) {
    console.error('Error reading file:', error);
    return { success: false, message: error.message };
  }
});

// Handle File objects that can't be directly passed through the contextBridge
ipcMain.handle('handle-file-object', async (event, fileObj, destPath) => {
  try {
    // In a real implementation, this would use proper file transfer from renderer
    // Since we can't directly access the File object from the renderer,
    // we'd normally create a temp file or use a different approach
    
    // For now, we'll try a simple workaround using the path if it exists
    if (fileObj.path) {
      fs.copyFileSync(fileObj.path, destPath);
      return { success: true };
    }
    
    return { success: false, error: 'File object cannot be processed without a path' };
  } catch (error) {
    console.error('Error handling file object:', error);
    return { success: false, error: error.message };
  }
});

// Handle file deletion
ipcMain.handle('delete-file', async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, message: 'File not found' };
    }

    fs.unlinkSync(filePath);
    return { success: true };
  } catch (error) {
    console.error('Error deleting file:', error);
    return { success: false, message: error.message };
  }
});

// Handle API connectivity check
ipcMain.handle('check-api-connectivity', async (event, apiUrl) => {
  return new Promise((resolve) => {
    const url = new URL(apiUrl);
    
    const req = http.request({
      host: url.hostname,
      port: url.port,
      path: url.pathname || '/',
      method: 'GET',
      timeout: 5000 // 5 second timeout
    }, (res) => {
      resolve({ 
        success: true, 
        status: res.statusCode 
      });
    });
    
    req.on('error', (e) => {
      console.error('API connectivity error:', e.message);
      resolve({ 
        success: false, 
        error: e.message,
        code: e.code 
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      console.error('API connectivity timeout');
      resolve({ 
        success: false, 
        error: 'Request timed out',
        code: 'TIMEOUT' 
      });
    });
    
    req.end();
  });
});

// Smart file existence checking function (global scope for IPC handlers)
function smartFileExistsGlobal(filePath) {
  try {
    // 1. Try original path first
    if (fs.existsSync(filePath)) {
      return { exists: true, resolvedPath: filePath };
    }
    
    // 2. Try URL-decoded version (for legacy files with spaces)
    const decoded = decodeURIComponent(filePath);
    if (decoded !== filePath && fs.existsSync(decoded)) {
      return { exists: true, resolvedPath: decoded };
    }
    
    // 3. Try sanitized version (spaces to underscores)
    const sanitized = decoded.replace(/\s+/g, '_');
    if (sanitized !== decoded && fs.existsSync(sanitized)) {
      return { exists: true, resolvedPath: sanitized };  
    }
    
    return { exists: false, resolvedPath: null };
  } catch (error) {
    console.error('Error in smartFileExists:', error);
    return { exists: false, resolvedPath: null };
  }
}

// Check if a file exists with smart path resolution
ipcMain.handle('test-file-exists', async (event, filePath) => {
  try {
    const fileCheck = smartFileExistsGlobal(filePath);
    
    return { 
      exists: fileCheck.exists, 
      resolvedPath: fileCheck.resolvedPath,
      originalPath: filePath
    };
  } catch (error) {
    console.error('Error checking file existence:', error);
    return { exists: false, error: error.message };
  }
});

// Copy file to exports directory
ipcMain.handle('copy-file-to-exports', async (event, { sourcePath, filename }) => {
  try {
    // Get exports directory
    const appDataPath = path.join(process.cwd(), 'ZyraData');
    const exportsPath = path.join(appDataPath, 'Exports');
    
    // Ensure exports directory exists
    if (!fs.existsSync(exportsPath)) {
      fs.mkdirSync(exportsPath, { recursive: true });
    }
    
    // Create destination path
    const destinationPath = path.join(exportsPath, filename);
    
    // Copy file
    fs.copyFileSync(sourcePath, destinationPath);
    
    return { 
      success: true, 
      destinationPath,
      sourcePath,
      filename
    };
  } catch (error) {
    console.error('Error copying file to exports:', error);
    return { success: false, error: error.message };
  }
});

// Show file in folder (file explorer/finder)
ipcMain.handle('show-in-folder', async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, message: 'File not found' };
    }
    
    // Use shell to show the file in the folder
    shell.showItemInFolder(filePath);
    return { success: true };
  } catch (error) {
    console.error('Error showing file in folder:', error);
    return { success: false, message: error.message };
  }
});

// Add backend process IPC handlers
ipcMain.handle('restart-backend', async () => {
  stopBackendProcess();
  const success = startBackendProcess();
  return { success };
});

ipcMain.handle('check-backend-status', async () => {
  try {
    // Always check if backend API is responsive, regardless of process status
    try {
      // Try to make a simple HTTP request to the backend API
      const result = await new Promise((resolve) => {
        const req = http.request({
          host: 'localhost',
          port: 2026,  // Update this to match your backend port
          path: '/health',  // A simple health check endpoint
          method: 'GET',
          timeout: 2000
        }, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve({
              status: res.statusCode,
              data: data
            });
          });
        });
        
        req.on('error', (e) => {
          resolve({ error: e.message });
        });
        
        req.on('timeout', () => {
          req.destroy();
          resolve({ error: 'Request timed out' });
        });
        
        req.end();
      });
      
      // If HTTP API is responsive, backend is running (regardless of process)
      if (!result.error && result.status === 200) {
        return { 
          running: true,
          responsive: true,
          pid: backendProcess ? backendProcess.pid : 'external',
          details: result,
          message: 'Backend API is responsive'
        };
      } else {
        return { 
          running: false,
          responsive: false,
          details: result,
          message: 'Backend API not responsive'
        };
      }
    } catch (error) {
      console.error('Error checking backend API responsiveness:', error);
      return { 
        running: false,
        responsive: false,
        error: error.message,
        message: 'Error checking backend API'
      };
    }
  } catch (error) {
    console.error('Error checking backend status:', error);
    return { 
      running: false,
      responsive: false,
      error: error.message
    };
  }
});

app.whenReady().then(() => {
  // Start the backend process
  startBackendProcess();
  
  // Register custom protocols before creating window
  protocol.registerFileProtocol('app-file', (request, callback) => {
    const appPath = path.join(process.cwd(), 'ZyraData');
    let filePath = request.url.replace('app-file://', '');

    // Handle different file locations
    let fullPath = null;

    // Check if it's in the main ZyraData directory
    const mainPath = path.normalize(`${appPath}/${filePath}`);
    if (fs.existsSync(mainPath)) {
      fullPath = mainPath;
    } else {
      // Check if it's in the uploads directory (for avatars, scripts, etc.)
      const uploadsPath = path.normalize(`${appPath}/uploads/${filePath}`);
      if (fs.existsSync(uploadsPath)) {
        fullPath = uploadsPath;
      } else {
        // Try the original app-file path as fallback
        const fallbackPath = path.normalize(`${appPath}/${filePath}`);
        if (fs.existsSync(fallbackPath)) {
          fullPath = fallbackPath;
        }
      }
    }

    if (fullPath) {
      callback({ path: fullPath });
    } else {
      console.error('File not found via app-file protocol:', filePath);
      callback({ error: -6 }); // FILE_NOT_FOUND error
    }
  });

  // Also register a more general file protocol for serving any local files
  protocol.registerFileProtocol('local-file', (request, callback) => {
    let filePath = request.url.replace('local-file://', '');

    // URL decode the path
    filePath = decodeURIComponent(filePath);

    // Check if file exists
    if (fs.existsSync(filePath)) {
      callback({ path: filePath });
    } else {
      console.error('File not found via local-file protocol:', filePath);
      callback({ error: -6 }); // FILE_NOT_FOUND error
    }
  });
  
  // Set permissions for accessing localhost API
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin': ['*'],
        'Access-Control-Allow-Headers': ['*'],
        'Access-Control-Allow-Methods': ['*']
      }
    });
  });
  
  // Create an API proxy to bypass CORS issues with localhost
  protocol.registerHttpProtocol('api', (request, callback) => {
    const url = request.url.replace('api://', 'http://localhost:2026/');
    
    // Forward the request to the actual API server
    callback({
      url,
      method: request.method,
      headers: request.headers
    });
  });
  
  createWindow();
});

app.on('window-all-closed', () => {
  // Stop the backend process when all windows are closed
  stopBackendProcess();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Make sure we stop the backend process before quitting
  stopBackendProcess();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
}); 