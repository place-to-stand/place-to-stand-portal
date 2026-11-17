import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { TaskLookup } from './types'
import { createTaskSaves } from './task-save-utils'

type Place = { status: string; rank: string }

/** A board of one project, a setState stand-in, and controllable saves. */
function setup(tasks: Record<string, Place>) {
  let lookup: TaskLookup = new Map([
    [
      'p',
      Object.entries(tasks).map(([id, place]) => ({ id, ...place })) as never,
    ],
  ])
  const set = (update: TaskLookup | ((prev: TaskLookup) => TaskLookup)) => {
    lookup = typeof update === 'function' ? update(lookup) : update
  }
  const place = (id: string) => {
    const task = lookup.get('p')!.find(item => item.id === id)!
    return { status: task.status, rank: task.rank }
  }
  /** Moves a card on the board, as a drop does before saving. */
  const show = (id: string, to: Place) =>
    set(prev =>
      new Map(prev).set(
        'p',
        prev.get('p')!.map(task => (task.id === id ? { ...task, ...to } : task))
      )
    )
  const order: string[] = []
  /** A save the test answers by hand; records when it reached the server. */
  const pending = (label: string) => {
    let answer!: (value: Place | null) => void
    let refuse!: () => void
    const reply = new Promise<Place | null>((resolve, reject) => {
      answer = resolve
      refuse = () => reject(new Error('refused'))
    })
    return {
      request: () => {
        order.push(label)
        return reply
      },
      answer,
      refuse,
    }
  }
  return { saves: createTaskSaves(set as never), place, show, pending, order }
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0))
const quiet = () => {
  const original = console.error
  console.error = () => {}
  return () => (console.error = original)
}

test("one card's saves reach the server in the order the moves were made", async () => {
  const { saves, show, pending, order, place } = setup({
    x: { status: 'A', rank: 'a' },
  })
  const first = pending('first')
  const second = pending('second')
  show('x', { status: 'B', rank: 'b' })
  const one = saves(
    'p',
    {
      id: 'x',
      before: { status: 'A', rank: 'a' },
      placed: { status: 'B', rank: 'b' },
    },
    first.request
  )
  show('x', { status: 'C', rank: 'c' })
  const two = saves(
    'p',
    {
      id: 'x',
      before: { status: 'B', rank: 'b' },
      placed: { status: 'C', rank: 'c' },
    },
    second.request
  )
  await tick()
  assert.deepEqual(order, ['first'])
  first.answer({ status: 'B', rank: 'b' })
  await one
  // The first answer leaves the card where the newer move put it.
  assert.deepEqual(place('x'), { status: 'C', rank: 'c' })
  await tick()
  assert.deepEqual(order, ['first', 'second'])
  second.answer({ status: 'C', rank: 'c2' })
  await two
  assert.deepEqual(place('x'), { status: 'C', rank: 'c2' })
})

test('a refused move goes back where the last accepted save left the card', async () => {
  const restore = quiet()
  const { saves, show, pending, place } = setup({
    x: { status: 'A', rank: 'a' },
  })
  const first = pending('first')
  const second = pending('second')
  show('x', { status: 'B', rank: 'b' })
  const one = saves(
    'p',
    {
      id: 'x',
      before: { status: 'A', rank: 'a' },
      placed: { status: 'B', rank: 'b' },
    },
    first.request
  )
  show('x', { status: 'C', rank: 'c' })
  const two = saves(
    'p',
    {
      id: 'x',
      before: { status: 'B', rank: 'b' },
      placed: { status: 'C', rank: 'c' },
    },
    second.request
  )
  // Both refused: the card goes back to A, not to B (never saved).
  first.refuse()
  assert.equal(await one, false)
  assert.deepEqual(place('x'), { status: 'C', rank: 'c' })
  await tick()
  second.refuse()
  assert.equal(await two, false)
  assert.deepEqual(place('x'), { status: 'A', rank: 'a' })
  restore()
})

test('a refused later move goes back to the accepted earlier one', async () => {
  const restore = quiet()
  const { saves, show, pending, place } = setup({
    x: { status: 'A', rank: 'a' },
  })
  const first = pending('first')
  const second = pending('second')
  show('x', { status: 'B', rank: 'b' })
  const one = saves(
    'p',
    {
      id: 'x',
      before: { status: 'A', rank: 'a' },
      placed: { status: 'B', rank: 'b' },
    },
    first.request
  )
  show('x', { status: 'C', rank: 'c' })
  const two = saves(
    'p',
    {
      id: 'x',
      before: { status: 'B', rank: 'b' },
      placed: { status: 'C', rank: 'c' },
    },
    second.request
  )
  first.answer({ status: 'B', rank: 'b' })
  await one
  await tick()
  second.refuse()
  await two
  assert.deepEqual(place('x'), { status: 'B', rank: 'b' })
  restore()
})

test("other cards' saves don't wait, and don't touch each other", async () => {
  const { saves, show, pending, order, place } = setup({
    x: { status: 'A', rank: 'a' },
    y: { status: 'A', rank: 'b' },
  })
  const slow = pending('x')
  const fast = pending('y')
  show('x', { status: 'B', rank: 'a' })
  void saves(
    'p',
    {
      id: 'x',
      before: { status: 'A', rank: 'a' },
      placed: { status: 'B', rank: 'a' },
    },
    slow.request
  )
  show('y', { status: 'B', rank: 'b' })
  const y = saves(
    'p',
    {
      id: 'y',
      before: { status: 'A', rank: 'b' },
      placed: { status: 'B', rank: 'b' },
    },
    fast.request
  )
  await tick()
  assert.deepEqual(order, ['x', 'y'])
  fast.answer({ status: 'B', rank: 'b' })
  await y
  assert.deepEqual(place('x'), { status: 'B', rank: 'a' })
  slow.answer(null)
})

test('the newest move settles its card even after a refresh put it back', async () => {
  const { saves, show, pending, place } = setup({
    x: { status: 'A', rank: 'a' },
  })
  const save = pending('save')
  show('x', { status: 'B', rank: 'b' })
  const one = saves(
    'p',
    {
      id: 'x',
      before: { status: 'A', rank: 'a' },
      placed: { status: 'B', rank: 'b' },
    },
    save.request
  )
  // A refresh from before the save lands: the board shows A again.
  show('x', { status: 'A', rank: 'a' })
  save.answer({ status: 'B', rank: 'b' })
  await one
  assert.deepEqual(place('x'), { status: 'B', rank: 'b' })
})
