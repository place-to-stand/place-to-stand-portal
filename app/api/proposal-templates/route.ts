import { NextResponse, type NextRequest } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { fetchProposalTemplates, type ProposalTemplateType } from '@/lib/queries/proposal-templates'

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser()
    assertAdmin(user)

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as ProposalTemplateType | null

    const templates = await fetchProposalTemplates(type ?? undefined)

    return NextResponse.json({ templates })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to fetch proposal templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}
