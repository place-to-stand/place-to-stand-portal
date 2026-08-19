import { defineConfig } from 'tsup'

// The rest of packages/* declare `"build": "tsc"`, which emits nothing here —
// tsconfig.base.json sets `noEmit: true` and no package overrides it. A CLI
// needs real output, so this bundles to a single executable ESM file instead.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
})
