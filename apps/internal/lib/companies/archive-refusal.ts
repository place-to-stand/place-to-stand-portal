/**
 * Archiving a company whose billing is still open (billed now, or through
 * the end of this month) is refused: stop its billing first. Client-safe, so
 * the list and the sheet show the same words the server returns.
 */
export const ARCHIVE_BILLED_REFUSAL = 'Stop billing first.'
