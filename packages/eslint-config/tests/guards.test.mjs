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

run('popover-shadow', {
  valid: [
    "<PopoverContent className='w-80 p-0' />",
    "<SelectContent className='shadow-popover' />",
    "<Card className='shadow-lg' />",
    "<SheetContent className='shadow-lg' />",
    "<SheetPrimitive.Popup className='shadow-lg' />",
  ],
  invalid: [
    { code: "<PopoverContent className='w-96 shadow-2xl' />", errors: 1 },
    {
      code: "<MenuPopup className={cn('p-1', open && 'shadow-lg')} />",
      errors: 1,
    },
  ],
})

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

run('no-details-section', {
  valid: ["<SheetSection title='Billing' />"],
  invalid: [{ code: "<SheetSection title='Details' />", errors: 1 }],
})

run('no-raw-type-size', {
  valid: ["const c = 'text-micro text-overline text-sm'"],
  invalid: [
    { code: "const c = 'text-[10px] font-semibold'", errors: 1 },
    { code: 'const c = `sm:text-[22px] ${x}`', errors: 1 },
  ],
})

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

run('underline-not-clipped', {
  valid: [
    "<a className='hover:underline'><span className='truncate-link'>x</span></a>",
    "<Link className='truncate-link hover:underline'>x</Link>",
    "<div className='truncate'>x</div>",
    "<span className='truncate'><a className='hover:underline'>x</a></span>",
  ],
  invalid: [
    {
      code: "<Link className='hover:text-foreground truncate hover:underline'>x</Link>",
      errors: [{ messageId: 'clipped' }],
    },
    {
      code: "<a className={cn('inline-flex hover:underline')}><Icon /><span className='truncate'>x</span></a>",
      errors: [{ messageId: 'clipped' }],
    },
  ],
})

run('sheet-link-in-place', {
  valid: [
    "<SheetLink sheet={{ entity: 'company', id }}>x</SheetLink>",
    "const item = { sheet: { entity: 'lead', id } }",
    { code: 'const link = { href: leadHref(id) }', filename: 'events.ts' },
    '<Link href={projectBoardHref(a, b)}>x</Link>',
    'router.push(companySheetHref(id))',
  ],
  invalid: [
    {
      code: '<Link href={companySheetHref(id)}>x</Link>',
      errors: [{ messageId: 'leaves' }],
    },
    {
      code: 'const item = { href: leadHref(lead.id) }',
      filename: 'row.tsx',
      errors: [{ messageId: 'leaves' }],
    },
  ],
})
