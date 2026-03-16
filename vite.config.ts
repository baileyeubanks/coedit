import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const crossOriginIsolationHeaders = {
  // Required for FFmpeg.wasm SharedArrayBuffer support.
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  server: {
    headers: crossOriginIsolationHeaders,
  },
  preview: {
    headers: crossOriginIsolationHeaders,
  },
})
