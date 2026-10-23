import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    // The 3D view's chunk is mostly three.js (~600 kB before gzip); it loads after the page.
    chunkSizeWarningLimit: 700,
  },
})
