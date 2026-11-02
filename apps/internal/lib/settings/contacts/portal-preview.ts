/**
 * Opens the client portal, in a new tab, as the given contact sees it.
 *
 * The portal's `/api/admin/preview-contact` route re-checks the admin role and
 * the contact against live rows before setting its view-as cookie, so the id
 * here carries no authority of its own. Preview is keyed by contact, not user:
 * a portal user is previewed through the contact they were promoted from.
 */
export function openPortalPreview(clientPortalUrl: string, contactId: string) {
  const base = clientPortalUrl.replace(/\/$/, '')
  const params = new URLSearchParams({ contactId })
  window.open(
    `${base}/api/admin/preview-contact?${params}`,
    '_blank',
    'noopener,noreferrer'
  )
}

/** Why Preview is off for someone `canPreviewAsClient` turns down. */
export const PREVIEW_UNAVAILABLE_REASON =
  "Not at a client we bill, so there's nothing to preview."

/**
 * Whether previewing the portal as this person shows anything: they're not
 * archived and work at a company we bill now (the portal shows exactly
 * those companies; see the client app's `resolveAdminScope`). Portal access
 * and sign-ins don't matter. The one rule for every Preview button.
 */
export function canPreviewAsClient(person: {
  deletedAt?: string | null
  companies: ReadonlyArray<{ isClient: boolean }>
}) {
  return !person.deletedAt && person.companies.some(company => company.isClient)
}
