import { timingSafeEqual } from 'crypto'

import { NextResponse, type NextRequest } from 'next/server'

/**
 * Bearer-token auth for machine-to-machine intake endpoints.
 *
 * Returns a `NextResponse` to short-circuit with, or `null` when the token is
 * valid and the caller should proceed.
 *
 * `timingSafeEqual` throws when the two buffers differ in length, so the
 * length check must come first — and it has to short-circuit before the
 * comparison, which is why this is a `&&` rather than two separate checks.
 */
export function verifyIntakeToken(
  request: NextRequest,
  configuredToken: string | undefined,
  label: string
): NextResponse | null {
  if (!configuredToken) {
    console.error(`${label} intake token is not configured`)
    return NextResponse.json(
      { error: `${label} intake is not configured.` },
      { status: 500 }
    )
  }

  const providedAuth = request.headers.get('authorization')

  if (!providedAuth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const providedBuffer = Buffer.from(providedAuth.slice('Bearer '.length).trim())
  const configuredBuffer = Buffer.from(configuredToken)

  const tokensMatch =
    providedBuffer.length === configuredBuffer.length &&
    timingSafeEqual(providedBuffer, configuredBuffer)

  if (!tokensMatch) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
