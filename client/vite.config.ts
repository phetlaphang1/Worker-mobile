import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  build: {
    outDir: '../public',
    emptyOutDir: true,
  },
  server: {
    port: 7000,
    host: 'localhost', // Only show localhost, not all network addresses
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
        // Add retry logic for when server is restarting
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('[PROXY] Connection error - Server may be restarting, will retry...');
            // Don't log full error stack, just show friendly message
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Suppress verbose logs
          });
        },
      },
      '/ws': {
        target: 'ws://localhost:5051',
        ws: true,
        changeOrigin: true,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('[WS PROXY] Connection error - Server may be restarting...');
          });
        },
      },
    },
  },
});
