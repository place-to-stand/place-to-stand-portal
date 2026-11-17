/**
 * Writes oxlint-rules.json: every rule Oxlint implements natively (nursery
 * rules left out), as to-oxlint.mjs names them. Run after updating oxlint:
 *   node packages/lint-config/scripts/oxlint-rules.mjs
 * tests/to-oxlint.test.mjs fails while the list is stale.
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
const rules = JSON.parse(
  execFileSync(
    new URL('../../../node_modules/.bin/oxlint', import.meta.url).pathname,
    ['--rules', '-f', 'json']
  ).toString()
)
const ids = rules
  .filter(r => r.category !== 'nursery')
  .map(r =>
    r.scope === 'eslint' ? r.value : `${r.scope.replace('_', '-')}/${r.value}`
  )
  .sort()
writeFileSync(
  new URL('../oxlint-rules.json', import.meta.url),
  JSON.stringify(ids, null, 1) + '\n'
)
console.log(ids.length)
