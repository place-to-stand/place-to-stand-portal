/**
 * Lead to Client Conversion Types
 *
 * Types for converting a CLOSED_WON lead into a client record.
 */

import type { ClientBillingTypeValue } from '@/lib/types'

export interface LeadConversionInput {
  leadId: string
  /** Client name - defaults to lead.companyName || lead.contactName */
  clientName?: string
  /** Client slug - auto-generated if not provided */
  clientSlug?: string
  /** Billing type for the new client */
  billingType: ClientBillingTypeValue
  /** Whether to copy lead notes to client notes */
  copyNotesToClient: boolean
  /** Whether to create a contact record from the lead */
  createContact: boolean
  /** Whether to create a project linked to the new client */
  createProject: boolean
  /** Name for the new project (required if createProject is true) */
  projectName?: string
  /** Link to an existing client instead of creating a new one */
  existingClientId?: string
  /** Initial client member user IDs (optional) */
  memberIds?: string[]
}

export interface LeadConversionResult {
  clientId?: string
  clientSlug?: string
  projectId?: string
  error?: string
  warnings?: string[]
}
