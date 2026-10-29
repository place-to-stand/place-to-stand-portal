/**
 * A client's name is its company's name (a company has at most one client).
 * Clients once had a label ("Retainer") that told several apart; it is no
 * longer used.
 */
export function clientDisplayName(companyName: string) {
  return companyName.trim()
}
