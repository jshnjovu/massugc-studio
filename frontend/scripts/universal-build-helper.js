#!/usr/bin/env node

/**
 * Universal Build Helper for MassUGC Studio
 * Unified script runner that detects OS and executes appropriate commands
 */

const PlatformUtils = require('./platform-utils');
const { execSync, spawn } = require('child_process');
const path = require('path');

class UniversalBuildHelper {
  constructor() {
    this.platform = new PlatformUtils();
    this.scriptsDir = __dirname;
  }

  /**
   * Run backend signing - automatically detects platform
   */
  runBackendSigning() {
    console.log('🔐 Running Universal Backend Signing...');
    this.platform.logPlatformInfo();
    
    if (this.platform.isLinux) {
      console.log('🐧 Linux detected - skipping backend signing (not required)');
      return true;
    }
    
    try {
      const signScript = path.join(this.scriptsDir, 'sign-backend-universal.js');
      execSync(`node "${signScript}"`, { stdio: 'inherit' });
      return true;
    } catch (error) {
      console.error('❌ Backend signing failed:', error.message);
      return false;
    }
  }

  /**
   * Run platform-specific icon creation
   */
  runIconCreation() {
    console.log('🎨 Running Universal Icon Creation...');
    this.platform.logPlatformInfo();
    
    try {
      if (this.platform.isWindows) {
        // Check if Python is available on Windows
        try {
          execSync('python --version', { stdio: 'pipe' });
        } catch {
          // Try python3
          execSync('python3 --version', { stdio: 'pipe' });
        }
      }
      
      const iconScript = path.join(this.scriptsDir, 'create-icon-universal.py');
      
      if (this.platform.isWindows) {
        // Use python command on Windows
        execSync(`python "${iconScript}"`, { stdio: 'inherit' });
      } else {
        // Use python3 on macOS/Linux
        execSync(`python3 "${iconScript}"`, { stdio: 'inherit' });
      }
      return true;
    } catch (error) {
      console.error('❌ Icon creation failed:', error.message);
      console.log('💡 Make sure Python and PIL are installed');
      return false;
    }
  }

  /**
   * Check platform-specific build requirements
   */
  checkBuildRequirements() {
    console.log('[DEBUG] Checking build requirements...');
    const requirements = {
      pass: true,
      issues: []
    };

    if (this.platform.isMac) {
      // Check macOS requirements
      if (!this.platform.commandExists('codesign')) {
        requirements.issues.push('codesign not found - required for macOS signing');
        requirements.pass = false;
      }
      
      if (!this.platform.commandExists('xcrun')) {
        requirements.issues.push('xcrun not found - required for macOS notarization');
        requirements.pass = false;
      }
      
    } else if (this.platform.isWindows) {
      // Check Windows requirements
      if (!this.platform.commandExists('signtool')) {
        requirements.issues.push('signtool not found - requires Windows SDK for signing');
        requirements.pass = false;
      }
      
      if (!this.platform.commandExists('python')) {
        try {
          execSync('python3 --version', { stdio: 'pipe' });
        } catch {
          requirements.issues.push('Python not found - required for icon creation');
          requirements.pass = false;
        }
      }
      
    } else {
      // Linux requirements
      try {
        execSync('python3 --version', { stdio: 'pipe' });
      } catch {
        requirements.issues.push('python3 not found - required for icon creation');
        requirements.pass = false;
      }
    }

    // Universal requirements
    if (!this.platform.commandExists('node')) {
      requirements.issues.push('node not found - required for build process');
      requirements.pass = false;
    }

    if (requirements.pass) {
      console.log('✅ All build requirements met');
    } else {
      console.log('❌ Build requirements not met:');
      requirements.issues.forEach(issue => console.log(`   - ${issue}`));
    }

    return requirements;
  }

