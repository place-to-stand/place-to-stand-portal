import 'server-only'

import { createHmac } from 'crypto'

/**
 * Get the HMAC secret for signing tokens/cookies.
 * Throws if no secret is configured - never use a fallback in production.
 */
export function getHmacSecret(): string {
  const secret = process.env.COOKIE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) {
    throw new Error(
      'Missing COOKIE_SECRET or SUPABASE_SERVICE_ROLE_KEY environment variable. ' +
      'HMAC signing requires a secret to be configured.'
    )
  }
  return secret
}

/**
 * Sign a token using HMAC-SHA256.
 */
export function signToken(token: string): string {
  const secret = getHmacSecret()
  return createHmac('sha256', secret).update(token).digest('hex')
}

/**
 * Verify a token signature matches the expected HMAC.
 */
export function verifyTokenSignature(token: string, signature: string): boolean {
  const expected = signToken(token)
  // Use timing-safe comparison to prevent timing attacks
  if (expected.length !== signature.length) return false
  let result = 0
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return result === 0
}

/**
 * Validate that signature data is a PNG data URL.
 * Prevents potential XSS from malicious SVG or other content types.
 */
export function isValidSignatureDataUrl(data: string): boolean {
  return data.startsWith('data:image/png;base64,')
}
