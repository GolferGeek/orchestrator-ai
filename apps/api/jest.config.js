module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      isolatedModules: true
    }],
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
  ],
  coverageDirectory: '../coverage',
  testTimeout: 30000,
  transformIgnorePatterns: [
    'node_modules/(?!(quick-lru)/)'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@agents/(.*)$': '<rootDir>/agents/$1',
    '^@agents/base/(.*)$': '<rootDir>/agents/base/$1',
    '^@agents/base/sub-services/(.*)$': '<rootDir>/agents/base/sub-services/$1',
    '^@agents/base/implementations/(.*)$': '<rootDir>/agents/base/implementations/$1',
    '^@agent-pool/(.*)$': '<rootDir>/agent-pool/$1',
    '^@llm/(.*)$': '<rootDir>/llms/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
    '^@common/(.*)$': '<rootDir>/common/$1'
  }
};