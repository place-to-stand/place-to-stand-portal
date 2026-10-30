import { base } from '@pts/eslint-config/base'

export default [
  ...base(),
  // The one module allowed to build date formatters (house rule 10).
  { files: ['src/dates.ts'], rules: { 'pts/dates-through-ui': 'off' } },
]
