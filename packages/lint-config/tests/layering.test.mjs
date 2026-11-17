import { ruleTester } from './tester.mjs'

import { pts } from '../plugin.mjs'

const tester = ruleTester()

tester.run('client-boundary', pts.rules['client-boundary'], {
  valid: [
    // Not a client file.
    "import { db } from '@/lib/db'",
    // Type-only imports are fine.
    "'use client'\nimport type { TaskRow } from '@/lib/queries/tasks'",
    "'use client'\nimport { type Company } from '@pts/db/schema'",
  ],
  invalid: [
    {
      code: "'use client'\nimport { fetchTasks } from '@/lib/queries/tasks'",
      errors: [{ messageId: 'banned' }],
    },
    {
      code: "'use client'\nimport { companies } from '@pts/db/schema'",
      errors: [{ messageId: 'banned' }],
    },
  ],
})
