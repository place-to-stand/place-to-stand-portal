/**
 * Escapes a string for interpolation into an HTML email body or attribute.
 *
 * Every email template in this directory builds HTML with template literals.
 * Anything that originated outside the codebase — client names, contact
 * names, invoice numbers, URLs — has to pass through here first. Client names
 * in particular can come from the unauthenticated leads-intake webhook, so a
 * crafted lead can otherwise plant markup in every invoice email that client
 * later receives.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
