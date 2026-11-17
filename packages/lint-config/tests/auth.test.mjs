import { ruleTester } from './tester.mjs'

import { pts } from '../plugin.mjs'

const tester = ruleTester()

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
