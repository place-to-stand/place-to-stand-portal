import { IGNORES, common } from '@pts/lint-config/base'
import { tsRecommended } from '@pts/lint-config/presets'
import { toOxlint } from '@pts/lint-config/to-oxlint'

/**
 * Root scripts and the browser tests: the shared rules without type
 * information (neither has a tsconfig). Each workspace lints itself.
 */
export default toOxlint([
  IGNORES,
  { ignores: ['apps/**', 'packages/**', 'supabase/**', 'docs/**'] },
  ...tsRecommended,
  ...common({ allowConsole: true }),
])
