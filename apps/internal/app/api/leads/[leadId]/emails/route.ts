import { NextResponse } from 'next/server'

import { authorizeRoute } from '@/lib/auth/guard'
import { roleCan } from '@/lib/auth/capabilities'
import { fetchLeadById } from '@/lib/data/leads'
import { NotFoundError } from '@/lib/errors/http'
import { listViewerThreadsWith } from '@/lib/gmail/threads'
import { parseThreadsCursor } from '@/lib/gmail/threads-utils'
import { UUID_PATTERN } from '@/lib/sheets/entities'

/**
 * GET /api/leads/[leadId]/emails
 *
 * The viewer's own Gmail threads with the lead's contact, read live from
 * their connected Google account. Only ever the viewer's mailbox: one
 * person never sees another's mail here. `?cursor=` (the last answer's
 * `nextCursor`, as JSON) gets the next page.
 */
export async function GET(
  request: Request,
  { params }: RouteContext<'/api/leads/[leadId]/emails'>
) {
  const { user, denied } = await authorizeRoute('leads.manage')
  if (denied) return denied
  const { leadId } = await params

  if (!UUID_PATTERN.test(leadId)) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }
  if (!roleCan(user.role, 'integrations.google')) {
    return NextResponse.json({ state: 'not_allowed' })
  }

  try {
    const lead = await fetchLeadById(user, leadId)
    if (!lead.contactEmail) {
      return NextResponse.json({ state: 'no_email' })
    }
    const cursor = parseThreadsCursor(
      new URL(request.url).searchParams.get('cursor')
    )
    const result = await listViewerThreadsWith(
      user.id,
      [lead.contactEmail],
      cursor
    )
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }
    console.error('Failed to load lead emails:', error)
    return NextResponse.json(
      { error: 'Couldn’t load emails from Gmail.' },
      { status: 502 }
    )
  }
}
