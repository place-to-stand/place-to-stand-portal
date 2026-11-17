/**
 * `Name <address>` for a From header. A name with a comma, quote or other
 * special character is quoted, or the header breaks ("Acme, Inc." reads as
 * two addresses).
 */
export function formatSender(name: string, address: string): string {
  return `${quoteDisplayName(name)} <${address}>`
}

export function quoteDisplayName(name: string): string {
  if (/^[\w .'-]+$/.test(name)) return name
  return `"${name.replace(/["\\]/g, '\\$&')}"`
}
