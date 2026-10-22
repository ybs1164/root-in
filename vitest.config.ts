import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Worker threads load modules faster than the default child processes:
    // about 37s instead of 48s for the whole suite (docs/plan-maintenance-harness.md MH2).
    pool: 'threads',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    restoreMocks: true,
    unstubGlobals: true,
    // Lets src/test/styles.test.ts read styles.css (`?raw`); other CSS stays stubbed.
    css: { include: [/styles\.css/] },
  },
});
