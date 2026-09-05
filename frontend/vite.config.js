import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serves this project from /fan-site/.
// Set VITE_BASE_PATH=/ for a future custom-domain deployment.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/fan-site/',
  plugins: [react()],
})
