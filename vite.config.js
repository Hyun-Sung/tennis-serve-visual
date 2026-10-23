import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    // three.js alone is ~700 kB before gzip, plus the eight translations.
    chunkSizeWarningLimit: 1400,
  },
})
