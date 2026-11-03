import { NextResponse } from 'next/server'
import { z } from 'zod'

import { fetchLeadConversionSummary } from '@/lib/data/leads/conversion'
import { NotFoundError } from '@/lib/errors/http'
import { authorizeRoute } from '@/lib/auth/guard'

const leadIdSchema = z.string().uuid()

/**
 * GET /api/leads/[leadId]/conversion
 *
 * What a converted lead became — client, contact, and the client's projects —
 * for the lead sheet sidebar. `data` is null when the lead isn't converted.
 * Admin-only endpoint.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<'/api/leads/[leadId]/conversion'>
) {
  const { user, denied } = await authorizeRoute('leads.convert')
  if (denied) return denied
  const { leadId } = await params

  if (!leadIdSchema.safeParse(leadId).success) {
    return NextResponse.json(
      { ok: false, error: 'Lead not found' },
      { status: 404 }
    )
  }

  try {
    const data = await fetchLeadConversionSummary(user, leadId)
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 404 }
      )
    }
    console.error('Failed to fetch lead conversion:', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch lead conversion' },
      { status: 500 }
    )
  }
}
