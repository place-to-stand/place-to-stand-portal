#!/usr/bin/env node
/**
 * A pull request that changes the apps adds a line to What's new
 * (apps/internal/CHANGELOG.md), or says why not. Run by the Changelog
 * workflow on every pull request:
 *
 *   node scripts/check-changelog.mjs <base sha> <head sha>
 *
 * with the PR body in PR_BODY. It passes when the PR:
 *   - changes nothing people can see (no app or shared UI code), or
 *   - adds a `- **Area:** change` line to CHANGELOG.md, or
 *   - has a line `Changelog: none` in its body, for changes nobody sees
 *     (dependencies, tests, lint). The skip is in the open, for review.
 *
 * It can tell a line was added, not whether it says anything useful:
 * review checks the wording.
 */
import { execFileSync } from 'node:child_process'

const CHANGELOG = 'apps/internal/CHANGELOG.md'
// Code people see: both apps and the shared UI package.
const VISIBLE = [/^apps\/internal\//, /^apps\/client\//, /^packages\/ui\//]
// Inside those, files no one sees.
const HIDDEN = [
  /\.test\.[cm]?[jt]sx?$/,
  /\.md$/,
  /(^|\/)lint-suppressions\.json$/,
  /(^|\/)oxlint\.config\.mjs$/,
]
const ITEM = /^- \*\*[^*]+:\*\* \S/
const SKIP = /^\s*changelog:\s*none\b/im

export function checkChangelog({ files, addedLines, body }) {
  const visible = files.filter(
    file =>
      file !== CHANGELOG &&
      VISIBLE.some(re => re.test(file)) &&
      !HIDDEN.some(re => re.test(file))
  )
  if (visible.length === 0) return { ok: true, why: 'no visible changes' }
  if (addedLines.some(line => ITEM.test(line))) {
    return { ok: true, why: 'CHANGELOG.md has a new line' }
  }
  if (SKIP.test(body ?? '')) return { ok: true, why: 'Changelog: none' }
  return { ok: false, visible }
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' })
}

function main() {
  const [base, head] = process.argv.slice(2)
  if (!base || !head) {
    console.error('Usage: check-changelog.mjs <base sha> <head sha>')
    process.exit(2)
  }
  const range = `${base}...${head}`
  const files = git('diff', '--name-only', range).split('\n').filter(Boolean)
  const addedLines = git('diff', '--unified=0', range, '--', CHANGELOG)
    .split('\n')
    .filter(line => line.startsWith('+') && !line.startsWith('+++'))
    .map(line => line.slice(1))

  const result = checkChangelog({
    files,
    addedLines,
    body: process.env.PR_BODY,
  })
  if (result.ok) {
    console.log(`Changelog check passed: ${result.why}.`)
    return
  }
  console.error(
    [
      `This pull request changes what people see but adds no line to ${CHANGELOG}.`,
      '',
      "Either add one under this week's heading:",
      '  - **Area:** what changed, in plain words for staff.',
      '',
      'or, if nobody will notice the change (dependencies, tests, lint),',
      'add this line to the pull request description:',
      '  Changelog: none',
      '',
      'Changed files people can see:',
      ...result.visible.slice(0, 20).map(file => `  ${file}`),
    ].join('\n')
  )
  process.exit(1)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
