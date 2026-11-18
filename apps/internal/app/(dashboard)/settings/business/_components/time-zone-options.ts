import { describeTimeZone } from '@pts/ui/dates'

import type { SearchableComboboxItem } from '@/components/ui/searchable-combobox'

/**
 * Every IANA time zone the browser knows, west to east by today's offset,
 * then by city, so the list reads like a world clock. Each says what it is:
 * "Chicago", with "Central Time · GMT−6" under it, and is found by its IANA
 * name, generic name ("central", "CT") or offset ("GMT-6"). The saved zone is
 * always listed, even when this browser doesn't know it.
 */
export function timeZoneOptions(
  current: string,
  now: Date = new Date()
): SearchableComboboxItem[] {
  const names = new Set<string>(
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : []
  )
  names.add(current)
  names.add('UTC')

  return [...names]
    .map(name => {
      const zone = describeTimeZone(name, now)
      const label = cityFor(name)
      const description = zone
        ? zone.genericName
          ? `${zone.genericName} · ${zone.offsetLabel}`
          : zone.offsetLabel
        : undefined
      const keywords = [name, name.replace(/_/g, ' ')]
      if (zone) {
        if (zone.genericName) keywords.push(zone.genericName)
        if (zone.shortGeneric) keywords.push(zone.shortGeneric)
        // Typed with a plain hyphen ("GMT-6") as well as the label's minus.
        keywords.push(zone.offsetLabel, zone.offsetLabel.replace('−', '-'))
      }
      return {
        item: { value: name, label, description, keywords },
        offset: zone?.offsetMinutes ?? 0,
      }
    })
    .sort(
      (a, b) => a.offset - b.offset || a.item.label.localeCompare(b.item.label)
    )
    .map(({ item }) => item)
}

/** "America/Chicago" → "Chicago"; "America/Argentina/Buenos_Aires" → "Argentina / Buenos Aires". */
function cityFor(name: string): string {
  const parts = name.split('/')
  if (parts.length < 2) return name
  return parts.slice(1).join(' / ').replace(/_/g, ' ')
}
