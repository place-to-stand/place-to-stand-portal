// Run: npx tsx --test apps/internal/lib/help/changelog-utils.test.mts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { changelogVersion, parseChangelog } from './changelog-utils.ts'

test('weeks from headings, items from dashes, intro skipped', () => {
  const weeks = parseChangelog(
    [
      "# What's new",
      '',
      'Intro text with a - dash.',
      '',
      '## Week of November 16, 2026',
      '',
      '- **Boards:** drag several cards.',
      '- A line with no area.',
      '',
      '## Week of November 9, 2026',
      '- **Ctrl K**: search everything.',
    ].join('\n')
  )
  assert.deepEqual(weeks, [
    {
      title: 'Week of November 16, 2026',
      id: 'week-of-november-16-2026',
      items: [
        { area: 'Boards', text: 'drag several cards.' },
        { area: null, text: 'A line with no area.' },
      ],
    },
    {
      title: 'Week of November 9, 2026',
      id: 'week-of-november-9-2026',
      items: [{ area: 'Ctrl K', text: 'search everything.' }],
    },
  ])
})

test('a week with no lines is left out; lines before any week are ignored', () => {
  const weeks = parseChangelog('- stray\n## Empty\n\n## Real\n- one')
  assert.deepEqual(
    weeks.map(week => week.title),
    ['Real']
  )
})

test('bold without a colon is not an area', () => {
  const [week] = parseChangelog(
    "## W\n- **Just bold**\n- **Don't** lose drafts"
  )
  assert.deepEqual(week.items, [
    { area: null, text: '**Just bold**' },
    { area: null, text: "**Don't** lose drafts" },
  ])
})

test('the version changes when a line is added or edited, not otherwise', () => {
  const [a] = parseChangelog('## Week of X\n- **A:** one')
  const [same] = parseChangelog('## Week of X\n\n- **A:** one\n')
  const [added] = parseChangelog('## Week of X\n- **A:** one\n- two')
  const [edited] = parseChangelog('## Week of X\n- **A:** one!')
  assert.equal(changelogVersion(a), changelogVersion(same))
  assert.notEqual(changelogVersion(a), changelogVersion(added))
  assert.notEqual(changelogVersion(a), changelogVersion(edited))
  assert.match(changelogVersion(a), /^week-of-x:/)
})

test('the real CHANGELOG.md parses, newest week first, every week has lines', () => {
  const file = new URL('../../CHANGELOG.md', import.meta.url)
  const markdown = readFileSync(file, 'utf8')
  const weeks = parseChangelog(markdown)
  // Under a week, every non-blank line is one item: a wrapped or nested
  // line would be dropped from the dialog.
  const body = markdown.slice(markdown.search(/^## /m))
  for (const line of body.split(/\r?\n/)) {
    if (line.trim() === '' || line.startsWith('## ')) continue
    assert.match(line, /^- \*\*[^*]+:\*\* \S/, `not one item line: ${line}`)
  }
  assert.ok(weeks.length > 0)
  for (const week of weeks) {
    assert.match(week.title, /^Week of [A-Z][a-z]+ \d{1,2}, \d{4}$/)
    assert.ok(week.items.length > 0)
  }
  const dates = weeks.map(week =>
    Date.parse(week.title.replace('Week of ', ''))
  )
  assert.deepEqual(
    dates,
    [...dates].sort((a, b) => b - a)
  )
})
