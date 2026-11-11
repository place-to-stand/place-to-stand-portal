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

run('figure-cell-aligned', {
  valid: [
    "<TableCell className='text-right tabular-nums'>{formatCurrency(n)}</TableCell>",
    '<TableCell className={MONEY_CELL}>{formatCurrency(n)}</TableCell>',
    "<TableCell className='text-sm'>{name}</TableCell>",
  ],
  invalid: [
    {
      code: "<TableCell className='text-sm'>{formatCurrency(n)}</TableCell>",
      errors: 1,
    },
    { code: '<TableCell>{formatHours(h)}</TableCell>', errors: 1 },
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

run('shortcut-registry', {
  valid: [
    'function onKey(e) { if (matchesShortcut(e, SHORTCUTS.save)) save() }',
    // ⌘-click opens in a new tab: modifiers without a key are not a shortcut.
    'const onClick = event => { if (event.metaKey || event.ctrlKey) return }',
    "function onKey(e) { if (e.key === 'Enter' && !e.shiftKey) send() }",
    // A column's key is not a key press.
    'function Row({ col }) { const k = col.key; const onClick = e => { if (e.metaKey) open(k) } }',
  ],
  invalid: [
    {
      code: "function onKey(e) { if (e.key === 'k' && (e.metaKey || e.ctrlKey)) open() }",
      errors: 2,
    },
    {
      code: "window.addEventListener('keydown', event => { const mod = () => event.metaKey; if (mod() && event.key === 's') save() })",
      errors: 1,
    },
    {
      code: "window.addEventListener('keydown', e => { const { key, metaKey } = e; if (metaKey && key === 'k') open() })",
      errors: 1,
    },
  ],
})
