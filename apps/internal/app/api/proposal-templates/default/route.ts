import { NextRequest, NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import {
  fetchDefaultProposalTemplate,
  type ProposalTemplateType,
} from '@/lib/queries/proposal-templates'

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser()
    assertAdmin(user)

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as ProposalTemplateType | null

    if (!type || type !== 'TERMS_AND_CONDITIONS') {
      return NextResponse.json({ error: 'Invalid template type' }, { status: 400 })
    }

    const template = await fetchDefaultProposalTemplate(type)

    return NextResponse.json({ template })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to fetch default proposal template:', error)
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    )
  }
}
