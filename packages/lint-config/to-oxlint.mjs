/**
 * Turns a config written in ESLint's flat format (base.mjs, next.mjs) into an
 * Oxlint config. We keep the flat format because it reads well. Each workspace's
 * oxlint.config.mjs is `export default toOxlint(<config>)`.
 *
 * How the formats differ, and what this does about it:
 * - Flat config applies objects in order, a later one winning. Oxlint has
 *   base `rules` plus `overrides` applied in order, so every object becomes
 *   an override, in the same order.
 * - An object's `ignores` (files it skips) has no Oxlint form. The override
 *   is followed by one for the skipped files that puts each of its rules back
 *   to the value earlier objects gave those files.
 * - An object holding only `ignores` skips files everywhere: ignorePatterns.
 * - Rule names map to Oxlint's (`@typescript-eslint/x` is `typescript/x`).
 *   Rules Oxlint doesn't have natively run from their ESLint plugins through
 *   `jsPlugins` (JS_RULES); `pts/*` rules always do.
 * - `env` (the globals an object declares) carries over as is.
 * - A later object that sets only a rule's severity keeps its earlier
 *   options, as in ESLint (Oxlint would reset them: inheritOptions).
 * - Oxlint runs every rule at the severity it's given, and lint fails on any
 *   problem, so `warn` becomes `error`.
 */
import { createRequire } from 'node:module'
import { join, matchesGlob } from 'node:path'
import { fileURLToPath } from 'node:url'

import tsPlugin from '@typescript-eslint/eslint-plugin'

import nativeRules from './oxlint-rules.json' with { type: 'json' }

/** Every rule Oxlint implements (scripts/oxlint-rules.mjs writes the list). */
const NATIVE = new Set(nativeRules)

const here = path => fileURLToPath(new URL(path, import.meta.url))

/**
 * Plugins loaded as JavaScript. Names Oxlint implements natively (react,
 * jsx-a11y, nextjs, …) are reserved, so the ESLint copies take an alias.
 */
export const JS_PLUGINS = [
  { name: 'pts', specifier: here('./plugin.mjs') },
  // The React Compiler's own rules. Oxlint has a port, but it reports
  // different code, so we run React's.
  { name: 'react-compiler', specifier: 'eslint-plugin-react-hooks' },
  { name: 'react-js', specifier: 'eslint-plugin-react' },
  { name: 'next-js', specifier: '@next/eslint-plugin-next' },
  { name: 'jsx-a11y-js', specifier: 'eslint-plugin-jsx-a11y' },
  // typescript-eslint's rules that need no type information. Oxlint's ports
  // differ on defaults (no-unused-vars skips `_names`, ban-ts-comment bans
  // @ts-check) and on edge cases (unused `declare namespace`).
  { name: 'ts-js', specifier: '@typescript-eslint/eslint-plugin' },
]

/** Where a rule Oxlint lacks runs from, by its Oxlint plugin name. */
const JS_FALLBACK = {
  react: 'react-js',
}

/** ESLint rule ids that run from a JavaScript plugin, and the id they run as. */
const JS_RULES = {
  // Oxlint has no no-restricted-syntax: pts/restricted-syntax takes the
  // same options.
  'no-restricted-syntax': 'pts/restricted-syntax',
  // The eslint-comments plugin crashes under Oxlint: same rules in pts.
  '@eslint-community/eslint-comments/require-description':
    'pts/require-description',
  '@eslint-community/eslint-comments/no-unlimited-disable':
    'pts/no-unlimited-disable',
  '@eslint-community/eslint-comments/disable-enable-pair':
    'pts/disable-enable-pair',
}

/**
 * Rules that can never report, so they have no Oxlint form: they only tell
 * ESLint's no-unused-vars that JSX uses React and the component. Oxlint's
 * no-unused-vars reads JSX itself.
 */
const NO_OP_RULES = new Set(['react/jsx-uses-react', 'react/jsx-uses-vars'])

/**
 * typescript-eslint rules that read types run natively on tsgolint (a
 * JavaScript plugin gets no type information); the rest run from the plugin.
 */
const needsTypes = rule =>
  tsPlugin.rules[rule]?.meta?.docs?.requiresTypeChecking === true

