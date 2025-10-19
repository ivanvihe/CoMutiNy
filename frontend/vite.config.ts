import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { configDefaults } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
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
      exclude: [...configDefaults.coverage.exclude, 'src/**/*.d.ts'],
    },
    globals: false,
    setupFiles: [],
  },
});
