import { Users } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { PayrollData } from '@/lib/data/reports/types'

import {
  SectionEmpty,
  SectionRow,
  SectionRowList,
  SectionShell,
  formatCurrency,
} from './section-shell'

type PayrollSectionProps = {
  data: PayrollData
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

export function PayrollSection({ data }: PayrollSectionProps) {
  return (
    <SectionShell
      compact
      icon={Users}
      iconTone='violet'
      title='Payroll'
      description={`Hours logged on client projects × $${data.hourlyRate}/hr — what we owe on payroll this month.`}
      total={formatCurrency(data.totalAmount)}
    >
      {data.rows.length > 0 ? (
        <SectionRowList>
          {data.rows.map(row => {
            const displayName = row.fullName ?? row.email
            const avatarSrc = `/api/storage/user-avatar/${row.userId}?v=${encodeURIComponent(row.updatedAt)}`
            return (
              <SectionRow
                key={row.userId}
                leading={
                  <Avatar className='h-7 w-7'>
                    <AvatarImage src={avatarSrc} alt={displayName} />
                    <AvatarFallback className='text-[10px]'>
                      {getInitials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                }
                primary={displayName}
                hours={row.totalHours}
                amount={row.amount}
              />
            )
          })}
        </SectionRowList>
      ) : (
        <SectionEmpty message='No time logged by employees this month.' />
      )}
    </SectionShell>
  )
}
