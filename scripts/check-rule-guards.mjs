#!/usr/bin/env node
/**
 * Every written rule names what guards it (run by `npm run lint`), so a new
 * preference can't land as words alone.
 *
 * Reads docs/design-system/README.md's "House rules" list and every
 * **Rules** paragraph or bullet list in docs/design-system/components/*.md,
 * and fails on a rule that doesn't end with a guard:
 *
 *   (guard: eslint `pts/no-align-start`)
 *   (guard: scripts/check-badges.mjs)
 *   (guard: eslint `pts/toast-copy`; review)
 *   (guard: review)            ← can't be automated: allowed, but explicit
 *
 * A `pts/*` rule must exist in packages/eslint-config/plugin.mjs, and a
 * script path must exist on disk.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { pts } from '../packages/eslint-config/plugin.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const docs = join(root, 'docs/design-system')
const GUARD = /\(guard: ([^)]*)\)\s*$/

/** Each rule as { where, text }. */
function houseRules() {
  const text = readFileSync(join(docs, 'README.md'), 'utf8')
  const section = text.split(/^## House rules.*$/m)[1]?.split(/^## /m)[0] ?? ''
  if (!section.trim())
    throw new Error('README.md has no "## House rules" section')
  return section
    .split('\n')
    .map((line, i) => ({ line, i }))
    .filter(({ line }) => /^\d+\.\s/.test(line))
    .map(({ line }) => ({
      where: `README.md house rule ${line.match(/^\d+/)[0]}`,
      text: line,
    }))
}

function componentRules(file) {
  const lines = readFileSync(join(docs, 'components', file), 'utf8').split('\n')
  const rules = []
  lines.forEach((line, i) => {
    if (!/^\*\*Rules\b/.test(line)) return
    const inline = line.replace(/^\*\*Rules[^*]*\*\*:?\s*/, '').trim()
    if (inline) {
      rules.push({ where: `components/${file}:${i + 1}`, text: line })
      return
    }
    for (let j = i + 1; j < lines.length && /^- /.test(lines[j]); j++) {
      rules.push({ where: `components/${file}:${j + 1}`, text: lines[j] })
    }
  })
  return rules
}

const rules = [
  ...houseRules(),
  ...readdirSync(join(docs, 'components'))
    .filter(name => name.endsWith('.md'))
    .sort()
    .flatMap(componentRules),
]

const errors = []
for (const { where, text } of rules) {
  const match = text.trim().match(GUARD)
  if (!match) {
    errors.push(
      `${where}: no guard. End it with (guard: eslint \`rule-id\`), (guard: scripts/<check>.mjs) or (guard: review).`
    )
    continue
  }
  for (const part of match[1].split(';').map(p => p.trim())) {
    const eslint = part.match(/^eslint `([^`]+)`$/)
    if (eslint) {
      const id = eslint[1]
      if (id.startsWith('pts/') && !pts.rules[id.slice(4)]) {
        errors.push(
          `${where}: eslint rule ${id} doesn't exist in packages/eslint-config/plugin.mjs`
        )
      }
    } else if (/^scripts\/[\w-]+\.mjs$/.test(part)) {
      if (!existsSync(join(root, part)))
        errors.push(`${where}: ${part} doesn't exist`)
    } else if (part !== 'review') {
      errors.push(
        `${where}: unknown guard "${part}" (use eslint \`id\`, scripts/<check>.mjs or review)`
      )
    }
  }
}

if (errors.length) {
  console.error(
    'Rule guard check failed: every design-system rule names what enforces it.'
  )
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}
const automated = rules.filter(
  r => !/\(guard: review\)\s*$/.test(r.text.trim())
).length
console.log(
  `Rule guards: ${rules.length} rules each name a guard (${automated} automated, ${rules.length - automated} by review)`
)
