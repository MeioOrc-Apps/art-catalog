import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    host: true,
    port: 5173,
    watch: { usePolling: true },
    proxy: {
      '/api': { target: 'http://api:8000', changeOrigin: true },
      '/auth': { target: 'http://api:8000', changeOrigin: true },
      '/images': { target: 'http://api:8000', changeOrigin: true },
    },
  },
})
