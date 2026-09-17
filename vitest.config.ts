import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * The `@/` alias that tsconfig gives the app, repeated for the test runner —
 * vitest resolves imports itself and does not read tsconfig paths.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
