#!/usr/bin/env node
/**
 * Keeps hours, money and percentages one format (run by `npm run lint`). All
 * three are built only in packages/ui/src/numbers.ts (`@pts/ui/numbers`:
 * `formatHours` → "1.5h", `formatCurrency` → "$1,234.00", `formatPercent` →
 * "8.25%"). Fails on a hand-rolled copy
 * anywhere else in the apps or packages:
 *
 * - `new Intl.NumberFormat(…)`, `currency: 'USD'`, or `toLocaleString` with
 *   currency / fraction-digit options
 * - a local `formatHours` / `formatCurrency` / `formatMoney` definition
 * - hours glued on by hand: `${n}h`, `${n} hrs`, `{n}h`, `{n} hrs`,
 *   `${n.toFixed(2)} hours`
 * - a dollar sign glued on by hand: `$${n}`, or `${n}` as JSX text
 * - a percent sign glued on by hand: `${n}%`, `toFixed(…)}%`, or `{n}%` as JSX
 *
 * Need a variant (no cents, a sign)? Add an option to numbers.ts. A line that
 * is not a figure for people (a CSS width) can carry `format-check: allow`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const DIRS = [
  'apps/internal/app',
  'apps/internal/components',
  'apps/internal/hooks',
  'apps/internal/lib',
  'apps/client/app',
  'apps/client/components',
  'apps/client/lib',
  'packages',
]
const SKIP =
  /node_modules|\.next|\/dist\/|tiptap|rich-text-editor|packages\/ui\/src\/numbers\.ts$/

const RULES = [
  [/new Intl\.NumberFormat\b/, 'new Intl.NumberFormat'],
  [/currency:\s*['"]USD['"]/, "currency: 'USD'"],
  [
    /\.toLocaleString\([^)]*\{[^}]*(?:currency|FractionDigits)/,
    'toLocaleString with number options',
  ],
  [
    /(?:function|const|let|var)\s+(?:formatHours|formatCurrency|formatMoney|formatUsd|formatDollars)\b/,
    'local hours/money formatter',
  ],
  [/toFixed\(\d*\)\s*\}?\s?(?:h|hrs?|hours?)\b/, 'toFixed hours'],
  [
    /\$\{[^{}]*\}(?:h\b(?![-\w])| hrs?\b)/,
    'hours suffix glued on (${n}h / ${n} hrs)',
  ],
  [/\$\$\{/, 'dollar sign glued on ($${n})'],
  [
    /(?:function|const|let|var)\s+(?:formatPercent|formatRate|formatTaxRate)\b/,
    'local percent formatter',
  ],
  [/(?<!%)\$\{[^{}]*\}%/, 'percent sign glued on (${n}%)'],
  [/toFixed\(\d*\)[^\n]{0,3}%/, 'toFixed percent'],
]
// JSX text only (lines without a template literal).
const JSX_RULES = [
  [
    /(?:^|[\s>])\{[^{}]*\}(?:h\b(?![-\w])| hrs?\b)/,
    'hours suffix glued on in JSX ({n}h / {n} hrs)',
  ],
  [/(?:^|[\s>(])\$\{/, 'dollar sign glued on in JSX (${n})'],
  [/(?:^|[\s>(])\{[^{}]*\}%/, 'percent sign glued on in JSX ({n}%)'],
]

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (SKIP.test(path)) continue
    if (statSync(path).isDirectory()) yield* files(path)
    else if (/\.(?:ts|tsx|mjs)$/.test(path) && !path.endsWith('.d.ts'))
      yield path
  }
}

/** Each hand-built hours, money or percent format in `source`. */
export function checkFormatters(source, file) {
  const found = []
  source.split('\n').forEach((line, index) => {
    if (/^\s*(?:\/\/|\*|\/\*)/.test(line)) return
    if (line.includes('format-check: allow')) return
    const rules = [...RULES]
    if (file.endsWith('.tsx') && !line.includes('`')) rules.push(...JSX_RULES)
    for (const [pattern, label] of rules) {
      if (pattern.test(line)) found.push({ line: index + 1, label })
    }
  })
  return found
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

const errors = []
if (isMain) {
  for (const dir of DIRS) {
    for (const file of files(join(root, dir))) {
      for (const { line, label } of checkFormatters(
        readFileSync(file, 'utf8'),
        file
      )) {
        errors.push(`${file.slice(root.length)}:${line}: ${label}`)
      }
    }
  }
}

if (!isMain) {
  // Imported by the tests: nothing to report.
} else if (errors.length) {
  console.error(
    'Formatter check failed: format hours, money and percentages with @pts/ui/numbers (formatHours, formatCurrency, formatPercent).'
  )
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
} else
  console.log(
    'Formatters: hours, money and percentages come only from @pts/ui/numbers'
  )
