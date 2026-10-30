/**
 * Shared flat config for every workspace (apps and packages).
 *
 *   import { base } from '@pts/eslint-config/base'
 *   export default base()
 *
 * The apps layer Next.js and the house rules on top (`./next.mjs`).
 */
import { globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'

export const IGNORES = globalIgnores([
  '**/node_modules/**',
  '**/.next/**',
  '**/out/**',
  '**/build/**',
  '**/dist/**',
  '**/next-env.d.ts',
])

/** TypeScript parsing for a package that isn't a Next app. */
export function base() {
  return [
    IGNORES,
    // The same TypeScript rules eslint-config-next/typescript gives the apps.
    ...tseslint.configs.recommended,
  ]
}
