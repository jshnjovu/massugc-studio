#!/usr/bin/env node

/**
 * Visual C++ Redistributable Installer for MassUGC Studio Windows Builds
 * Detects, downloads, and installs VC++ Redistributables if not available
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

class VCRedistInstaller {
  constructor() {
    this.isWindows = process.platform === 'win32';
    this.architecture = process.arch; // 'x64', 'ia32', 'arm64', etc.
    this.is64Bit = this.architecture === 'x64' || this.architecture === 'arm64';

    this.vcRedistVersions = this.getVCRedistVersions();
  }

  /**
   * Get appropriate VC++ Redistributables based on system architecture
   */
  getVCRedistVersions() {
    const baseVersions = [
      {
        version: '2022',
        x64: {
          downloadUrl: 'https://aka.ms/vs/17/release/vc_redist.x64.exe',
          registryKey: 'HKLM\\SOFTWARE\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\x64',
          displayName: 'Microsoft Visual C++ 2022 Redistributable (x64)'
        },
        x86: {
          downloadUrl: 'https://aka.ms/vs/17/release/vc_redist.x86.exe',
          registryKey: 'HKLM\\SOFTWARE\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\x86',
          displayName: 'Microsoft Visual C++ 2022 Redistributable (x86)'
        }
      },
      {
        version: '2019',
        x64: {
          downloadUrl: 'https://aka.ms/vs/16/release/vc_redist.x64.exe',
          registryKey: 'HKLM\\SOFTWARE\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\x64',
          displayName: 'Microsoft Visual C++ 2019 Redistributable (x64)'
        },
        x86: {
          downloadUrl: 'https://aka.ms/vs/16/release/vc_redist.x86.exe',
          registryKey: 'HKLM\\SOFTWARE\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\x86',
          displayName: 'Microsoft Visual C++ 2019 Redistributable (x86)'
        }
      },
      {
        version: '2015-2022',
        x64: {
          downloadUrl: 'https://aka.ms/vs/17/release/vc_redist.x64.exe',
          registryKey: 'HKLM\\SOFTWARE\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\x64',
          displayName: 'Microsoft Visual C++ 2015-2022 Redistributable (x64)'
        },
        x86: {
          downloadUrl: 'https://aka.ms/vs/17/release/vc_redist.x86.exe',
          registryKey: 'HKLM\\SOFTWARE\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\x86',
          displayName: 'Microsoft Visual C++ 2015-2022 Redistributable (x86)'
        }
      }
    ];

    return baseVersions.map(version => {
      const arch = this.is64Bit ? 'x64' : 'x86';
      const archData = version[arch];

      return {
        version: version.version,
        downloadUrl: archData.downloadUrl,
        registryKey: archData.registryKey,
        displayName: archData.displayName,
        architecture: arch
      };
    });
  }

  /**
   * Check if running on Windows
   */
  isWindowsPlatform() {
    return this.isWindows;
  }

  /**
   * Check if Visual C++ Redistributables are installed
   */
  async checkVCRedistributables() {
    if (!this.isWindowsPlatform()) {
      console.log('ℹ️  Visual C++ Redistributables check only applies to Windows');
      return { installed: true, missing: [] };
    }

    console.log('🔍 Checking Visual C++ Redistributables...');
    console.log(`📋 Target Architecture: ${this.architecture} (${this.is64Bit ? '64-bit' : '32-bit'})`);

    const results = {
      installed: true,
      missing: [],
      details: []
    };

    for (const vcRedist of this.vcRedistVersions) {
      const isInstalled = this.checkRegistryKey(vcRedist.registryKey);
      const detail = {
        version: vcRedist.version,
        displayName: vcRedist.displayName,
        installed: isInstalled,
        registryKey: vcRedist.registryKey
      };

      results.details.push(detail);

      if (!isInstalled) {
        results.installed = false;
        results.missing.push(vcRedist);
        console.log(`❌ ${vcRedist.displayName} not found`);
      } else {
        console.log(`✅ ${vcRedist.displayName} is installed`);
      }
    }

    return results;
  }

  /**
   * Check Windows registry for VC++ Redistributable installation
   */
  checkRegistryKey(keyPath) {
    try {
      // Use reg query to check if the registry key exists
      const command = `reg query "${keyPath}" /ve`;
      execSync(command, { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Download VC++ Redistributable installer
   */
  async downloadInstaller(url, outputPath) {
    console.log(`📥 Downloading VC++ Redistributable from: ${url}`);

    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(outputPath);
      const protocol = url.startsWith('https') ? https : http;

      const request = protocol.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }

        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloadedSize = 0;

        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          if (totalSize) {
            const progress = (downloadedSize / totalSize * 100).toFixed(1);
            console.log(`📊 Download progress: ${progress}%`);
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          console.log(`✅ Downloaded to: ${outputPath}`);
          resolve(outputPath);
        });
      });

      request.on('error', (error) => {
        fs.unlink(outputPath, () => {}); // Clean up partial download
        reject(error);
      });

      file.on('error', (error) => {
        fs.unlink(outputPath, () => {}); // Clean up partial download
        reject(error);
      });
    });
  }

  /**
   * Install VC++ Redistributable silently
   */
  async installVCRedist(installerPath, version) {
    console.log(`🔧 Installing ${version}...`);

    try {
      // Run installer silently
      const command = `"${installerPath}" /quiet /norestart`;
      execSync(command, { stdio: 'inherit' });

      console.log(`✅ ${version} installed successfully`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to install ${version}:`, error.message);
      return false;
    } finally {
      // Clean up installer
      try {
        fs.unlinkSync(installerPath);
        console.log('🧹 Cleaned up installer file');
      } catch (cleanupError) {
        console.warn('⚠️  Could not clean up installer file:', cleanupError.message);
      }
    }
  }

  /**
   * Install missing VC++ Redistributables
   */
  async installMissingVCRedistributables() {
    if (!this.isWindowsPlatform()) {
      console.log('ℹ️  VC++ Redistributable installation only applies to Windows');
      return true;
    }

    const checkResult = await this.checkVCRedistributables();

    if (checkResult.installed) {
      console.log('✅ All required VC++ Redistributables are already installed');
      return true;
    }

    console.log(`📦 Installing ${checkResult.missing.length} missing VC++ Redistributables...`);

    let allInstalled = true;
    const tempDir = path.join(process.cwd(), 'temp');

    // Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    for (const vcRedist of checkResult.missing) {
      try {
        const installerPath = path.join(tempDir, `vc_redist_${vcRedist.version}_${vcRedist.architecture}.exe`);

        // Download installer
        await this.downloadInstaller(vcRedist.downloadUrl, installerPath);

        // Install redistributable
        const installed = await this.installVCRedist(installerPath, vcRedist.displayName);
        if (!installed) {
          allInstalled = false;
        }
      } catch (error) {
        console.error(`❌ Failed to install ${vcRedist.displayName}:`, error.message);
        allInstalled = false;
      }
    }

    // Clean up temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('⚠️  Could not clean up temp directory:', error.message);
    }

    return allInstalled;
  }

  /**
   * Main execution function
   */
  async run() {
    console.log('🔧 Visual C++ Redistributable Installer for MassUGC Studio');
    console.log('============================================================');
    console.log(`🖥️  Architecture: ${this.architecture} (${this.is64Bit ? '64-bit' : '32-bit'})`);

    try {
      const success = await this.installMissingVCRedistributables();

      if (success) {
        console.log('🎉 VC++ Redistributables setup completed successfully!');
        return 0;
      } else {
        console.error('❌ Some VC++ Redistributables could not be installed');
        return 1;
      }
    } catch (error) {
      console.error('💥 Fatal error during VC++ Redistributables installation:', error.message);
      return 1;
    }
  }

  /**
   * Print usage information
   */
  printUsage() {
    console.log('Visual C++ Redistributable Installer for MassUGC Studio');
    console.log('');
    console.log('Usage: node scripts/vc-redist-installer.js [command]');
    console.log('');
    console.log('Commands:');
    console.log('  check    - Check if VC++ Redistributables are installed');
    console.log('  install  - Install missing VC++ Redistributables');
    console.log('  help     - Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/vc-redist-installer.js check');
    console.log('  node scripts/vc-redist-installer.js install');
  }
}

// Main execution
if (require.main === module) {
  const installer = new VCRedistInstaller();
  const command = process.argv[2] || 'install';

  switch (command) {
    case 'check':
      installer.checkVCRedistributables()
        .then(result => {
          console.log('\n📋 VC++ Redistributables Check Summary:');
          console.log(`Installed: ${result.installed ? '✅ Yes' : '❌ No'}`);
          if (result.missing.length > 0) {
            console.log('Missing:');
            result.missing.forEach(vc => console.log(`  - ${vc.displayName}`));
          }
          process.exit(result.installed ? 0 : 1);
        })
        .catch(error => {
          console.error('Error checking VC++ Redistributables:', error.message);
          process.exit(1);
        });
      break;

    case 'install':
      installer.run()
        .then(exitCode => process.exit(exitCode))
        .catch(error => {
          console.error('Error during installation:', error.message);
          process.exit(1);
        });
      break;

    case 'help':
    default:
      installer.printUsage();
      process.exit(0);
  }
}

module.exports = VCRedistInstaller;
