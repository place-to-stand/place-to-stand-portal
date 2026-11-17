#!/usr/bin/env node
/**
 * `pts-lint`: runs Oxlint on a workspace and applies its bulk suppressions,
 * which Oxlint has no form for. Each workspace's `lint` script is `pts-lint`.
 *
 *   pts-lint                       lint the workspace (run from its root)
 *   pts-lint <file>...             lint some files (pre-commit)
 *   pts-lint --fix <file>...       and apply Oxlint's fixes
 *   pts-lint --prune-suppressions  drop suppressions that no longer occur
 *   pts-lint --suppress-all        grandfather every current problem
 *
 * lint-suppressions.json keeps ESLint's bulk suppression format, by file and
 * Oxlint rule id: `{ "<file>": { "typescript/no-deprecated": { "count": 2 } } }`.
 * A file with that many problems of that rule or fewer passes; one more and
 * every one of them is reported, so a new problem is never hidden behind an
 * old one. A suppression that no longer occurs fails lint, so the list only
 * shrinks (run with --prune-suppressions to drop it).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, matchesGlob, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const SUPPRESSIONS_FILE = 'lint-suppressions.json'

const require = createRequire(import.meta.url)

/** Oxlint's diagnostic `code` ("typescript-eslint(no-deprecated)") as a rule id. */
export function ruleIdOf(code) {
  const match = /^([\w@/-]+)\((.+)\)$/u.exec(code ?? '')
  if (!match) return null
  const [, plugin, rule] = match
  switch (plugin) {
    case 'eslint':
      return rule
    case 'typescript-eslint':
      return `typescript/${rule}`
    case 'next':
      return `nextjs/${rule}`
    case 'eslint-plugin-react-hooks':
    case 'react-hooks':
      return `react/${rule}`
    default:
      return `${plugin}/${rule}`
  }
}

/**
 * Splits problems into the ones to report and the counts that are left
 * unused. `linted` limits the unused check to files that were linted.
 */
export function applySuppressions(problems, suppressions, linted = null) {
  const byKey = new Map()
  for (const problem of problems) {
    const key = `${problem.file}\0${problem.ruleId}`
    byKey.set(key, [...(byKey.get(key) ?? []), problem])
  }
  const reported = []
  for (const [key, list] of byKey) {
    const [file, ruleId] = key.split('\0')
    const allowed = ruleId ? (suppressions[file]?.[ruleId]?.count ?? 0) : 0
    if (list.length > allowed) reported.push(...list)
  }
  const unused = []
  for (const [file, rules] of Object.entries(suppressions)) {
    if (linted && !linted.has(file)) continue
    for (const [ruleId, { count }] of Object.entries(rules)) {
      const found = byKey.get(`${file}\0${ruleId}`)?.length ?? 0
      if (found < count) unused.push({ file, ruleId, count, found })
    }
  }
  return { reported, unused }
}

/** The suppressions that exactly cover `problems` (sorted, like ESLint's). */
export function suppressionsFor(problems) {
  const out = {}
  for (const { file, ruleId } of problems) {
    if (!ruleId) continue
    out[file] ??= {}
    out[file][ruleId] ??= { count: 0 }
    out[file][ruleId].count += 1
  }
  return Object.fromEntries(
    Object.keys(out)
      .sort()
      .map(file => [
        file,
        Object.fromEntries(
          Object.keys(out[file])
            .sort()
            .map(rule => [rule, out[file][rule]])
        ),
      ])
  )
}

