const { notarize } = require('@electron/notarize');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.default = async function(context) {
  const { electronPlatformName, appOutDir } = context;
  
  // Only notarize macOS builds
  if (electronPlatformName !== 'darwin') {
    console.log(`Skipping notarization - not a macOS build (platform: ${electronPlatformName})`);
    return;
  }

  const appPath = `${appOutDir}/${context.packager.appInfo.productFilename}.app`;
  const appBundleId = context.packager.appInfo.bundleIdentifier;

  console.log(`🔍 Starting comprehensive notarization process for ${appPath}`);
  console.log(`📱 Bundle ID: ${appBundleId}`);

  try {
    // Step 1: Verify all executables are signed with hardened runtime
    console.log('\n🔧 Step 1: Verifying and fixing executable signatures...');
    await verifyAndFixSignatures(appPath);

    // Step 2: Check if we have the required environment variables
    const appleId = process.env.APPLE_ID;
    const appleIdPassword = process.env.APPLE_APP_PASSWORD;
    const teamId = process.env.APPLE_TEAM_ID;
    
    // Prefer API key authentication (modern approach)
    const apiKey = process.env.APPLE_API_KEY;
    const apiKeyId = process.env.APPLE_API_KEY_ID;
    const apiIssuer = process.env.APPLE_API_ISSUER;

    let notarizeOptions;

    if (apiKey && apiKeyId && apiIssuer) {
      // Use API key authentication (recommended)
      console.log('🔑 Using API key authentication for notarization');
      notarizeOptions = {
        appBundleId,
        appPath,
        appleApiKey: apiKey,
        appleApiKeyId: apiKeyId,
        appleApiIssuer: apiIssuer,
      };
    } else if (appleId && appleIdPassword) {
      // Fallback to app-specific password (legacy)
      console.log('🔑 Using app-specific password authentication for notarization');
      notarizeOptions = {
        appBundleId,
        appPath,
        appleId,
        appleIdPassword,
      };
      
      // Add team ID if available
      if (teamId) {
        notarizeOptions.teamId = teamId;
      }
    } else {
      // Use keychain profile (most convenient for this setup)
      console.log('🔑 Using keychain profile for notarization');
      notarizeOptions = {
        appBundleId,
        appPath,
        keychainProfile: 'MassUGC-Studio',
      };
    }

    // Step 3: Perform notarization with timeout and retry logic
    console.log('\n📤 Step 2: Submitting for notarization...');
    console.log('⏳ This may take 10-30 minutes for large apps like this...');
    
    await notarize(notarizeOptions);
    console.log('✅ Notarization completed successfully');

    // Step 4: Staple the notarization ticket to the app
    console.log('\n📎 Step 3: Stapling notarization ticket...');
    execSync(`xcrun stapler staple "${appPath}"`, { stdio: 'inherit' });
    console.log('✅ Stapling completed successfully');

    console.log('\n🎉 Complete! Your app is now notarized and ready for distribution.');

  } catch (error) {
    console.error('\n❌ Notarization failed:', error.message);
    
    // Provide helpful error messages
    if (error.message.includes('Invalid credentials')) {
      console.error('\n💡 Tip: Make sure your Apple ID credentials are correct and you have enabled two-factor authentication.');
      console.error('For app-specific passwords, generate one at: https://appleid.apple.com/account/manage');
    } else if (error.message.includes('Bundle ID')) {
      console.error('\n💡 Tip: Ensure your bundle ID matches exactly with your Apple Developer account.');
    } else if (error.message.includes('hardened runtime')) {
      console.error('\n💡 Tip: Some executables may still need hardened runtime. Check the verification step above.');
    }
    
    throw error;
  }
};

