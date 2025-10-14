import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: path.join(__dirname, 'src/renderer/src'),
  publicDir: path.join(__dirname, 'src/renderer/public'),
  base: './',
  build: {
    outDir: path.join(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  resolve: {
    alias: {
      '@': path.join(__dirname, 'src/renderer/src'),
      '@components': path.join(__dirname, 'src/renderer/src/components'),
      '@pages': path.join(__dirname, 'src/renderer/src/pages'),
    },
  },
  server: {
    port: 3001,
  },
}); 