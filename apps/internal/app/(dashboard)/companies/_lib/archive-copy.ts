/** The Archive company confirm text, shared by the list and the sheet. */
export function archiveCompanyDescription(
  companyName: string | null | undefined,
  clientName: string | null | undefined
): string {
  const name = companyName || 'this company'
  const base = `Archiving ${name} hides it from the Companies list. Its contacts and leads stay as they are.`
  return clientName
    ? `${base} Portal users at it lose access to ${clientName}, and a restore doesn't give it back.`
    : base
}
