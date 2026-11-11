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
const options = [{ entities: ['task', 'invoice', 'hour-block'] }]

tester.run('sheets', pts.rules.sheets, {
  valid: [
    { code: 'const h = invoiceHref(id)', options },
    { code: "params.set('page', '2')", options },
    { code: 'const h = `/invoices?q=${q}`', options },
    // Without the sheet params, only links are checked.
    "params.set('task', id)",
    // The builders' own home.
    {
      code: "params.set('task', id)",
      filename: 'lib/sheets/stack.ts',
      options: [
        { ...options[0], exceptions: { 'url-builders': ['lib/sheets/**'] } },
      ],
    },
    "<SheetLink sheet={{ entity: 'company', id }}>x</SheetLink>",
    "const item = { sheet: { entity: 'lead', id } }",
    { code: 'const link = { href: leadHref(id) }', filename: 'events.ts' },
    '<Link href={projectBoardHref(a, b)}>x</Link>',
    'router.push(companySheetHref(id))',
  ],
  invalid: [
    {
      code: 'const h = `/invoices/archive?invoice=${id}`',
      options,
      errors: errors('write'),
    },
    {
      code: 'const h = `/hour-blocks?page=2&hour-block=${id}`',
      options,
      errors: errors('write'),
    },
    { code: "params.set('task', id)", options, errors: errors('write') },
    { code: "params.delete('task')", options, errors: errors('write') },
    {
      code: '<Link href={companySheetHref(id)}>x</Link>',
      errors: errors('leaves'),
    },
    {
      code: 'const item = { href: leadHref(lead.id) }',
      filename: 'row.tsx',
      errors: errors('leaves'),
    },
  ],
})
