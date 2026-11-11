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
    { code: "searchParams.get('tab')", options },
    { code: 'const { tab } = await searchParams', options },
    { code: 'task.invoice', options },
    { code: "map.get('task')", options },
    {
      code: "searchParams.get('task')",
      filename: 'app/api/x/route.ts',
      options: [
        { ...options[0], exceptions: { 'param-in-stack': ['app/api/**'] } },
      ],
    },
    "<SheetContent className='w-full sm:max-w-2xl' />",
    "<DialogContent className='z-50' />",
    '<SheetContent style={{ width: 400 }} />',
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
    // param-in-stack
    { code: "searchParams.get('task')", options, errors: errors('read') },
    {
      code: "url.searchParams.has('invoice')",
      options,
      errors: errors('read'),
    },
    { code: 'params.task', options, errors: errors('read') },
    { code: "searchParams['hour-block']", options, errors: errors('read') },
    {
      code: 'const { task, tab } = await searchParams',
      options,
      errors: errors('read'),
    },
    // layer-z
    { code: "<SheetContent className='z-50 w-full' />", errors: errors('z') },
    {
      code: "<SheetOverlay className={cn('sm:z-[60]')} />",
      errors: errors('z'),
    },
    {
      code: '<SheetPrimitive.Popup style={{ zIndex: 70 }} />',
      errors: errors('z'),
    },
    { code: "<SheetContent className='z-(--layer)' />", errors: errors('z') },
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

tester.run('use-id-not-fixed-id', pts.rules['use-id-not-fixed-id'], {
  valid: [
    '<form id={formId} />',
    '<Input id={`${fieldId}-name`} />',
    '<Button form={formId} />',
    'document.getElementById(composerId)',
    "document.querySelector('[data-section=x]')",
    "<div data-id='x' />",
  ],
  invalid: [
    { code: "<form id='task-form' />", errors: 1 },
    { code: "<Input id={'name'} />", errors: 1 },
    { code: '<Button form={`company-form`} />', errors: 1 },
    { code: "document.getElementById('task-description')", errors: 1 },
    { code: "<Label htmlFor='name'>Name</Label>", errors: 1 },
    { code: "<p aria-describedby='name-error' />", errors: 1 },
    { code: "document.querySelector('#company-projects')", errors: 1 },
  ],
})
