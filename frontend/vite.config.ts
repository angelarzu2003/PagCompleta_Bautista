import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// En desarrollo (`npm run dev`) las peticiones a /api se redirigen al backend Express.
const API_TARGET = process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:4000';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: false,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: false },
    },
  },
  preview: {
    port: 3000,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: false },
    },
  },
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
  },
} as any);
