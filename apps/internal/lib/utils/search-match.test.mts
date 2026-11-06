// Run: npx tsx --test apps/internal/lib/utils/search-match.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { SEARCH_SCORE, matchedHint, scoreSearchMatch } from './search-match.ts'

const contacts = ['Jane Smith', 'jane@warmintro.com', "Sean O'Brien"]
const score = (search: string, keywords = contacts) =>
  scoreSearchMatch('Warm Intro', search, keywords)

test('a contact name or email finds the company', () => {
  assert.ok(score('jane') > 0)
  assert.ok(score('smith') > 0)
  assert.ok(score('jane smith') > 0)
  assert.ok(score('warmintro.com') > 0)
})

test('the company name still ranks above a contact match', () => {
  assert.ok(score('warm') > score('jane'))
  assert.equal(score('warm intro'), SEARCH_SCORE.exact)
})

test('spacing differences match, below plain matches', () => {
  assert.equal(
    scoreSearchMatch('Warm Intro', 'warmintro'),
    SEARCH_SCORE.spacing
  )
  assert.ok(scoreSearchMatch('WarmIntro', 'warm intro') > 0)
  assert.ok(SEARCH_SCORE.spacing < SEARCH_SCORE.substring)
})

test('apostrophes are ignored', () => {
  assert.ok(score('obrien') > 0)
  assert.ok(score("o'brien") > 0)
})

test('one slip per word still matches, ranked last', () => {
  for (const typo of [
    'smtih',
    'smiht',
    'smth',
    'smiith',
    'jnae',
    'warn intro',
  ]) {
    assert.equal(score(typo), SEARCH_SCORE.typo, typo)
  }
})

test('slips are not allowed on short words or the first letter', () => {
  assert.equal(score('jnr'), SEARCH_SCORE.none)
  assert.equal(score('xmith'), SEARCH_SCORE.none)
  assert.equal(scoreSearchMatch('Bass Marketing', 'tales'), SEARCH_SCORE.none)
})

test('two slips in one word do not match', () => {
  assert.equal(score('smtiht'), SEARCH_SCORE.none)
  assert.equal(score('snyth'), SEARCH_SCORE.none)
})

test('the old guard against letter-sequence noise holds', () => {
  assert.equal(
    scoreSearchMatch('Bass Marketing / Landing pages', 'sales'),
    SEARCH_SCORE.none
  )
})

test('a match through a person names that person', () => {
  const hints = ['Jane Smith · jane@warmintro.com', 'Marcus Lee · marcus@x.com']
  const hint = (q: string) =>
    matchedHint('Warm Intro', ['Warm Intro'], hints, q)
  assert.equal(hint('jane'), hints[0])
  assert.equal(hint('marcus@'), hints[1])
  assert.equal(hint('smtih'), hints[0])
  assert.equal(hint('warm'), null)
  assert.equal(hint(''), null)
  assert.equal(hint('zzz'), null)
  // Words split between the company and a person: name the person.
  assert.equal(hint('warm marcus'), hints[1])
})
