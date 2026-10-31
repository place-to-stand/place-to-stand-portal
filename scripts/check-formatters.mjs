#!/usr/bin/env node
/**
 * Keeps hours and money one format (run by `npm run lint`). Both are built
 * only in packages/ui/src/numbers.ts (`@pts/ui/numbers`: `formatHours` →
 * "1.5h", `formatCurrency` → "$1,234.00"). Fails on a hand-rolled copy
 * anywhere else in the apps or packages:
 *
 * - `new Intl.NumberFormat(…)`, `currency: 'USD'`, or `toLocaleString` with
 *   currency / fraction-digit options
 * - a local `formatHours` / `formatCurrency` / `formatMoney` definition
 * - hours glued on by hand: `${n}h`, `${n} hrs`, `{n}h`, `{n} hrs`,
 *   `${n.toFixed(2)} hours`
 * - a dollar sign glued on by hand: `$${n}`, or `${n}` as JSX text
 *
 * Need a variant (no cents, a sign)? Add an option to numbers.ts.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
const SKIP = /node_modules|\.next|\/dist\/|tiptap|rich-text-editor|packages\/ui\/src\/numbers\.ts$/

const RULES = [
  [/new Intl\.NumberFormat\b/, 'new Intl.NumberFormat'],
  [/currency:\s*['"]USD['"]/, "currency: 'USD'"],
  [/\.toLocaleString\([^)]*\{[^}]*(?:currency|FractionDigits)/, 'toLocaleString with number options'],
  [/(?:function|const|let|var)\s+(?:formatHours|formatCurrency|formatMoney|formatUsd|formatDollars)\b/, 'local hours/money formatter'],
  [/toFixed\(\d*\)\s*\}?\s?(?:h|hrs?|hours?)\b/, 'toFixed hours'],
  [/\$\{[^{}]*\}(?:h\b(?![-\w])| hrs?\b)/, 'hours suffix glued on (${n}h / ${n} hrs)'],
  [/\$\$\{/, 'dollar sign glued on ($${n})'],
]
// JSX text only (lines without a template literal).
const JSX_RULES = [
  [/(?:^|[\s>])\{[^{}]*\}(?:h\b(?![-\w])| hrs?\b)/, 'hours suffix glued on in JSX ({n}h / {n} hrs)'],
  [/(?:^|[\s>(])\$\{/, 'dollar sign glued on in JSX (${n})'],
]

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (SKIP.test(path)) continue
    if (statSync(path).isDirectory()) yield* files(path)
    else if (/\.(?:ts|tsx|mjs)$/.test(path) && !path.endsWith('.d.ts')) yield path
  }
}

const errors = []
for (const dir of DIRS) {
  for (const file of files(join(root, dir))) {
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, index) => {
      if (/^\s*(?:\/\/|\*|\/\*)/.test(line)) return
      const rules = [...RULES]
      if (file.endsWith('.tsx') && !line.includes('`')) rules.push(...JSX_RULES)
      for (const [pattern, label] of rules) {
        if (pattern.test(line)) {
          errors.push(`${file.slice(root.length)}:${index + 1}: ${label}`)
        }
      }
    })
  }
}

if (errors.length) {
  console.error(
    'Formatter check failed: format hours and money with @pts/ui/numbers (formatHours, formatCurrency).'
  )
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}
console.log('Formatters: hours and money come only from @pts/ui/numbers')
