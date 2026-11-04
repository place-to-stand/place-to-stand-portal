/**
 * Payload shapes returned by `GET /api/sheets/init` per entity — the data a
 * self-sufficient sheet wrapper needs to render an entity sheet given only
 * the param value (`<uuid>` or `new`).
 *
 * Types only — this module is imported by client wrappers, so it must never
 * import server-only code. Each entity's payload is added alongside its
 * wrapper + resolver.
 */

import type { ClientWithClosers } from '@/lib/companies/billing/client-sheet-utils'
import type {
  DbUser,
  ProjectWithRelations,
  TaskWithRelations,
} from '@/lib/types'
import type { FormSubmissionRecord } from '@/lib/form-submissions/types'
import type {
  InvoiceClient,
  InvoiceWithLineItems,
  ProductCatalogItemRow,
} from '@/lib/invoices/invoice-form'
import type { TaxRateData } from '@/lib/invoices/use-invoice-sheet-state'
import type { LeadAssigneeOption, LeadRecord } from '@/lib/leads/types'
import type { ContactSheetInput } from '@/lib/people/use-contact-sheet-state'
import type {
  HourBlockClient,
  HourBlockWithClient,
} from '@/lib/hour-blocks/hour-block-form'
import type {
  ClientPickerRow,
  ProjectWithClient,
} from '@/lib/projects/sheet/project-sheet-form'
import type { AdminUserForOwner } from '@/lib/projects/sheet/project-sheet-ui-state'

export type SheetInitPayloads = {
  /** The company sheet loads its own record; init only confirms access. */
  company: { companyId: string | null }
  /**
   * Not a sheet param: the company sheet's billing section loads its client
   * row here. `null` only for `new`.
   */
  client: { client: ClientWithClosers | null }
  submission: { submission: FormSubmissionRecord }
  /** The contact sheet self-fetches its client links; it only needs the row. */
  contact: { contact: ContactSheetInput | null }
  'hour-block': {
    hourBlock: HourBlockWithClient | null
    clients: HourBlockClient[]
  }
  invoice: {
    invoice: InvoiceWithLineItems | null
    clients: InvoiceClient[]
    productCatalog: ProductCatalogItemRow[]
    taxRates: TaxRateData[]
  }
  project: {
    project: ProjectWithClient | null
    clients: ClientPickerRow[]
    adminUsers: AdminUserForOwner[]
  }
  lead: {
    lead: LeadRecord | null
    assignees: LeadAssigneeOption[]
    senderName: string | null
  }
  task: {
    task: TaskWithRelations | null
    admins: DbUser[]
    /** Identity-only projects for the sheet's "Project or lead" selector. */
    projects: ProjectWithRelations[]
    currentUserId: string
  }
}

export type SheetInitEntity = keyof SheetInitPayloads
