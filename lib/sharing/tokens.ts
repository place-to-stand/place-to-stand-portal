import { randomBytes } from 'crypto'

/** Matches 32–64 character lowercase hex strings */
export const TOKEN_REGEX = /^[a-f0-9]{32,64}$/

/**
 * Generate a 32-character hex share token (UUID with dashes stripped).
 */
export function generateShareToken(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

/**
 * Generate a 64-character hex token using cryptographically secure random bytes.
 * Suitable for countersign tokens or other high-entropy use cases.
 */
export function generateSecureToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Validate that a string matches the expected share token format.
 */
export function validateToken(token: string): boolean {
  return TOKEN_REGEX.test(token)
}