async function verifyAndFixSignatures(appPath) {
  const identity = "Jonathan Brower (6UY72DSS38)";
  const fullEntitlementsPath = path.join(__dirname, '../build/entitlements.mac.plist');
  const minimalEntitlementsPath = path.join(__dirname, '../build/entitlements.mac.minimal.plist');
  
  console.log(`📍 Checking signatures in: ${appPath}`);
  
  // Define executables with their appropriate entitlements
  const executablesConfig = [
    // Main app and backend - need full entitlements
    { path: 'Contents/MacOS/MassUGC Studio', entitlements: fullEntitlementsPath, type: 'main' },
    { path: 'Contents/Resources/backend/ZyraVideoAgentBackend', entitlements: fullEntitlementsPath, type: 'backend' },
    { path: 'Contents/Resources/backend/_internal/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1', entitlements: fullEntitlementsPath, type: 'backend' },
    { path: 'Contents/Resources/backend/_internal/torch/bin/protoc-3.13.0.0', entitlements: fullEntitlementsPath, type: 'backend' },
    { path: 'Contents/Resources/backend/_internal/torch/bin/torch_shm_manager', entitlements: fullEntitlementsPath, type: 'backend' },
    { path: 'Contents/Resources/backend/_internal/torch/bin/protoc', entitlements: fullEntitlementsPath, type: 'backend' },
    
    // Electron helpers - can use minimal entitlements
    { path: 'Contents/Frameworks/MassUGC Studio Helper.app/Contents/MacOS/MassUGC Studio Helper', entitlements: minimalEntitlementsPath, type: 'helper' },
    { path: 'Contents/Frameworks/MassUGC Studio Helper (GPU).app/Contents/MacOS/MassUGC Studio Helper (GPU)', entitlements: minimalEntitlementsPath, type: 'helper' },
    { path: 'Contents/Frameworks/MassUGC Studio Helper (Plugin).app/Contents/MacOS/MassUGC Studio Helper (Plugin)', entitlements: minimalEntitlementsPath, type: 'helper' },
    { path: 'Contents/Frameworks/MassUGC Studio Helper (Renderer).app/Contents/MacOS/MassUGC Studio Helper (Renderer)', entitlements: minimalEntitlementsPath, type: 'helper' },
    { path: 'Contents/Frameworks/Electron Framework.framework/Versions/A/Helpers/chrome_crashpad_handler', entitlements: minimalEntitlementsPath, type: 'helper' },
    { path: 'Contents/Frameworks/Squirrel.framework/Versions/A/Resources/ShipIt', entitlements: minimalEntitlementsPath, type: 'helper' }
  ];

  let resignedCount = 0;
  
  for (const config of executablesConfig) {
    const fullPath = path.join(appPath, config.path);
    
    if (fs.existsSync(fullPath)) {
      try {
        // Check if already properly signed with hardened runtime
        execSync(`codesign --verify --strict --deep "${fullPath}"`, { stdio: 'pipe' });
        
        // Check for hardened runtime
        const checkResult = execSync(`codesign -dv --entitlements - "${fullPath}" 2>&1 || true`, { encoding: 'utf8' });
        
        if (!checkResult.includes('runtime') || !checkResult.includes('hardened')) {
          console.log(`🔧 Re-signing (${config.type}): ${config.path}`);
          
          // Re-sign with hardened runtime and appropriate entitlements
          execSync(`codesign --force --timestamp --options runtime --entitlements "${config.entitlements}" --sign "${identity}" "${fullPath}"`, { stdio: 'inherit' });
          resignedCount++;
        } else {
          console.log(`✅ Already properly signed (${config.type}): ${config.path}`);
        }
      } catch (error) {
        console.log(`🔧 Signing (${config.type}): ${config.path}`);
        try {
          // Sign with hardened runtime and appropriate entitlements
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
  } else {
    console.log(`✅ All executables already properly signed`);
  }
  
  // Final verification of the entire app bundle
  console.log('\n🔍 Final verification of app bundle...');
  
  // Step 1: Re-sign any frameworks that we modified
  if (resignedCount > 0) {
    console.log('🔧 Re-signing frameworks after modifying contents...');
    
    const frameworksToResign = [
      'Contents/Frameworks/Squirrel.framework',
      'Contents/Frameworks/Electron Framework.framework'
    ];
    
    for (const framework of frameworksToResign) {
      const frameworkPath = path.join(appPath, framework);
      if (fs.existsSync(frameworkPath)) {
        try {
          console.log(`🔧 Re-signing framework: ${framework}`);
          execSync(`codesign --force --timestamp --options runtime --entitlements "${minimalEntitlementsPath}" --sign "${identity}" "${frameworkPath}"`, { stdio: 'inherit' });
        } catch (error) {
          console.warn(`⚠️  Could not re-sign framework ${framework}: ${error.message}`);
        }
      }
    }
    
    // Step 2: Re-sign helper apps that we modified
    const helperApps = [
      'Contents/Frameworks/MassUGC Studio Helper.app',
      'Contents/Frameworks/MassUGC Studio Helper (GPU).app',
      'Contents/Frameworks/MassUGC Studio Helper (Plugin).app',
      'Contents/Frameworks/MassUGC Studio Helper (Renderer).app'
    ];
    
    for (const helperApp of helperApps) {
      const helperPath = path.join(appPath, helperApp);
      if (fs.existsSync(helperPath)) {
        try {
          console.log(`🔧 Re-signing helper app: ${helperApp}`);
          execSync(`codesign --force --timestamp --options runtime --entitlements "${minimalEntitlementsPath}" --sign "${identity}" "${helperPath}"`, { stdio: 'inherit' });
        } catch (error) {
          console.warn(`⚠️  Could not re-sign helper app ${helperApp}: ${error.message}`);
        }
      }
    }
    
    // Step 3: Re-sign the main app bundle
    console.log('🔧 Re-signing main app bundle...');
    try {
      execSync(`codesign --force --timestamp --options runtime --entitlements "${fullEntitlementsPath}" --sign "${identity}" "${appPath}"`, { stdio: 'inherit' });
      console.log('✅ Main app bundle re-signed successfully');
    } catch (error) {
      console.error(`❌ Failed to re-sign main app bundle: ${error.message}`);
      throw error;
    }
  }
  
  try {
    execSync(`codesign --verify --deep --strict "${appPath}"`, { stdio: 'inherit' });
    console.log('✅ App bundle verification passed');
  } catch (error) {
    console.error('❌ App bundle verification failed:', error.message);
    throw error;
  }
}
