/**
 * Vite config for isolated E2E testing.
 * Proxies all API routes to the dedicated test backend on port 5001.
 * Do NOT use this for development — use vite.config.js instead.
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const E2E_BACKEND_PORT = process.env.E2E_BACKEND_PORT || '5001'
const backendTarget = `http://127.0.0.1:${E2E_BACKEND_PORT}`

const proxyToE2EBackend = {
  target: backendTarget,
  changeOrigin: true,
  secure: false,
  bypass: (req) => {
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
      return '/index.html'
    }
  },
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/auth': proxyToE2EBackend,
      '/events': proxyToE2EBackend,
      '/notifications': proxyToE2EBackend,
      '/user': proxyToE2EBackend,
      '/aggregation': proxyToE2EBackend,
      '/admin': proxyToE2EBackend,
      '/health': proxyToE2EBackend,
      '/chatbot': proxyToE2EBackend,
    },
  },
  optimizeDeps: {
    include: ['react-easy-crop'],
  },
})
