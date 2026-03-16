import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { disableProposalSharing } from '@/lib/data/proposals'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser()
  assertAdmin(user)

  const { id } = await params
  const success = await disableProposalSharing(id)

  if (!success) {
    return NextResponse.json({ ok: false, error: 'Proposal not found.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
