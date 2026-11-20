import assert from 'node:assert/strict'
import { test } from 'node:test'

import { filterMentionOptions, MENTION_LIST_LIMIT } from './mention-utils.ts'

const person = (name: string) => ({ id: name, name, avatarUrl: null })
const PEOPLE = [
  person('Kris Crawford'),
  person('Dave Pokk'),
  person('Jason Desiderio'),
]
const names = (query: string) =>
  filterMentionOptions(PEOPLE, query).map(p => p.name)

test('an empty query lists everyone by name', () => {
  assert.deepEqual(names(''), ['Dave Pokk', 'Jason Desiderio', 'Kris Crawford'])
})

test('matches the start of any word, first names first', () => {
  assert.deepEqual(names('kr'), ['Kris Crawford'])
  assert.deepEqual(names('CRAW'), ['Kris Crawford'])
  assert.deepEqual(names('d'), ['Dave Pokk', 'Jason Desiderio'])
})

test('no match inside a word, and none for strangers', () => {
  assert.deepEqual(names('ris'), [])
  assert.deepEqual(names('zed'), [])
})

test('shows at most the list limit', () => {
  const many = Array.from({ length: 20 }, (_, i) => person(`Person ${i}`))
  assert.equal(filterMentionOptions(many, 'p').length, MENTION_LIST_LIMIT)
})
