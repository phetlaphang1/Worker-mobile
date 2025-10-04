import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react({
      // Enable Fast Refresh
      fastRefresh: true,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '../public',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    host: true, // Listen on all addresses
    strictPort: true,
    open: false,
    cors: true,
    hmr: {
      overlay: true, // Show error overlay
    },
    watch: {
      usePolling: true, // Better for Windows
      interval: 100,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5051',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:5051',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
