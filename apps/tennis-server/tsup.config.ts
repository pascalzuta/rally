import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  // Bundle workspace dependencies (@rally/core) into the output
  noExternal: [/@rally\/.*/],
  // Don't bundle node_modules (express, supabase, etc.)
  external: [],
  sourcemap: true,
  splitting: false,
});
