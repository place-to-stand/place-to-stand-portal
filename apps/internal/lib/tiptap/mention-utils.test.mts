import assert from 'node:assert/strict'
import { test } from 'node:test'

import { filterMentionOptions, MENTION_LIST_LIMIT } from './mention-utils.ts'

const person = (name: string) => ({ id: name, name, avatarUrl: null })
const PEOPLE = [
  person('Alex Rivera'),
  person('Priya Shah'),
  person('Jordan Park'),
]
const names = (query: string) =>
  filterMentionOptions(PEOPLE, query).map(p => p.name)

test('an empty query lists everyone by name', () => {
  assert.deepEqual(names(''), ['Alex Rivera', 'Jordan Park', 'Priya Shah'])
})

test('matches the start of any word, first names first', () => {
  assert.deepEqual(names('al'), ['Alex Rivera'])
  assert.deepEqual(names('RIV'), ['Alex Rivera'])
  assert.deepEqual(names('p'), ['Priya Shah', 'Jordan Park'])
})

test('no match inside a word, and none for strangers', () => {
  assert.deepEqual(names('lex'), [])
  assert.deepEqual(names('zed'), [])
})

test('shows at most the list limit', () => {
  const many = Array.from({ length: 20 }, (_, i) => person(`Person ${i}`))
  assert.equal(filterMentionOptions(many, 'p').length, MENTION_LIST_LIMIT)
})
