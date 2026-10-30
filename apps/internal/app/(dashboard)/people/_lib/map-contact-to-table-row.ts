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
    userId: item.userId,
    userHasPhoto: item.userHasPhoto ?? false,
    signInRole: item.signInRole ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    deletedAt: item.deletedAt,
    jobTitle: item.jobTitle,
    linkedinUrl: item.linkedinUrl,
    companyId: item.companyId,
    companyName: item.companyName,
    companies: item.companies,
    metrics: {
      totalClients: item.metrics.totalClients,
      clients: item.metrics.clients,
    },
  }
}
