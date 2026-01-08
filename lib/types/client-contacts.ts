import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import type { contacts, contactClients, contactLeads } from '@/lib/db/schema'

// Base contact types
export type Contact = InferSelectModel<typeof contacts>
export type NewContact = InferInsertModel<typeof contacts>

// Junction table types
export type ContactClient = InferSelectModel<typeof contactClients>
export type NewContactClient = InferInsertModel<typeof contactClients>

export type ContactLead = InferSelectModel<typeof contactLeads>
export type NewContactLead = InferInsertModel<typeof contactLeads>

// Contact with linked clients
export interface ContactWithClients extends Contact {
  clients: Array<{
    id: string
    name: string
    slug: string | null
    isPrimary: boolean
  }>
}

// Contact with isPrimary from a specific client's junction record
// Used when displaying contacts for a single client
export interface ContactWithClientLink extends Contact {
  isPrimary: boolean
}

// Contact with linked leads
export interface ContactWithLeads extends Contact {
  leads: Array<{
    id: string
    contactName: string
    companyName: string | null
  }>
}

// Backwards compatibility - deprecated types
/** @deprecated Use Contact instead */
export type ClientContact = Contact
/** @deprecated Use NewContact instead */
export type NewClientContact = NewContact
/** @deprecated Use ContactWithClients instead */
export interface ClientContactWithClient extends Contact {
  client: {
    id: string
    name: string
    slug: string | null
  }
}

