/** "Acme", "Acme and Beta", "Acme, Beta and Cobalt". Client-safe. */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}
