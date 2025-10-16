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
   * Supports branch-specific behavior for unifiedbuild (unsigned) vs main (signed)
   */
  getSigningInfo() {
    // Check if we're in unifiedbuild branch or unsigned mode
    const isUnifiedBuild = process.env.GITHUB_REF?.includes('unifiedbuild') || 
                          process.env.SKIP_SIGNING === 'true' ||
                          process.env.NODE_ENV === 'development';

    if (this.isMac) {
      return {
        identity: isUnifiedBuild ? null : (process.env.APPLE_SIGNING_IDENTITY || "Jonathan Brower (6UY72DSS38)"),
        keychainProfile: isUnifiedBuild ? null : (process.env.APPLE_KEYCHAIN_PROFILE || "MassUGC-Studio"),
        requiresNotarization: !isUnifiedBuild,
        skipSigning: isUnifiedBuild
      };
    } else if (this.isWindows) {
      return {
        // Windows signing certificate info
        // These would need to be configured in environment variables
        certificateThumbprint: isUnifiedBuild ? null : process.env.WINDOWS_CERT_THUMBPRINT,
        timestampServer: process.env.WINDOWS_TIMESTAMP_SERVER || "http://timestamp.digicert.com",
        requiresSigntool: !isUnifiedBuild,
        skipSigning: isUnifiedBuild
      };
    } else {
      return {
        // Linux - typically not code signed
        requiresSigning: false,
        skipSigning: true
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
    
    // Check if we're in unifiedbuild branch or unsigned mode
    const isUnifiedBuild = process.env.GITHUB_REF?.includes('unifiedbuild') || 
                          process.env.SKIP_SIGNING === 'true' ||
                          process.env.NODE_ENV === 'development';
    
    if (this.isMac) {
      if (isUnifiedBuild) {
        console.log(`🍎 macOS detected - UNSIGNED BUILD MODE (no signing/notarization)`);
      } else {
        console.log(`🍎 macOS detected - App Store signing/notarization required`);
      }
    } else if (this.isWindows) {
      if (isUnifiedBuild) {
        console.log(`🪟 Windows detected - UNSIGNED BUILD MODE (no Authenticode signing)`);
      } else {
        console.log(`🪟 Windows detected - Authenticode signing available`);
      }
    } else {
      console.log(`🐧 Linux detected - No code signing required`);
    }
  }
}

module.exports = PlatformUtils;
