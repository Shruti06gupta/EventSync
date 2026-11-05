import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backendTarget = 'http://127.0.0.1:5000'

const proxyToBackend = {
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
    port: 5173,
    proxy: {
      '/auth': proxyToBackend,
      '/events': proxyToBackend,
      '/notifications': proxyToBackend,
      '/user': proxyToBackend,
      '/aggregation': proxyToBackend,
      '/admin': proxyToBackend,
      '/health': proxyToBackend,
      '/chatbot': proxyToBackend,
    },
  },
  optimizeDeps: {
    include: ['react-easy-crop'],
  },
})
