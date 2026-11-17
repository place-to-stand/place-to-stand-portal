/**
 * `Name <address>` for a From header. A name with a comma, quote or other
 * special character is quoted, or the header breaks ("Acme, Inc." reads as
 * two addresses).
 */
export function formatSender(name: string, address: string): string {
  return `${quoteDisplayName(name)} <${address}>`
}

export function quoteDisplayName(rawName: string): string {
  // A line break or other control character would end the header early.
  const name = rawName.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim()
  if (/^[\w .'-]+$/.test(name)) return name
  return `"${name.replace(/["\\]/g, '\\$&')}"`
}
