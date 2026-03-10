module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@landomo/core$': '<rootDir>/node_modules/@landomo/core/dist/index.js',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
};
