import 'server-only'

import { ROLE_LABELS } from '@/lib/auth/roles'
import { loadAppUserById, type AppUser } from '@/lib/auth/session'
import { ForbiddenError, UnauthorizedError } from '@/lib/errors/http'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const SIGN_IN_HINT = 'Run `pts login` to authenticate.'

/** How a bearer-token surface names itself in the errors it returns. */
export type BearerSurface = {
  /** Product name used in copy, e.g. "the CLI". */
  name: string
  /** Appended to authentication failures, e.g. "Run `pts login`…". */
  signInHint: string
}

const CLI_SURFACE: BearerSurface = {
  name: 'the CLI',
  signInHint: SIGN_IN_HINT,
}

function readBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization')

  if (!header) {
    return null
  }

  const [scheme, ...rest] = header.split(' ')

  if (scheme?.toLowerCase() !== 'bearer') {
    return null
  }

  const token = rest.join(' ').trim()

  return token.length ? token : null
}

/**
 * Resolve the user behind a Supabase access token, admitting only `roles`.
 * Shared by every bearer surface (the CLI, the MCP server) so they cannot
 * drift on how a token is validated; each surface passes the roles it admits.
 *
 * `auth.getUser` validates the token against Supabase rather than just
 * checking its signature, so a revoked session or OAuth grant stops working
 * immediately instead of at token expiry.
 */
export async function resolveUserFromToken(
  token: string,
  surface: BearerSurface,
  roles: readonly AppUser['role'][]
): Promise<AppUser> {
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user?.id) {
    throw new UnauthorizedError(
      `Invalid or expired token. ${surface.signInHint}`
    )
  }

  // Mirrors the proxy's force-reset gate: a user who must set a new password
  // is mid-way through provisioning and should not be acting through the API.
  if (data.user.user_metadata?.must_reset_password) {
    throw new ForbiddenError(
      `This account must reset its password in the portal before using ${surface.name}.`
    )
  }

  const user = await loadAppUserById(data.user.id)

  // The auth record outlived the profile — deleted, disabled, or never
  // provisioned. Treat it as unauthenticated rather than leaking which.
  if (!user) {
    throw new UnauthorizedError(
      `Account is not active. ${surface.signInHint}`
    )
  }

  if (!roles.includes(user.role)) {
    const labels = roles.map(role => ROLE_LABELS[role].toLowerCase())

    throw new ForbiddenError(
      `${capitalize(surface.name)} is available to ${labels.join(' and ')} users only.`
    )
  }

  return user
}

/** The CLI admits ADMIN only. */
export async function resolveAdminFromToken(
  token: string,
  surface: BearerSurface
): Promise<AppUser> {
  return resolveUserFromToken(token, surface, ['ADMIN'])
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/**
 * Resolve the admin behind a CLI request from its bearer token.
 *
 * Deliberately does not use `requireUser()`: that redirects rather than
 * throwing, which Next turns into a 307 and an HTML sign-in page — a CLI
 * following it would see a 200 and no data. `getCurrentUser()` is equally
 * unusable here because it reads identity from cookies. Everything in this
 * path throws `HttpError`s so `withCliAuth` can render them as JSON.
 */
export async function resolveCliUser(request: Request): Promise<AppUser> {
  const token = readBearerToken(request)

  if (!token) {
    throw new UnauthorizedError(`Missing bearer token. ${SIGN_IN_HINT}`)
  }

  return resolveAdminFromToken(token, CLI_SURFACE)
}
