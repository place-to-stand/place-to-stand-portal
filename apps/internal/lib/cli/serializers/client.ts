import type { ClientWithMetrics } from '@/lib/data/clients'

import { isoTimestamp } from './timestamp'

/** Who brought a client in, or a closer: a staff sign-in or a person. */
export type CliCommissionParty = {
  kind: 'user' | 'contact'
  id: string
  name: string | null
}

export type CliClient = {
  id: string
  /** The company this client is (the same id as `id` since 0111). */
  companyId: string | null
  name: string
  slug: string | null
  billingType: ClientWithMetrics['billingType']
  state: string | null
  /** The company's website, falling back to the client's legacy copy. */
  website: string | null
  projectCount: number
  activeProjectCount: number
  totalHoursPurchased: number
  totalHoursUsed: number
  hoursRemaining: number
  /** On the newest commission term; null when nobody is recorded. */
  originator: CliCommissionParty | null
  /** Closers on the newest commission term, largest share first. */
  closers: (CliCommissionParty & { sharePercent: number })[]
  createdAt: string
  updatedAt: string
}

export function serializeClient(client: ClientWithMetrics): CliClient {
  return {
    id: client.id,
    companyId: client.companyId,
    name: client.name,
    slug: client.slug,
    billingType: client.billingType,
    state: client.state,
    website: client.website,
    projectCount: client.projectCount,
    activeProjectCount: client.activeProjectCount,
    totalHoursPurchased: client.totalHoursPurchased,
    totalHoursUsed: client.totalHoursUsed,
    hoursRemaining: client.hoursRemaining,
    originator: client.originationUserId
      ? {
          kind: 'user',
          id: client.originationUserId,
          name: client.originationUserName,
        }
      : client.originationContactId
        ? {
            kind: 'contact',
            id: client.originationContactId,
            name: client.originationContactName,
          }
        : null,
    closers: client.closers.map(closer => ({
      kind: closer.kind,
      id: closer.id,
      name: closer.name,
      sharePercent: closer.sharePercent,
    })),
    createdAt: isoTimestamp(client.createdAt ?? client.updatedAt),
    updatedAt: isoTimestamp(client.updatedAt),
  }
}
