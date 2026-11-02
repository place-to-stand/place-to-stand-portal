/**
 * The extra line for the Archive company confirm, shared by the list and the
 * sheet. A company still billed can't be archived (stop billing first), so
 * this only describes companies not billed now.
 */
export function archiveCompanyExtra(formerClient: boolean): string {
  const base = 'Its people and leads stay as they are.'
  return formerClient
    ? `${base} Its people's portal switches go off, so restarting its billing later doesn't give them access again.`
    : base
}
