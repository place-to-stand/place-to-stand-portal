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

const route = '/repo/apps/internal/app/api/things/route.ts'

tester.run('api-route-guard', pts.rules['api-route-guard'], {
  valid: [
    { code: "await authorizeRoute('projects.manage')", filename: route },
    // OAuth navigations may redirect.
    {
      code: 'await requireUser()',
      filename: '/repo/apps/internal/app/api/auth/github/route.ts',
    },
    // Pages redirect.
    {
      code: "await requirePage('projects.manage')",
      filename: '/repo/apps/internal/app/(dashboard)/projects/page.tsx',
    },
  ],
  invalid: [
    {
      code: 'await requireUser()',
      filename: route,
      errors: [{ messageId: 'redirect' }],
    },
    {
      code: "await requirePage('projects.manage')",
      filename: route,
      errors: [{ messageId: 'redirect' }],
    },
  ],
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
