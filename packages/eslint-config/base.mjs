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

import { pts } from './plugin.mjs'

export const IGNORES = globalIgnores([
  '**/node_modules/**',
  '**/.next/**',
  '**/out/**',
  '**/build/**',
  '**/dist/**',
  '**/next-env.d.ts',
])

/** Rules for every workspace, apps and packages alike. */
export function common() {
  return [
    {
      plugins: { pts },
      rules: {
        // Money: an outer column in a correlated subquery binds to the inner
        // table (three past bugs). See rules/drizzle-qualified-subquery.mjs.
        'pts/drizzle-qualified-subquery': 'error',
      },
    },
  ]
}

/** A package that isn't a Next app. */
export function base() {
  return [
    IGNORES,
    // The same TypeScript rules eslint-config-next/typescript gives the apps.
    ...tseslint.configs.recommended,
    ...common(),
  ]
}
