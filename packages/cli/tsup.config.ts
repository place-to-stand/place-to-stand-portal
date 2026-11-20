import { defineConfig } from 'tsup'

// The other packages ship TypeScript source and have no build step, and
// tsconfig.base.json sets `noEmit: true`. A CLI needs real output, so this
// bundles to a single executable ESM file.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
})
