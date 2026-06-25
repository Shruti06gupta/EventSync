import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/auth': 'http://localhost:5000',
      '/events': 'http://localhost:5000',
      '/notifications': 'http://localhost:5000',
      '/user': 'http://localhost:5000',
      '/health': 'http://localhost:5000',
    },
  },
})
