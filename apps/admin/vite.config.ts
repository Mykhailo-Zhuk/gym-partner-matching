import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The API exposes routes at the root (no global prefix); proxy only API namespaces.
const api = {
  target: process.env.API_URL ?? 'http://localhost:3000',
  changeOrigin: true,
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': api,
      '/admin': api,
      '/gyms': api,
      '/matching': api,
      '/reports': api,
      '/devices': api,
      '/uploads': api,
      '/health': api,
    },
  },
});
