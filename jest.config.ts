import type { Config } from 'jest'

const config: Config = {
  preset:               'ts-jest',
  testEnvironment:      'node',
  roots:                ['<rootDir>/__tests__'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  coverageDirectory:    'coverage',
  collectCoverageFrom:  [
    'services/**/*.ts',
    'lib/**/*.ts',
    'app/api/**/*.ts',
    '!**/*.d.ts',
    '!**/index.ts',
  ],
  coverageThreshold: {
    global: {
      lines:      80,
      branches:   70,
      functions:  80,
      statements: 80,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testTimeout: 30000,
}

export default config
