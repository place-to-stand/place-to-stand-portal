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
