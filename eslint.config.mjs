import tseslint from 'typescript-eslint'

import { IGNORES, common } from '@pts/eslint-config/base'

/**
 * Root scripts and the browser tests: the shared rules without type
 * information (neither has a tsconfig). Each workspace lints itself.
 */
export default [
  IGNORES,
  { ignores: ['apps/**', 'packages/**', 'supabase/**', 'docs/**'] },
  ...tseslint.configs.recommended,
  ...common({ allowConsole: true }),
]
