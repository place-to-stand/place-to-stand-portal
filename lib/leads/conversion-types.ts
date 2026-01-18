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
  /** Initial client member user IDs (optional) */
  memberIds?: string[]
}

export interface LeadConversionResult {
  clientId?: string
  clientSlug?: string
  error?: string
}
