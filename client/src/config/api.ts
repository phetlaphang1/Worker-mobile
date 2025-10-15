/**
 * API Configuration
 * Auto-detects environment and uses appropriate base URL
 */

// Development: Use relative path to leverage Vite proxy (localhost:7000 -> localhost:5051)
// Production: Use direct backend URL
export const API_BASE_URL = import.meta.env.DEV
  ? '' // Empty string means relative URL, Vite proxy will handle it
  : 'http://localhost:5051'; // Production builds access backend directly

/**
 * Get full API URL
 * @param path - API path (should start with /api)
 * @returns Full URL for API request
 */
export function getApiUrl(path: string): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (API_BASE_URL) {
    return `${API_BASE_URL}${normalizedPath}`;
  }

  return normalizedPath;
}

/**
 * WebSocket URL
 */
export const WS_BASE_URL = import.meta.env.DEV
  ? `ws://${window.location.host}` // Use same host as current page in dev
  : 'ws://localhost:5051'; // Production

export function getWebSocketUrl(path: string = ''): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${WS_BASE_URL}${normalizedPath}`;
}