/** The react-hooks rules Oxlint implements; the rest are the compiler's. */
const NATIVE_HOOK_RULES = new Set(['rules-of-hooks', 'exhaustive-deps'])

/**
 * The Oxlint id for an ESLint rule id, or null for a rule to drop. A rule
 * Oxlint lacks (or has only as an unfinished nursery rule, like
 * react/require-render-return) runs from its ESLint plugin; turning one off
 * is dropped, since nothing turned it on.
 */
export function oxlintRuleId(id, { off = false } = {}) {
  const mapped = mapRuleId(id)
  if (!mapped || mapped.startsWith('pts/') || NATIVE.has(mapped)) return mapped
  if (
    mapped.includes('/') &&
    JS_PLUGINS.some(p => mapped.startsWith(`${p.name}/`))
  ) {
    return mapped
  }
  if (off) return null
  const slash = mapped.lastIndexOf('/')
  const fallback = JS_FALLBACK[mapped.slice(0, slash)]
  if (fallback) return `${fallback}/${mapped.slice(slash + 1)}`
  throw new Error(`No Oxlint rule or JS plugin for ${id} (${mapped})`)
}

function mapRuleId(id) {
  if (NO_OP_RULES.has(id)) return null
  if (JS_RULES[id]) return JS_RULES[id]
  const slash = id.lastIndexOf('/')
  if (slash === -1) return id
  const plugin = id.slice(0, slash)
  const rule = id.slice(slash + 1)
  switch (plugin) {
    case '@typescript-eslint':
      return needsTypes(rule) ? `typescript/${rule}` : `ts-js/${rule}`
    case 'react-hooks':
      return NATIVE_HOOK_RULES.has(rule)
        ? `react/${rule}`
        : `react-compiler/${rule}`
    // Oxlint's ports of these two plugins report differently from the
    // originals (Next's document rules, jsx-a11y's ARIA data), so both run
    // from the real plugins. They are cheap: about a second on the portal.
    case '@next/next':
      return `next-js/${rule}`
    case 'jsx-a11y':
      return `jsx-a11y-js/${rule}`
    default:
      // pts, react, import keep their names.
      return id
  }
}

function severity(value) {
  const [level, ...options] = Array.isArray(value) ? value : [value]
  const normal =
    level === 0 || level === 'off'
      ? 'off'
      : level === 1 || level === 2 || level === 'warn' || level === 'error'
        ? 'error'
        : null
  if (!normal)
    throw new Error(`Unknown rule severity: ${JSON.stringify(level)}`)
  // Options of a rule that's off are never read (and may not validate).
  return normal === 'off' || options.length === 0
    ? normal
    : [normal, ...options]
}

/**
 * One object's rules in Oxlint form. ESLint ids that map to one Oxlint id
 * (`no-unused-vars` and `@typescript-eslint/no-unused-vars`) take the
 * typescript-eslint value, which is the one ESLint ran on TypeScript files.
 */
export function convertRules(rules = {}) {
  const out = {}
  const from = {}
  for (const [id, value] of Object.entries(rules)) {
    const level = severity(value)
    const next = oxlintRuleId(id, { off: level === 'off' })
    if (!next) continue
    // Two ESLint rules landing on one Oxlint rule would let one overwrite
    // the other's setting.
    if (from[next] && from[next] !== id) {
      throw new Error(`${from[next]} and ${id} both map to ${next}`)
    }
    from[next] = id
    out[next] = level
  }
  return out
}

const matches = (pattern, file) => {
  // A pattern with no slash matches at the config's root only, as in
  // ESLint; `**/` patterns match anywhere.
  try {
    return matchesGlob(file, pattern)
  } catch {
    return false
  }
}

/**
 * Whether an object applies to `pattern` (an ignored glob, read as a
 * path). Used only to find the value to restore for skipped files.
 */
function appliesTo(object, pattern) {
  if (!object.files) return true
  const files = object.files.flat()
  const hit = files.some(
    glob => matches(glob, pattern) || matches(pattern, glob) || glob === pattern
  )
  const skipped = (object.ignores ?? []).some(
    glob => matches(glob, pattern) || glob === pattern
  )
  return hit && !skipped
}

/** Whether every file `files` matches is also matched by `earlier`. */
function covers(earlier, files) {
  if (!earlier.files) return true
  const globs = earlier.files.flat()
  return files.every(file =>
    globs.some(glob => glob === file || matches(glob, file))
  )
}

