import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      protocolImports: true,
    }),
  ],
  server: {
    proxy: {
      '/auctions': 'http://localhost:3000',
      '/bid': 'http://localhost:3000',
      '/register': 'http://localhost:3000',
      '/login': 'http://localhost:3000'
    }
  }
})