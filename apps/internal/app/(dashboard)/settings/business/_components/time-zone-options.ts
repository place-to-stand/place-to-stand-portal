import type { SearchableComboboxItem } from '@/components/ui/searchable-combobox'

/**
 * Every IANA time zone the browser knows, as "Chicago (America)" with the
 * full name searchable. The saved zone is always listed, even when this
 * browser doesn't know it.
 */
export function timeZoneOptions(current: string): SearchableComboboxItem[] {
  const names = new Set<string>(
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : []
  )
  names.add(current)
  names.add('UTC')
  return [...names].sort().map(name => ({
    value: name,
    label: labelFor(name),
    keywords: [name, name.replace(/_/g, ' ')],
  }))
}

function labelFor(name: string): string {
  const parts = name.split('/')
  if (parts.length < 2) return name
  const city = parts.slice(1).join(' / ').replace(/_/g, ' ')
  return `${city} (${parts[0]})`
}
