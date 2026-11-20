import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@dt/shared': fileURLToPath(new URL('./shared/index.ts', import.meta.url)) },
  },
  test: {
    environment: 'node',
    setupFiles: ['src/tests/setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
