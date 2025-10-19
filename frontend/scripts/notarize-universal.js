#!/usr/bin/env node

/**
 * Universal Notarization/Signing Script for MassUGC Studio
 * Handles macOS notarization and Windows Authenticode signing
 */

const { notarize } = require('@electron/notarize');
const PlatformUtils = require('./platform-utils');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

class UniversalNotarizer {
  constructor(context) {
    this.context = context;
    this.platform = new PlatformUtils();
    this.notarizeInfo = this.platform.getSigningInfo();
  }

  /**
   * Main notarization/signing function
   */
  async notarizeApp() {
    this.platform.logPlatformInfo();

    if (this.platform.isMac) {
      return await this.notarizeMacOS();
    } else if (this.platform.isWindows) {
      return await this.signWindowsApp();
    } else {
      console.log('🐧 Linux detected - skipping notarization/signing');
      return;
    }
  }

  /**
   * macOS notarization process
   */
  async notarizeMacOS() {
    const { electronPlatformName, appOutDir } = this.context;
    
    if (electronPlatformName !== 'darwin') {
      console.log(`Skipping macOS notarization - not a macOS build (platform: ${electronPlatformName})`);
      return;
    }

    const appPath = `${appOutDir}/${this.context.packager.appInfo.productFilename}.app`;
    const appBundleId = this.context.packager.appInfo.bundleIdentifier;

    console.log(`[DEBUG] Starting comprehensive macOS notarization for ${appPath}`);
    console.log(`📱 Bundle ID: ${appBundleId}`);

    try {
      // Step 1: Verify and fix executable signatures
      console.log('\n🔧 Step 1: Verifying and fixing executable signatures...');
      await this.verifyAndFixSignatures(appPath);

      // Step 2: Prepare notarization options
      const notarizeOptions = this.prepareNotarizeOptions(appBundleId, appPath);
      
      // Step 3: Submit for notarization
      console.log('\n📤 Step 2: Submitting for notarization...');
      console.log('⏳ This may take 10-30 minutes for large apps...');
      
      await notarize(notarizeOptions);
      console.log('✅ Notarization completed successfully');

      // Step 4: Staple the notarization ticket
      console.log('\n📎 Step 3: Stapling notarization ticket...');
      execSync(`xcrun stapler staple "${appPath}"`, { stdio: 'inherit' });
      console.log('✅ Stapling completed successfully');

      console.log('\n🎉 macOS notarization complete! Your app is ready for distribution.');

    } catch (error) {
      console.error('\n❌ macOS notarization failed:', error.message);
      this.handleNotarizationError(error);
      throw error;
    }
  }

  /**
   * Windows Authenticode signing process
   */
  async signWindowsApp() {
    const { electronPlatformName, appOutDir } = this.context;
    
    if (electronPlatformName !== 'win32') {
      console.log(`Skipping Windows signing - not a Windows build (platform: ${electronPlatformName})`);
      return;
    }

    const exePath = path.join(appOutDir, `${this.context.packager.appInfo.productFilename}.exe`);
    const bundleId = this.context.packager.appInfo.bundleIdentifier;

    if (!fs.existsSync(exePath)) {
      throw new Error(`❌ Windows executable not found: ${exePath}`);
    }

    console.log(`[DEBUG] Starting Windows Authenticode signing for ${exePath}`);
    console.log(`📱 Bundle ID: ${bundleId}`);

    try {
      // Check if cert is configured
      if (!this.notarizeInfo.certificateThumbprint) {
        console.log('⚠️  Windows certificate not configured. Set WINDOWS_CERT_THUMBPRINT environment variable.');
        console.log('ℹ️  Skipping Windows signing...');
        return;
      }

      const certThumbprint = this.notarizeInfo.certificateThumbprint;
      const timestampServer = this.notarizeInfo.timestampServer;

      // Step 1: Sign the main executable
      console.log('\n🔧 Step 1: Signing main executable...');
      this.signWindowsExecutable(exePath, certThumbprint, timestampServer);

      // Step 2: Sign helper executables if they exist
      await this.signWindowsHelpers(appOutDir, certThumbprint, timestampServer);

      // Step 3: Verify signature
      console.log('\n[DEBUG] Step 3: Verifying signature...');
      this.verifyWindowsSignature(exePath);

      console.log('\n🎉 Windows Authenticode signing complete!');

    } catch (error) {
      console.error('\n❌ Windows signing failed:', error.message);
      throw error;
    }
  }

