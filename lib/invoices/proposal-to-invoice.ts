import type { ProposalContent } from '@/lib/proposals/types'
import type { InvoiceFormValues, InvoiceLineItemFormValues } from './invoice-form'

const DEFAULT_HOURLY_RATE = 200
const MIN_BILLABLE_HOURS = 5

type ProposalForConversion = {
  id: string
  title: string
  clientId: string | null
  content: unknown
}

export function mapProposalToInvoiceDefaults(
  proposal: ProposalForConversion,
): InvoiceFormValues | null {
  if (!proposal.clientId) return null

  const content = proposal.content as ProposalContent | null
  const hourlyRate = content?.rates?.hourlyRate ?? DEFAULT_HOURLY_RATE

  const lineItems: InvoiceLineItemFormValues[] = [
    {
      id: undefined,
      productCatalogItemId: null,
      description: `Development Hours — ${proposal.title}`,
      quantity: MIN_BILLABLE_HOURS,
      unitPrice: hourlyRate,
      createsHourBlock: true,
    },
  ]

  return {
    clientId: proposal.clientId,
    dueDate: null,
    notes: `Per proposal: "${proposal.title}"`,
    taxRate: 0,
    lineItems,
  }
}
