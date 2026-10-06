import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');
const { version: appVersion } = JSON.parse(
  readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
);

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    react(),
    {
      name: 'check-release-version',
      apply: 'build',
      buildStart() {
        const changelog = readFileSync(path.join(repoRoot, 'CHANGELOG.md'), 'utf8');
        const releaseVersion = changelog.match(/^## \[(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)\]/m)?.[1];
        if (releaseVersion !== appVersion) {
          this.error(
            `Root package version (${appVersion}) must match the latest CHANGELOG.md release (${releaseVersion || 'missing'}).`
          );
        }
      },
    },
  ],
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
          'form-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
          // Route chunks
          'workflow': ['reactflow', 'dagre'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});
