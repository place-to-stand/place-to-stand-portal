import { NextResponse } from 'next/server'

import { authorizeRoute } from '@/lib/auth/guard'
import { isTagEntity } from '@/lib/tags/names'
import { listTagOptions, tagCapability } from '@/lib/tags/server'

/**
 * GET /api/tags/<entity>: every tag of one kind of record (`company`), A to
 * Z, with how often each is used, for the tag field and the list filter.
 * Guarded by the record's own capability.
 */
// permission: companies.manage — each kind's tags use its record's capability (tagCapability)
export async function GET(
  _request: Request,
  { params }: RouteContext<'/api/tags/[entity]'>
) {
  const { entity } = await params
  if (!isTagEntity(entity)) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
  }
  const { denied } = await authorizeRoute(tagCapability(entity))
  if (denied) return denied
  return NextResponse.json({ ok: true, data: await listTagOptions(entity) })
}