/** Whether `earlier` matches some of the files `files` matches. */
function overlaps(earlier, files) {
  if (!earlier.files) return true
  return earlier.files
    .flat()
    .some(glob =>
      files.some(
        file => glob === file || matches(glob, file) || matches(file, glob)
      )
    )
}

/**
 * ESLint keeps a rule's earlier options when a later object sets only its
 * severity (eslint-config-next's alt-text options under jsx-a11y's
 * `'error'`); Oxlint resets them. Copy them forward. An earlier object that
 * covers only some of the files would need a split, so it throws instead.
 */
function inheritOptions(rules, files, earlierObjects) {
  for (const [ruleId, value] of Object.entries(rules)) {
    if (value !== 'error') continue
    for (const earlier of [...earlierObjects].reverse()) {
      if (!earlier.rules) continue
      const previous = convertRules(earlier.rules)[ruleId]
      if (previous === undefined || !overlaps(earlier, files)) continue
      if (!covers(earlier, files)) {
        if (Array.isArray(previous)) {
          throw new Error(
            `${ruleId}: options set for some of ${files.join(', ')} only; give them again.`
          )
        }
        continue
      }
      if (Array.isArray(previous))
        rules[ruleId] = ['error', ...previous.slice(1)]
      break
    }
  }
}

/**
 * `react.version: 'detect'` as eslint-plugin-react resolves it (the React
 * installed where lint runs), since Oxlint only takes a version number.
 */
function detectReactVersion(settings) {
  if (settings.react?.version !== 'detect') return settings
  let version
  try {
    const require = createRequire(join(process.cwd(), 'package.json'))
    version = require('react/package.json').version
  } catch {
    // No React here: drop the setting, as the plugin would fall back.
    const react = { ...settings.react }
    delete react.version
    return { ...settings, react }
  }
  return { ...settings, react: { ...settings.react, version } }
}

/** Flat config objects → one Oxlint config. */
export function toOxlint(flatConfig, { settings } = {}) {
  const objects = flatConfig.flat(Infinity)
  const ignorePatterns = []
  const overrides = []
  const mergedSettings = {}

  objects.forEach((object, index) => {
    const keys = Object.keys(object).filter(key => key !== 'name')
    if (keys.length === 1 && keys[0] === 'ignores') {
      ignorePatterns.push(...object.ignores)
      return
    }
    // Settings apply everywhere in Oxlint (ESLint scopes them to `files`,
    // but every preset sets them for all files): react.version, next.rootDir.
    for (const [key, value] of Object.entries(object.settings ?? {})) {
      mergedSettings[key] = { ...mergedSettings[key], ...value }
    }
    if (!object.rules || Object.keys(object.rules).length === 0) return
    const rules = convertRules(object.rules)
    const files = object.files ? object.files.flat() : ['**/*']
    inheritOptions(rules, files, objects.slice(0, index))
    // Declared globals (`window`), which scope-reading rules depend on.
    overrides.push(
      object.env ? { files, env: object.env, rules } : { files, rules }
    )
    if (!object.ignores?.length) return

    // The skipped files keep what earlier objects gave them.
    const restore = {}
    for (const ruleId of Object.keys(rules)) restore[ruleId] = 'off'
    for (const earlier of objects.slice(0, index)) {
      if (!earlier.rules) continue
      if (!object.ignores.some(glob => appliesTo(earlier, glob))) continue
      for (const [ruleId, value] of Object.entries(
        convertRules(earlier.rules)
      )) {
        if (ruleId in restore) restore[ruleId] = value
      }
    }
    overrides.push({ files: object.ignores, rules: restore })
  })

  return {
    $schema: './node_modules/oxlint/configuration_schema.json',
    // Only the rules listed run: no default categories.
    categories: {
      correctness: 'off',
      suspicious: 'off',
      pedantic: 'off',
      perf: 'off',
      style: 'off',
      restriction: 'off',
      nursery: 'off',
    },
    plugins: ['typescript', 'react', 'import', 'unicorn', 'oxc'],
    jsPlugins: JS_PLUGINS,
    settings: detectReactVersion({ ...mergedSettings, ...settings }),
    ignorePatterns,
    rules: {},
    overrides,
  }
}
