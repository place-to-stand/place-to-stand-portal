import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { NotFoundError } from '@/lib/errors/http'
import { isValidSheetParamValue } from '@/lib/sheets/entities'
import {
  isSheetInitEntity,
  resolveSheetInit,
} from '@/lib/sheets/init/resolvers'

/**
 * GET /api/sheets/init?entity=<key>&id=<uuid|new>
 *
 * Backs the global SheetHost: returns everything a sheet wrapper needs to
 * render the entity's sheet from any route (the entity record plus any
 * reference data the sheet can't fetch itself).
 */
export async function GET(request: Request) {
  try {
    const user = await requireUser()
    assertAdmin(user)

    const url = new URL(request.url)
    const entity = url.searchParams.get('entity') ?? ''
    const id = url.searchParams.get('id') ?? ''

    if (!isSheetInitEntity(entity)) {
      return NextResponse.json(
        { ok: false, error: 'Unknown sheet entity' },
        { status: 400 }
      )
    }

    if (!id || !isValidSheetParamValue(id)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid sheet id' },
        { status: 400 }
      )
    }

    const data = await resolveSheetInit(user, entity, id)
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { ok: false, error: 'Not found' },
        { status: 404 }
      )
    }

    console.error('[sheets/init] failed', error)
    return NextResponse.json(
      { ok: false, error: 'Unable to load sheet data' },
      { status: 500 }
    )
  }
}
