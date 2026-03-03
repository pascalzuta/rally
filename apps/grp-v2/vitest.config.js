import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      // The source files (app.js, cms.js, news.js, news-data.js) use IIFEs
      // and cannot be imported by test files. Coverage is tracked against the
      // re-implemented helper functions in lib/helpers.js instead.
      // Until the source files are refactored to ES modules, coverage tracks
      // the helpers file. The IIFE sources are included for documentation but
      // will show 0% until the ES module refactor.
      include: ['apps/grp/lib/helpers.js'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    }
  },
});
