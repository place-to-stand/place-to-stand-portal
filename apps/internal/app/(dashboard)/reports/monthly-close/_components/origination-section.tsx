import { Handshake, LinkIcon } from 'lucide-react'

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { OriginationData } from '@/lib/data/reports/types'

import {
  SectionEmpty,
  SectionRow,
  SectionRowList,
  SectionShell,
  formatCurrency,
} from './section-shell'

type OriginationSectionProps = {
  data: OriginationData
}

function getInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

export function OriginationSection({ data }: OriginationSectionProps) {
  return (
    <SectionShell
      compact
      icon={Handshake}
      iconTone='amber'
      title='Origination'
      description={`10% finder fee at $${data.commissionPerHour}/hr on billing in — prepaid hours sold + net 30 hours logged.`}
      total={formatCurrency(data.totalAmount)}
    >
      {data.rows.length > 0 ? (
        <SectionRowList>
          {data.rows.map(row => {
            const key = `${row.originatorKind}:${row.originatorId}`
            const isInternal = row.originatorKind === 'user'
            const avatarSrc =
              isInternal && row.originatorUpdatedAt
                ? `/api/storage/user-avatar/${row.originatorId}?v=${encodeURIComponent(row.originatorUpdatedAt)}`
                : null
            const leading = isInternal ? (
              <Avatar className='h-7 w-7'>
                {avatarSrc ? (
                  <AvatarImage src={avatarSrc} alt={row.originatorName} />
                ) : null}
                <AvatarFallback className='text-[10px]'>
                  {getInitials(row.originatorName)}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className='flex h-7 w-7 items-center justify-center rounded-full border border-dashed'>
                <LinkIcon className='text-muted-foreground h-3 w-3' />
              </div>
            )
            const primary = (
              <div className='flex items-center gap-2'>
                <span className='truncate'>{row.originatorName}</span>
                {!isInternal ? (
                  <Badge
                    variant='outline'
                    className='border-sky-500/40 bg-sky-500/10 px-1.5 py-0 text-[9px] leading-tight text-sky-700 dark:text-sky-300'
                  >
                    External
                  </Badge>
                ) : null}
              </div>
            )
            return (
              <SectionRow
                key={key}
                leading={leading}
                primary={primary}
                secondary={row.clients.map(c => c.clientName).join(', ')}
                hours={row.totalHours}
                amount={row.totalCommission}
              />
            )
          })}
        </SectionRowList>
      ) : (
        <SectionEmpty message='No origination activity this month.' />
      )}
    </SectionShell>
  )
}
