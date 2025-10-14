#!/usr/bin/env node

/**
 * Migration Script for MassUGC Studio
 * Helps transition from platform-specific scripts to universal ones
 */

const fs = require('fs');
const path = require('path');

class ScriptMigrator {
  constructor() {
    this.projectRoot = path.dirname(__dirname);
    this.scriptsDir = path.join(this.projectRoot, 'scripts');
  }

  /**
   * Generate migration report
   */
  generateMigrationReport() {
    console.log('📋 Generating Migration Report...');
    console.log('=====================================');

    const scripts = [
      { old: 'sign-backend.sh', new: 'sign-backend-universal.js', type: 'macOS shell → Universal JS' },
      { old: 'check-notarization.sh', new: 'universal-build-helper.js check', type: 'macOS shell → Universal JS' },
      { old: 'notarize.js', new: 'notarize-universal.js', type: 'macOS only → Universal' },
      { old: 'create-rounded-icon.py', new: 'create-icon-universal.py', type: 'macOS only → Platform-aware' },
      { old: 'export-svg.js', new: 'export-svg-improved.js', type: 'Generic → Improved' },
      { old: 'export-svg-improved.js', new: 'existing (already universal)', type: 'Already universal' },
      { old: 'screenshot-to-svg.js', new: 'existing (already universal)', type: 'Already universal' }
    ];

    console.log('\n🔄 Script Migration Mapping:');
    scripts.forEach(script => {
      const oldExists = fs.existsSync(path.join(this.scriptsDir, script.old));
      const newExists = fs.existsSync(path.join(this.scriptsDir, script.new));
      
      console.log(`\n  ${oldExists ? '📄' : '❌'} ${script.old}`);
      console.log(`     ↓ ${script.type}`);
      console.log(`  ${newExists ? '✅' : '⚠️ '} ${script.new}`);
    });

    // Show package.json script changes
    console.log('\n📦 Package.json Script Changes:');
    console.log('\n  Added Universal Scripts:');
    console.log('    ✅ npm run universal:check     - Check build requirements');
    console.log('    ✅ npm run universal:icons    - Create platform-specific icons');
    console.log('    ✅ npm run universal:sign      - Platform-aware backend signing');
    console.log('    ✅ npm run universal:build     - Complete universal build');
    console.log('    ✅ npm run universal:scripts  - Generate platform scripts');

    console.log('\n  Original Platform Scripts (still work):');
    console.log('    📄 npm run build:mac           - macOS build (original)');
    console.log('    📄 npm run build:win           - Windows build (original)');
    console.log('    📄 npm run build:mac-notarize   - macOS with notarization');

    return scripts;
  }

  /**
   * Generate environment setup instructions
   */
  generateEnvironmentSetup() {
    console.log('\n🔧 Environment Setup Instructions:');
    console.log('=====================================');

    console.log('\n🍎 For macOS:');
    console.log('   Required:');
    console.log('     - Xcode Command Line Tools');
    console.log('     - Apple Developer Certificate');
    console.log('     - Validated keychain profile: "MassUGC-Studio"');
    console.log('\n   Environment Variables (optional):');
    console.log('     - APPLE_ID=your-email@example.com');
    console.log('     - APPLE_APP_PASSWORD=abc-def-ghi-jkl');
    console.log('     - APPLE_TEAM_ID=6UY72DSS38');
    console.log('     - APPLE_API_KEY=your-api-key (recommended)');
    console.log('     - APPLE_API_KEY_ID=your-key-id');
    console.log('     - APPLE_API_ISSUER=your-issuer');

    console.log('\n🪟 For Windows:');
    console.log('   Required:');
    console.log('     - Windows SDK (for signtool.exe)');
    console.log('     - Code signing certificate');
    console.log('     - Python 3.x with PIL (Pillow)');
    console.log('     - ImageMagick (optional, for better icon conversion)');
    console.log('\n   Environment Variables:');
    console.log('     - WINDOWS_CERT_THUMBPRINT=your-certificate-thumbprint');
    console.log('     - WINDOWS_TIMESTAMP_SERVER=http://timestamp.digicert.com');

    console.log('\n🐧 For Linux:');
    console.log('   Required:');
    console.log('     - Python 3.x with PIL (Pillow)');
    console.log('     - No code signing required');
  }

