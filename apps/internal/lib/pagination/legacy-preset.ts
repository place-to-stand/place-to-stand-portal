import { redirect } from 'next/navigation'

import type { RawSearchParams } from './params'

/**
 * Clients and Users were once list presets (`/companies?type=client`,
 * `/people?role=…`). Sends an old link to the page it meant, keeping its
 * other params; `keep` says whether the preset param means something there.
 */
export function redirectLegacyPreset(
  params: RawSearchParams,
  {
    key,
    path,
    keep,
  }: { key: string; path: string; keep: (value: string) => boolean }
): never {
  const next = new URLSearchParams()
  for (const [name, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item === undefined) continue
      if (name === key && !keep(item)) continue
      next.append(name, item)
    }
  }
  const query = next.toString()
  redirect(query ? `${path}?${query}` : path)
}
