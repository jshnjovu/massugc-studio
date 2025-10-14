#!/usr/bin/env node

/**
 * SVG Export Script for MassUGC Studio
 * Exports React components as SVG assets for website use
 */

const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const fs = require('fs');
const path = require('path');

// Mock data for components
const mockData = {
  campaigns: [
    {
      id: '1',
      name: 'Summer Product Launch',
      product: 'Premium Skincare Set',
      avatar_id: 'avatar_1',
      script_id: 'script_1',
      setting: 'Modern Office',
      hook: 'Transform your skincare routine',
      status: 'ready',
      created_at: new Date().toISOString()
    },
    {
      id: '2', 
      name: 'Holiday Campaign',
      product: 'Winter Collection',
      avatar_id: 'avatar_2',
      script_id: 'script_2',
      setting: 'Cozy Home',
      hook: 'Discover winter essentials',
      status: 'ready',
      created_at: new Date().toISOString()
    }
  ],
  jobs: [
    {
      campaignId: '1',
      runId: 'run_123',
      status: 'processing',
      progress: 65,
      message: 'Generating video content...',
      startTime: new Date(Date.now() - 120000).toISOString()
    },
    {
      campaignId: '2',
      runId: 'run_124', 
      status: 'completed',
      progress: 100,
      completedAt: new Date(Date.now() - 300000).toISOString(),
      startTime: new Date(Date.now() - 900000).toISOString()
    }
  ],
  settings: {
    OPENAI_API_KEY: '••••••••••••••••••••••••••••••••••••••••',
    ELEVENLABS_API_KEY: '••••••••••••••••••••••••••••••••••••••••',
    DREAMFACE_API_KEY: '••••••••••••••••••••••••••••••••••••••••',
    GCS_BUCKET_NAME: 'massugc-storage',
    OUTPUT_PATH: '/Users/username/MassUGC/exports'
  }
};

// Simplified components for SVG export
const CampaignsHero = () => {
  return React.createElement('div', {
    className: 'w-full max-w-4xl mx-auto p-8 bg-gradient-warm rounded-2xl border border-neutral-200 shadow-lg',
    style: { minHeight: '400px' }
  }, [
    // Header
    React.createElement('div', {
      key: 'header',
      className: 'flex justify-between items-center mb-8'
    }, [
      React.createElement('div', { key: 'title-section' }, [
        React.createElement('h1', {
          key: 'title',
          className: 'text-3xl font-semibold text-neutral-900 mb-2'
        }, 'Campaigns'),
        React.createElement('p', {
          key: 'subtitle',
          className: 'text-neutral-600'
        }, 'Manage and run your content generation campaigns')
      ]),
      React.createElement('button', {
        key: 'create-btn',
        className: 'bg-crimson-500 text-white px-4 py-2 rounded-lg font-medium shadow-md hover:shadow-lg transition-all'
      }, '+ Create Campaign')
    ]),
    
    // Campaign cards
    React.createElement('div', {
      key: 'campaigns',
      className: 'space-y-4'
    }, mockData.campaigns.map((campaign, index) =>
      React.createElement('div', {
        key: campaign.id,
        className: 'bg-white border border-neutral-200 rounded-xl p-6 hover:shadow-md transition-all'
      }, [
        React.createElement('div', {
          key: 'campaign-header',
          className: 'flex justify-between items-start mb-4'
        }, [
          React.createElement('div', { key: 'campaign-info' }, [
            React.createElement('h3', {
              key: 'campaign-name',
              className: 'text-lg font-semibold text-neutral-900'
            }, campaign.name),
            React.createElement('p', {
              key: 'campaign-product',
              className: 'text-neutral-600 text-sm'
            }, campaign.product)
          ]),
          React.createElement('button', {
            key: 'run-btn',
            className: 'bg-accent-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium'
          }, 'Run')
        ]),
        React.createElement('div', {
          key: 'campaign-details',
          className: 'grid grid-cols-3 gap-4 text-sm'
        }, [
          React.createElement('div', { key: 'setting' }, [
            React.createElement('span', {
              className: 'text-neutral-500'
            }, 'Setting: '),
            React.createElement('span', {
              className: 'text-neutral-700'
            }, campaign.setting)
          ]),
          React.createElement('div', { key: 'hook' }, [
            React.createElement('span', {
              className: 'text-neutral-500'
            }, 'Hook: '),
            React.createElement('span', {
              className: 'text-neutral-700'
            }, campaign.hook)
          ]),
          React.createElement('div', { key: 'status' }, [
            React.createElement('span', {
              className: 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800'
            }, campaign.status)
          ])
        ])
      ])
    ))
  ]);
};

