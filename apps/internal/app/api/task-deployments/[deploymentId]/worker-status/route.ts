import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { loadWorkerStatus } from '@/lib/tasks/worker-status'

/**
 * GET /api/task-deployments/<id>/worker-status: the coding worker's progress,
 * read from the GitHub issue's comments. The task sheet polls it. It also
 * records a new status on the deployment, so the board badge stays current.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<'/api/task-deployments/[deploymentId]/worker-status'>
) {
  const user = await requireUser()
  const { deploymentId } = await params
  const data = await loadWorkerStatus(user, deploymentId)
  return NextResponse.json({ ok: true, data })
}
