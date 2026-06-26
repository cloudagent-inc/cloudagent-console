import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Plugin to defer non-critical CSS
function deferCSS() {
  return {
    name: 'defer-css',
    transformIndexHtml(html) {
      // Transform CSS links to defer loading
      return html.replace(
        /<link\s+rel="stylesheet"\s+crossorigin\s+href="([^"]+)">/g,
        '<link rel="preload" as="style" href="$1" onload="this.onload=null;this.rel=\'stylesheet\'" crossorigin><noscript><link rel="stylesheet" href="$1" crossorigin></noscript>'
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), deferCSS()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '~ui': path.resolve(__dirname, './node_modules/@shadcn/ui'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'redux-vendor': ['@reduxjs/toolkit', 'react-redux'],
          'ui-vendor': ['lucide-react', 'framer-motion', 'react-hot-toast'],
          'aws-vendor': ['aws-amplify', '@aws-amplify/api', '@aws-amplify/auth'],
          'form-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
          // Route chunks
          'workflow': ['reactflow', 'dagre'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});
