// Run: npx tsx --test apps/internal/lib/bulk/run-in-chunks.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import type {
  BulkActionResult,
  BulkSelectionInput,
} from './archive-entities.ts'
import { CHUNK_FAILED, runInChunks } from './run-in-chunks.ts'

const ids = Array.from({ length: 7 }, (_, i) => `id-${i}`)

function recorder(
  answer: (chunk: string[], call: number) => BulkActionResult | Error
) {
  const calls: string[][] = []
  const action = async (input: BulkSelectionInput) => {
    assert.equal(input.kind, 'ids')
    const chunk = input.kind === 'ids' ? input.ids : []
    calls.push(chunk)
    const result = answer(chunk, calls.length)
    if (result instanceof Error) throw result
    return result
  }
  return { calls, action }
}

test('splits the ids into chunks and adds up the results', async () => {
  const { calls, action } = recorder(chunk => ({
    done: chunk.length - 1,
    failed: [{ id: chunk[0], error: 'No' }],
    warnings: ['Heads up'],
  }))
  const result = await runInChunks(ids, action, 3)
  assert.deepEqual(calls, [
    ['id-0', 'id-1', 'id-2'],
    ['id-3', 'id-4', 'id-5'],
    ['id-6'],
  ])
  assert.equal(result.done, 4)
  assert.deepEqual(
    result.failed.map(row => row.id),
    ['id-0', 'id-3', 'id-6']
  )
  assert.deepEqual(result.warnings, ['Heads up'])
  assert.equal(result.error, undefined)
})

test('stops at a returned error and keeps what was done', async () => {
  const { calls, action } = recorder((chunk, call) =>
    call === 2
      ? { done: 0, failed: [], warnings: [], error: 'Not allowed' }
      : { done: chunk.length, failed: [], warnings: [] }
  )
  const result = await runInChunks(ids, action, 3)
  assert.equal(calls.length, 2)
  assert.equal(result.done, 3)
  assert.equal(result.error, 'Not allowed')
})

test('a thrown call ends the run with a plain message', async () => {
  const { calls, action } = recorder((chunk, call) =>
    call === 2
      ? new Error('FUNCTION_INVOCATION_TIMEOUT')
      : { done: chunk.length, failed: [], warnings: [] }
  )
  const result = await runInChunks(ids, action, 3)
  assert.equal(calls.length, 2)
  assert.equal(result.done, 3)
  assert.equal(result.error, CHUNK_FAILED)
})

test('no ids, no calls', async () => {
  const { calls, action } = recorder(() => ({
    done: 0,
    failed: [],
    warnings: [],
  }))
  const result = await runInChunks([], action)
  assert.equal(calls.length, 0)
  assert.equal(result.done, 0)
})
