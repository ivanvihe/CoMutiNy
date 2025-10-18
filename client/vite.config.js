import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiTarget = process.env.VITE_BACKEND_ORIGIN || process.env.VITE_API_ORIGIN || 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    fs: {
      allow: ['..']
    },
    proxy: {
      '/auth': {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
        ws: false
      }
    }
  }
});
