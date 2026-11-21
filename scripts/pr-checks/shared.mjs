/**
 * Helpers shared by the pull request checks in this folder, run by
 * .github/workflows/pr-checks.yml.
 */
import { execFileSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export function git(...args) {
  // Plain paths: non-ASCII names aren't quoted into a form the patterns miss.
  return execFileSync('git', ['-c', 'core.quotePath=false', ...args], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    // Errors carry git's message; a missing file on the base prints nothing.
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/**
 * The files a pull request changes, from the merge base. --no-renames lists
 * both sides of a rename, so moving a file out of a folder still counts.
 */
export function changedFiles(base, head, filter) {
  const args = ['diff', '--name-only', '--no-renames']
  if (filter) args.push(`--diff-filter=${filter}`)
  return git(...args, `${base}...${head}`)
    .split('\n')
    .filter(Boolean)
}

/**
 * Whether the PR description has `line` (e.g. `Changelog: none`) on a line of
 * its own, outside HTML comments and code blocks, so a PR template can't
 * carry it onto every pull request.
 */
export function bodyHasLine(body, line) {
  // An unclosed comment or fence hides the rest of the description when
  // GitHub renders it, so it hides the rest here too.
  const visible = (body ?? '')
    .replace(/<!--[\s\S]*?(-->|$)/g, '')
    .replace(/^[ \t]*(```|~~~)[\s\S]*?(^[ \t]*\1|(?![\s\S]))/gm, '')
  const [key, value] = line.split(':').map(part => part.trim())
  // The whole line: "Prod migration: done not yet" doesn't count.
  const pattern = new RegExp(
    `^[ \\t]*${escape(key)}:[ \\t]*${escape(value)}[ \\t]*\\r?$`,
    'im'
  )
  return pattern.test(visible)
}

export function escape(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * True when `metaUrl`'s file is the script node was asked to run, so a check
 * runs as a script and never on import. Compared as real paths: a symlink or
 * a space in the path can't skip the check and pass silently.
 */
export function isMain(metaUrl) {
  return Boolean(
    process.argv[1] &&
    realpathSync(process.argv[1]) === realpathSync(fileURLToPath(metaUrl))
  )
}

/** `<base sha> <head sha>` from the command line, or exit with usage. */
export function readRange(name) {
  const [base, head] = process.argv.slice(2)
  if (!base || !head) {
    console.error(`Usage: ${name} <base sha> <head sha>`)
    process.exit(2)
  }
  return { base, head }
}