const JobsQueue = () => {
  return React.createElement('div', {
    className: 'w-full max-w-4xl mx-auto p-8 bg-gradient-warm rounded-2xl border border-neutral-200 shadow-lg',
    style: { minHeight: '400px' }
  }, [
    // Header
    React.createElement('div', {
      key: 'header',
      className: 'flex justify-between items-center mb-8'
    }, [
      React.createElement('h1', {
        key: 'title',
        className: 'text-3xl font-semibold text-neutral-900'
      }, 'Running Campaigns'),
      React.createElement('button', {
        key: 'cancel-btn',
        className: 'bg-red-500 text-white px-4 py-2 rounded-lg font-medium'
      }, 'Cancel All Jobs')
    ]),
    
    // Status filters
    React.createElement('div', {
      key: 'filters',
      className: 'flex gap-2 mb-6'
    }, ['All', 'Running', 'Queued', 'Completed'].map(status =>
      React.createElement('button', {
        key: status,
        className: `px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
          status === 'All' 
            ? 'bg-accent-500 text-white' 
            : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
        }`
      }, status)
    )),
    
    // Job cards
    React.createElement('div', {
      key: 'jobs',
      className: 'space-y-4'
    }, mockData.jobs.map((job, index) =>
      React.createElement('div', {
        key: job.runId,
        className: 'bg-white border border-neutral-200 rounded-xl p-6'
      }, [
        React.createElement('div', {
          key: 'job-header',
          className: 'flex justify-between items-center mb-4'
        }, [
          React.createElement('div', { key: 'job-info' }, [
            React.createElement('h3', {
              key: 'job-name',
              className: 'text-lg font-medium text-neutral-900'
            }, mockData.campaigns.find(c => c.id === job.campaignId)?.name || 'Campaign'),
            React.createElement('div', {
              key: 'job-id',
              className: 'text-xs text-neutral-500 mt-1'
            }, `Run ID: ${job.runId}`)
          ]),
          React.createElement('div', {
            key: 'status-badge',
            className: `px-2.5 py-1.5 rounded-full text-xs font-medium ${
              job.status === 'processing' 
                ? 'bg-accent-100 text-accent-800' 
                : job.status === 'completed'
                ? 'bg-green-100 text-green-800'
                : 'bg-neutral-100 text-neutral-800'
            }`
          }, job.status === 'processing' ? 'Processing' : 'Completed')
        ]),
        
        // Progress bar for processing jobs
        job.status === 'processing' && React.createElement('div', {
          key: 'progress',
          className: 'mt-4'
        }, [
          React.createElement('div', {
            key: 'progress-info',
            className: 'flex justify-between text-sm text-neutral-600 mb-2'
          }, [
            React.createElement('span', {}, job.message || 'Processing...'),
            React.createElement('span', {}, `${job.progress}%`)
          ]),
          React.createElement('div', {
            key: 'progress-bar',
            className: 'w-full bg-neutral-200 rounded-full h-2'
          }, React.createElement('div', {
            className: 'bg-accent-500 h-2 rounded-full transition-all',
            style: { width: `${job.progress}%` }
          }))
        ])
      ])
    ))
  ]);
};

