import { NextResponse, type NextRequest } from 'next/server'

import {
  pruneActivityLogsBefore,
  retentionCutoff,
} from '@/lib/activity/retention'
import { serverEnv } from '@/lib/env.server'
import { pruneArchivedNotifications } from '@/lib/notifications/in-app/queries'
import { verifyIntakeToken } from '@/lib/integrations/verify-intake-token'

/**
 * Weekly Vercel Cron (see vercel.json): hard-deletes activity_logs rows older
 * than ACTIVITY_LOG_RETENTION_DAYS. The table is append-only and grows with
 * every mutation, so without a prune it grows forever. Also deletes
 * notifications archived more than 90 days ago, for the same reason.
 *
 * Auth: Vercel sends `Authorization: Bearer ${CRON_SECRET}` automatically
 * when the CRON_SECRET env var is set on the project.
 */
export async function GET(request: NextRequest) {
  const authFailure = verifyIntakeToken(request, serverEnv.CRON_SECRET, 'Cron')

  if (authFailure) {
    return authFailure
  }

  const cutoff = retentionCutoff(serverEnv.ACTIVITY_LOG_RETENTION_DAYS)

  // Runs first and on its own, so neither prune's failure stops the other.
  const archivedNotificationsDeleted = await pruneArchivedNotifications().catch(
    error => {
      console.error('Failed to prune archived notifications', error)
      return null
    }
  )

  try {
    const deletedCount = await pruneActivityLogsBefore(cutoff)

    return NextResponse.json({
      ok: true,
      data: {
        deletedCount,
        cutoff: cutoff.toISOString(),
        archivedNotificationsDeleted,
      },
    })
  } catch (error) {
    console.error('Failed to prune activity logs', error)
    return NextResponse.json(
      { ok: false, error: 'Unable to prune activity logs.' },
      { status: 500 }
    )
  }
}
