import { hash, compare } from 'bcryptjs'

const BCRYPT_ROUNDS = 10

/**
 * Hash a plaintext password for share protection.
 */
export async function hashSharePassword(password: string): Promise<string> {
  return hash(password, BCRYPT_ROUNDS)
}

/**
 * Verify a plaintext password against a bcrypt hash.
 */
export async function verifySharePassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return compare(password, passwordHash)
}
