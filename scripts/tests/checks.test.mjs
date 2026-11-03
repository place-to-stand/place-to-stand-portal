// Fixture tests for the source checks in `npm run lint`, so a regex change
// that starts passing everything (or failing everything) shows up here.
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { checkBadges } from '../check-badges.mjs'
import { checkCopy } from '../check-copy.mjs'
import { checkFormatters } from '../check-formatters.mjs'

const lines = found => found.map(f => f.line)

test('badges: size, weight and case come from the Badge', () => {
  assert.deepEqual(checkBadges("<Badge variant='secondary'>App</Badge>"), [])
  assert.deepEqual(
    checkBadges("<Badge className='gap-1 shrink-0'>x</Badge>"),
    []
  )
  const found = checkBadges(
    "<div />\n<Badge className='uppercase text-sm'>x</Badge>"
  )
  assert.deepEqual(found, [{ line: 2, classes: ['uppercase', 'text-sm'] }])
})

test('formatters: hours, money and percents are never glued on', () => {
  const ok = [
    'const a = formatHours(hours)',
    'const b = formatPercent(rate)',
    'where(like(col, `%${q}%`))', // SQL LIKE, not a percent
    'style={{ width: `${w}%` }} // format-check: allow',
    '// a comment about ${n}h is fine',
  ]
  for (const line of ok)
    assert.deepEqual(checkFormatters(line, 'a.ts'), [], line)

  const bad = [
    'const a = `${hours}h`',
    'const b = `$' + '${amount}`',
    'const c = `${rate}%`',
    "const d = new Intl.NumberFormat('en-US')",
    'function formatMoney(n) {}',
    'const e = `${n.toFixed(1)}%`',
  ]
  for (const line of bad) {
    assert.equal(checkFormatters(line, 'a.ts').length > 0, true, line)
  }
  assert.deepEqual(lines(checkFormatters('x\n<span>{n}%</span>', 'a.tsx')), [2])
  // JSX rules only apply to .tsx files.
  assert.deepEqual(checkFormatters('<span>{n}%</span>', 'a.ts'), [])
})

test('copy: retired words in UI strings, not in code', () => {
  const internal = text => checkCopy(text, 'a.tsx', 'internal')
  const client = text => checkCopy(text, 'a.tsx', 'client')

  assert.deepEqual(internal('<p>Add person</p>'), [])
  assert.deepEqual(internal("import { contacts } from './contacts'"), [])
  assert.deepEqual(internal("const href = '/api/contacts'"), [])
  assert.deepEqual(internal('<p>Contact support for help</p>'), [])
  assert.deepEqual(internal('<p>Primary contact</p>'), [])
  assert.deepEqual(lines(internal('<p>Add contact</p>')), [1])
  assert.deepEqual(lines(internal('<p>Your account was disabled</p>')), [1])
  assert.deepEqual(internal('<p>Your Google account</p>'), [])
  assert.deepEqual(
    internal('// copy-check: allow — the contact form\n<p>Add contact</p>'),
    []
  )
  assert.deepEqual(lines(internal('<h2>Delete forever</h2>')), [1])

  assert.deepEqual(client('<p>Your client portal</p>'), [])
  assert.deepEqual(lines(client('<p>Your clients</p>')), [1])
  assert.deepEqual(lines(client('<p>Log in to continue</p>')), [1])
  assert.deepEqual(internal('<p>Your clients</p>'), [])
})
