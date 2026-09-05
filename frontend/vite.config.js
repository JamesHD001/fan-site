import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Use the root path by default for modern hosts such as Vercel.
// GitHub Pages overrides this with VITE_BASE_PATH=/fan-site/ in CI.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
})
