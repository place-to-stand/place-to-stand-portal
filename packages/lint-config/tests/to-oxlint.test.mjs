import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { convertRules, oxlintRuleId, toOxlint } from '../to-oxlint.mjs'

const require = createRequire(import.meta.url)

test('oxlint-rules.json matches the installed Oxlint', () => {
  const bin = join(
    dirname(require.resolve('oxlint/package.json')),
    'bin/oxlint'
  )
  const rules = JSON.parse(
    execFileSync(process.execPath, [bin, '--rules', '-f', 'json']).toString()
  )
  const ids = rules
    .filter(r => r.category !== 'nursery')
    .map(r =>
      r.scope === 'eslint' ? r.value : `${r.scope.replace('_', '-')}/${r.value}`
    )
    .sort()
  const saved = JSON.parse(
    readFileSync(new URL('../oxlint-rules.json', import.meta.url), 'utf8')
  )
  assert.deepEqual(
    saved,
    ids,
    'Run node packages/lint-config/scripts/oxlint-rules.mjs'
  )
})

test('rule ids map to Oxlint or to their ESLint plugin', () => {
  assert.equal(oxlintRuleId('no-console'), 'no-console')
  assert.equal(
    oxlintRuleId('@typescript-eslint/no-deprecated'),
    'typescript/no-deprecated'
  )
  assert.equal(
    oxlintRuleId('@typescript-eslint/no-unused-vars'),
    'ts-js/no-unused-vars'
  )
  assert.equal(
    oxlintRuleId('@typescript-eslint/ban-ts-comment'),
    'ts-js/ban-ts-comment'
  )
  assert.equal(oxlintRuleId('jsx-a11y/alt-text'), 'jsx-a11y-js/alt-text')
  assert.equal(
    oxlintRuleId('react-hooks/exhaustive-deps'),
    'react/exhaustive-deps'
  )
  assert.equal(
    oxlintRuleId('react-hooks/set-state-in-effect'),
    'react-compiler/set-state-in-effect'
  )
  assert.equal(
    oxlintRuleId('@next/next/no-img-element'),
    'next-js/no-img-element'
  )
  assert.equal(
    oxlintRuleId('@next/next/no-location-assign-relative-destination'),
    'next-js/no-location-assign-relative-destination'
  )
  assert.equal(oxlintRuleId('react/no-deprecated'), 'react-js/no-deprecated')
  assert.equal(
    oxlintRuleId('react/require-render-return'),
    'react-js/require-render-return'
  )
  assert.equal(oxlintRuleId('no-restricted-syntax'), 'pts/restricted-syntax')
  assert.equal(
    oxlintRuleId('@eslint-community/eslint-comments/require-description'),
    'pts/require-description'
  )
  assert.equal(oxlintRuleId('react/jsx-uses-vars'), null)
  // Turning off a rule Oxlint lacks needs nothing.
  assert.equal(oxlintRuleId('react/prop-types', { off: true }), null)
  assert.throws(() => oxlintRuleId('unknown-plugin/rule'))
})

test('warnings fail like errors; options of an off rule are dropped', () => {
  assert.deepEqual(
    convertRules({
      'no-console': 'warn',
      'max-lines': ['warn', { max: 3 }],
      eqeqeq: ['off', 'always'],
    }),
    { 'no-console': 'error', 'max-lines': ['error', { max: 3 }], eqeqeq: 'off' }
  )
})

test('the typescript-eslint copy of a rule stays apart from the core one', () => {
  assert.deepEqual(
    convertRules({
      '@typescript-eslint/no-unused-vars': 'error',
      'no-unused-vars': 'off',
    }),
    { 'ts-js/no-unused-vars': 'error', 'no-unused-vars': 'off' }
  )
})

test('two ESLint rules may not land on one Oxlint rule', () => {
  assert.throws(
    () =>
      convertRules({
        'react-hooks/exhaustive-deps': 'error',
        'react/exhaustive-deps': 'off',
      }),
    /both map to react\/exhaustive-deps/
  )
})

test('objects keep their order; ignored files get earlier values back', () => {
  const config = toOxlint([
    { ignores: ['dist/**'] },
    { rules: { 'no-restricted-imports': ['error', { paths: ['a'] }] } },
    {
      files: ['lib/queries/**'],
      ignores: ['lib/queries/old.ts'],
      rules: { 'no-restricted-imports': ['error', { paths: ['a', 'b'] }] },
    },
    {
      files: ['**/*.ts'],
      ignores: ['**/*.test.*'],
      rules: { 'max-lines': 'error' },
    },
  ])
  assert.deepEqual(config.ignorePatterns, ['dist/**'])
  assert.deepEqual(config.overrides, [
    {
      files: ['**/*'],
      rules: { 'no-restricted-imports': ['error', { paths: ['a'] }] },
    },
    {
      files: ['lib/queries/**'],
      rules: { 'no-restricted-imports': ['error', { paths: ['a', 'b'] }] },
    },
    {
      files: ['lib/queries/old.ts'],
      rules: { 'no-restricted-imports': ['error', { paths: ['a'] }] },
    },
    { files: ['**/*.ts'], rules: { 'max-lines': 'error' } },
    { files: ['**/*.test.*'], rules: { 'max-lines': 'off' } },
  ])
})

test("settings carry over, with react.version 'detect' resolved", () => {
  const { settings } = toOxlint([
    {
      settings: { react: { version: 'detect' } },
      rules: { 'no-console': 'error' },
    },
    {
      settings: { next: { rootDir: 'apps/x' } },
      rules: { 'no-debugger': 'error' },
    },
  ])
  assert.match(settings.react.version, /^\d+\.\d+\.\d+/)
  assert.deepEqual(settings.next, { rootDir: 'apps/x' })
})
