import { NextResponse } from 'next/server'

import { assertAdmin } from '@/lib/auth/permissions'
import { requireUser } from '@/lib/auth/session'
import { serverEnv } from '@/lib/env.server'
import {
  MercuryApiError,
  fetchMercuryAccounts,
} from '@/lib/integrations/mercury/api'

/**
 * Health check for the company Mercury connection (MERCURY_API_TOKEN). The
 * settings page calls it on load: configured or not, and whether the token
 * can read the accounts the profit share adds up.
 */
export async function GET() {
  const user = await requireUser()
  assertAdmin(user)

  const token = serverEnv.MERCURY_API_TOKEN
  if (!token) {
    return NextResponse.json({ ok: true, data: { status: 'not_configured' } })
  }

  try {
    const accounts = await fetchMercuryAccounts(token)
    return NextResponse.json({
      ok: true,
      data: {
        status: 'connected',
        checkedAt: new Date().toISOString(),
        accounts: accounts.map(account => ({
          id: account.id,
          name: account.name,
          balance: account.currentBalance,
        })),
      },
    })
  } catch (error) {
    console.error('Mercury status check failed', error)
    const message =
      error instanceof MercuryApiError
        ? error.status === 401 || error.status === 403
          ? `Mercury rejected the token (${error.status}).`
          : `${error.message}.`
        : 'Mercury could not be reached.'
    return NextResponse.json({
      ok: true,
      data: { status: 'error', message, checkedAt: new Date().toISOString() },
    })
  }
}
