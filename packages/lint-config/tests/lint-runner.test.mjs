import { test } from 'node:test'
import assert from 'node:assert/strict'

import { applySuppressions, ruleIdOf, suppressionsFor } from '../bin/lint.mjs'

const problem = (file, ruleId, line = 1) => ({ file, ruleId, line })

test("Oxlint's codes read as rule ids", () => {
  assert.equal(ruleIdOf('eslint(max-lines)'), 'max-lines')
  assert.equal(
    ruleIdOf('typescript-eslint(no-deprecated)'),
    'typescript/no-deprecated'
  )
  assert.equal(ruleIdOf('next(no-img-element)'), 'nextjs/no-img-element')
  assert.equal(ruleIdOf('pts(copy)'), 'pts/copy')
  assert.equal(
    ruleIdOf('react-compiler(set-state-in-effect)'),
    'react-compiler/set-state-in-effect'
  )
  assert.equal(ruleIdOf(undefined), null)
})

test('a file within its count passes; one over reports every one', () => {
  const suppressions = { 'a.ts': { 'max-lines': { count: 1 } } }
  assert.deepEqual(
    applySuppressions([problem('a.ts', 'max-lines')], suppressions),
    { reported: [], unused: [] }
  )
  const two = [problem('a.ts', 'max-lines', 1), problem('a.ts', 'max-lines', 2)]
  assert.deepEqual(applySuppressions(two, suppressions).reported, two)
})

test('problems without a rule (unused disable comments) are never suppressed', () => {
  const unusedDirective = problem('a.ts', null)
  assert.deepEqual(
    applySuppressions([unusedDirective], { 'a.ts': {} }).reported,
    [unusedDirective]
  )
})

test('a suppression that no longer occurs is reported', () => {
  const suppressions = { 'a.ts': { 'max-lines': { count: 2 } } }
  assert.deepEqual(
    applySuppressions([problem('a.ts', 'max-lines')], suppressions).unused,
    [{ file: 'a.ts', ruleId: 'max-lines', count: 2, found: 1 }]
  )
  // Linting only other files leaves it alone (pre-commit).
  assert.deepEqual(
    applySuppressions([], suppressions, new Set(['b.ts'])).unused,
    []
  )
})

test('suppressionsFor counts problems by file and rule, sorted', () => {
  assert.deepEqual(
    suppressionsFor([
      problem('b.ts', 'pts/copy'),
      problem('a.ts', 'max-lines'),
      problem('a.ts', 'max-lines'),
      problem('a.ts', null),
    ]),
    {
      'a.ts': { 'max-lines': { count: 2 } },
      'b.ts': { 'pts/copy': { count: 1 } },
    }
  )
})
