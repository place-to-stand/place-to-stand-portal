import 'server-only'

import type {
  ExternalProjectOption,
  IntegrationProvider,
} from '@/lib/types/integrations'

import { listExternalProjectsForUser } from './connections'

export type IntegrationLinkRequest = {
  provider: IntegrationProvider
  externalId: string
}

/**
 * Re-resolves external projects (Vercel, Supabase) from the caller's own
 * connections rather than trusting what the browser sent, so a link can only
 * be made to a project the staff member can actually see. One listing per
 * provider. Throws the provider errors from `listExternalProjectsForUser`
 * (not connected, rejected token); anything not visible comes back in
 * `missing`.
 */
export async function findExternalProjectsForUser(
  userId: string,
  requests: readonly IntegrationLinkRequest[]
): Promise<{
  options: ExternalProjectOption[]
  missing: IntegrationLinkRequest[]
}> {
  const providers = Array.from(new Set(requests.map(r => r.provider)))
  const listings = new Map<IntegrationProvider, ExternalProjectOption[]>(
    await Promise.all(
      providers.map(
        async provider =>
          [provider, await listExternalProjectsForUser(userId, provider)] as const
      )
    )
  )

  const options: ExternalProjectOption[] = []
  const missing: IntegrationLinkRequest[] = []
  requests.forEach(request => {
    const option = listings
      .get(request.provider)
      ?.find(candidate => candidate.externalId === request.externalId)
    if (option) options.push(option)
    else missing.push(request)
  })

  return { options, missing }
}
