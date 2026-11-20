/**
 * The checks that live in built-in rules (base.mjs, next.mjs) rather than in
 * a pts rule: dates and numbers, Radix, the no-restricted-syntax selectors
 * (syntax-rules.mjs) and the query layer's imports.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { RESTRICTED_IMPORTS, common } from '../base.mjs'
import { ruleIdOf } from '../bin/lint.mjs'
import {
  API_ROUTE_GUARD,
  DIALOG_FORM,
  IMAGE_FILE_INPUT,
  NO_ALIGN_START,
  NO_HAND_SECTION_HEADING,
  SETTINGS_SUBMIT,
  NO_TITLE_TOOLTIP,
  QUERY_LAYER_PATTERNS,
  TOOLTIP_OFF,
} from '../next.mjs'
import { toOxlint } from '../to-oxlint.mjs'

const require = createRequire(import.meta.url)
const oxlint = join(
  dirname(require.resolve('oxlint/package.json')),
  'bin/oxlint'
)

/**
 * Runs Oxlint once over every case (one file each) and asserts the rule ids
 * that fire on each. One run per test keeps the suite fast: starting Oxlint
 * with its JS plugins takes about half a second.
 */
function expectFired(config, cases) {
  // Inside the package, so the config's JS plugins resolve.
  const dir = mkdtempSync(join(import.meta.dirname, '.tmp-'))
  try {
    writeFileSync(join(dir, '.oxlintrc.json'), JSON.stringify(toOxlint(config)))
    const files = cases.map(({ code, filename = 'file.tsx' }, i) => {
      const file = `${i}-${filename}`
      writeFileSync(join(dir, file), code)
      return file
    })
    const result = spawnSync(
      process.execPath,
      [oxlint, '-c', '.oxlintrc.json', '--format=json', ...files],
      { cwd: dir, encoding: 'utf8' }
    )
    const { diagnostics } = JSON.parse(result.stdout)
    cases.forEach(({ code, fires }, i) => {
      const ids = diagnostics
        .filter(d => d.filename === files[i])
        .map(d => ruleIdOf(d.code))
      assert.deepEqual(ids, fires, code)
    })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const base = common()

test('dates and numbers go through @pts/ui', () => {
  expectFired(base, [
    ...[
      'd.toLocaleDateString()',
      'd.toLocaleTimeString()',
      "new Intl.DateTimeFormat('en-US')",
      "new Intl.NumberFormat('en-US')",
    ].map(code => ({ code, fires: ['no-restricted-properties'] })),
    ...[
      "import { format } from 'date-fns'",
      "import format from 'date-fns/format'",
      "import { formatInTimeZone } from 'date-fns-tz'",
      "import { format } from 'date-fns-tz'",
      "import { formatInTimeZone } from 'date-fns'",
    ].map(code => ({ code, fires: ['no-restricted-imports'] })),
    { code: "import { addDays } from 'date-fns'", fires: [] },
    { code: 'n.toLocaleString()', fires: [] },
  ])
})

test('no Radix', () => {
  expectFired(base, [
    {
      code: "import * as D from '@radix-ui/react-dialog'",
      fires: ['no-restricted-imports'],
    },
    { code: "import { Dialog } from '@base-ui/react'", fires: [] },
  ])
})

test('no title= tooltip on any button', () => {
  const config = [
    { rules: { 'no-restricted-syntax': ['error', NO_TITLE_TOOLTIP] } },
  ]
  expectFired(config, [
    ...[
      "<button title='Toggle' />",
      "<Button title='Bold' />",
      "<ToolbarIconButton title='Bold' />",
    ].map(code => ({ code, fires: ['pts/restricted-syntax'] })),
    { code: "<div title='x' />", fires: [] },
    { code: "<RecordRowButton title='Row' />", fires: [] },
  ])
})

test("RowActionButton's tooltip is off only under a Tooltip or trigger", () => {
  const config = [{ rules: { 'no-restricted-syntax': ['error', TOOLTIP_OFF] } }]
  const button = "<RowActionButton tooltip={false} label='More' />"
  expectFired(config, [
    { code: button, fires: ['pts/restricted-syntax'] },
    ...[
      `<Tooltip><TooltipTrigger>${button}</TooltipTrigger></Tooltip>`,
      `<DropdownMenuTrigger render={${button}} />`,
      `<DropdownMenuTrigger asChild>${button}</DropdownMenuTrigger>`,
      "<RowActionButton label='More' />",
    ].map(code => ({ code, fires: [] })),
  ])
})

test('a form inside a dialog is DialogForm', () => {
  const config = [{ rules: { 'no-restricted-syntax': ['error', DIALOG_FORM] } }]
  expectFired(config, [
    {
      code: '<DialogContent><form onSubmit={save} /></DialogContent>',
      fires: ['pts/restricted-syntax'],
    },
    {
      code: '<AlertDialogContent><form onSubmit={save} /></AlertDialogContent>',
      fires: ['pts/restricted-syntax'],
    },
    {
      code: '<DialogContent><DialogForm onSubmit={save} /></DialogContent>',
      fires: [],
    },
    {
      code: '<SheetContent><form onSubmit={save} /></SheetContent>',
      fires: [],
    },
  ])
})

test('an image file input is the shared tile', () => {
  const config = [
    { rules: { 'no-restricted-syntax': ['error', IMAGE_FILE_INPUT] } },
  ]
  expectFired(config, [
    {
      code: "<input type='file' accept='image/png,image/jpeg' />",
      fires: ['pts/restricted-syntax'],
    },
    { code: '<input type="file" accept={accept} />', fires: [] },
    { code: "<input type='file' accept='.pdf,.zip' />", fires: [] },
    { code: "<input type='text' />", fires: [] },
  ])
})

test('a Settings page has no Save button of its own', () => {
  const config = [
    { rules: { 'no-restricted-syntax': ['error', SETTINGS_SUBMIT] } },
  ]
  expectFired(config, [
    {
      code: "<form><Button type='submit'>Save</Button></form>",
      fires: ['pts/restricted-syntax'],
    },
    {
      code: "<DialogForm><DialogFooter><Button type='submit'>Add</Button></DialogFooter></DialogForm>",
      fires: [],
    },
    { code: "<Button type='button'>Discard</Button>", fires: [] },
  ])
})

test('a page form section is FormSection, not a hand-written h2', () => {
  const config = [
    { rules: { 'no-restricted-syntax': ['error', NO_HAND_SECTION_HEADING] } },
  ]
  expectFired(config, [
    {
      code: "<h2 className='text-lg font-semibold'>Tax rates</h2>",
      fires: ['pts/restricted-syntax'],
    },
    {
      code: "<h2 className='font-semibold text-lg tracking-tight'>Dates</h2>",
      fires: ['pts/restricted-syntax'],
    },
    { code: "<h2 className='text-sm font-semibold'>Notes</h2>", fires: [] },
    { code: "<h3 className='text-lg font-semibold'>Board</h3>", fires: [] },
    { code: '<h2 className={TITLE_CLASS}>Title</h2>', fires: [] },
  ])
})

test("no align='start' on a popup", () => {
  const config = [
    { rules: { 'no-restricted-syntax': ['error', NO_ALIGN_START] } },
  ]
  expectFired(config, [
    {
      code: "<DropdownMenuContent align='start' />",
      fires: ['pts/restricted-syntax'],
    },
    { code: "<DropdownMenuContent align='end' />", fires: [] },
  ])
})

test('API routes never call a redirecting guard', () => {
  const config = [
    { rules: { 'no-restricted-syntax': ['error', API_ROUTE_GUARD] } },
  ]
  expectFired(config, [
    {
      code: 'await requireUser()',
      filename: 'route.ts',
      fires: ['pts/restricted-syntax'],
    },
    {
      code: "await requirePage('projects.manage')",
      filename: 'route.ts',
      fires: ['pts/restricted-syntax'],
    },
    {
      code: "await authorizeRoute('projects.manage')",
      filename: 'route.ts',
      fires: [],
    },
  ])
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
  expectFired(config, [
    ...[
      "import { assertAdmin } from '@/lib/auth/permissions'",
      "import { logActivity } from '@/lib/activity/logger'",
      "import { logTaskCreated } from '@/lib/activity/events/tasks'",
    ].map(code => ({
      code,
      filename: 'q.ts',
      fires: ['no-restricted-imports'],
    })),
    ...[
      "import type { AppUser } from '@/lib/auth/session'",
      "import { htmlToPlainText } from '@/lib/activity/text-diff'",
    ].map(code => ({ code, filename: 'q.ts', fires: [] })),
  ])
})
