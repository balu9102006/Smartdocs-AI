import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Route-level lazy imports (see App.jsx) already split each page
        // into its own chunk. This further splits out big third-party
        // libraries that change far less often than app code, so a
        // returning visitor's browser cache can skip re-downloading them
        // after a deploy that only touched app code.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/react-markdown|remark-gfm|micromark|mdast|unist|unified|vfile/.test(id)) {
            return 'vendor-markdown';
          }
          if (/[\\/]react[\\/]|[\\/]react-dom[\\/]|[\\/]react-router/.test(id)) {
            return 'vendor-react';
          }
          if (id.includes('@supabase')) {
            return 'vendor-supabase';
          }
        }
      }
    }
  }
})
