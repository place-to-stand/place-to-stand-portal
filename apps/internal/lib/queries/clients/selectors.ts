import { clients } from "@/lib/db/schema"

// `closer_user_id` is deprecated (closer splits live on the commission term)
// and is never selected.
export type SelectClient = Omit<typeof clients.$inferSelect, 'closerUserId'>

export const clientFields = {
  id: clients.id,
  name: clients.name,
  slug: clients.slug,
  notes: clients.notes,
  billingType: clients.billingType,
  website: clients.website,
  state: clients.state,
  originationContactId: clients.originationContactId,
  originationUserId: clients.originationUserId,
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
  clients.website,
  clients.state,
  clients.originationContactId,
  clients.originationUserId,
  clients.createdBy,
  clients.createdAt,
  clients.updatedAt,
  clients.deletedAt,
] as const
export const ACTIVE_STATUS = "ACTIVE"
