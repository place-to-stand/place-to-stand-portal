import type { SaveConflict } from '@/lib/sheets/save-conflict/types'

export type LeadActionResult = {
  success: boolean
  error?: string
  leadId?: string
  /** The lead's version after a save; the sheet's next expected one. */
  updatedAt?: string
  /** Set when someone else saved first and nothing was written. */
  conflict?: SaveConflict
}
