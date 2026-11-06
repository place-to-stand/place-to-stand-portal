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

const table = heads =>
  `const t = <Table layout='fixed'><TableHeader><TableRow>${heads}</TableRow></TableHeader></Table>`

tester.run('fixed-table-columns', pts.rules['fixed-table-columns'], {
  valid: [
    // One unsized text column, data columns in %, Actions in px.
    table(
      "<SelectAllHead /><TableHead>Name</TableHead><TableHead className='w-[20%]'>Email</TableHead><TableHead className='w-[14%]'>Status</TableHead><TableHead className='w-24 text-right'>Actions</TableHead>"
    ),
    // Helper calls: the '' class leaves Company unsized.
    table(
      "{sortHead('name', 'Company', '')}{sortHead('hours', 'Hours', 'w-48')}"
    ),
    // Widths read through a local object.
    `const widths = { name: '', status: 'w-28' }
     ${table('<TableHead className={widths.name}>Name</TableHead><TableHead className={widths.status}>Status</TableHead>')}`,
    // Auto layout is left alone.
    "const t = <Table><TableHeader><TableRow><TableHead className='w-[20%]'>Status</TableHead></TableRow></TableHeader></Table>",
  ],
  invalid: [
    {
      code: table(
        "<TableHead className='w-[40%]'>Name</TableHead><TableHead className='w-24'>Actions</TableHead>"
      ),
      errors: [{ messageId: 'growing' }],
    },
    {
      code: table(
        "<TableHead>Name</TableHead><TableHead className='w-[10%]'>Actions</TableHead><TableHead className='w-[8%]' />"
      ),
      errors: [{ messageId: 'percent' }, { messageId: 'percent' }],
    },
    {
      code: `const widths = { name: 'w-[50%]', status: 'w-[20%]' }
       ${table('<TableHead className={widths.name}>Name</TableHead><TableHead className={`${widths.status} text-right`}>Actions</TableHead>')}`,
      errors: [{ messageId: 'growing' }, { messageId: 'percent' }],
    },
  ],
})
