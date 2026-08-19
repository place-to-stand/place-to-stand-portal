import type { ClientWithMetrics } from '@/lib/data/clients'

export type CliClient = {
  id: string
  name: string
  slug: string | null
  billingType: ClientWithMetrics['billingType']
  state: string | null
  website: string | null
  projectCount: number
  activeProjectCount: number
  totalHoursPurchased: number
  totalHoursUsed: number
  hoursRemaining: number
  createdAt: string
  updatedAt: string
}

export function serializeClient(client: ClientWithMetrics): CliClient {
  return {
    id: client.id,
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
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  }
}
