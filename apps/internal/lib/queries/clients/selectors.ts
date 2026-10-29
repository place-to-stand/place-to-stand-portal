import { clients } from "@/lib/db/schema"

// `closer_user_id` is deprecated (closer splits live on the commission term)
// and is never selected. `website` is the company's now (the client's copy
// is legacy; see `clientWebsiteSql`).
export type SelectClient = Omit<
  typeof clients.$inferSelect,
  'closerUserId' | 'website'
>

export const clientFields = {
  id: clients.id,
  name: clients.name,
  slug: clients.slug,
  notes: clients.notes,
  billingType: clients.billingType,
  state: clients.state,
  originationContactId: clients.originationContactId,
  originationUserId: clients.originationUserId,
  companyId: clients.companyId,
  label: clients.label,
  createdBy: clients.createdBy,
  createdAt: clients.createdAt,
  updatedAt: clients.updatedAt,
  deletedAt: clients.deletedAt,
}

export const clientGroupByColumns = [
  clients.id,
  clients.name,
  clients.slug,
  clients.notes,
  clients.billingType,
  clients.state,
  clients.originationContactId,
  clients.originationUserId,
  clients.companyId,
  clients.label,
  clients.createdBy,
  clients.createdAt,
  clients.updatedAt,
  clients.deletedAt,
] as const
export const ACTIVE_STATUS = "ACTIVE"
