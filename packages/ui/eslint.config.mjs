import { reactLibrary } from '@pts/eslint-config/base'

export default [
  ...reactLibrary({ dir: import.meta.dirname }),
  // The one module allowed to build date formatters (house rule 10).
  { files: ['src/dates.ts'], rules: { 'pts/dates-through-ui': 'off' } },
]
