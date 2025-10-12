/**
 * API Configuration
 *
 * Use relative URLs in production (served by PM2 on port 5051)
 * Use absolute URLs in development (Vite proxy on port 5173)
 */

// Detect if we're in development mode (Vite) or production (PM2)
const isDevelopment = import.meta.env.DEV;

// Base URL for API requests
// In dev: use relative URLs (Vite proxy forwards to backend on port 5051)
// In prod: use relative URLs (same origin as frontend)
export const API_BASE_URL = '';  // Always use relative URLs - Vite proxy handles routing in dev

// Helper function to build API URLs
export function apiUrl(path: string): string {
  // Ensure path starts with /
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

// Export convenience functions
export const api = {
  url: apiUrl,
  base: API_BASE_URL,
};
