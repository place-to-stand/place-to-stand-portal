import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { getValidAccessToken } from '@/lib/gmail/client'
import { serverEnv } from '@/lib/env.server'

export async function GET() {
  try {
    const user = await requireUser()
    assertAdmin(user)

    const { accessToken } = await getValidAccessToken(user.id)

    return NextResponse.json({
      accessToken,
      clientId: serverEnv.GOOGLE_CLIENT_ID,
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to get picker token' },
      { status: 401 }
    )
  }
}
