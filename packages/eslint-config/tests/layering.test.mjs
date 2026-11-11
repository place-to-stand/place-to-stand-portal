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
