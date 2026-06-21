import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // jest-compatible globals (describe/test/expect/beforeEach...) without imports.
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Some image/network tests exercise retries; keep a generous default.
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      reporter: ['text', 'lcov', 'html'],
    },
  },
});
