import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'

import { safeReturnPath } from './state-path'

export { safeReturnPath }

const STATE_COOKIE = 'oauth_state'
const STATE_EXPIRY = 10 * 60 * 1000 // 10 minutes

/**
 * Generate and store OAuth state parameter for CSRF protection
 */
export async function generateOAuthState(): Promise<string> {
  const state = randomBytes(32).toString('hex')
  const cookieStore = await cookies()

  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: STATE_EXPIRY / 1000,
    path: '/',
  })

  return state
}

/**
 * Validate and consume OAuth state parameter
 */
export async function validateOAuthState(state: string): Promise<boolean> {
  const cookieStore = await cookies()
  const storedState = cookieStore.get(STATE_COOKIE)?.value

  // Delete the cookie regardless of validation result
  cookieStore.delete(STATE_COOKIE)

  return storedState === state
}

const RETURN_TO_COOKIE = 'oauth_return_to'

/** Remember where the connect flow started, for the callback. */
export async function setOAuthReturnTo(path: string | null) {
  const cookieStore = await cookies()
  if (!path) {
    cookieStore.delete(RETURN_TO_COOKIE)
    return
  }
  cookieStore.set(RETURN_TO_COOKIE, path, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: STATE_EXPIRY / 1000,
    path: '/',
  })
}

/** Read and clear the path the connect flow started from. */
export async function consumeOAuthReturnTo(): Promise<string | null> {
  const cookieStore = await cookies()
  const value = cookieStore.get(RETURN_TO_COOKIE)?.value
  cookieStore.delete(RETURN_TO_COOKIE)
  return safeReturnPath(value)
}
