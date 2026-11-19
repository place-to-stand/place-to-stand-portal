import { NextResponse } from 'next/server'

import { authorizeRoute } from '@/lib/auth/guard'

/**
 * The version this server runs (the commit it was built from), so a tab left
 * open across a deploy can tell it's out of date and reload while it's in
 * the background (`components/providers/new-version-reload.tsx`). Null
 * outside Vercel, where nothing deploys under an open tab.
 */
export async function GET() {
  const { denied } = await authorizeRoute('portal.sign_in')
  if (denied) return denied
  return NextResponse.json(
    { ok: true, data: { version: process.env.VERCEL_GIT_COMMIT_SHA ?? null } },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