  /**
   * Prepare notarization options with fallback authentication methods
   */
  prepareNotarizeOptions(appBundleId, appPath) {
    const appleId = process.env.APPLE_ID;
    const appleIdPassword = process.env.APPLE_APP_PASSWORD;
    const teamId = process.env.APPLE_TEAM_ID;
    
    // Prefer API key authentication (modern approach)
    const apiKey = process.env.APPLE_API_KEY;
    const apiKeyId = process.env.APPLE_API_KEY_ID;
    const apiIssuer = process.env.APPLE_API_ISSUER;

    let notarizeOptions;

    if (apiKey && apiKeyId && apiIssuer) {
      console.log('🔑 Using API key authentication for notarization');
      notarizeOptions = {
        appBundleId,
        appPath,
        appleApiKey: apiKey,
        appleApiKeyId: apiKeyId,
        appleApiIssuer: apiIssuer,
      };
    } else if (appleId && appleIdPassword) {
      console.log('🔑 Using app-specific password authentication');
      notarizeOptions = {
        appBundleId,
        appPath,
        appleId,
        appleIdPassword,
      };
      
      if (teamId) {
        notarizeOptions.teamId = teamId;
      }
    } else {
      console.log('🔑 Using keychain profile for notarization');
      notarizeOptions = {
        appBundleId,
        appPath,
        keychainProfile: 'MassUGC-Studio',
      };
    }

    return notarizeOptions;
  }

  /**
   * Verify and fix signatures on macOS
   */
  async verifyAndFixSignatures(appPath) {
    const identity = this.notarizeInfo.identity;
    const fullEntitlementsPath = path.join(__dirname, '../build/entitlements.mac.plist');
    const minimalEntitlementsPath = path.join(__dirname, '../build/entitlements.mac.minimal.plist');
    
    console.log(`📍 Checking signatures in: ${appPath}`);
    
    // Ensure FFmpeg binary has execute permissions before signing
    const ffmpegPath = path.join(appPath, 'Contents/Resources/backend/_internal/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1');
    if (fs.existsSync(ffmpegPath)) {
      try {
        fs.chmodSync(ffmpegPath, 0o755);
        console.log('✅ Set execute permissions on FFmpeg binary');
      } catch (error) {
        console.warn(`⚠️  Could not set FFmpeg permissions: ${error.message}`);
      }
    }
    
    // Define executables with their appropriate entitlements
    const executablesConfig = [
      { path: 'Contents/MacOS/MassUGC Studio', entitlements: fullEntitlementsPath, type: 'main' },
      { path: 'Contents/Resources/backend/ZyraVideoAgentBackend', entitlements: fullEntitlementsPath, type: 'backend' },
      { path: 'Contents/Resources/backend/_internal/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1', entitlements: fullEntitlementsPath, type: 'ffmpeg' },
      { path: 'Contents/Frameworks/MassUGC Studio Helper.app/Contents/MacOS/MassUGC Studio Helper', entitlements: minimalEntitlementsPath, type: 'helper' },
      { path: 'Contents/Frameworks/MassUGC Studio Helper (GPU).app/Contents/MacOS/MassUGC Studio Helper (GPU)', entitlements: minimalEntitlementsPath, type: 'helper' },
      { path: 'Contents/Frameworks/MassUGC Studio Helper (Plugin).app/Contents/MacOS/MassUGC Studio Helper (Plugin)', entitlements: minimalEntitlementsPath, type: 'helper' },
      { path: 'Contents/Frameworks/MassUGC Studio Helper (Renderer).app/Contents/MacOS/MassUGC Studio Helper (Renderer)', entitlements: minimalEntitlementsPath, type: 'helper' }
    ];

    let resignedCount = 0;
    
    for (const config of executablesConfig) {
      const fullPath = path.join(appPath, config.path);
      
      if (fs.existsSync(fullPath)) {
        try {
          // Check if already properly signed with hardened runtime
          execSync(`codesign --verify --strict --deep "${fullPath}"`, { stdio: 'pipe' });
          
          const checkResult = execSync(`codesign -dv --entitlements - "${fullPath}" 2>&1 || true`, { encoding: 'utf8' });
          
          if (!checkResult.includes('runtime') || !checkResult.includes('hardened')) {
            console.log(`🔧 Re-signing (${config.type}): ${config.path}`);
            execSync(`codesign --force --timestamp --options runtime --entitlements "${config.entitlements}" --sign "${identity}" "${fullPath}"`, { stdio: 'inherit' });
            resignedCount++;
          } else {
            console.log(`✅ Already properly signed (${config.type}): ${config.path}`);
          }
        } catch (error) {
          console.log(`🔧 Signing (${config.type}): ${config.path}`);
          try {
            execSync(`codesign --force --timestamp --options runtime --entitlements "${config.entitlements}" --sign "${identity}" "${fullPath}"`, { stdio: 'inherit' });
            resignedCount++;
          } catch (signError) {
            console.warn(`⚠️  Could not sign ${config.path}: ${signError.message}`);
          }
        }
      } else {
        console.log(`ℹ️  Not found (${config.type}): ${config.path}`);
      }
    }
    
    if (resignedCount > 0) {
      console.log(`✅ Re-signed ${resignedCount} executables with hardened runtime`);
      
      // Re-sign frameworks and main app after modifications
      try {
        execSync(`codesign --force --timestamp --options runtime --entitlements "${fullEntitlementsPath}" --sign "${identity}" "${appPath}"`, { stdio: 'inherit' });
        console.log('✅ Main app bundle re-signed successfully');
      } catch (error) {
        console.error(`❌ Failed to re-sign main app bundle: ${error.message}`);
        throw error;
      }
      
      try {
        execSync(`codesign --verify --deep --strict "${appPath}"`, { stdio: 'inherit' });
        console.log('✅ App bundle verification passed');
      } catch (error) {
        console.error('❌ App bundle verification failed:', error.message);
        throw error;
      }
    } else {
      console.log(`✅ All executables already properly signed`);
    }
  }

