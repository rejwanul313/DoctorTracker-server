import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts', 'src/scripts/seed.ts', 'src/scripts/ensureIndexes.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // `@dt/shared` is a tsconfig path alias to ./shared (TypeScript source): bundle it into the build.
  noExternal: ['@dt/shared'],
});
