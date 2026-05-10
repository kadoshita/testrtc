import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    include: ['../test/browser/**/*.browser.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [
        {
          browser: 'chromium',
          launch: {
            args: [
              '--use-fake-device-for-media-stream',
              '--use-fake-ui-for-media-stream',
            ],
          },
          context: {
            permissions: ['camera', 'microphone'],
          },
        },
      ],
    },
  },
});
