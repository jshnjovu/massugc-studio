// Jest setup file for React component testing
require('@testing-library/jest-dom');

// Check if running integration tests
const isIntegrationTest = process.env.RUN_INTEGRATION_TESTS === 'true';

// Mock Electron APIs
global.window = global.window || {};
global.window.electron = {
  openExternal: jest.fn()
};

if (isIntegrationTest) {
  // For integration tests, use real implementations
  const EventSource = require('eventsource');
  global.EventSource = EventSource;
  
  // Ensure EventSource is available in the global scope
  if (typeof global.EventSource === 'undefined') {
    global.EventSource = EventSource;
  }
  
  // Simple Node.js fetch implementation using http/https
  global.fetch = async (url, options = {}) => {
    const http = require('http');
    const https = require('https');
    const { URL } = require('url');
    
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const lib = parsedUrl.protocol === 'https:' ? https : http;
      
      const requestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
        headers: options.headers || {}
      };
      
      const req = lib.request(requestOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            ok: res.statusCode >= 200 && res.statusCode < 300,
            json: () => Promise.resolve(JSON.parse(data)),
            text: () => Promise.resolve(data)
          });
        });
      });
      
      req.on('error', reject);
      
      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  };
  
  // Keep real console for integration test debugging
  console.log('[SETUP] Integration test mode - using real fetch and EventSource');
} else {
  // For unit tests, use mocks
  
  // Mock EventSource
  global.EventSource = jest.fn(() => ({
    addEventListener: jest.fn(),
    close: jest.fn(),
    readyState: 0,
    onerror: jest.fn()
  }));

  // Mock fetch
  global.fetch = jest.fn();

  // Mock console methods to avoid noise in tests
  global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
  };
}
