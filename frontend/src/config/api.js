/**
 * API Configuration
 * Centralized API URL configuration for the application
 */

// Get API URL from environment variable or use localhost as fallback
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';

// Export default axios configuration
export const API_CONFIG = {
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
};

// Helper function to get full API endpoint
export const getApiEndpoint = (path) => {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${API_URL}/${cleanPath}`;
};

export default API_URL;
