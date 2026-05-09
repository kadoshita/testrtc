/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  define: {
    'API_ENDPOINT': JSON.stringify(process.env.API_ENDPOINT ?? ''),
    'TURN_URL': JSON.stringify('https://networktraversal.googleapis.com/v1alpha/iceconfig?key='),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
    include: ['../test/**/*.test.ts'],
  },
});
