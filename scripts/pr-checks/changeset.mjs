#!/usr/bin/env node
/**
 * A pull request that changes a package we publish to npm must say how, or
 * the change never ships:
 *
 *   node scripts/pr-checks/changeset.mjs <base sha> <head sha>
 *
 * with the PR description in PR_BODY and the branch in HEAD_REF. It passes
 * when the PR adds a changeset (`npx changeset`) naming each published
 * package it changes, or its description has the line `Changeset: none`
 * (a change nobody installing the package would notice: tests, lint, a dev
 * dependency). The "Release packages" PR the release workflow opens is
 * exempt: it is the one that spends the changesets.
 */
import { PUBLISHED } from '../published-packages.mjs'
import { bodyHasLine, changedFiles, git, isMain, readRange } from './shared.mjs'

const NONE = 'Changeset: none'
const RELEASE_BRANCH = 'changeset-release/main'
const CHANGESET = /^\.changeset\/(?!README\.md$)[^/]+\.md$/

/** Files that never reach npm: tests and the package's own tooling. */
const NOT_SHIPPED =
  /(\.(test|spec)\.[cm]?[jt]sx?$|\/(__tests__|__snapshots__|fixtures)\/|\/(oxlint\.config\.mjs|lint-suppressions\.json|tsconfig(\.[^/]*)?\.json)$)/

/** The names a changeset's front matter bumps, e.g. '@placetostand/ui'. */
export function changesetPackages(text) {
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (!front) return []
  return front[1]
    .split(/\r?\n/)
    .map(line => /^\s*['"]?([^'":\s]+)['"]?\s*:/.exec(line)?.[1])
    .filter(Boolean)
}

export function checkChangeset({ files, body, headRef, packages, changesets }) {
  if (headRef === RELEASE_BRANCH) return { ok: true, why: 'release PR' }
  const touched = packages.filter(({ dir }) =>
    files.some(file => file.startsWith(`${dir}/`) && !NOT_SHIPPED.test(file))
  )
  if (touched.length === 0)
    return { ok: true, why: 'no published package changed' }
  if (bodyHasLine(body, NONE)) return { ok: true, why: NONE }
  const named = new Set(changesets.flatMap(changesetPackages))
  const missing = touched.filter(({ name }) => !named.has(name))
  if (missing.length === 0) return { ok: true, why: 'changeset added' }
  return { ok: false, missing }
}

function main() {
  const { base, head } = readRange('changeset.mjs')
  const files = changedFiles(base, head)
  const packages = PUBLISHED.map(dir => ({
    dir,
    name: JSON.parse(git('show', `${head}:${dir}/package.json`)).name,
  }))
  // Added or changed changesets, read as the PR leaves them.
  const changesets = changedFiles(base, head, 'AM')
    .filter(file => CHANGESET.test(file))
    .map(file => git('show', `${head}:${file}`))
  const result = checkChangeset({
    files,
    body: process.env.PR_BODY,
    headRef: process.env.HEAD_REF,
    packages,
    changesets,
  })
  if (result.ok) {
    console.log(`Changeset check passed: ${result.why}.`)
    return
  }
  console.error(
    [
      'This pull request changes a package we publish to npm, but adds no',
      'changeset for it, so the change would never be released:',
      '',
      ...result.missing.map(({ name, dir }) => `  ${name} (${dir})`),
      '',
      'Run `npx changeset`, pick the package and patch, minor or major, write',
      'one sentence, and commit the file it creates. If nobody installing the',
      'package would notice the change (tests, lint, a dev dependency), add',
      'this line to the pull request description instead:',
      `  ${NONE}`,
    ].join('\n')
  )
  process.exit(1)
}

if (isMain(import.meta.url)) main()
