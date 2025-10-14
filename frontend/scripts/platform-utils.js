#!/usr/bin/env node

/**
 * Cross-Platform Utilities for MassUGC Studio
 * Provides unified platform detection and command execution
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class PlatformUtils {
  constructor() {
    this.platform = os.platform();
    this.isWindows = this.platform === 'win32';
    this.isMac = this.platform === 'darwin';
    this.isLinux = this.platform === 'linux';
  }

  /**
   * Get platform-specific executable file extension
   */
  getExecutableExt() {
    return this.isWindows ? '.exe' : '';
  }

  /**
   * Get directory separator for platform
   */
  getDirSeparator() {
    return this.isWindows ? '\\' : '/';
  }

  /**
   * Convert path to platform-specific format
   */
  normalizePath(inputPath) {
    if (this.isWindows) {
      return inputPath.replace(/\//g, '\\');
    }
    return inputPath.replace(/\\/g, '/');
  }

  /**
   * Execute command with platform-specific shell
   */
  executeCommand(command, options = {}) {
    const shellOptions = {
      stdio: 'inherit',
      ...options
    };

    if (this.isWindows) {
      // Use PowerShell for Windows commands
      const psCommand = `powershell -Command "${command}"`;
      return execSync(psCommand, shellOptions);
    } else {
      // Use bash for Unix-like systems
      return execSync(command, shellOptions);
    }
  }

  /**
   * Check if a command/tool exists on the system
   */
  commandExists(command) {
    try {
      if (this.isWindows) {
        execSync(`where ${command}`, { stdio: 'pipe' });
      } else {
        execSync(`which ${command}`, { stdio: 'pipe' });
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get platform-specific signing identity information
   */
  getSigningInfo() {
    if (this.isMac) {
      return {
        identity: "Jonathan Brower (6UY72DSS38)",
        keychainProfile: "MassUGC-Studio",
        requiresNotarization: true
      };
    } else if (this.isWindows) {
      return {
        // Windows signing certificate info
        // These would need to be configured in environment variables
        certificateThumbprint: process.env.WINDOWS_CERT_THUMBPRINT,
        timestampServer: process.env.WINDOWS_TIMESTAMP_SERVER || "http://timestamp.digicert.com",
        requiresSigntool: true
      };
    } else {
      return {
        // Linux - typically not code signed
        requiresSigning: false
      };
    }
  }

  /**
   * Get appropriate icon format for platform
   */
  getIconFormat() {
    if (this.isMac) {
      return {
        format: 'icns',
        size: [16, 32, 64, 128, 256, 512, 1024],
        command: 'sips'
      };
    } else if (this.isWindows) {
      return {
        format: 'ico',
        size: [16, 24, 32, 48, 64, 96, 128, 256],
        command: 'magick' // ImageMagick
      };
    } else {
      return {
        format: 'png',
        size: [16, 32, 48, 64, 128, 256],
        command: null
      };
    }
  }

  /**
   * Log platform-specific information
   */
  logPlatformInfo() {
    console.log(`🖥️  Platform: ${os.type()} ${os.release()}`);
    console.log(`📁 Architecture: ${os.arch()}`);
    console.log(`🔧 Detected OS: ${this.platform}`);
    
    if (this.isMac) {
      console.log(`🍎 macOS detected - App Store signing/notarization required`);
    } else if (this.isWindows) {
      console.log(`🪟 Windows detected - Authenticode signing available`);
    } else {
      console.log(`🐧 Linux detected - No code signing required`);
    }
  }
}

module.exports = PlatformUtils;
