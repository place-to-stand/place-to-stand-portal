/**
 * Shared token generation and validation utilities.
 * Extracted from proposal sharing code for reuse across invoices, SOWs, etc.
 */

/**
 * Generate a 32-character hex share token.
 * Uses crypto.randomUUID() with dashes stripped.
 */
export function generateShareToken(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

/**
 * Regex that matches both 32-char (share) and 64-char (countersign) hex tokens.
 */
export const TOKEN_REGEX = /^[a-f0-9]{32,64}$/

/**
 * Validate that a token matches the expected format.
 */
export function validateToken(token: string): boolean {
  return TOKEN_REGEX.test(token)
}
