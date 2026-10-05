import type { ClientsSettingsListItem } from '@/lib/queries/clients'
import type { ClientRow } from '@/lib/settings/clients/client-sheet-utils'

export type ClientsTableRow = ClientRow & {
  metrics: {
    active_projects: number
    total_projects: number
  }
}

export function mapClientToTableRow(client: ClientsSettingsListItem): ClientsTableRow {
  return {
    id: client.id,
    name: client.name,
    slug: client.slug,
    notes: client.notes,
    website: client.website,
    state: client.state ?? null,
    origination_contact_id: client.originationContactId,
    origination_user_id: client.originationUserId,
    billing_type: client.billingType,
    created_by: client.createdBy,
    created_at: client.createdAt,
    updated_at: client.updatedAt,
    deleted_at: client.deletedAt,
    closers: client.closers,
    metrics: {
      active_projects: client.metrics.activeProjects,
      total_projects: client.metrics.totalProjects,
    },
  }
}
