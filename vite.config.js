import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
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
      // Proxy BYMA Open Data API calls (for bond metadata / ficha técnica)
      '/byma': {
        target: 'https://open.bymadata.com.ar/vanoms-be-core/rest/api/bymadata/free',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/byma/, ''),
        headers: {
          'Origin': 'https://open.bymadata.com.ar',
          'Referer': 'https://open.bymadata.com.ar/',
        },
      },
      // Proxy CriptoYa calls to bypass CORS
      '/cripto': {
        target: 'https://criptoya.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/cripto/, ''),
      },
    },
  },
});
