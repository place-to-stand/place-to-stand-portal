import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { enableProposalSharing } from '@/lib/data/proposals'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser()
  assertAdmin(user)

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const password = typeof body.password === 'string' ? body.password : null

  const result = await enableProposalSharing(id, password)

  if (!result) {
    return NextResponse.json({ ok: false, error: 'Proposal not found.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, data: result })
}
