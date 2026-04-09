import { UserCheck } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { CloserData } from '@/lib/data/reports/types'

import {
  SectionEmpty,
  SectionRow,
  SectionRowList,
  SectionShell,
  formatCurrency,
} from './section-shell'

type CloserSectionProps = {
  data: CloserData
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

export function CloserSection({ data }: CloserSectionProps) {
  return (
    <SectionShell
      compact
      icon={UserCheck}
      iconTone='rose'
      title='Closer'
      description={`20% closer fee at $${data.commissionPerHour}/hr on billing in — prepaid hours sold + net 30 hours logged.`}
      total={formatCurrency(data.totalAmount)}
    >
      {data.rows.length > 0 ? (
        <SectionRowList>
          {data.rows.map(row => {
            const displayName = row.closerName ?? row.closerEmail
            const avatarSrc = `/api/storage/user-avatar/${row.closerUserId}?v=${encodeURIComponent(row.closerUpdatedAt)}`
            return (
              <SectionRow
                key={row.closerUserId}
                leading={
                  <Avatar className='h-7 w-7'>
                    <AvatarImage src={avatarSrc} alt={displayName} />
                    <AvatarFallback className='text-[10px]'>
                      {getInitials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                }
                primary={displayName}
                secondary={row.clients.map(c => c.clientName).join(', ')}
                hours={row.totalHours}
                amount={row.totalCommission}
              />
            )
          })}
        </SectionRowList>
      ) : (
        <SectionEmpty message='No closer activity this month.' />
      )}
    </SectionShell>
  )
}
