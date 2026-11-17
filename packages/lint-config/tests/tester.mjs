/**
 * The RuleTester every rule test uses: Oxlint's, so each case runs the rule
 * the way `npm run lint` does. `eslintCompat` keeps ESLint's 1-based columns
 * and module default, which the cases were written against.
 */
import { describe, it } from 'node:test'

import { RuleTester } from 'oxlint/plugins-dev'

RuleTester.describe = describe
RuleTester.it = it

export function ruleTester({ jsx = false } = {}) {
  return new RuleTester({
    eslintCompat: true,
    languageOptions: {
      sourceType: 'module',
      parserOptions: { lang: jsx ? 'tsx' : 'ts' },
    },
  })
}