  /**
   * Generate platform-specific package.json scripts
   */
  generateScripts() {
    console.log('📝 Generating platform-specific scripts...');
    
    const scripts = {
      universal: {
        "build:sign": "node scripts/sign-backend-universal.js",
        "build:icons": "node scripts/universal-build-helper.js icons",
        "build:check": "node scripts/universal-build-helper.js check",
        "build:all": "node scripts/universal-build-helper.js build"
      }
    };

    if (this.platform.isMac) {
      scripts.mac = {
        "build:mac": "electron-builder --mac",
        "build:mac-notarize": "electron-builder --mac --config.notarize.executable='scripts/notarize-universal.js'",
        "build:mac-universal": "electron-builder --mac --x64 --arm64"
      };
    }

    if (this.platform.isWindows) {
      scripts.windows = {
        "build:win": "electron-builder --win",
        "build:win32": "electron-builder --win --ia32",
        "build:win64": "electron-builder --win --x64",
        "build:win-universal": "electron-builder --win --ia32 --x64"
      };
    }

    // Write scripts to a config file
    const configPath = path.join(this.scriptsDir, '../scripts-config.json');
    require('fs').writeFileSync(configPath, JSON.stringify(scripts, null, 2));
    
    console.log('✅ Platform-specific scripts generated');
    console.log(`📁 Config saved to: ${configPath}`);
    
    return scripts;
  }

  /**
   * Run universal build process
   */
  runUniversalBuild() {
    console.log('🚀 Starting Universal Build Process...');
    this.platform.logPlatformInfo();
    
    // Step 1: Check requirements
    const requirements = this.checkBuildRequirements();
    if (!requirements.pass) {
      console.log('❌ Cannot proceed without meeting build requirements');
      return false;
    }

    // Step 2: Generate icons
    console.log('\n📋 Step 1: Creating platform icons...');
    const iconSuccess = this.runIconCreation();
    
    // Step 3: Run appropriate build command
    console.log('\n📋 Step 2: Running platform-specific build...');
    let buildSuccess = false;
    
    try {
      if (this.platform.isMac) {
        console.log('🍎 Running macOS build...');
        execSync('electron-builder --mac', { stdio: 'inherit' });
        buildSuccess = true;
      } else if (this.platform.isWindows) {
        console.log('🪟 Running Windows build...');
        execSync('electron-builder --win', { stdio: 'inherit' });
        buildSuccess = true;
      } else {
        console.log('🐧 Linux builds not configured yet');
        buildSuccess = false;
      }
    } catch (error) {
      console.error('❌ Build failed:', error.message);
      buildSuccess = false;
    }

    // Summary
    console.log('\n📊 Build Summary:');
    console.log(`   Icons: ${iconSuccess ? '✅' : '❌'}`);
    console.log(`   Build: ${buildSuccess ? '✅' : '❌'}`);
    
    return iconSuccess && buildSuccess;
  }

  /**
   * Print usage information
   */
  printUsage() {
    console.log('🔧 MassUGC Studio Universal Build Helper');
    console.log('');
    console.log('Usage: node universal-build-helper.js [command]');
    console.log('');
    console.log('Commands:');
    console.log('  sign     - Run backend signing for current platform');
    console.log('  icons    - Create platform-specific icons');
    console.log('  check    - Check build requirements');
    console.log('  build    - Run complete universal build process');
    console.log('  scripts  - Generate platform-specific package.json scripts');
    console.log('  help     - Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/universal-build-helper.js build');
    console.log('  node scripts/universal-build-helper.js check');
  }
}

// Main execution
if (require.main === module) {
  const helper = new UniversalBuildHelper();
  const command = process.argv[2] || 'help';

  switch (command) {
    case 'sign':
      const signSuccess = helper.runBackendSigning();
      process.exit(signSuccess ? 0 : 1);
      
    case 'icons':
      const iconSuccess = helper.runIconCreation();
      process.exit(iconSuccess ? 0 : 1);
      
    case 'check':
      const requirements = helper.checkBuildRequirements();
      process.exit(requirements.pass ? 0 : 1);
      
    case 'build':
      const buildSuccess = helper.runUniversalBuild();
      process.exit(buildSuccess ? 0 : 1);
      
    case 'scripts':
      helper.generateScripts();
      process.exit(0);
      
    case 'help':
    default:
      helper.printUsage();
      process.exit(0);
  }
}

module.exports = UniversalBuildHelper;
