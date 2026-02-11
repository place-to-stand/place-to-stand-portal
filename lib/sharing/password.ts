import 'server-only'

import { hash, compare } from 'bcryptjs'

const BCRYPT_ROUNDS = 10

/**
 * Hash a share password using bcryptjs.
 */
export async function hashSharePassword(password: string): Promise<string> {
  return hash(password, BCRYPT_ROUNDS)
}

/**
 * Verify a password against a bcryptjs hash.
 */
export async function verifySharePassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return compare(password, passwordHash)
}
