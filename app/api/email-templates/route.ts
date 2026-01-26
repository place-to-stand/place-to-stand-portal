import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { fetchEmailTemplates } from '@/lib/queries/email-templates'

export async function GET() {
  try {
    const user = await requireUser()
    assertAdmin(user)

    const templates = await fetchEmailTemplates()

    return NextResponse.json({ templates })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to fetch email templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}
