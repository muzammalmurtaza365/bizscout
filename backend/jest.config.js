/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/services/**/*.ts',
    'src/routes/**/*.ts',
    'src/utils/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    'src/services/anomaly.ts': {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  testTimeout: 30000,
  setupFiles: ['<rootDir>/src/test/jestSetupEnv.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/test/jestSetup.ts'],
};
