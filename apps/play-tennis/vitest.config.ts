import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    globals: false,
    // @rally/core is a workspace package imported as TS source — inline it so
    // vitest transforms it instead of treating it as an external dependency.
    server: { deps: { inline: [/@rally\/core/] } },
  },
})
