import { roleCan, type Role } from '@/lib/auth/capabilities'

/**
 * Portal access and sign-ins are shown only to people who manage clients
 * (`clients.manage`, admins today): the person sheet, the people list, and
 * the contacts MCP tools and CLI all ask this. Client-safe.
 */
export function canSeePortalAccess(role: Role | null | undefined): boolean {
  return Boolean(role && roleCan(role, 'clients.manage'))
}

/** A membership with its portal access left out, for everyone else. */
export function withoutPortalAccess<
  T extends { portalAccess: boolean; hasPortalAccess?: boolean },
>(membership: T): T {
  return {
    ...membership,
    portalAccess: false,
    ...('hasPortalAccess' in membership ? { hasPortalAccess: false } : {}),
  }
}
