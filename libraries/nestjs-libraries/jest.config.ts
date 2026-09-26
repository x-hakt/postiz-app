// x-hakt: jest for this library's specs (bosun-x PLN-20). Run from the repo root:
//   npx jest -c libraries/nestjs-libraries/jest.config.ts
export default {
  displayName: 'nestjs-libraries',
  rootDir: '../..',
  testEnvironment: 'node',
  // Nest/class-validator decorators need reflect-metadata loaded first, as at app startup
  setupFiles: ['reflect-metadata'],
  testMatch: ['<rootDir>/libraries/nestjs-libraries/src/**/*.spec.ts'],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.base.json', isolatedModules: true, diagnostics: false }],
  },
  moduleNameMapper: {
    '^@gitroom/nestjs-libraries/(.*)$': '<rootDir>/libraries/nestjs-libraries/src/$1',
    '^@gitroom/helpers/(.*)$': '<rootDir>/libraries/helpers/src/$1',
    '^@gitroom/backend/(.*)$': '<rootDir>/apps/backend/src/$1',
    '^@gitroom/orchestrator/(.*)$': '<rootDir>/apps/orchestrator/src/$1',
    '^@gitroom/plugins/(.*)$': '<rootDir>/libraries/plugins/src/$1',
  },
};
