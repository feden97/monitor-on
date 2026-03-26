import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy API calls to bypass CORS during local development.
      // In the browser, call '/api/live/arg_corp' → forwards to 'https://data912.com/live/arg_corp'
      '/api': {
        target: 'https://data912.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
