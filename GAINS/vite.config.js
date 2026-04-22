// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      "/auth": {
        target: "http://localhost:3003",
        changeOrigin: true,
      },
      "/api": {
        target: "http://localhost:3003",
        changeOrigin: true,
      },
      "/llm": {
        target: "http://localhost:3003",
        changeOrigin: true,
      },
    },
  },
  // optional: disable the red overlay if it annoys you
  // server: { hmr: { overlay: false } }
})
