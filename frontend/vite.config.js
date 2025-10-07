import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Enhanced CSP Plugin for development server
const cspPlugin = () => {
  return {
    name: 'csp-headers',
    configureServer(server) {
      // Use a more specific middleware approach
      server.middlewares.use((req, res, next) => {
        console.log('CSP Plugin triggered for:', req.url); // Debug log
        
        // Balanced CSP policy for React development
        const cspPolicy = [
          "default-src 'self'",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com",
          "script-src 'self' 'unsafe-inline'", // Required for React dev mode
          "img-src 'self' data: https: blob:",
          "connect-src 'self' https: wss: ws: http://localhost:8081 http://localhost:5174",
          "media-src 'self'",
          "object-src 'none'",
          "frame-src 'none'",
          "base-uri 'self'",
          "form-action 'self'"
        ].join('; ');
        
        // Set multiple security headers
        res.setHeader('Content-Security-Policy', cspPolicy);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        
        console.log('✅ CSP Headers set successfully!'); // More visible debug log
        next();
      });
    }
  };
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cspPlugin()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
    // Disable CORS on frontend dev server - let backend handle it
    cors: false,
    // Alternative approach: configure middleware directly
    middlewareMode: false,
    headers: {
      'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; connect-src 'self' https: wss: ws: http://localhost:8081 http://localhost:5174; media-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'self'",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      // Additional security headers to prevent cross-domain issues
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-origin'
    }
  },
})
