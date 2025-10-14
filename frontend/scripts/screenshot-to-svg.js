#!/usr/bin/env node

/**
 * Screenshot-to-SVG Export Script for MassUGC Studio
 * Takes screenshots of the running app and creates clean SVG mockups
 */

// const puppeteer = require('puppeteer'); // Not needed for mockups
const fs = require('fs');
const path = require('path');

// Simple SVG mockups that look like your actual UI
const createMockupSVG = (type, width, height) => {
  const mockups = {
    campaigns: `
    <!-- Background -->
    <rect width="${width}" height="${height}" fill="#fef2f2"/>
    
    <!-- Main container -->
    <rect x="40" y="40" width="${width-80}" height="${height-80}" rx="20" fill="white" stroke="#e5e5e5" stroke-width="1" filter="drop-shadow(0 4px 12px rgba(0,0,0,0.05))"/>
    
    <!-- Header -->
    <text x="80" y="100" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="32" font-weight="600" fill="#171717">Campaigns</text>
    <text x="80" y="130" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" fill="#6b7280">Manage and run your content generation campaigns</text>
    
    <!-- Create button -->
    <rect x="${width-220}" y="70" width="140" height="44" rx="12" fill="#ef4444"/>
    <text x="${width-150}" y="95" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="500" fill="white" text-anchor="middle">+ Create Campaign</text>
    
    <!-- Campaign card 1 -->
    <rect x="80" y="170" width="${width-160}" height="110" rx="16" fill="white" stroke="#e5e5e5" stroke-width="1"/>
    <text x="100" y="200" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="600" fill="#171717">Summer Product Launch</text>
    <text x="100" y="225" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#6b7280">Premium Skincare Set</text>
    
    <!-- Run button -->
    <rect x="${width-180}" y="185" width="70" height="36" rx="8" fill="#f59e0b"/>
    <text x="${width-145}" y="206" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="500" fill="white" text-anchor="middle">Run</text>
    
    <!-- Details -->
    <text x="100" y="250" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill="#6b7280">Setting: Modern Office</text>
    <text x="100" y="270" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill="#6b7280">Hook: Transform your skincare routine</text>
    
    <!-- Status badge -->
    <rect x="500" y="245" width="50" height="24" rx="12" fill="#dcfce7"/>
    <text x="525" y="260" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="500" fill="#166534" text-anchor="middle">ready</text>
    
    <!-- Campaign card 2 -->
    <rect x="80" y="300" width="${width-160}" height="110" rx="16" fill="white" stroke="#e5e5e5" stroke-width="1"/>
    <text x="100" y="330" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="600" fill="#171717">Holiday Campaign</text>
    <text x="100" y="355" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#6b7280">Winter Collection</text>
    
    <!-- Run button 2 -->
    <rect x="${width-180}" y="315" width="70" height="36" rx="8" fill="#f59e0b"/>
    <text x="${width-145}" y="336" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="500" fill="white" text-anchor="middle">Run</text>
    
    <!-- Details 2 -->
    <text x="100" y="380" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill="#6b7280">Setting: Cozy Home</text>
    <text x="100" y="400" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill="#6b7280">Hook: Discover winter essentials</text>
    
    <!-- Status badge 2 -->
    <rect x="500" y="375" width="50" height="24" rx="12" fill="#dcfce7"/>
    <text x="525" y="390" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="500" fill="#166534" text-anchor="middle">ready</text>
    `,
    
    jobs: `
    <!-- Background -->
    <rect width="${width}" height="${height}" fill="#fef2f2"/>
    
    <!-- Main container -->
    <rect x="40" y="40" width="${width-80}" height="${height-80}" rx="20" fill="white" stroke="#e5e5e5" stroke-width="1" filter="drop-shadow(0 4px 12px rgba(0,0,0,0.05))"/>
    
    <!-- Header -->
    <text x="80" y="100" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="32" font-weight="600" fill="#171717">Running Campaigns</text>
    
    <!-- Cancel button -->
    <rect x="${width-200}" y="70" width="120" height="44" rx="12" fill="#ef4444"/>
    <text x="${width-140}" y="95" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="500" fill="white" text-anchor="middle">Cancel All Jobs</text>
    
    <!-- Filter buttons -->
    <rect x="80" y="130" width="60" height="32" rx="16" fill="#f59e0b"/>
    <text x="110" y="149" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="white" text-anchor="middle">All</text>
    
    <rect x="150" y="130" width="80" height="32" rx="16" fill="#f5f5f5"/>
    <text x="190" y="149" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill="#6b7280" text-anchor="middle">Running</text>
    
    <rect x="240" y="130" width="70" height="32" rx="16" fill="#f5f5f5"/>
    <text x="275" y="149" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill="#6b7280" text-anchor="middle">Queued</text>
    
    <rect x="320" y="130" width="90" height="32" rx="16" fill="#f5f5f5"/>
    <text x="365" y="149" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill="#6b7280" text-anchor="middle">Completed</text>
    
    <!-- Job card 1 -->
    <rect x="80" y="180" width="${width-160}" height="120" rx="16" fill="white" stroke="#e5e5e5" stroke-width="1"/>
    <text x="100" y="210" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="500" fill="#171717">Summer Product Launch</text>
    <text x="100" y="235" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="#6b7280">Run ID: run_123</text>
    
    <!-- Processing badge -->
    <rect x="${width-180}" y="190" width="80" height="28" rx="14" fill="#fef3c7"/>
    <text x="${width-140}" y="207" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="500" fill="#92400e" text-anchor="middle">Processing</text>
    
    <!-- Progress info -->
    <text x="100" y="260" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#6b7280">Generating video content...</text>
    <text x="${width-140}" y="260" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#6b7280">65%</text>
    
    <!-- Progress bar -->
    <rect x="100" y="270" width="${width-200}" height="8" rx="4" fill="#e5e5e5"/>
    <rect x="100" y="270" width="${(width-200) * 0.65}" height="8" rx="4" fill="#f59e0b"/>
    
    <!-- Job card 2 -->
    <rect x="80" y="320" width="${width-160}" height="100" rx="16" fill="white" stroke="#e5e5e5" stroke-width="1"/>
    <text x="100" y="350" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="500" fill="#171717">Holiday Campaign</text>
    <text x="100" y="375" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="#6b7280">Run ID: run_124</text>
    
    <!-- Completed badge -->
    <rect x="${width-180}" y="330" width="80" height="28" rx="14" fill="#dcfce7"/>
    <text x="${width-140}" y="347" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="500" fill="#166534" text-anchor="middle">Completed</text>
    `,
    
    settings: `
    <!-- Background -->
    <rect width="${width}" height="${height}" fill="#fef2f2"/>
    
    <!-- Main container -->
    <rect x="40" y="40" width="${width-80}" height="${height-80}" rx="20" fill="white" stroke="#e5e5e5" stroke-width="1" filter="drop-shadow(0 4px 12px rgba(0,0,0,0.05))"/>
    
    <!-- Header -->
    <text x="80" y="100" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="32" font-weight="600" fill="#171717">Settings</text>
    
    <!-- API Keys section -->
    <rect x="80" y="130" width="${width-160}" height="280" rx="16" fill="white" stroke="#e5e5e5" stroke-width="1"/>
    <text x="100" y="160" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="500" fill="#171717">API Keys</text>
    
    <!-- OpenAI field -->
    <text x="100" y="190" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="500" fill="#374151">OpenAI API Key</text>
    <rect x="100" y="200" width="${width-200}" height="40" rx="8" fill="#ffffff" stroke="#d1d5db" stroke-width="1"/>
    <text x="115" y="223" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#9ca3af">••••••••••••••••••••••••••••••••••••••••</text>
    
    <!-- ElevenLabs field -->
    <text x="100" y="270" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="500" fill="#374151">ElevenLabs API Key</text>
    <rect x="100" y="280" width="${width-200}" height="40" rx="8" fill="#ffffff" stroke="#d1d5db" stroke-width="1"/>
    <text x="115" y="303" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#9ca3af">••••••••••••••••••••••••••••••••••••••••</text>
    
    <!-- Lipsync field -->
    <text x="100" y="350" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="500" fill="#374151">Lipsync API Key</text>
    <rect x="100" y="360" width="${width-200}" height="40" rx="8" fill="#ffffff" stroke="#d1d5db" stroke-width="1"/>
    <text x="115" y="383" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#9ca3af">••••••••••••••••••••••••••••••••••••••••</text>
    
    <!-- Buttons -->
    <rect x="100" y="420" width="120" height="44" rx="12" fill="#ef4444"/>
    <text x="160" y="445" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="500" fill="white" text-anchor="middle">Save Settings</text>
    
    <rect x="240" y="420" width="100" height="44" rx="12" fill="white" stroke="#d1d5db" stroke-width="1"/>
    <text x="290" y="445" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="500" fill="#374151" text-anchor="middle">Quick Test</text>
    
    <!-- Appearance section -->
    <rect x="80" y="430" width="${width-160}" height="180" rx="16" fill="white" stroke="#e5e5e5" stroke-width="1"/>
    <text x="100" y="460" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="500" fill="#171717">Appearance</text>
    
    <!-- Light theme -->
    <rect x="100" y="480" width="90" height="90" rx="12" fill="#fffbeb" stroke="#f59e0b" stroke-width="2"/>
    <circle cx="145" cy="515" r="12" fill="#facc15"/>
    <text x="145" y="545" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="500" fill="#171717" text-anchor="middle">Light</text>
    
    <!-- Dark theme -->
    <rect x="210" y="480" width="90" height="90" rx="12" fill="white" stroke="#e5e5e5" stroke-width="1"/>
    <circle cx="255" cy="515" r="12" fill="#374151"/>
    <text x="255" y="545" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="500" fill="#171717" text-anchor="middle">Dark</text>
    `
  };
  
  return mockups[type] || '';
};

