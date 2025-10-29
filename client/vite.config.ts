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
        timeout: 180000, // 180 second timeout (match backend activation timeout)
        configure: (proxy, options) => {
          let errorCount = 0;
          let lastErrorTime = 0;
          const ERROR_THROTTLE = 5000; // Only log every 5 seconds

          proxy.on('error', (err, req, res) => {
            const now = Date.now();
            // Throttle error messages to avoid spam
            if (now - lastErrorTime > ERROR_THROTTLE) {
              console.log('[PROXY] Connection error - Server may be restarting, will retry...');
              lastErrorTime = now;
              errorCount = 0;
            } else {
              errorCount++;
            }

            // Send a proper error response instead of hanging
            if (res && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                error: 'Backend server unavailable',
                message: 'Server is restarting or temporarily unavailable. Please try again.'
              }));
            }
          });

          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Set reasonable timeout for proxy requests
            proxyReq.setTimeout(180000); // Match proxy timeout
          });
        },
      },
      '/ws': {
        target: 'ws://localhost:5051',
        ws: true,
        changeOrigin: true,
        configure: (proxy, options) => {
          let wsErrorCount = 0;
          let lastWsErrorTime = 0;
          const WS_ERROR_THROTTLE = 5000;

          proxy.on('error', (err, req, res) => {
            const now = Date.now();
            if (now - lastWsErrorTime > WS_ERROR_THROTTLE) {
              console.log('[WS PROXY] WebSocket connection error - Server may be restarting...');
              lastWsErrorTime = now;
              wsErrorCount = 0;
            }
          });
        },
      },
    },
  },
});
