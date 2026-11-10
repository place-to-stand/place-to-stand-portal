'use client'

import { useQuery } from '@tanstack/react-query'

import { getJson } from '@/lib/http/get-json'
import type { TagEntity, TagOption } from '@/lib/tags/names'

/** Invalidate after a save that may have created tags. */
export const tagOptionsQueryKey = (entity: TagEntity) =>
  ['tagOptions', entity] as const

/** The tags of one kind still on some record, A to Z, with how often each
 * is used. */
export function useTagOptions(entity: TagEntity, enabled = true) {
  return useQuery({
    queryKey: tagOptionsQueryKey(entity),
    queryFn: () => getJson<TagOption[]>(`/api/tags/${entity}`),
    staleTime: 30_000,
    enabled,
  })
}
