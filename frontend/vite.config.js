import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/static/react_dist/',
  server: {
    host: '0.0.0.0', // 允許外部設備透過 IP 連線
    port: 5173
  },
  build: {
    outDir: '../program/static/react_dist',
    emptyOutDir: true
  }
})
