/**
 * Jest configuration for Biolab Shop tests
 */
module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['./tests/setup.js'],
  testTimeout: 10000,
  verbose: true
};
