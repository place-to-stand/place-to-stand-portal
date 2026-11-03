import { NextResponse } from 'next/server'

import { assertAdmin } from '@/lib/auth/permissions'
import { fetchCompanyServices } from '@/lib/integrations/company-services'
import { authorizeRoute } from '@/lib/auth/guard'

/**
 * Status of every company service configured in the server environment
 * (Stripe, Resend, PostHog, …). Mercury has its own route because it returns
 * balances, not just a status.
 */
export async function GET() {
  const { user, denied } = await authorizeRoute('integrations.manage')
  if (denied) return denied
  assertAdmin(user)

  const services = await fetchCompanyServices()
  return NextResponse.json({ ok: true, data: services })
}
