import { NextResponse } from 'next/server'

import { readBusinessImage } from '@pts/db/business'

import { db } from '@/lib/db'
import { decodeImageDataUrl } from '@/lib/business/images'

/**
 * The business's uploaded logo or icon (Settings → Business). Public, because
 * share pages and sign-in screens show it before anyone signs in; it is the
 * same image the business prints on its invoices. Links carry `?v=` with the
 * last save time, so a long cache is safe.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<'/api/public/business/[kind]'>
) {
  const { kind } = await params
  if (kind !== 'logo' && kind !== 'icon') {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
  }

  const decoded = decodeImageDataUrl(await readBusinessImage(db, kind))
  if (!decoded) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(decoded.bytes), {
    headers: {
      'Content-Type': decoded.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      // An uploaded SVG could carry script; never let it run as a page.
      'Content-Security-Policy':
        "default-src 'none'; style-src 'unsafe-inline'",
      'X-Content-Type-Options': 'nosniff',
      // Opened directly, an SVG downloads instead of rendering as a page, so
      // nothing in it can run on this domain whatever other CSP applies.
      // <img> ignores this header.
      ...(decoded.contentType === 'image/svg+xml'
        ? { 'Content-Disposition': 'attachment; filename="' + kind + '.svg"' }
        : {}),
    },
  })
}
