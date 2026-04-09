import { Building } from 'lucide-react'

import type { HouseData } from '@/lib/data/reports/types'

import {
  SectionShell,
  SectionRow,
  SectionRowList,
  formatCurrency,
} from './section-shell'

type HouseSectionProps = {
  data: HouseData
  nominalPercent: string
  prepaidHours: number
  net30Hours: number
}

export function HouseSection({
  data,
  nominalPercent,
  prepaidHours,
  net30Hours,
}: HouseSectionProps) {
  return (
    <SectionShell
      compact
      icon={Building}
      iconTone='emerald'
      title='House'
      description={`${nominalPercent} house rate at $${data.ratePerHour}/hr on billing in — prepaid hours sold + net 30 hours logged.`}
      total={formatCurrency(data.totalAmount)}
    >
      <SectionRowList>
        <SectionRow
          primary='Prepaid'
          hours={prepaidHours}
          amount={prepaidHours * data.ratePerHour}
        />
        <SectionRow
          primary='Net 30'
          hours={net30Hours}
          amount={net30Hours * data.ratePerHour}
        />
      </SectionRowList>
    </SectionShell>
  )
}
