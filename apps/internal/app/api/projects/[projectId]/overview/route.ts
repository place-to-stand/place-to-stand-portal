import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/session'
import { ensureClientAccessByProjectId, isAdmin } from '@/lib/auth/permissions'

type RouteParams = {
  params: Promise<{ projectId: string }>
}

// Communications (email threads + transcripts) were removed from the project
// overview. The endpoint is retained for project-scoped overview data; it
// currently returns an empty payload until non-comms overview data is added.
export async function GET(_req: Request, { params }: RouteParams) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { projectId } = await params

  if (!isAdmin(user)) {
    try {
      await ensureClientAccessByProjectId(user, projectId)
    } catch {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }
  }

  return NextResponse.json({ ok: true, data: {} })
}
