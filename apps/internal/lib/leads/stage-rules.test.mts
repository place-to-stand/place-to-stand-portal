// Run: npx tsx --test apps/internal/lib/leads/stage-rules.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { leadStageMoveFields } from './stage-rules.ts'

const AT = '2026-11-07T12:00:00.000Z'

test('staying in a stage writes nothing', () => {
  assert.deepEqual(
    leadStageMoveFields('PROPOSAL_SENT', 'PROPOSAL_SENT', AT),
    {}
  )
})

test('moving between open stages only restarts the stage clock', () => {
  assert.deepEqual(
    leadStageMoveFields('NEW_OPPORTUNITIES', 'PROPOSAL_SENT', AT),
    { currentStageEnteredAt: AT }
  )
})

test('closing a lead stamps resolved', () => {
  for (const to of ['CLOSED_WON', 'CLOSED_LOST', 'UNQUALIFIED']) {
    assert.deepEqual(leadStageMoveFields('PROPOSAL_SENT', to, AT), {
      currentStageEnteredAt: AT,
      resolvedAt: AT,
    })
  }
})

test('moving between closed stages restamps resolved', () => {
  assert.deepEqual(leadStageMoveFields('CLOSED_WON', 'CLOSED_LOST', AT), {
    currentStageEnteredAt: AT,
    resolvedAt: AT,
  })
})

test('reopening a closed lead clears resolved', () => {
  assert.deepEqual(leadStageMoveFields('CLOSED_LOST', 'ON_ICE', AT), {
    currentStageEnteredAt: AT,
    resolvedAt: null,
  })
})
