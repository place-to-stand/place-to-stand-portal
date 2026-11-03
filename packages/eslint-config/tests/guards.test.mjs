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
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

const run = (id, cases) => tester.run(id, pts.rules[id], cases)

run('one-page-panel', {
  valid: [
    "const c = 'rounded-xl border p-4'",
    "const c = 'rounded-lg border shadow-sm'",
  ],
  invalid: [
    {
      code: "const c = 'bg-background rounded-xl border p-4 shadow-sm'",
      errors: 1,
    },
    { code: 'const c = `bg-card ${x} rounded-xl border shadow-sm`', errors: 1 },
  ],
})

run('no-raw-colour', {
  valid: [
    "const c = 'bg-warning/10 text-destructive border-brand-lime/50'",
    "const c = 'text-red'", // not a palette step
    "const c = 'grid-cols-2 gap-500'",
  ],
  invalid: [
    { code: "const c = 'border-b border-amber-500/40'", errors: 1 },
    { code: "const c = 'dark:text-red-300'", errors: 1 },
    { code: "const c = 'border-[#65a30d]/60'", errors: 1 },
    { code: 'const c = `px-2 ${x} bg-zinc-100`', errors: 1 },
  ],
})

const sheetOptions = [{ entities: ['task', 'invoice', 'hour-block'] }]
run('sheet-url-through-builders', {
  valid: [
    { code: 'const h = invoiceHref(id)', options: sheetOptions },
    { code: "params.set('page', '2')", options: sheetOptions },
    { code: 'const h = `/invoices?q=${q}`', options: sheetOptions },
  ],
  invalid: [
    {
      code: 'const h = `/invoices/archive?invoice=${id}`',
      options: sheetOptions,
      errors: 1,
    },
    {
      code: 'const h = `/hour-blocks?page=2&hour-block=${id}`',
      options: sheetOptions,
      errors: 1,
    },
    { code: "params.set('task', id)", options: sheetOptions, errors: 1 },
    { code: "params.delete('task')", options: sheetOptions, errors: 1 },
  ],
})

const deleteOptions = [{ allow: ['timeLogTasks', 'rate_limit_buckets'] }]
run('no-hard-delete', {
  valid: [
    { code: 'await db.delete(timeLogTasks).where(x)', options: deleteOptions },
    { code: "params.delete('task')", options: deleteOptions },
    { code: 'cache.delete(key)', options: deleteOptions },
    {
      code: 'sql`delete from rate_limit_buckets where x`',
      options: deleteOptions,
    },
    { code: 'sql`delete from auth.sessions where x`', options: deleteOptions },
  ],
  invalid: [
    {
      code: 'await db.delete(tasks).where(x)',
      options: deleteOptions,
      errors: 1,
    },
    {
      code: 'await tx.delete(schema.invoices)',
      options: deleteOptions,
      errors: 1,
    },
    {
      code: 'sql`DELETE FROM tasks WHERE id = ${id}`',
      options: deleteOptions,
      errors: 1,
    },
  ],
})

run('optional-label', {
  valid: [
    '<FormLabel optional>Notes</FormLabel>',
    "const s = '(optional)'", // not JSX
  ],
  invalid: [
    { code: '<FormLabel>Notes (optional)</FormLabel>', errors: 1 },
    { code: "<Label>{'Slug (optional)'}</Label>", errors: 1 },
    { code: "<Field label='End date (optional)' />", errors: 1 },
  ],
})

run('env-through-schema', {
  valid: [
    "if (process.env.NODE_ENV === 'production') {}",
    'const k = process.env.NEXT_PUBLIC_POSTHOG_KEY',
    'const u = process.env.VERCEL_URL',
    'const k = serverEnv.STRIPE_SECRET_KEY',
  ],
  invalid: [
    { code: 'const k = process.env.STRIPE_SECRET_KEY', errors: 1 },
    { code: "const k = process.env['APP_BASE_URL']", errors: 1 },
  ],
})
