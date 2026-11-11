import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  isStackItemClaimed,
  pageSheetParam,
  openTarget,
  parseSheetStack,
  removeSheetParams,
  setFirstSheetParam,
  swapSheetParam,
} from './stack.ts'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const H = '33333333-3333-4333-8333-333333333333'

const params = (query: string) => new URLSearchParams(query)

test('the stack keeps URL order and holds two of one entity', () => {
  const stack = parseSheetStack(
    params(`company=${A}&page=2&contact=${H}&company=${B}`)
  )
  assert.deepEqual(
    stack.map(item => [item.entity, item.value, item.ordinal, item.paramIndex]),
    [
      ['company', A, 0, 0],
      ['contact', H, 0, 2],
      ['company', B, 1, 3],
    ]
  )
})

test('a record is listed once, create sheets repeat, bad values skip', () => {
  const stack = parseSheetStack(
    params(`invoice=${A}&invoice=${A}&task=nope&contact=new&contact=new`)
  )
  assert.deepEqual(
    stack.map(item => item.id),
    [`invoice:${A}:0`, 'contact:new:0', 'contact:new:1']
  )
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
  assert.equal(target.kind === 'back' && target.above.length, 0)
})

test('another record of an open entity stacks on top', () => {
  const stack = parseSheetStack(params(`company=${A}&contact=${H}`))
  assert.equal(openTarget(stack, 'company', B).kind, 'stack')
})

test('create sheets always stack, even over another draft', () => {
  const stack = parseSheetStack(
    params(`contact=new&company=new&task=copy-${A}`)
  )
  assert.equal(openTarget(stack, 'contact', 'new').kind, 'stack')
  assert.equal(openTarget(stack, 'task', `copy-${A}`).kind, 'stack')
})

test('removing sheets keeps the rest in order and drops orphaned aux', () => {
  const query = params(
    `company=${A}&contact=new&contactName=Ada&page=2&company=${B}`
  )
  removeSheetParams(query, [`company:${B}:0`, 'contact:new:0'])
  assert.equal(query.toString(), `company=${A}&page=2`)
})

test('removing one of two drafts keeps the other and its aux', () => {
  const query = params('contact=new&contactName=Ada&company=new&contact=new')
  removeSheetParams(query, ['contact:new:1'])
  assert.equal(query.toString(), 'contact=new&contactName=Ada&company=new')
})

test('a swap keeps the sheet in place', () => {
  const query = params(`task=new&lead=${H}&task=new`)
  assert.ok(swapSheetParam(query, 'task:new:1', B))
  assert.equal(query.toString(), `task=new&lead=${H}&task=${B}`)
  assert.equal(swapSheetParam(query, 'task:new:1', B), null)
})

test('the first sheet of an entity is set in place', () => {
  const query = params(`task=${A}&company=${H}&task=${B}`)
  setFirstSheetParam(query, 'task', H)
  assert.equal(query.toString(), `task=${H}&company=${H}&task=${B}`)
  setFirstSheetParam(query, 'task', null)
  assert.equal(query.toString(), `company=${H}&task=${B}`)
})

test('servers read the bottom sheet, when it is the page entity', () => {
  assert.equal(pageSheetParam('invoice', { invoice: ['bogus', A] }), A)
  assert.equal(pageSheetParam('invoice', {}), undefined)
  assert.equal(
    pageSheetParam('invoice', { page: '2', invoice: A, 'hour-block': B }),
    A
  )
  // Above another sheet, the SheetHost shows it, not the page.
  assert.equal(pageSheetParam('lead', { company: A, lead: B }), undefined)
})

test('a page renders only the bottom sheet', () => {
  const stack = parseSheetStack(params(`invoice=${A}&hour-block=${B}`))
  assert.equal(isStackItemClaimed(stack[0]!, '/invoices'), true)
  const above = parseSheetStack(params(`company=${H}&invoice=${A}`))
  assert.equal(isStackItemClaimed(above[1]!, '/invoices'), false)
})

test('a record never ends up open twice', () => {
  const query = params(`task=${A}&lead=${B}&task=${B}`)
  setFirstSheetParam(query, 'task', B)
  assert.equal(query.toString(), `task=${B}&lead=${B}`)
  const repeated = params(`task=${A}&lead=${H}&task=${A}`)
  removeSheetParams(repeated, [`task:${A}:0`])
  assert.equal(repeated.toString(), `lead=${H}`)
})
