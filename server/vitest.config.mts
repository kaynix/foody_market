import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    include: ['src/**/*.test.ts'],
    env: {
      DEV_IDENTITY_ENABLED: 'true',
    },
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
