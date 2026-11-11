import { describe, it } from 'node:test'

import { RuleTester } from 'eslint'
import tseslint from 'typescript-eslint'

import { pts } from '../plugin.mjs'

RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
})

tester.run('no-role-literal', pts.rules['no-role-literal'], {
  valid: [
    "roleCan(user.role, 'projects.manage')",
    // Someone else's role is data.
    "people.filter(person => person.role === 'ADMIN')",
    // lib/auth defines the roles.
    {
      code: "user.role === 'ADMIN'",
      filename: '/repo/apps/internal/lib/auth/capabilities.ts',
    },
  ],
  invalid: [
    { code: "user.role === 'ADMIN'", errors: [{ messageId: 'literal' }] },
    { code: "'SALES' !== actor.role", errors: [{ messageId: 'literal' }] },
    { code: "user?.role === 'ADMIN'", errors: [{ messageId: 'literal' }] },
    { code: "actorRole === 'ADMIN'", errors: [{ messageId: 'literal' }] },
  ],
})
