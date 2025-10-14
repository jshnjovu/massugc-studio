#!/usr/bin/env node

/**
 * Improved SVG Export Script for MassUGC Studio
 * Creates proper UI mockups with actual styling that matches the app
 */

const fs = require('fs');
const path = require('path');

// SVG template with proper styling that matches your Tailwind theme
const createSVG = (content, width, height, title) => {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <title>${title}</title>
  <defs>
    <!-- Gradients matching your theme -->
    <linearGradient id="warmGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#fef2f2;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#fffbeb;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="crimsonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#ef4444;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#dc2626;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#b91c1c;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f59e0b;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#d97706;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#b45309;stop-opacity:1" />
    </linearGradient>
    
    <!-- Drop shadows -->
    <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.1"/>
    </filter>
    <filter id="buttonShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.1"/>
    </filter>
  </defs>
  
  <!-- Background with noise pattern -->
  <rect width="100%" height="100%" fill="url(#warmGradient)"/>
  <pattern id="noisePattern" patternUnits="userSpaceOnUse" width="20" height="20">
    <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.05)"/>
  </pattern>
  <rect width="100%" height="100%" fill="url(#noisePattern)"/>
  
  ${content}
</svg>`;
};

// Campaigns Hero SVG with proper UI styling
const createCampaignsHero = () => {
  return `
  <!-- Main container with rounded corners and shadow -->
  <rect x="50" y="50" width="900" height="500" rx="16" ry="16" fill="white" filter="url(#cardShadow)" stroke="#e5e5e5" stroke-width="1"/>
  
  <!-- Header section -->
  <text x="80" y="110" font-family="Inter, sans-serif" font-size="28" font-weight="600" fill="#171717">Campaigns</text>
  <text x="80" y="140" font-family="Inter, sans-serif" font-size="14" fill="#525252">Manage and run your content generation campaigns</text>
  
  <!-- Create Campaign button -->
  <rect x="750" y="80" width="160" height="40" rx="8" ry="8" fill="url(#crimsonGradient)" filter="url(#buttonShadow)"/>
  <text x="820" y="103" font-family="Inter, sans-serif" font-size="14" font-weight="500" fill="white" text-anchor="middle">+ Create Campaign</text>
  
  <!-- Campaign Card 1 -->
  <rect x="80" y="180" width="840" height="120" rx="12" ry="12" fill="white" stroke="#e5e5e5" stroke-width="1" filter="url(#cardShadow)"/>
  
  <!-- Campaign 1 content -->
  <text x="100" y="210" font-family="Inter, sans-serif" font-size="18" font-weight="600" fill="#171717">Summer Product Launch</text>
  <text x="100" y="230" font-family="Inter, sans-serif" font-size="14" fill="#525252">Premium Skincare Set</text>
  
  <!-- Run button for campaign 1 -->
  <rect x="820" y="190" width="80" height="32" rx="6" ry="6" fill="url(#accentGradient)"/>
  <text x="860" y="209" font-family="Inter, sans-serif" font-size="14" font-weight="500" fill="white" text-anchor="middle">Run</text>
  
  <!-- Campaign details grid -->
  <text x="100" y="260" font-family="Inter, sans-serif" font-size="12" fill="#737373">Setting:</text>
  <text x="150" y="260" font-family="Inter, sans-serif" font-size="12" fill="#404040">Modern Office</text>
  
  <text x="300" y="260" font-family="Inter, sans-serif" font-size="12" fill="#737373">Hook:</text>
  <text x="340" y="260" font-family="Inter, sans-serif" font-size="12" fill="#404040">Transform your skincare routine</text>
  
  <!-- Status badge -->
  <rect x="600" y="250" width="50" height="20" rx="10" ry="10" fill="#dcfce7"/>
  <text x="625" y="262" font-family="Inter, sans-serif" font-size="10" font-weight="500" fill="#166534" text-anchor="middle">ready</text>
  
  <!-- Campaign Card 2 -->
  <rect x="80" y="320" width="840" height="120" rx="12" ry="12" fill="white" stroke="#e5e5e5" stroke-width="1" filter="url(#cardShadow)"/>
  
  <!-- Campaign 2 content -->
  <text x="100" y="350" font-family="Inter, sans-serif" font-size="18" font-weight="600" fill="#171717">Holiday Campaign</text>
  <text x="100" y="370" font-family="Inter, sans-serif" font-size="14" fill="#525252">Winter Collection</text>
  
  <!-- Run button for campaign 2 -->
  <rect x="820" y="330" width="80" height="32" rx="6" ry="6" fill="url(#accentGradient)"/>
  <text x="860" y="349" font-family="Inter, sans-serif" font-size="14" font-weight="500" fill="white" text-anchor="middle">Run</text>
  
  <!-- Campaign 2 details -->
  <text x="100" y="400" font-family="Inter, sans-serif" font-size="12" fill="#737373">Setting:</text>
  <text x="150" y="400" font-family="Inter, sans-serif" font-size="12" fill="#404040">Cozy Home</text>
  
  <text x="300" y="400" font-family="Inter, sans-serif" font-size="12" fill="#737373">Hook:</text>
  <text x="340" y="400" font-family="Inter, sans-serif" font-size="12" fill="#404040">Discover winter essentials</text>
  
  <!-- Status badge 2 -->
  <rect x="600" y="390" width="50" height="20" rx="10" ry="10" fill="#dcfce7"/>
  <text x="625" y="402" font-family="Inter, sans-serif" font-size="10" font-weight="500" fill="#166534" text-anchor="middle">ready</text>
  `;
};

// Jobs Queue SVG with proper UI styling
const createJobsQueue = () => {
  return `
  <!-- Main container -->
  <rect x="50" y="50" width="900" height="500" rx="16" ry="16" fill="white" filter="url(#cardShadow)" stroke="#e5e5e5" stroke-width="1"/>
  
  <!-- Header -->
  <text x="80" y="110" font-family="Inter, sans-serif" font-size="28" font-weight="600" fill="#171717">Running Campaigns</text>
  
  <!-- Cancel All Jobs button -->
  <rect x="720" y="80" width="140" height="40" rx="8" ry="8" fill="#ef4444"/>
  <text x="790" y="103" font-family="Inter, sans-serif" font-size="14" font-weight="500" fill="white" text-anchor="middle">Cancel All Jobs</text>
  
  <!-- Status filter buttons -->
  <rect x="80" y="140" width="60" height="30" rx="15" ry="15" fill="url(#accentGradient)"/>
  <text x="110" y="158" font-family="Inter, sans-serif" font-size="12" font-weight="500" fill="white" text-anchor="middle">All</text>
  
  <rect x="150" y="140" width="80" height="30" rx="15" ry="15" fill="#f5f5f5"/>
  <text x="190" y="158" font-family="Inter, sans-serif" font-size="12" font-weight="500" fill="#404040" text-anchor="middle">Running</text>
  
  <rect x="240" y="140" width="70" height="30" rx="15" ry="15" fill="#f5f5f5"/>
  <text x="275" y="158" font-family="Inter, sans-serif" font-size="12" font-weight="500" fill="#404040" text-anchor="middle">Queued</text>
  
  <rect x="320" y="140" width="90" height="30" rx="15" ry="15" fill="#f5f5f5"/>
  <text x="365" y="158" font-family="Inter, sans-serif" font-size="12" font-weight="500" fill="#404040" text-anchor="middle">Completed</text>
  
  <!-- Job Card 1 (Processing) -->
  <rect x="80" y="200" width="840" height="100" rx="12" ry="12" fill="white" stroke="#e5e5e5" stroke-width="1" filter="url(#cardShadow)"/>
  
  <text x="100" y="230" font-family="Inter, sans-serif" font-size="18" font-weight="500" fill="#171717">Summer Product Launch</text>
  <text x="100" y="250" font-family="Inter, sans-serif" font-size="12" fill="#737373">Run ID: run_123</text>
  
  <!-- Processing status badge -->
  <rect x="820" y="210" width="80" height="24" rx="12" ry="12" fill="#fef3c7"/>
  <text x="860" y="225" font-family="Inter, sans-serif" font-size="11" font-weight="500" fill="#92400e" text-anchor="middle">Processing</text>
  
  <!-- Progress bar -->
  <text x="100" y="275" font-family="Inter, sans-serif" font-size="12" fill="#525252">Generating video content...</text>
  <text x="820" y="275" font-family="Inter, sans-serif" font-size="12" fill="#525252">65%</text>
  
  <rect x="100" y="280" width="740" height="6" rx="3" ry="3" fill="#e5e5e5"/>
  <rect x="100" y="280" width="481" height="6" rx="3" ry="3" fill="url(#accentGradient)"/>
  
  <!-- Job Card 2 (Completed) -->
  <rect x="80" y="320" width="840" height="80" rx="12" ry="12" fill="white" stroke="#e5e5e5" stroke-width="1" filter="url(#cardShadow)"/>
  
  <text x="100" y="350" font-family="Inter, sans-serif" font-size="18" font-weight="500" fill="#171717">Holiday Campaign</text>
  <text x="100" y="370" font-family="Inter, sans-serif" font-size="12" fill="#737373">Run ID: run_124</text>
  
  <!-- Completed status badge -->
  <rect x="820" y="330" width="80" height="24" rx="12" ry="12" fill="#dcfce7"/>
  <text x="860" y="345" font-family="Inter, sans-serif" font-size="11" font-weight="500" fill="#166534" text-anchor="middle">Completed</text>
  `;
};

// Settings Panel SVG with proper UI styling
const createSettingsPanel = () => {
  return `
  <!-- Main container -->
  <rect x="50" y="50" width="800" height="600" rx="16" ry="16" fill="white" filter="url(#cardShadow)" stroke="#e5e5e5" stroke-width="1"/>
  
  <!-- Header -->
  <text x="80" y="110" font-family="Inter, sans-serif" font-size="28" font-weight="600" fill="#171717">Settings</text>
  
  <!-- API Keys Section -->
  <rect x="80" y="140" width="740" height="280" rx="12" ry="12" fill="white" stroke="#e5e5e5" stroke-width="1"/>
  <text x="100" y="170" font-family="Inter, sans-serif" font-size="18" font-weight="500" fill="#171717">API Keys</text>
  
  <!-- OpenAI API Key -->
  <text x="100" y="200" font-family="Inter, sans-serif" font-size="14" font-weight="500" fill="#404040">OpenAI API Key</text>
  <rect x="100" y="210" width="700" height="36" rx="6" ry="6" fill="#ffffff" stroke="#d4d4d4" stroke-width="1"/>
  <text x="115" y="231" font-family="Inter, sans-serif" font-size="14" fill="#737373">••••••••••••••••••••••••••••••••••••••••</text>
  
  <!-- ElevenLabs API Key -->
  <text x="100" y="270" font-family="Inter, sans-serif" font-size="14" font-weight="500" fill="#404040">ElevenLabs API Key</text>
  <rect x="100" y="280" width="700" height="36" rx="6" ry="6" fill="#ffffff" stroke="#d4d4d4" stroke-width="1"/>
  <text x="115" y="301" font-family="Inter, sans-serif" font-size="14" fill="#737373">••••••••••••••••••••••••••••••••••••••••</text>
  
  <!-- Lipsync API Key -->
  <text x="100" y="340" font-family="Inter, sans-serif" font-size="14" font-weight="500" fill="#404040">Lipsync API Key</text>
  <rect x="100" y="350" width="700" height="36" rx="6" ry="6" fill="#ffffff" stroke="#d4d4d4" stroke-width="1"/>
  <text x="115" y="371" font-family="Inter, sans-serif" font-size="14" fill="#737373">••••••••••••••••••••••••••••••••••••••••</text>
  
  <!-- Save Settings button -->
  <rect x="100" y="390" width="120" height="40" rx="8" ry="8" fill="url(#crimsonGradient)" filter="url(#buttonShadow)"/>
  <text x="160" y="413" font-family="Inter, sans-serif" font-size="14" font-weight="500" fill="white" text-anchor="middle">Save Settings</text>
  
  <!-- Quick Test button -->
  <rect x="240" y="390" width="100" height="40" rx="8" ry="8" fill="white" stroke="#d4d4d4" stroke-width="1"/>
  <text x="290" y="413" font-family="Inter, sans-serif" font-size="14" font-weight="500" fill="#404040" text-anchor="middle">Quick Test</text>
  
  <!-- Appearance Section -->
  <rect x="80" y="450" width="740" height="160" rx="12" ry="12" fill="white" stroke="#e5e5e5" stroke-width="1"/>
  <text x="100" y="480" font-family="Inter, sans-serif" font-size="18" font-weight="500" fill="#171717">Appearance</text>
  
  <!-- Light theme option -->
  <rect x="100" y="500" width="80" height="80" rx="8" ry="8" fill="#fffbeb" stroke="#f59e0b" stroke-width="2"/>
  <circle cx="140" cy="530" r="8" fill="#facc15"/>
  <text x="140" y="555" font-family="Inter, sans-serif" font-size="12" font-weight="500" fill="#171717" text-anchor="middle">Light</text>
  
  <!-- Dark theme option -->
  <rect x="200" y="500" width="80" height="80" rx="8" ry="8" fill="white" stroke="#e5e5e5" stroke-width="1"/>
  <circle cx="240" cy="530" r="8" fill="#404040"/>
  <text x="240" y="555" font-family="Inter, sans-serif" font-size="12" font-weight="500" fill="#171717" text-anchor="middle">Dark</text>
  `;
};

// Export function
const exportImprovedSVGs = () => {
  const outputDir = path.join(process.cwd(), 'src/renderer/public/svgs');
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  console.log('🎨 Exporting improved SVG assets with proper UI styling...');
  
  // Export each component with proper styling
  const exports = [
    {
      name: 'campaigns-hero',
      content: createCampaignsHero(),
      width: 1000,
      height: 600,
      title: 'MassUGC Studio - Campaigns Dashboard'
    },
    {
      name: 'jobs-queue',
      content: createJobsQueue(),
      width: 1000,
      height: 600,
      title: 'MassUGC Studio - Running Campaigns'
    },
    {
      name: 'settings-panel',
      content: createSettingsPanel(),
      width: 900,
      height: 700,
      title: 'MassUGC Studio - Settings Panel'
    }
  ];
  
  exports.forEach(({ name, content, width, height, title }) => {
    try {
      const svg = createSVG(content, width, height, title);
      const filePath = path.join(outputDir, `${name}.svg`);
      
      fs.writeFileSync(filePath, svg, 'utf8');
      console.log(`✅ Exported: ${name}.svg (${width}x${height}) with proper UI styling`);
    } catch (error) {
      console.error(`❌ Failed to export ${name}:`, error.message);
    }
  });
  
  console.log(`\n🎉 Improved SVG export complete! Files saved to: ${outputDir}`);
  console.log('\n📝 To optimize the SVGs, run: npm run optimize:svg');
};

// Run export if called directly
if (require.main === module) {
  exportImprovedSVGs();
}

module.exports = { exportImprovedSVGs };
