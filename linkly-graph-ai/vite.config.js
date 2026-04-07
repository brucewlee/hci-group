import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/arxiv-api': {
        target: 'https://export.arxiv.org',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/arxiv-api/, '/api'),
      },
    },
  },
})
