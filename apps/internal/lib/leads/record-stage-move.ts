import 'server-only'

import type { DbTx } from '@/lib/db'
import { leadStageHistory } from '@/lib/db/schema'
import { markConvertedIfClient } from '@/lib/leads/mark-converted'

import type { LeadStatusValue } from './constants'

/**
 * What every stage move writes besides the lead row: the conversion stamp
 * (a Won lead whose company is already a client) and the stage history row.
 * Run in the same transaction as the lead update. `fromStatus` is null when
 * the lead is new.
 */
export async function recordLeadStageMove(
  tx: DbTx,
  move: {
    leadId: string
    fromStatus: LeadStatusValue | null
    toStatus: LeadStatusValue
    at: string
    actorId: string
  }
) {
  await markConvertedIfClient(tx, move.leadId, move.at)

  await tx.insert(leadStageHistory).values({
    leadId: move.leadId,
    fromStatus: move.fromStatus,
    toStatus: move.toStatus,
    changedAt: move.at,
    changedBy: move.actorId,
  })
}
