import { NextResponse } from 'next/server'

import { assertAdmin } from '@/lib/auth/permissions'
import { requireUser } from '@/lib/auth/session'
import { fetchCompanyServices } from '@/lib/integrations/company-services'

/**
 * Status of every company service configured in the server environment
 * (Stripe, Resend, PostHog, …). Mercury has its own route because it returns
 * balances, not just a status.
 */
export async function GET() {
  const user = await requireUser()
  assertAdmin(user)

  const services = await fetchCompanyServices()
  return NextResponse.json({ ok: true, data: services })
}
