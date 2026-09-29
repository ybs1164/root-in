import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    restoreMocks: true,
    unstubGlobals: true,
    // Lets src/test/styles.test.ts read styles.css (`?raw`); other CSS stays stubbed.
    css: { include: [/styles\.css/] },
  },
});
