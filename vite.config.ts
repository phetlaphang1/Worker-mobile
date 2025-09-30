import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist", "public"),
    emptyOutDir: true,
  },
  server: {
    port: 3000, // Or any other port like 3001, 3002, etc. unique to each client project
    strictPort: true, // Ensures it will use this port or fail
    // If you need to proxy API calls to your backend:
    proxy: {
      '/api': {
        target: 'http://localhost:5000', // Or 5001 for your other project
        changeOrigin: true,
        ws: true, // Enable WebSocket proxying if needed
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