  /**
   * Sign Windows executable
   */
  signWindowsExecutable(exePath, certThumbprint, timestampServer) {
    try {
      const cmd = `signtool sign /sha1 ${certThumbprint} /tr ${timestampServer} /td sha256 "${exePath}"`;
      execSync(cmd, { stdio: 'inherit' });
      console.log(`✅ Signed main executable: ${path.basename(exePath)}`);
    } catch (error) {
      throw new Error(`Failed to sign Windows executable: ${error.message}`);
    }
  }

  /**
   * Sign Windows helper executables
   */
  async signWindowsHelpers(appOutDir, certThumbprint, timestampServer) {
    console.log('\n🔷 Step 2: Signing helper executables...');
    
    // Find all .exe files in the application directory
    const helperPaths = this.findWindowsExecutables(appOutDir);
    
    helperPaths.forEach(helperPath => {
      try {
        const cmd = `signtool sign /sha1 ${certThumbprint} /tr ${timestampServer} /td sha256 "${helperPath}"`;
        execSync(cmd, { stdio: 'pipe' });
        console.log(`✅ Signed helper: ${path.basename(helperPath)}`);
      } catch (error) {
        console.warn(`⚠️  Could not sign helper ${path.basename(helperPath)}: ${error.message}`);
      }
    });
  }

  /**
   * Find all Windows executables to sign
   */
  findWindowsExecutables(appOutDir) {
    const executables = [];
    
    function findExesRecursive(dir) {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
          findExesRecursive(itemPath);
        } else if (item.endsWith('.exe') && !itemPath.executables) {
          executables.push(itemPath);
        }
      }
    }
    
    findExesRecursive(appOutDir);
    return executables;
  }

  /**
   * Verify Windows signature
   */
  verifyWindowsSignature(exePath) {
    try {
      const cmd = `signtool verify /pa "${exePath}"`;
      execSync(cmd, { stdio: 'inherit' });
      console.log('✅ Windows signature verification passed');
    } catch (error) {
      console.warn(`⚠️  Windows signature verification failed: ${error.message}`);
    }
  }

  /**
   * Handle notarization errors with helpful messages
   */
  handleNotarizationError(error) {
    if (error.message.includes('Invalid credentials')) {
      console.error('\n💡 Tip: Make sure your Apple ID credentials are correct and you have enabled two-factor authentication.');
      console.error('For app-specific passwords, generate one at: https://appleid.apple.com/account/manage');
    } else if (error.message.includes('Bundle ID')) {
      console.error('\n💡 Tip: Ensure your bundle ID matches exactly with your Apple Developer account.');
    } else if (error.message.includes('hardened runtime')) {
      console.error('\n💡 Tip: Some executables may still need hardened runtime. Check the verification step above.');
    }
  }
}

// Main execution function compatible with electron-builder
module.exports = async function(context) {
  const notarizer = new UniversalNotarizer(context);
  return await notarizer.notarizeApp();
};

// Also export as default for ES6 imports
module.exports.default = module.exports;
