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
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

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
// One line of its own, outside comments and code blocks.
const SKIP = /^[ \t]*changelog:[ \t]*none\b/im

/** The body without HTML comments or fenced code, so a template can't skip for everyone. */
function visibleBody(body) {
  return (body ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/```[\s\S]*?```/g, '')
}

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
  if (SKIP.test(visibleBody(body))) return { ok: true, why: 'Changelog: none' }
  return { ok: false, visible }
}

function git(...args) {
  // Plain paths: non-ASCII names aren't quoted into a form the patterns miss.
  return execFileSync('git', ['-c', 'core.quotePath=false', ...args], {
    encoding: 'utf8',
    // Errors carry git's message; a missing file on the base prints nothing.
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function main() {
  const [base, head] = process.argv.slice(2)
  if (!base || !head) {
    console.error('Usage: check-changelog.mjs <base sha> <head sha>')
    process.exit(2)
  }
  const range = `${base}...${head}`
  // --no-renames lists both sides of a rename, so moving a file out of the
  // apps still counts.
  const files = git('diff', '--name-only', '--no-renames', range)
    .split('\n')
    .filter(Boolean)
  const mergeBase = git('merge-base', base, head).trim()
  let baseLines = []
  try {
    baseLines = git('show', `${mergeBase}:${CHANGELOG}`).split('\n')
  } catch {
    // No CHANGELOG.md on the base yet: every line is new.
  }
  const addedLines = git('diff', '--unified=0', range, '--', CHANGELOG)
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
      '  Changelog: none',
      '',
      'Changed files people can see:',
      ...result.visible.slice(0, 20).map(file => `  ${file}`),
    ].join('\n')
  )
  process.exit(1)
}

// Run only as a script, never on import. Compared as real paths, so a
// symlink or a space in the path can't skip the check and pass silently.
if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  main()
}
