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

const errors = (...ids) => ids.map(messageId => ({ messageId }))
const internal = [{ portal: 'internal' }]
const client = [{ portal: 'client' }]

tester.run('copy', pts.rules.copy, {
  valid: [
    // Toasts.
    "toast({ title: 'Invoice sent' })",
    "toast({ title: 'Unable to save invoice', description: error.message, variant: 'destructive' })",
    // Placeholders, optional fields, sections.
    "<Input placeholder='Search people…' />",
    '<FormLabel optional>Notes</FormLabel>',
    "const s = '(optional)'", // not JSX
    "<SheetSection title='Billing' />",
    // Words: UI strings only, and only for the portal it ships in.
    { code: '<p>Add person</p>', options: internal },
    { code: "import { contacts } from './contacts'", options: internal },
    { code: "const href = '/api/contacts'", options: internal },
    { code: '<p>Contact support for help</p>', options: internal },
    { code: '<p>Primary contact</p>', options: internal },
    { code: '<p>Your Google account</p>', options: internal },
    { code: "if (kind === 'Contact form') go()", options: internal },
    { code: "params.get('contact')", options: internal },
    { code: '<p>Your clients</p>', options: internal },
    { code: '<p>Your client portal</p>', options: client },
    '<p>Add contact</p>', // no portal: no word list
    // Figures.
    'const a = formatHours(hours)',
    'const b = formatPercent(rate)',
    'where(like(col, `%${q}%`))', // SQL LIKE, not a percent
    'const w = `${width}px`',
    '<span>{count} tasks</span>',
    // A check that's off for this file.
    {
      code: 'const c = `${rate}%`',
      filename: 'components/tiptap-ui/x.tsx',
      options: [{ exceptions: { figures: ['**/tiptap*/**'] } }],
    },
    // Exception globs are relative to `root` when it is set.
    {
      code: 'const c = `${rate}%`',
      filename: '/repo/apps/internal/components/tiptap-ui/x.tsx',
      options: [
        {
          root: '/repo/apps/internal',
          exceptions: { figures: ['components/tiptap-ui/**'] },
        },
      ],
    },
  ],
  invalid: [
    {
      code: "toast({ title: 'Failed to save invoice' })",
      errors: errors('toast-failed'),
    },
    {
      code: "toast({ title: 'Invoice sent successfully' })",
      errors: errors('toast-successfully'),
    },
    { code: "toast({ title: 'Saved!' })", errors: errors('toast-bang') },
    {
      code: "toast({ title: 'Error', description: x })",
      errors: errors('toast-error'),
    },
    {
      code: "toast({ title: 'Unable to save', description: getMessage(e, 'Failed to save.') })",
      errors: errors('toast-failed'),
    },
    {
      code: "<Input placeholder='Search people...' />",
      output: "<Input placeholder='Search people…' />",
      errors: errors('ellipsis'),
    },
    {
      code: '<FormLabel>Notes (optional)</FormLabel>',
      errors: errors('optional'),
    },
    { code: "<Label>{'Slug (optional)'}</Label>", errors: errors('optional') },
    {
      code: "<Field label='End date (optional)' />",
      errors: errors('optional'),
    },
    { code: "<SheetSection title='Details' />", errors: errors('details') },
    { code: '<p>Add contact</p>', options: internal, errors: errors('words') },
    {
      code: '<p>Your account was disabled</p>',
      options: internal,
      errors: errors('words'),
    },
    {
      code: "toast({ title: 'Contact saved' })",
      options: internal,
      errors: errors('words'),
    },
    {
      code: '<h2>Delete forever</h2>',
      options: internal,
      errors: errors('words'),
    },
    { code: '<p>Your clients</p>', options: client, errors: errors('words') },
    {
      code: '<p>Log in to continue</p>',
      options: client,
      errors: errors('words'),
    },
    { code: 'const a = `${hours}h`', errors: errors('figures') },
    { code: 'const a = `${n.toFixed(2)} hours`', errors: errors('figures') },
    { code: 'const b = `$' + '${amount}`', errors: errors('figures') },
    { code: 'const c = `${rate}%`', errors: errors('figures') },
    { code: 'const e = `${n.toFixed(1)}%`', errors: errors('figures') },
    { code: "const e = n.toFixed(1) + '%'", errors: errors('figures') },
    { code: 'function formatMoney(n) {}', errors: errors('figures') },
    {
      code: "const o = { style: 'currency', currency: 'USD' }",
      errors: errors('figures'),
    },
    {
      code: 'n.toLocaleString(undefined, { maximumFractionDigits: 1 })',
      errors: errors('figures'),
    },
    { code: '<span>{n}%</span>', errors: errors('figures') },
    { code: '<span>{hours}h</span>', errors: errors('figures') },
    { code: '<span>${amount}</span>', errors: errors('figures') },
    { code: 'const p = `${n.toFixed(1)} %`', errors: errors('figures') },
    { code: '<span>{n.toFixed(1)} %</span>', errors: errors('figures') },
    { code: 'const h = `${m?.toFixed(1)} hours`', errors: errors('figures') },
    {
      code: "const o = { currency: 'USD' as const }",
      errors: errors('figures'),
    },
    {
      code: "n.toLocaleString(undefined, { 'minimumFractionDigits': 2 })",
      errors: errors('figures'),
    },
  ],
})
