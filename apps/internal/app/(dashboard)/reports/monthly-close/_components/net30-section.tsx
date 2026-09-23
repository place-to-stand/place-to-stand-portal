import { Building2 } from 'lucide-react'

import type { Net30Data } from '@/lib/data/reports/types'

import {
  SectionEmpty,
  SectionRow,
  SectionRowList,
  SectionShell,
  formatCurrency,
} from './section-shell'

type Net30SectionProps = {
  data: Net30Data
}

export function Net30Section({ data }: Net30SectionProps) {
  return (
    <SectionShell
      compact
      icon={Building2}
      iconTone='sky'
      title='Net 30 billing'
      description={`Hours logged on net 30 clients × $${data.hourlyRate}/hr — what we'll invoice this month.`}
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
        <SectionEmpty message='No hours logged for net 30 clients this month.' />
      )}
    </SectionShell>
  )
}