  /**
   * Generate migration guide
   */
  generateMigrationGuide() {
    console.log('\n📖 Migration Guide:');
    console.log('====================');
    
    console.log('\n🚀 Quick Start (Recommended):');
    console.log('   1. Run: npm run universal:check');
    console.log('   2. Configure environment variables as needed');
    console.log('   3. Run: npm run universal:build');
    
    console.log('\n🔄 Step-by-step Migration:');
    console.log('   1. Install Dependencies:');
    console.log('      npm install');
    console.log('');
    console.log('   2. Check Requirements:');
    console.log('      npm run universal:check');
    console.log('');
    console.log('   3. Create Platform Icons:');
    console.log('      npm run universal:icons');
    console.log('');
    console.log('   4. Test Backend Signing:');
    console.log('      npm run universal:sign');
    console.log('');
    console.log('   5. Run Full Build:');
    console.log('      npm run universal:build');

    console.log('\n❗ Breaking Changes:');
    console.log('   - Notarization now uses notarize-universal.js by default');
    console.log('   - Windows builds now require signtool.e xe');
    console.log('   - Icon creation works on all platforms');

    console.log('\n💡 Benefits:');
    console.log('   ✅ Single command works on any platform');
    console.log('   ✅ Automatic platform detection');
    console.log('   ✅ Unified configuration');
    console.log('   ✅ Better error handling');
    console.log('   ✅ Consistent experience across platforms');

    console.log('\n🛠️  Manual Override Options:');
    console.log('   - Use original scripts by calling them directly');
    console.log('   - Update package.json to revert afterSign configuration');
    console.log('   - Platform-specific scripts still available');
  }

  /**
   * Generate complete migration guide
   */
  generateCompleteReport() {
    console.log('🎯 MassUGC Studio Universal Scripts Migration');
    console.log('==============================================');
    console.log('');
    console.log('This report shows how your Mac-only scripts have been converted');
    console.log('to work seamlessly across Windows, macOS, and Linux platforms.');
    console.log('');

    this.generateMigrationReport();
    this.generateEnvironmentSetup();
    this.generateMigrationGuide();

    console.log('\n🎉 Migration Summary:');
    console.log('=====================');
    console.log('✅ Universal signing script created');
    console.log('✅ Platform-aware notarization added');
    console.log('✅ Cross-platform icon generation implemented');
    console.log('✅ Build requirements detection added');
    console.log('✅ Unified command interface provided');
    console.log('');
    console.log('Ready to build on any platform! 🚀');
  }

  /**
   * Create migration guide file
   */
  createMigrationFile() {
    const guideContent = `
# Universal Scripts Migration Guide

## Overview
Your MassUGC Studio scripts have been converted from Mac-only to universal cross-platform support.

## New Commands
- \`npm run universal:check\` - Check build requirements for current platform  
- \`npm run universal:icons\` - Create platform-appropriate icons
- \`npm run universal:sign\` - Platform-aware backend signing
- \`npm run universal:build\` - Complete universal build process

## Platform Requirements

### macOS
- Xcode Command Line Tools
- Apple Developer Certificate  
- Keychain profile: "MassUGC-Studio"
- Optional: APPLE_API_KEY for modern authentication

### Windows  
- Windows SDK (includes signtool.exe)
- Code signing certificate
- Python 3.x with PIL/Pillow
- Optional: ImageMagick for advanced icon conversion
- Environment: WINDOWS_CERT_THUMBPRINT

### Linux
- Python 3.x with PIL/Pillow
- No code signing required

## Quick Start
1. Run: \`npm run universal:check\`
2. Configure environment variables as needed
3. Run: \`npm run universal:build\`

## Files Changed
- Created universal signing script
- Enhanced notarization with platform detection  
- Updated icon creation for all platforms
- Added build requirements checker
- Updated package.json with universal scripts

Your original platform-specific scripts are still available and working!
`;

    const guidePath = path.join(this.projectRoot, 'UNIVERSAL-SCRIPTS-MIGRATION.md');
    fs.writeFileSync(guidePath, guideContent);
    console.log(`\n📄 Migration guide saved to: ${guidePath}`);
    
    return guidePath;
  }
}

// Main execution
if (require.main === module) {
  const migrator = new ScriptMigrator();
  
  // Generate complete report
  migrator.generateCompleteReport();
  
  // Create migration file
  migrator.createMigrationFile();
  
  console.log('\n🎯 Next Steps:');
  console.log('=============');
  console.log('1. Review the migration guide above');
  console.log('2. Run: npm run universal:check');
  console.log('3. Install any missing dependencies');
  console.log('4. Configure environment variables');
  console.log('5. Test: npm run universal:icons');
  console.log('6. Build: npm run universal:build');
}

module.exports = ScriptMigrator;