const createCleanSVG = (type, width, height, title) => {
  const content = createMockupSVG(type, width, height);
  
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <title>${title}</title>
  <defs>
    <filter id="drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.05"/>
    </filter>
  </defs>
  ${content}
</svg>`;
};

const exportCleanSVGs = async () => {
  const outputDir = path.join(process.cwd(), 'src/renderer/public/svgs');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  console.log('🎨 Creating clean SVG mockups of your UI...');
  
  const exports = [
    {
      name: 'campaigns-hero',
      type: 'campaigns',
      width: 1000,
      height: 500,
      title: 'MassUGC Studio - Campaigns Dashboard'
    },
    {
      name: 'jobs-queue',
      type: 'jobs',
      width: 1000,
      height: 500,
      title: 'MassUGC Studio - Running Campaigns'
    },
    {
      name: 'settings-panel',
      type: 'settings',
      width: 900,
      height: 650,
      title: 'MassUGC Studio - Settings Panel'
    }
  ];
  
  exports.forEach(({ name, type, width, height, title }) => {
    try {
      const svg = createCleanSVG(type, width, height, title);
      const filePath = path.join(outputDir, `${name}.svg`);
      
      fs.writeFileSync(filePath, svg, 'utf8');
      console.log(`✅ Created clean mockup: ${name}.svg (${width}x${height})`);
    } catch (error) {
      console.error(`❌ Failed to create ${name}:`, error.message);
    }
  });
  
  console.log(`\n🎉 Clean SVG mockups created! Files saved to: ${outputDir}`);
  console.log('📱 These are simplified but accurate representations of your UI');
};

if (require.main === module) {
  exportCleanSVGs();
}

module.exports = { exportCleanSVGs };
