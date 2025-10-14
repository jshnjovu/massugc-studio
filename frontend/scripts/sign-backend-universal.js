#!/usr/bin/env node

/**
 * Universal Backend Signing Script for MassUGC Studio
 * Supports both macOS (codesign) and Windows (signtool)
 */

const PlatformUtils = require('./platform-utils');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class UniversalSigner {
  constructor() {
    this.platform = new PlatformUtils();
    this.backendDir = 'ZyraData/backend';
    this.signingInfo = this.platform.getSigningInfo();
  }

  /**
   * Main signing function - detects platform and runs appropriate signing
   */
  async signBackend() {
    console.log('🔐 Universal Backend Signing Started');
    this.platform.logPlatformInfo();
    
    if (!fs.existsSync(this.backendDir)) {
      throw new Error(`❌ Backend directory not found: ${this.backendDir}`);
    }

    if (this.platform.isMac) {
      await this.signMacOS();
    } else if (this.platform.isWindows) {
      await this.signWindows();
    } else {
      console.log('🐧 Linux detected - skipping code signing (not required)');
      return;
    }

    console.log('🎉 Backend signing complete!');
  }

  /**
   * macOS signing using codesign
   */
  async signMacOS() {
    console.log('🍎 Starting macOS code signing...');
    
    const identity = this.signingInfo.identity;
    
    // Count files to sign
    const soCount = this.countFiles('*.so');
    const dylibCount = this.countFiles('*.dylib');
    
    console.log(`📋 Found ${soCount} .so files and ${dylibCount} .dylib files to sign`);

    // Sign .so files
    if (soCount > 0) {
      console.log('🔧 Signing .so files...');
      this.signFiles('*.so', 'codesign', identity);
      console.log('✅ Signed .so files');
    }

    // Sign .dylib files  
    if (dylibCount > 0) {
      console.log('🔧 Signing .dylib files...');
      this.signFiles('*.dylib', 'codesign', identity);
      console.log('✅ Signed .dylib files');
    }

    // Sign main backend executable
    await this.signMacOSExecutable(identity);
    
    // Sign Python.framework if it exists
    await this.signPythonFramework(identity);
    
    // Sign specific executables
    await this.signSpecificBinaries(identity);
  }

  /**
   * Windows signing using signtool
   */
  async signWindows() {
    console.log('🪟 Starting Windows code signing...');
    
    if (!this.signingInfo.certificateThumbprint) {
      console.log('⚠️  Windows certificate not configured. Set WINDOWS_CERT_THUMBPRINT environment variable.');
      console.log('ℹ️  Skipping Windows signing...');
      return;
    }

    const certThumbprint = this.signingInfo.certificateThumbprint;
    const timestampServer = this.signingInfo.timestampServer;

    // Count files to sign
    const dllCount = this.countFiles('*.dll');
    const exeCount = this.countFiles('*.exe');
    
    console.log(`📋 Found ${dllCount} .dll files and ${exeCount} .exe files to sign`);

    // Sign .dll files
    if (dllCount > 0) {
      console.log('🔧 Signing .dll files...');
      this.signFilesWindows('*.dll', certThumbprint, timestampServer);
      console.log('✅ Signed .dll files');
    }

    // Sign .exe files
    if (exeCount > 0) {
      console.log('🔧 Signing .exe files...');
    } else {
      // Look for any executables
      const executableCount = this.countFiles('*');
      const executables = fs.readdirSync(this.backendDir).filter(file => {
        const fullPath = path.join(this.backendDir, file);
        return fs.statSync(fullPath).isFile();
      });
      
      executables.forEach(executable => {
        const fullPath = path.join(this.backendDir, executable);
        console.log(`🔧 Signing executable: ${executable}`);
        this.signWindowsFile(fullPath, certThumbprint, timestampServer);
      });
    }
  }

  /**
   * Count files matching pattern
   */
  countFiles(pattern) {
    try {
      const command = this.platform.isWindows 
        ? `powershell -Command "Get-ChildItem '${this.backendDir}\\${pattern}' -Recurse | Measure-Object | Select-Object -ExpandProperty Count"`
        : `find "${this.backendDir}" -name "${pattern}" | wc -l`;
      
      const result = execSync(command, { encoding: 'utf8' }).trim();
      return parseInt(result) || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Sign files with macOS codesign
   */
  signFiles(pattern, command, identity) {
    try {
      const cmd = `find "${this.backendDir}" -name "${pattern}" -exec codesign --force --timestamp --options runtime --sign "${identity}" {} \\;`;
      execSync(cmd, { stdio: 'inherit' });
    } catch (error) {
      console.warn(`⚠️  Failed to sign ${pattern} files:`, error.message);
    }
  }

  /**
   * Sign files with Windows signtool
   */
  signFilesWindows(pattern, certThumbprint, timestampServer) {
    try {
      const cmd = this.platform.isWindows 
        ? `powershell -Command "Get-ChildItem '${this.backendDir}\\${pattern}' -Recurse | ForEach-Object { signtool sign /sha1 ${certThumbprint} /tr ${timestampServer} /td sha256 $_.FullName }"`
        : `find "${this.backendDir}" -name "${pattern}" -exec signtool sign /sha1 ${certThumbprint} /tr ${timestampServer} /td sha256 {} \\;`;
      
      execSync(cmd, { stdio: 'inherit' });
    } catch (error) {
      console.warn(`⚠️  Failed to sign ${pattern} files:`, error.message);
    }
  }

  /**
   * Sign single Windows file
   */
  signWindowsFile(filePath, certThumbprint, timestampServer) {
    try {
      const cmd = `signtool sign /sha1 ${certThumbprint} /tr ${timestampServer} /td sha256 "${filePath}"`;
      execSync(cmd, { stdio: 'inherit' });
      console.log(`✅ Signed: ${path.basename(filePath)}`);
    } catch (error) {
      console.warn(`⚠️  Failed to sign ${filePath}:`, error.message);
    }
  }

  /**
   * Sign macOS executable
   */
  async signMacOSExecutable(identity) {
    console.log('🔧 Signing main backend executable...');
    
    const executablePath = path.join(this.backendDir, 'ZyraVideoAgentBackend');
    const executablePathExe = path.join(this.backendDir, 'ZyraVideoAgentBackend.exe');
    
    if (fs.existsSync(executablePath)) {
      try {
        execSync(`codesign --force --timestamp --options runtime --sign "${identity}" "${executablePath}"`, { stdio: 'inherit' });
        console.log('✅ Signed macOS main backend executable');
      } catch (error) {
        console.warn(`⚠️  Could not sign main executable:`, error.message);
      }
    } else if (fs.existsSync(executablePathExe)) {
      console.log('ℹ️  Found Windows executable, skipping macOS signing');
    } else {
      console.log('⚠️  Main backend executable not found');
    }
  }

  /**
   * Sign Python.framework on macOS
   */
  async signPythonFramework(identity) {
    console.log('🔧 Checking for Python.framework...');
    const pythonFramework = path.join(this.backendDir, '_internal/Python.framework');
    
    if (fs.existsSync(pythonFramework)) {
      console.log('🔧 Signing Python.framework...');
      
      const pythonBinary = path.join(pythonFramework, 'Python');
      if (fs.existsSync(pythonBinary)) {
        try {
          execSync(`codesign --force --timestamp --options runtime --sign "${identity}" "${pythonBinary}"`, { stdio: 'pipe' });
        } catch {
          console.log('⚠️  Python framework binary couldn\'t be signed (this is often okay)');
        }
      }
      
      try {
        execSync(`codesign --force --timestamp --options runtime --sign "${identity}" "${pythonFramework}"`, { stdio: 'pipe' });
        console.log('✅ Python.framework signing attempted');
      } catch {
        console.log('⚠️  Python framework couldn\'t be signed (this is often okay)');
      }
    }
  }

  /**
   * Sign specific executables that are commonly problematic
   */
  async signSpecificBinaries(identity) {
    console.log('🔧 Signing specific executables that require hardened runtime...');

    // Sign ffmpeg binary if it exists
    const ffmpegPath = path.join(this.backendDir, '_internal/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1');
    if (fs.existsSync(ffmpegPath)) {
      console.log('🔧 Signing ffmpeg binary...');
      try {
        execSync(`codesign --force --timestamp --options runtime --sign "${identity}" "${ffmpegPath}"`, { stdio: 'pipe' });
      } catch {
        console.log('⚠️  ffmpeg binary couldn\'t be signed');
      }
    }

    // Sign torch binaries if they exist
    const torchBinaries = [
      path.join(this.backendDir, '_internal/torch/bin/protoc-3.13.0.0'),
      path.join(this.backendDir, '_internal/torch/bin/torch_shm_manager'),
      path.join(this.backendDir, '_internal/torch/bin/protoc')
    ];

    torchBinaries.forEach(binaryPath => {
      if (fs.existsSync(binaryPath)) {
        console.log(`🔧 Signing torch binary: ${path.basename(binaryPath)}`);
        try {
          execSync(`codesign --force --timestamp --options runtime --sign "${identity}" "${binaryPath}"`, { stdio: 'pipe' });
        } catch {
          console.log(`⚠️  ${path.basename(binaryPath)} couldn't be signed`);
        }
      }
    });
  }
}

// Export for use as module
module.exports = UniversalSigner;

// Main execution if called directly
if (require.main === module) {
  const signer = new UniversalSigner();
  
  signer.signBackend()
    .then(() => {
      console.log('🎉 Universal backend signing completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Universal backend signing failed:', error.message);
      process.exit(1);
    });
}
