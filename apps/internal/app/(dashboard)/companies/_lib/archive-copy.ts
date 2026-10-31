/**
 * The Archive company confirm text, shared by the list and the sheet. A
 * company still billed can't be archived (stop billing first), so this only
 * describes companies not billed now.
 */
export function archiveCompanyDescription(
  companyName: string | null | undefined,
  formerClient: boolean
): string {
  const name = companyName || 'this company'
  const base = `Archiving ${name} hides it from the Companies list. Its people and leads stay as they are.`
  return formerClient
    ? `${base} Its people's portal switches go off, so restarting its billing later doesn't give them access again.`
    : base
}
