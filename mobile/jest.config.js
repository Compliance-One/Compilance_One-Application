/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  modulePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/android/', '<rootDir>/ios/'],
};
