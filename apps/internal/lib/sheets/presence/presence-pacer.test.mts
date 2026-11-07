import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createPresencePacer } from './presence-pacer.ts'

function fakeClock() {
  let now = 0
  let queue: { at: number; run: () => void; id: number }[] = []
  let nextId = 1
  return {
    timers: {
      now: () => now,
      setTimeout: (run: () => void, ms: number) => {
        const id = nextId++
        queue.push({ at: now + ms, run, id })
        return id
      },
      clearTimeout: (id: unknown) => {
        queue = queue.filter(item => item.id !== id)
      },
    },
    advance(ms: number) {
      const until = now + ms
      for (;;) {
        queue.sort((a, b) => a.at - b.at)
        const next = queue[0]
        if (!next || next.at > until) break
        queue.shift()
        now = next.at
        next.run()
      }
      now = until
    },
  }
}

function setup() {
  const clock = fakeClock()
  const sent: { at: number; editing: boolean }[] = []
  const pacer = createPresencePacer<boolean>(
    editing => sent.push({ at: clock.timers.now(), editing }),
    (a, b) => a === b,
    8000,
    clock.timers
  )
  return { clock, sent, pacer }
}

test('quick edit-and-save rounds stay under 5 updates in 30 seconds', () => {
  const { clock, sent, pacer } = setup()
  pacer.joined(false)
  for (let round = 0; round < 20; round++) {
    clock.advance(1500)
    pacer.update(true)
    clock.advance(400)
    pacer.update(false)
  }
  clock.advance(20000)
  for (const first of sent) {
    const inWindow = sent.filter(
      s => s.at >= first.at && s.at < first.at + 30000
    )
    assert.ok(inWindow.length <= 4, `${inWindow.length} sends in 30s`)
  }
})

test('the latest state always goes out in the end', () => {
  const { clock, sent, pacer } = setup()
  pacer.joined(false)
  clock.advance(1000)
  pacer.update(true)
  clock.advance(1000)
  pacer.update(false)
  clock.advance(1000)
  pacer.update(true)
  clock.advance(10000)
  assert.deepEqual(sent.at(-1), { at: 8000, editing: true })
})

test('a change undone inside the gap sends nothing', () => {
  const { clock, sent, pacer } = setup()
  pacer.joined(false)
  clock.advance(1000)
  pacer.update(true)
  pacer.update(false)
  clock.advance(10000)
  assert.equal(sent.length, 1)
})

test('after a quiet spell a change goes out at once', () => {
  const { clock, sent, pacer } = setup()
  pacer.joined(false)
  clock.advance(9000)
  pacer.update(true)
  assert.deepEqual(sent.at(-1), { at: 9000, editing: true })
})

test('stop drops a waiting update', () => {
  const { clock, sent, pacer } = setup()
  pacer.joined(false)
  pacer.update(true)
  pacer.stop()
  clock.advance(10000)
  assert.equal(sent.length, 1)
})
