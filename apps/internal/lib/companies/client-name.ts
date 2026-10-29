/** A client's name: its company's name, plus its label when it has one. */
export function clientDisplayName(companyName: string, label: string | null | undefined) {
  const trimmed = label?.trim()
  return trimmed ? `${companyName} · ${trimmed}` : companyName
}
