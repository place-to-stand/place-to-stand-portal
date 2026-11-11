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
const entities = [{ entities: ['task', 'company', 'hour-block'] }]

run('use-id-not-fixed-id', {
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

run('sheet-param-through-stack', {
  valid: [
    { code: "searchParams.get('tab')", options: entities },
    { code: "params.set('task', id)", options: entities },
    { code: 'const { tab } = await searchParams', options: entities },
    { code: 'task.company', options: entities },
    { code: "map.get('task')", options: entities },
  ],
  invalid: [
    { code: "searchParams.get('task')", options: entities, errors: 1 },
    { code: "url.searchParams.has('company')", options: entities, errors: 1 },
    { code: 'params.task', options: entities, errors: 1 },
    { code: "searchParams['hour-block']", options: entities, errors: 1 },
    {
      code: 'const { task, tab } = await searchParams',
      options: entities,
      errors: 1,
    },
  ],
})

run('sheet-layer-z', {
  valid: [
    "<SheetContent className='w-full sm:max-w-2xl' />",
    "<DialogContent className='z-50' />",
    '<SheetContent style={{ width: 400 }} />',
  ],
  invalid: [
    { code: "<SheetContent className='z-50 w-full' />", errors: 1 },
    { code: "<SheetOverlay className={cn('sm:z-[60]')} />", errors: 1 },
    { code: '<SheetPrimitive.Popup style={{ zIndex: 70 }} />', errors: 1 },
    { code: "<SheetContent className='z-(--layer)' />", errors: 1 },
  ],
})
