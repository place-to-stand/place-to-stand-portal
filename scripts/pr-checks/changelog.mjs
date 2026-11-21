#!/usr/bin/env node
/**
 * A pull request that changes the apps adds a line to What's new
 * (apps/internal/CHANGELOG.md), or says why not:
 *
 *   node scripts/pr-checks/changelog.mjs <base sha> <head sha>
 *
 * with the PR description in PR_BODY. It passes when the PR:
 *   - changes nothing people can see (no app or shared UI code), or
 *   - adds a new `- **Area:** change` line to CHANGELOG.md, or
 *   - has a line `Changelog: none` in its description, for changes nobody
 *     sees (dependencies, tests, lint). The skip is in the open, for review.
 *
 * It can tell a line was added, not whether it says anything useful:
 * review checks the wording.
 */
import { bodyHasLine, changedFiles, git, isMain, readRange } from './shared.mjs'

const CHANGELOG = 'apps/internal/CHANGELOG.md'
// Code people see: both apps and the shared UI package.
const VISIBLE = [/^apps\/internal\//, /^apps\/client\//, /^packages\/ui\//]
// Inside those, files no one sees.
const HIDDEN = [
  /\.(test|spec)\.[cm]?[jt]sx?$/,
  /(^|\/)(__tests__|__snapshots__|fixtures)\//,
  /\.md$/,
  /(^|\/)lint-suppressions\.json$/,
  /(^|\/)oxlint\.config\.mjs$/,
]
const ITEM = /^- \*\*[^*]+:\*\* \S/
const SKIP = 'Changelog: none'

/**
 * `addedLines`: lines the PR adds to CHANGELOG.md. `baseLines`: the file on
 * the base branch, so rewording or moving an old entry doesn't count as new.
 */
export function checkChangelog({ files, addedLines, baseLines = [], body }) {
  const visible = files.filter(
    file =>
      file !== CHANGELOG &&
      VISIBLE.some(re => re.test(file)) &&
      !HIDDEN.some(re => re.test(file))
  )
  if (visible.length === 0) return { ok: true, why: 'no visible changes' }
  const existing = new Set(baseLines.map(line => line.trim()))
  const added = addedLines.filter(
    line => ITEM.test(line) && !existing.has(line.trim())
  )
  if (added.length > 0) {
    return { ok: true, why: 'CHANGELOG.md has a new line' }
  }
  if (bodyHasLine(body, SKIP)) return { ok: true, why: SKIP }
  return { ok: false, visible }
}

function main() {
  const { base, head } = readRange('changelog.mjs')
  const files = changedFiles(base, head)
  const mergeBase = git('merge-base', base, head).trim()
  let baseLines = []
  try {
    baseLines = git('show', `${mergeBase}:${CHANGELOG}`).split('\n')
  } catch {
    // No CHANGELOG.md on the base yet: every line is new.
  }
  const addedLines = git(
    'diff',
    '--unified=0',
    `${base}...${head}`,
    '--',
    CHANGELOG
  )
    .split('\n')
    .filter(line => line.startsWith('+') && !line.startsWith('+++'))
    .map(line => line.slice(1))

  const result = checkChangelog({
    files,
    addedLines,
    baseLines,
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
      `  ${SKIP}`,
      '',
      'Changed files people can see:',
      ...result.visible.slice(0, 20).map(file => `  ${file}`),
    ].join('\n')
  )
  process.exit(1)
}

if (isMain(import.meta.url)) main()
