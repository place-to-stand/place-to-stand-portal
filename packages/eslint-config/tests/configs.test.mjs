/**
 * The checks that live in eslint's built-in rules (base.mjs, next.mjs)
 * rather than in a pts rule: dates and numbers, Radix, title= on a native
 * button, redirecting guards in API routes, and the query layer's imports.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { Linter } from 'eslint'
import tseslint from 'typescript-eslint'

import { RESTRICTED_IMPORTS, common } from '../base.mjs'
import {
  API_ROUTE_GUARD,
  NO_TITLE_TOOLTIP,
  QUERY_LAYER_PATTERNS,
} from '../next.mjs'

const languageOptions = {
  parser: tseslint.parser,
  ecmaVersion: 'latest',
  sourceType: 'module',
  parserOptions: { ecmaFeatures: { jsx: true } },
}

/** The rule ids that fire on `code` under `config`. */
function fired(config, code, filename = 'file.tsx') {
  const messages = new Linter().verify(
    code,
    [{ files: ['**/*.ts', '**/*.tsx'], languageOptions }, ...config],
    filename
  )
  return messages.map(m => m.ruleId)
}

const base = common()

test('dates and numbers go through @pts/ui', () => {
  for (const code of [
    'd.toLocaleDateString()',
    'd.toLocaleTimeString()',
    "new Intl.DateTimeFormat('en-US')",
    "new Intl.NumberFormat('en-US')",
  ]) {
    assert.deepEqual(fired(base, code), ['no-restricted-properties'], code)
  }
  for (const code of [
    "import { format } from 'date-fns'",
    "import format from 'date-fns/format'",
    "import { formatInTimeZone } from 'date-fns-tz'",
  ]) {
    assert.deepEqual(fired(base, code), ['no-restricted-imports'], code)
  }
  assert.deepEqual(fired(base, "import { addDays } from 'date-fns'"), [])
  assert.deepEqual(fired(base, 'n.toLocaleString()'), [])
})

test('no Radix', () => {
  assert.deepEqual(fired(base, "import * as D from '@radix-ui/react-dialog'"), [
    'no-restricted-imports',
  ])
  assert.deepEqual(fired(base, "import { Dialog } from '@base-ui/react'"), [])
})

test('no title= tooltip on a native button', () => {
  const config = [
    { rules: { 'no-restricted-syntax': ['error', NO_TITLE_TOOLTIP] } },
  ]
  assert.deepEqual(fired(config, "<button title='Toggle' />"), [
    'no-restricted-syntax',
  ])
  assert.deepEqual(fired(config, "<div title='x' />"), [])
})

test('API routes never call a redirecting guard', () => {
  const config = [
    { rules: { 'no-restricted-syntax': ['error', API_ROUTE_GUARD] } },
  ]
  assert.deepEqual(fired(config, 'await requireUser()', 'route.ts'), [
    'no-restricted-syntax',
  ])
  assert.deepEqual(
    fired(config, "await requirePage('projects.manage')", 'route.ts'),
    ['no-restricted-syntax']
  )
  assert.deepEqual(
    fired(config, "await authorizeRoute('projects.manage')", 'route.ts'),
    []
  )
})

test('lib/queries does no logging and no permission checks', () => {
  const config = [
    {
      rules: {
        'no-restricted-imports': [
          'error',
          { ...RESTRICTED_IMPORTS, patterns: QUERY_LAYER_PATTERNS },
        ],
      },
    },
  ]
  for (const code of [
    "import { assertAdmin } from '@/lib/auth/permissions'",
    "import { logActivity } from '@/lib/activity/logger'",
    "import { logTaskCreated } from '@/lib/activity/events/tasks'",
  ]) {
    assert.deepEqual(fired(config, code, 'q.ts'), ['no-restricted-imports'])
  }
  for (const code of [
    "import type { AppUser } from '@/lib/auth/session'",
    "import { htmlToPlainText } from '@/lib/activity/text-diff'",
  ]) {
    assert.deepEqual(fired(config, code, 'q.ts'), [], code)
  }
})
