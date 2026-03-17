export const CLIENT_BILLING_TYPE_VALUES = ['prepaid', 'net_30'] as const

export type ClientBillingTypeValue = (typeof CLIENT_BILLING_TYPE_VALUES)[number]

export type BillingTypeOption = {
  value: ClientBillingTypeValue
  label: string
  description?: string
  /** Tailwind classes for badge styling */
  badgeClassName: string
}

export const CLIENT_BILLING_TYPE_SELECT_OPTIONS: BillingTypeOption[] = [
  {
    value: 'prepaid',
    label: 'Prepaid',
    description: 'Hours draw down from purchased blocks.',
    badgeClassName:
      'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300',
  },
  {
    value: 'net_30',
    label: 'Net 30',
    description: 'Clients are invoiced at the end of each month.',
    badgeClassName:
      'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
  },
]

export function getBillingTypeLabel(
  billingType: ClientBillingTypeValue
): string {
  const option = CLIENT_BILLING_TYPE_SELECT_OPTIONS.find(
    opt => opt.value === billingType
  )
  return option?.label ?? billingType
}

export function getBillingTypeOption(
  billingType: ClientBillingTypeValue
): BillingTypeOption | undefined {
  return CLIENT_BILLING_TYPE_SELECT_OPTIONS.find(
    opt => opt.value === billingType
  )
}
