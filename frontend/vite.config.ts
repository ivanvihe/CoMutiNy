import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { UserConfig } from 'vite';

type TestConfig = {
  environment: string;
  coverage: {
    provider: string;
    reporter: string[];
    exclude: string[];
  };
  globals: boolean;
  setupFiles: string[];
};

type ViteConfigWithTest = UserConfig & { test?: TestConfig };

const config: ViteConfigWithTest = {
  plugins: [react()],
  resolve: {
    alias: {
      'colyseus.js': '@colyseus/client',
    },
  },
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: [
        'coverage/**',
        'dist/**',
        'node_modules/**',
        'tests/**',
        'test/**',
        '**/*.spec.*',
        '**/*.test.*',
        '**/__tests__/**',
        'src/**/*.d.ts',
      ],
    },
    globals: false,
    setupFiles: [],
  },
};

// https://vite.dev/config/
export default defineConfig(config);
