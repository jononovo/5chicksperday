import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
    },
  },
  build: {
    outDir: 'static/js',
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, 'client/src/chat-embed.tsx'),
      name: 'ChatEmbed',
      fileName: 'chat-embed',
      formats: ['iife']
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {}
      }
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  }
});