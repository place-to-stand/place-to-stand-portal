/**
 * Payload shapes returned by `GET /api/sheets/init` per entity — the data a
 * self-sufficient sheet wrapper needs to render an entity sheet given only
 * the param value (`<uuid>` or `new`).
 *
 * Types only — this module is imported by client wrappers, so it must never
 * import server-only code. Each entity's payload is added alongside its
 * wrapper + resolver.
 */

import type {
  DbClient,
  DbUser,
  ProjectWithRelations,
  TaskWithRelations,
} from '@/lib/types'
import type { FormSubmissionRecord } from '@/lib/form-submissions/types'
import type {
  ClientRow as InvoiceClientRow,
  InvoiceWithLineItems,
  ProductCatalogItemRow,
} from '@/lib/invoices/invoice-form'
import type { TaxRateData } from '@/lib/invoices/use-invoice-sheet-state'
import type { LeadAssigneeOption, LeadRecord } from '@/lib/leads/types'
import type { ContactSheetInput } from '@/lib/settings/contacts/use-contact-sheet-state'
import type {
  ClientRow as HourBlockClientRow,
  HourBlockWithClient,
} from '@/lib/settings/hour-blocks/hour-block-form'
import type {
  ClientRow as ProjectClientRow,
  ProjectWithClient,
} from '@/lib/settings/projects/project-sheet-form'
import type { AdminUserForOwner } from '@/lib/settings/projects/project-sheet-ui-state'
import type { UserAssignments } from '@/lib/settings/users/state/types'

export type SheetInitPayloads = {
  /** `null` client = create mode (`?client=new`). */
  client: { client: DbClient | null }
  submission: { submission: FormSubmissionRecord }
  /** The contact sheet self-fetches its client links; it only needs the row. */
  contact: { contact: ContactSheetInput | null }
  'hour-block': {
    hourBlock: HourBlockWithClient | null
    clients: HourBlockClientRow[]
  }
  invoice: {
    invoice: InvoiceWithLineItems | null
    clients: InvoiceClientRow[]
    productCatalog: ProductCatalogItemRow[]
    taxRates: TaxRateData[]
  }
  user: {
    user: DbUser | null
    currentUserId: string
    assignments: UserAssignments
  }
  project: {
    project: ProjectWithClient | null
    clients: ProjectClientRow[]
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
    /** Default project when creating a task from a lead. */
    currentUserId: string
  }
}

export type SheetInitEntity = keyof SheetInitPayloads
