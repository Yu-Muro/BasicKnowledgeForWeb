/** @jest-config-loader esbuild-register */
import type { Config } from 'jest';

const config: Config = {
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.ts'],
    transform: {
        '^.+\\.ts$': [
            '@swc/jest',
            { jsc: { parser: { syntax: 'typescript' } } },
        ],
    },
    moduleNameMapper: {
        '^@backend/(.*)$': '<rootDir>/$1',
    },
};

export default config;
