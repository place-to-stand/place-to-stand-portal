import type { ContactsSettingsListItem } from '@/lib/queries/contacts'
import type { ContactsTableContact } from '@/lib/settings/contacts/use-contacts-table-state'

export function mapContactToTableRow(
  item: ContactsSettingsListItem
): ContactsTableContact {
  return {
    id: item.id,
    email: item.email,
    name: item.name,
    phone: item.phone,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    deletedAt: item.deletedAt,
    metrics: {
      totalClients: item.metrics.totalClients,
    },
  }
}