const SettingsPanel = () => {
  return React.createElement('div', {
    className: 'w-full max-w-3xl mx-auto p-8 bg-gradient-warm rounded-2xl border border-neutral-200 shadow-lg',
    style: { minHeight: '500px' }
  }, [
    // Header
    React.createElement('h1', {
      key: 'title',
      className: 'text-3xl font-semibold text-neutral-900 mb-8'
    }, 'Settings'),
    
    // API Keys Section
    React.createElement('div', {
      key: 'api-section',
      className: 'bg-white rounded-xl border border-neutral-200 p-6 mb-6'
    }, [
      React.createElement('h3', {
        key: 'api-title',
        className: 'text-lg font-medium text-neutral-900 mb-4'
      }, 'API Keys'),
      
      React.createElement('div', {
        key: 'api-fields',
        className: 'space-y-4'
      }, [
        // OpenAI API Key
        React.createElement('div', { key: 'openai' }, [
          React.createElement('label', {
            className: 'block text-sm font-medium text-neutral-700 mb-1'
          }, 'OpenAI API Key'),
          React.createElement('input', {
            type: 'password',
            value: mockData.settings.OPENAI_API_KEY,
            className: 'w-full px-3 py-2 border border-neutral-300 rounded-lg focus:border-crimson-500 focus:ring-1 focus:ring-crimson-500',
            readOnly: true
          })
        ]),
        
        // ElevenLabs API Key
        React.createElement('div', { key: 'elevenlabs' }, [
          React.createElement('label', {
            className: 'block text-sm font-medium text-neutral-700 mb-1'
          }, 'ElevenLabs API Key'),
          React.createElement('input', {
            type: 'password',
            value: mockData.settings.ELEVENLABS_API_KEY,
            className: 'w-full px-3 py-2 border border-neutral-300 rounded-lg focus:border-crimson-500 focus:ring-1 focus:ring-crimson-500',
            readOnly: true
          })
        ]),
        
        // DreamFace API Key
        React.createElement('div', { key: 'dreamface' }, [
          React.createElement('label', {
            className: 'block text-sm font-medium text-neutral-700 mb-1'
          }, 'Lipsync API Key'),
          React.createElement('input', {
            type: 'password',
            value: mockData.settings.DREAMFACE_API_KEY,
            className: 'w-full px-3 py-2 border border-neutral-300 rounded-lg focus:border-crimson-500 focus:ring-1 focus:ring-crimson-500',
            readOnly: true
          })
        ])
      ]),
      
      React.createElement('div', {
        key: 'save-section',
        className: 'mt-6 flex gap-3'
      }, [
        React.createElement('button', {
          key: 'save-btn',
          className: 'bg-crimson-500 text-white px-4 py-2 rounded-lg font-medium'
        }, 'Save Settings'),
        React.createElement('button', {
          key: 'test-btn',
          className: 'bg-neutral-100 text-neutral-700 px-4 py-2 rounded-lg font-medium border border-neutral-300'
        }, 'Quick Test')
      ])
    ]),
    
    // Theme Section
    React.createElement('div', {
      key: 'theme-section',
      className: 'bg-white rounded-xl border border-neutral-200 p-6'
    }, [
      React.createElement('h3', {
        key: 'theme-title',
        className: 'text-lg font-medium text-neutral-900 mb-4'
      }, 'Appearance'),
      
      React.createElement('div', {
        key: 'theme-options',
        className: 'flex gap-4'
      }, [
        React.createElement('button', {
          key: 'light-theme',
          className: 'flex flex-col items-center p-4 rounded-lg border-2 border-accent-500 bg-accent-50'
        }, [
          React.createElement('div', {
            key: 'sun-icon',
            className: 'w-6 h-6 mb-2 rounded-full bg-yellow-400'
          }),
          React.createElement('span', {
            key: 'light-label',
            className: 'text-sm font-medium text-neutral-900'
          }, 'Light')
        ]),
        
        React.createElement('button', {
          key: 'dark-theme',
          className: 'flex flex-col items-center p-4 rounded-lg border-2 border-neutral-200'
        }, [
          React.createElement('div', {
            key: 'moon-icon',
            className: 'w-6 h-6 mb-2 rounded-full bg-neutral-700'
          }),
          React.createElement('span', {
            key: 'dark-label',
            className: 'text-sm font-medium text-neutral-900'
          }, 'Dark')
        ])
      ])
    ])
  ]);
};

