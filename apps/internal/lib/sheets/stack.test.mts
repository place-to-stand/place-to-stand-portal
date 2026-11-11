import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  openTarget,
  parseSheetStack,
  removeSheetParams,
  swapSheetParam,
} from './stack.ts'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const H = '33333333-3333-4333-8333-333333333333'

const params = (query: string) => new URLSearchParams(query)

test('the stack keeps URL order and holds two of one entity', () => {
  const stack = parseSheetStack(
    params(`company=${A}&contact=${H}&company=${B}&page=2`)
  )
  assert.deepEqual(
    stack.map(item => [item.entity, item.value, item.ordinal, item.key]),
    [
      ['company', A, 0, 'company#0'],
      ['contact', H, 0, 'contact#0'],
      ['company', B, 1, 'company#1'],
    ]
  )
})

test('the same record is listed once and bad values are skipped', () => {
  const stack = parseSheetStack(params(`invoice=${A}&invoice=${A}&task=nope`))
  assert.equal(stack.length, 1)
})

test('opening a record already in the stack goes back to it', () => {
  const stack = parseSheetStack(
    params(`invoice=${A}&hour-block=${H}&contact=${B}`)
  )
  const target = openTarget(stack, 'invoice', A)
  assert.equal(target.kind, 'back')
  assert.deepEqual(
    target.kind === 'back' ? target.above.map(item => item.entity) : [],
    ['contact', 'hour-block']
  )
})

test('opening the top sheet closes nothing', () => {
  const stack = parseSheetStack(params(`invoice=${A}&hour-block=${H}`))
  const target = openTarget(stack, 'hour-block', H)
  assert.deepEqual(target, { kind: 'back', index: 1, above: [] })
})

test('another record of an open entity stacks on top', () => {
  const stack = parseSheetStack(params(`company=${A}&contact=${H}`))
  const target = openTarget(stack, 'company', B)
  assert.deepEqual(target, {
    kind: 'stack',
    item: { entity: 'company', value: B, ordinal: 1, key: 'company#1' },
  })
})

test('a second create sheet of an entity goes back to the first', () => {
  const stack = parseSheetStack(params(`contact=new&company=${A}`))
  assert.equal(openTarget(stack, 'contact', 'new').kind, 'back')
})

test('removing sheets keeps the rest in order and drops orphaned aux', () => {
  const query = params(
    `company=${A}&contact=new&contactName=Ada&page=2&company=${B}`
  )
  removeSheetParams(query, [
    { entity: 'company', value: B },
    { entity: 'contact', value: 'new' },
  ])
  assert.equal(query.toString(), `company=${A}&page=2`)
})

test('aux stays while a create sheet of its entity is left', () => {
  const query = params(`contact=new&contactName=Ada&contact=${A}`)
  removeSheetParams(query, [{ entity: 'contact', value: A }])
  assert.equal(query.toString(), 'contact=new&contactName=Ada')
})

test('a swap keeps the sheet in place', () => {
  const query = params(`task=${A}&lead=${H}&task=new`)
  assert.equal(swapSheetParam(query, 'task', 'new', B), true)
  assert.equal(query.toString(), `task=${A}&lead=${H}&task=${B}`)
  assert.equal(swapSheetParam(query, 'task', 'new', B), false)
})
