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
import type { ContactSheetInput } from '@/lib/settings/contacts/use-contact-sheet-state'
import type {
  HourBlockClient,
  HourBlockWithClient,
} from '@/lib/settings/hour-blocks/hour-block-form'
import type {
  ClientPickerRow,
  ProjectWithClient,
} from '@/lib/settings/projects/project-sheet-form'
import type { AdminUserForOwner } from '@/lib/settings/projects/project-sheet-ui-state'

export type SheetInitPayloads = {
  /** The company sheet loads its own record; init only confirms access. */
  company: { companyId: string | null }
  /** `null` client = create mode (`?client=new`). */
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
  user: {
    /** The person whose sign-in this is. */
    contactId: string | null
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
    /** Identity-only projects for the sheet's project selector. */
    projects: ProjectWithRelations[]
    /** Default project when creating a task from a lead (null until it exists). */
    salesProjectId: string | null
    currentUserId: string
  }
}

export type SheetInitEntity = keyof SheetInitPayloads
