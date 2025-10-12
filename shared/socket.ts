// WebSocket configuration
// In development: Connect directly to backend server (port 5051)
// In production: Connect to same origin (port 5051) where PM2 serves both frontend and API

const isDevelopment = typeof window !== 'undefined' && window.location.port === '7000';
const SERVER_PORT = 5051; // Backend/API server port

/**
 * Get WebSocket URL based on environment
 * - Development: Connects directly to backend on port 5051
 * - Production: Uses current host (PM2 server on port 5051)
 */
export function getWebSocketUrl(): string {
  if (isDevelopment) {
    // Development: Connect directly to backend server
    return `ws://localhost:${SERVER_PORT}`;
  } else {
    // Production: Use same origin
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}`;
  }
}

// Legacy export for backward compatibility
export const WEB_SOCKET_PORT = SERVER_PORT; // Backend server port
