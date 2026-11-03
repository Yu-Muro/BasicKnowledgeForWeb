/** @jest-config-loader esbuild-register */
import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const customJestConfig: Config = {
    testEnvironment: '<rootDir>/tests/config/CustomJestEnvironment.ts',
    testEnvironmentOptions: {
        // @mswjs/interceptors は "browser" export condition で ESM (.mjs) を返す。
        // jest の jsdom はデフォルトで browser 条件を有効にするため無効化し、
        // Node.js の CJS バージョンを使うようにする。
        customExportConditions: [],
    },
    setupFiles: ['<rootDir>/jest.polyfills.ts'],
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    moduleNameMapper: {
        '^@frontend/(.*)$': '<rootDir>/$1',
        '^@backend/(.*)$': '<rootDir>/../backend/$1',
        '^lru-cache$': '<rootDir>/tests/mocks/lru-cache.js',
        '^@asamuzakjp/css-color$': '<rootDir>/tests/mocks/css-color.js',
        '^@asamuzakjp/css-color/(.*)$': '<rootDir>/tests/mocks/css-color.js',
    },
    testMatch: ['<rootDir>/tests/**/*.test.{ts,tsx}'],
    modulePathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/.open-next/'],
};

// createJestConfig は transformIgnorePatterns を next/jest デフォルトで上書きするため、
// MSW v2 (純粋 ESM) に必要なパッケージを変換対象にするよう後処理で置き換える。
const MSW_ESM_PACKAGES = [
    'msw',
    '@mswjs/interceptors',
    'until-async',
    'rettime',
    '@open-draft/until',
    '@open-draft/logger',
    '@open-draft/deferred-promise',
    'outvariant',
    'strict-event-emitter',
    'headers-polyfill',
    'is-node-process',
].join('|');

export default async () => {
    const config = await createJestConfig(customJestConfig)();
    config.transformIgnorePatterns = [
        `node_modules/(?!(${MSW_ESM_PACKAGES})/)`,
        '^.+\\.module\\.(css|sass|scss)$',
    ];
    return config;
};
