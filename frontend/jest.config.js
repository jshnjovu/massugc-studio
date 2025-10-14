module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
  testMatch: [
    '<rootDir>/__tests__/**/*.test.{js,jsx}'
  ],
  collectCoverageFrom: [
    'src/renderer/src/**/*.{js,jsx}',
    '!src/renderer/src/__tests__/**',
    '!src/renderer/src/main.jsx',
    '!src/renderer/src/index.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Specific coverage thresholds for the three main files
    'src/renderer/src/services/JobProgressService.js': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    'src/renderer/src/components/CampaignProgressIndicator.jsx': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    'src/renderer/src/components/JobProgressIndicator.jsx': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/renderer/src/$1'
  },
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(zustand)/)'
  ],
  // Test timeout for integration tests
  testTimeout: 30000,
  // Ignore integration tests by default unless RUN_INTEGRATION_TESTS is set
  testPathIgnorePatterns: [
    '/node_modules/',
    ...(process.env.RUN_INTEGRATION_TESTS ? [] : ['<rootDir>/__tests__/.*integration.*'])
  ]
};
