/**
 * Portal access can be on only for someone who can sign in to the client
 * portal now: a live Client sign-in (not switched off or archived). The one
 * rule both sheets show and the server enforces (`hasLiveClientSignIn`).
 * A stored switch that's on while they can't sign in shows off and locked;
 * it isn't cleared, so turning their sign-in back on restores it.
 * Client-safe.
 */
export function canHavePortalAccess(signIn: {
  exists: boolean
  enabled: boolean
  role: 'ADMIN' | 'SALES' | 'CLIENT' | null | undefined
}): boolean {
  return signIn.exists && signIn.enabled && signIn.role === 'CLIENT'
}

/** Why the Portal access switch is locked (on the person sheet: "under Sign-in"). */
export function portalAccessLockedReason(
  name: string,
  where: 'company' | 'person' = 'company'
): string {
  const fix = where === 'person' ? 'under Sign-in' : 'on their person sheet'
  return `${name} can’t sign in as a client. Turn on Can sign in, Role Client, ${fix}.`
}
