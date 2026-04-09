import { LinkIcon, Wallet } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { PartnerPayoutData } from '@/lib/data/reports/types'

import { SectionShell, formatCurrency, tableClasses } from './section-shell'

type PartnerPayoutsSectionProps = {
  data: PartnerPayoutData
}

function getInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

// Zero amounts become dashes so the Total column dominates visually.
function Amount({ value, muted }: { value: number; muted?: boolean }) {
  if (value === 0) {
    return <span className='text-muted-foreground/40'>—</span>
  }
  return (
    <span className={cn('tabular-nums', muted && 'text-muted-foreground')}>
      {formatCurrency(value)}
    </span>
  )
}

export function PartnerPayoutsSection({ data }: PartnerPayoutsSectionProps) {
  const hasData = data.rows.length > 0
  const hasCloserColumn = data.totalCloser > 0

  return (
    <SectionShell
      icon={Wallet}
      iconTone='violet'
      title='Partner Payouts'
      description='Every person owed money this month — Payroll + Origination + Closer combined per payee.'
      total={formatCurrency(data.totalAmount)}
      totalLabel='to distribute'
    >
      {hasData ? (
        <Table>
          <TableHeader>
            <TableRow className={tableClasses.headRow}>
              <TableHead className={tableClasses.head}>Payee</TableHead>
              <TableHead className={tableClasses.headRight}>Payroll</TableHead>
              <TableHead className={tableClasses.headRight}>
                Origination
              </TableHead>
              {hasCloserColumn ? (
                <TableHead className={tableClasses.headRight}>Closer</TableHead>
              ) : null}
              <TableHead className={tableClasses.headRight}>Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map(row => {
              const isInternal = row.kind === 'user'
              const avatarSrc =
                isInternal && row.avatarUpdatedAt
                  ? `/api/storage/user-avatar/${row.id}?v=${encodeURIComponent(row.avatarUpdatedAt)}`
                  : null
              return (
                <TableRow key={row.key} className={tableClasses.row}>
                  <TableCell className={cn(tableClasses.cell, 'font-medium')}>
                    <div className='flex items-center gap-3'>
                      {isInternal ? (
                        <Avatar className='h-9 w-9'>
                          {avatarSrc ? (
                            <AvatarImage src={avatarSrc} alt={row.name} />
                          ) : null}
                          <AvatarFallback className='text-xs'>
                            {getInitials(row.name)}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className='flex h-9 w-9 items-center justify-center rounded-full border border-dashed'>
                          <LinkIcon className='text-muted-foreground h-4 w-4' />
                        </div>
                      )}
                      <div className='flex min-w-0 items-center gap-2'>
                        <span className='truncate'>{row.name}</span>
                        {!isInternal ? (
                          <Badge
                            variant='outline'
                            className='border-sky-500/40 bg-sky-500/10 px-1.5 py-0 text-[9px] leading-tight text-sky-700 dark:text-sky-300'
                          >
                            External
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className={cn(tableClasses.cell, 'text-right')}>
                    <Amount value={row.payrollAmount} muted />
                  </TableCell>
                  <TableCell className={cn(tableClasses.cell, 'text-right')}>
                    <Amount value={row.originationAmount} muted />
                  </TableCell>
                  {hasCloserColumn ? (
                    <TableCell className={cn(tableClasses.cell, 'text-right')}>
                      <Amount value={row.closerAmount} muted />
                    </TableCell>
                  ) : null}
                  <TableCell
                    className={cn(
                      tableClasses.cell,
                      'text-right text-base font-semibold tabular-nums'
                    )}
                  >
                    {formatCurrency(row.totalAmount)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
          <TableFooter>
            <TableRow className='border-t bg-transparent hover:bg-transparent'>
              <TableCell
                className={cn(
                  tableClasses.footerCell,
                  'text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase'
                )}
              >
                Column totals
              </TableCell>
              <TableCell
                className={cn(
                  tableClasses.footerCell,
                  'text-muted-foreground text-right text-xs tabular-nums'
                )}
              >
                {data.totalPayroll > 0
                  ? formatCurrency(data.totalPayroll)
                  : '—'}
              </TableCell>
              <TableCell
                className={cn(
                  tableClasses.footerCell,
                  'text-muted-foreground text-right text-xs tabular-nums'
                )}
              >
                {data.totalOrigination > 0
                  ? formatCurrency(data.totalOrigination)
                  : '—'}
              </TableCell>
              {hasCloserColumn ? (
                <TableCell
                  className={cn(
                    tableClasses.footerCell,
                    'text-muted-foreground text-right text-xs tabular-nums'
                  )}
                >
                  {formatCurrency(data.totalCloser)}
                </TableCell>
              ) : null}
              <TableCell
                className={cn(
                  tableClasses.footerCell,
                  'text-right text-base font-bold tabular-nums'
                )}
              >
                {formatCurrency(data.totalAmount)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      ) : (
        <p className='text-muted-foreground py-8 text-center text-sm'>
          No partner payouts owed this month.
        </p>
      )}
    </SectionShell>
  )
}
