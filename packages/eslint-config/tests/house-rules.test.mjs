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

run('no-radix', {
  valid: ["const c = 'data-active:bg-background'"],
  invalid: [
    {
      code: "import * as D from '@radix-ui/react-dialog'",
      errors: [{ messageId: 'import' }],
    },
    {
      code: "const c = 'data-[state=open]:opacity-100'",
      errors: [{ messageId: 'state' }],
    },
  ],
})

run('no-align-start', {
  valid: ["<DropdownMenuContent align='end' />", "<UserMenu align='start' />"],
  invalid: [{ code: "<PopoverContent align='start' />", errors: 1 }],
})

run('save-not-gated-on-dirty', {
  valid: [
    '<Button disabled={isPending}>Save</Button>',
    // Not a Save: sending waits for a save (rule 8).
    '<Button disabled={isPending || hasUnsavedChanges}>Mark as sent</Button>',
  ],
  invalid: [
    { code: '<Button disabled={!isDirty}>Save</Button>', errors: 1 },
    {
      code: "<Button type='submit' disabled={!form.formState.isDirty}>Go</Button>",
      errors: 1,
    },
  ],
})

run('dates-through-ui', {
  valid: [
    "import { formatCalendarDate } from '@pts/ui/dates'",
    "import { addDays } from 'date-fns'",
  ],
  invalid: [
    { code: 'd.toLocaleDateString()', errors: 1 },
    { code: "new Intl.DateTimeFormat('en-US')", errors: 1 },
    { code: "import { format } from 'date-fns'", errors: 1 },
  ],
})

run('no-title-tooltip', {
  valid: ["<div title='x' />", "<RowActionButton label='Archive' />"],
  invalid: [
    { code: "<Button title='Archive' />", errors: 1 },
    { code: "<button title='Toggle' />", errors: 1 },
  ],
})

run('no-size-override', {
  valid: [
    "<Button size='sm' className='w-full' />",
    "<Avatar size='xs' className='shrink-0' />",
  ],
  invalid: [
    { code: "<Button className='h-8' />", errors: 1 },
    { code: "<Avatar className={cn('text-[9px]', x)} />", errors: 1 },
  ],
})

run('toast-copy', {
  valid: [
    "toast({ title: 'Invoice sent' })",
    "toast({ title: 'Unable to save invoice', description: error.message, variant: 'destructive' })",
  ],
  invalid: [
    {
      code: "toast({ title: 'Failed to save invoice' })",
      errors: [{ messageId: 'failed' }],
    },
    {
      code: "toast({ title: 'Invoice sent successfully' })",
      errors: [{ messageId: 'successfully' }],
    },
    { code: "toast({ title: 'Saved!' })", errors: [{ messageId: 'bang' }] },
    {
      code: "toast({ title: 'Error', description: x })",
      errors: [{ messageId: 'error' }],
    },
    {
      code: "toast({ title: 'Unable to save', description: getMessage(e, 'Failed to save.') })",
      errors: [{ messageId: 'failed' }],
    },
  ],
})

run('grid-phone-column', {
  valid: [
    "const c = 'grid grid-cols-1 lg:grid-cols-2'",
    "const c = 'grid gap-2'",
    "const c = 'flex md:grid-cols-2'",
  ],
  invalid: [
    { code: "<div className='grid gap-4 lg:grid-cols-2' />", errors: 1 },
  ],
})

run('ellipsis-character', {
  valid: ["<Input placeholder='Search people…' />"],
  invalid: [
    {
      code: "<Input placeholder='Search people...' />",
      output: "<Input placeholder='Search people…' />",
      errors: 1,
    },
  ],
})

run('filter-select', {
  valid: [
    '<FilterBar><FilterSelect /></FilterBar>',
    {
      code: "import { Select } from '@pts/ui/select'",
      filename: '/x/page-size-select.tsx',
    },
  ],
  invalid: [
    { code: '<FilterBar><div><Select /></div></FilterBar>', errors: 1 },
    {
      code: "import { Select } from '@pts/ui/select'",
      filename: '/x/lead-filters.tsx',
      errors: 1,
    },
  ],
})
