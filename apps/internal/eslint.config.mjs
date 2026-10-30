import { nextApp } from '@pts/eslint-config/next'

// Shared with apps/client: packages/eslint-config/next.mjs.
export default nextApp({
  dir: import.meta.dirname,
  entityRegistry: 'lib/entity-accents.ts',
})