// A disable comment that names no rule. The eslint-comments rules that ban it
// run as a JS plugin, so the comment would switch them off along with
// everything else: it is caught here instead, outside Oxlint.
const BLANKET_DISABLE =
  /^[\t ]*\{?\/(?:\*|\/)\s*(?:eslint|oxlint)-disable(?=\s*(?:\*\/|--|$))/gm
const SOURCE = /\.(?:[cm]?[jt]sx?)$/

/** Problems for every blanket disable comment in the files Oxlint lints. */
export function blanketDisables(file, text) {
  const problems = []
  for (const match of text.matchAll(BLANKET_DISABLE)) {
    const before = text.slice(0, match.index).split('\n')
    problems.push({
      file,
      line: before.length,
      column: match[0].indexOf('/') + 1,
      ruleId: 'pts/no-unlimited-disable',
      severity: 'error',
      message: 'Name the rules this comment disables.',
    })
  }
  return problems
}

async function scanBlanketDisables(cwd, files) {
  const { default: config } = await import(
    pathToFileURL(join(cwd, 'oxlint.config.mjs')).href
  )
  const ignores = config.ignorePatterns ?? []
  const candidates = files.length
    ? files
    : spawnSync('git', ['ls-files', '-co', '--exclude-standard', '.'], {
        cwd,
        encoding: 'utf8',
      })
        .stdout.split('\n')
        .filter(Boolean)
  return candidates
    .filter(file => SOURCE.test(file) && existsSync(join(cwd, file)))
    .filter(file => !ignores.some(glob => matchesGlob(file, glob)))
    .flatMap(file =>
      blanketDisables(file, readFileSync(join(cwd, file), 'utf8'))
    )
}

function oxlintBin() {
  const pkg = require.resolve('oxlint/package.json')
  const { bin } = JSON.parse(readFileSync(pkg, 'utf8'))
  return join(dirname(pkg), typeof bin === 'string' ? bin : bin.oxlint)
}

function runOxlint(cwd, args) {
  const result = spawnSync(
    process.execPath,
    [
      oxlintBin(),
      '-c',
      'oxlint.config.mjs',
      '--type-aware',
      '--report-unused-disable-directives-severity=error',
      '--format=json',
      // Pre-commit may hand over only files the config ignores.
      '--no-error-on-unmatched-pattern',
      ...args,
    ],
    { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }
  )
  if (result.error) throw result.error
  let parsed
  try {
    parsed = JSON.parse(result.stdout)
  } catch {
    process.stderr.write(result.stdout + result.stderr)
    throw new Error(`oxlint failed (exit ${result.status})`)
  }
  if (result.stderr.trim()) process.stderr.write(result.stderr)
  return parsed.diagnostics.map(d => {
    const span = d.labels?.[0]?.span
    return {
      file: d.filename,
      line: span?.line ?? 0,
      column: span?.column ?? 0,
      ruleId: ruleIdOf(d.code),
      severity: d.severity,
      message: d.message,
      help: d.help,
    }
  })
}

function format({ file, line, column, ruleId, message, help }) {
  const where = `${file}:${line}:${column}`
  const tail = help ? `\n    ${help}` : ''
  return `${where}  ${ruleId ?? 'oxlint'}  ${message}${tail}`
}

async function main(argv) {
  const cwd = process.cwd()
  const flags = new Set(argv.filter(arg => arg.startsWith('--')))
  const files = argv
    .filter(arg => !arg.startsWith('--'))
    .map(file => relative(cwd, resolve(file)))
  const passThrough = flags.has('--fix') ? ['--fix'] : []
  for (const flag of flags) {
    if (!['--fix', '--prune-suppressions', '--suppress-all'].includes(flag)) {
      throw new Error(`Unknown flag ${flag}`)
    }
  }

  const path = join(cwd, SUPPRESSIONS_FILE)
  const suppressions = existsSync(path)
    ? JSON.parse(readFileSync(path, 'utf8'))
    : {}
  const problems = [
    ...runOxlint(cwd, [...passThrough, ...files]),
    ...(await scanBlanketDisables(cwd, files)),
  ]

  if (flags.has('--suppress-all') || flags.has('--prune-suppressions')) {
    if (files.length)
      throw new Error(
        'Rewrite suppressions for a whole workspace, not single files.'
      )
    const next = flags.has('--suppress-all')
      ? suppressionsFor(problems)
      : suppressionsFor(
          problems.filter(
            p => (suppressions[p.file]?.[p.ruleId]?.count ?? 0) > 0
          )
        )
    // Pruning never grows a count past what was suppressed before.
    if (flags.has('--prune-suppressions')) {
      for (const [file, rules] of Object.entries(next)) {
        for (const [rule, entry] of Object.entries(rules)) {
          entry.count = Math.min(entry.count, suppressions[file][rule].count)
        }
      }
    }
    if (Object.keys(next).length) {
      writeFileSync(path, JSON.stringify(next, null, 2) + '\n')
    } else if (existsSync(path)) {
      writeFileSync(path, '{}\n')
    }
    console.log(`Wrote ${SUPPRESSIONS_FILE}.`)
  }

  const current =
    flags.has('--suppress-all') || flags.has('--prune-suppressions')
      ? JSON.parse(readFileSync(path, 'utf8'))
      : suppressions
  const linted = files.length ? new Set(files) : null
  const { reported, unused } = applySuppressions(problems, current, linted)

  for (const problem of reported) console.error(format(problem))
  for (const { file, ruleId, count, found } of unused) {
    console.error(
      `${file}  ${ruleId}  ${SUPPRESSIONS_FILE} allows ${count}, found ${found}: run \`npm run lint -- --prune-suppressions\` in this workspace.`
    )
  }
  if (reported.length || unused.length) {
    console.error(
      `\n${reported.length} problem(s), ${unused.length} stale suppression(s).`
    )
    return 1
  }
  return 0
}

const isMain =
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  try {
    process.exitCode = await main(process.argv.slice(2))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 2
  }
}