// SVG wrapper component
const SvgWrapper = ({ children, width = 800, height = 600, title }) => {
  const markup = renderToStaticMarkup(children);
  
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <title>${title}</title>
  <defs>
    <style>
      .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
      .text-2xl { font-size: 1.5rem; line-height: 2rem; }
      .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
      .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
      .text-base { font-size: 1rem; line-height: 1.5rem; }
      .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
      .text-xs { font-size: 0.75rem; line-height: 1rem; }
      .font-semibold { font-weight: 600; }
      .font-medium { font-weight: 500; }
      .text-neutral-900 { fill: #171717; }
      .text-neutral-700 { fill: #404040; }
      .text-neutral-600 { fill: #525252; }
      .text-neutral-500 { fill: #737373; }
      .text-white { fill: #ffffff; }
      .bg-gradient-warm { fill: url(#warmGradient); }
      .bg-white { fill: #ffffff; }
      .bg-crimson-500 { fill: #ef4444; }
      .bg-accent-500 { fill: #f59e0b; }
      .bg-green-100 { fill: #dcfce7; }
      .bg-green-800 { fill: #166534; }
      .bg-accent-100 { fill: #fef3c7; }
      .bg-accent-800 { fill: #92400e; }
      .bg-neutral-100 { fill: #f5f5f5; }
      .bg-neutral-200 { fill: #e5e5e5; }
      .bg-neutral-300 { fill: #d4d4d4; }
      .bg-red-500 { fill: #ef4444; }
      .bg-yellow-400 { fill: #facc15; }
      .bg-neutral-700 { fill: #404040; }
      .bg-accent-50 { fill: #fffbeb; }
      .border-neutral-200 { stroke: #e5e5e5; stroke-width: 1; fill: none; }
      .border-neutral-300 { stroke: #d4d4d4; stroke-width: 1; fill: none; }
      .border-accent-500 { stroke: #f59e0b; stroke-width: 2; fill: none; }
      .rounded-2xl { rx: 1rem; ry: 1rem; }
      .rounded-xl { rx: 0.75rem; ry: 0.75rem; }
      .rounded-lg { rx: 0.5rem; ry: 0.5rem; }
      .rounded-full { rx: 50%; ry: 50%; }
      .shadow-lg { filter: drop-shadow(0 10px 15px rgba(0, 0, 0, 0.1)); }
      .shadow-md { filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1)); }
      text { font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    </style>
    <linearGradient id="warmGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#fef2f2;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#fffbeb;stop-opacity:1" />
    </linearGradient>
  </defs>
  <foreignObject x="0" y="0" width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Inter, sans-serif; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
      ${markup}
    </div>
  </foreignObject>
</svg>`;
};

// Export function
const exportComponents = () => {
  const outputDir = path.join(process.cwd(), 'src/renderer/public/svgs');
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  console.log('🎨 Exporting SVG assets...');
  
  // Export each component
  const exports = [
    {
      name: 'campaigns-hero',
      component: React.createElement(CampaignsHero),
      width: 1000,
      height: 600,
      title: 'MassUGC Studio - Campaigns Dashboard'
    },
    {
      name: 'jobs-queue',
      component: React.createElement(JobsQueue),
      width: 1000,
      height: 600,
      title: 'MassUGC Studio - Running Campaigns'
    },
    {
      name: 'settings-panel',
      component: React.createElement(SettingsPanel),
      width: 900,
      height: 700,
      title: 'MassUGC Studio - Settings Panel'
    }
  ];
  
  exports.forEach(({ name, component, width, height, title }) => {
    try {
      const svg = SvgWrapper({ children: component, width, height, title });
      const filePath = path.join(outputDir, `${name}.svg`);
      
      fs.writeFileSync(filePath, svg, 'utf8');
      console.log(`✅ Exported: ${name}.svg (${width}x${height})`);
    } catch (error) {
      console.error(`❌ Failed to export ${name}:`, error.message);
    }
  });
  
  console.log(`\n🎉 SVG export complete! Files saved to: ${outputDir}`);
  console.log('\n📝 To optimize the SVGs, run: npm run optimize:svg');
};

// Run export if called directly
if (require.main === module) {
  exportComponents();
}

module.exports = { exportComponents };
