import { CreditCard } from 'lucide-react'

import type { PrepaidBillingData } from '@/lib/data/reports/types'

import {
  SectionEmpty,
  SectionRow,
  SectionRowList,
  SectionShell,
  formatCurrency,
} from './section-shell'

type PrepaidSectionProps = {
  data: PrepaidBillingData
}

export function PrepaidSection({ data }: PrepaidSectionProps) {
  return (
    <SectionShell
      compact
      icon={CreditCard}
      iconTone='emerald'
      title='Prepaid Billing'
      description={`New hour blocks sold this month × $${data.hourlyRate}/hr — what we billed prepaid clients.`}
      total={formatCurrency(data.totalAmount)}
    >
      {data.rows.length > 0 ? (
        <SectionRowList>
          {data.rows.map(row => (
            <SectionRow
              key={row.clientId}
              primary={row.clientName}
              hours={row.totalHours}
              amount={row.amount}
            />
          ))}
        </SectionRowList>
      ) : (
        <SectionEmpty message='No hour blocks purchased this month.' />
      )}
    </SectionShell>
  )
}
