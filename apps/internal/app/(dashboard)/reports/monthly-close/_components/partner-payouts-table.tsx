'use client'

import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import { RowActionButton } from '@pts/ui/row-action-button'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@pts/ui/table'
import { cn } from '@/lib/utils'

import { formatMoney } from './format'
import { PayeeAvatar } from './payee-avatar'
import type { PayoutColumn, PayoutTable } from './payout-rows'

type PartnerPayoutsTableProps = {
  table: PayoutTable
  showCloser: boolean
  showProfitShare: boolean
}

const MONEY_HEAD = 'text-muted-foreground w-28 text-right text-xs font-medium'
const MONEY_CELL = 'text-right tabular-nums'

function Amount({ value }: { value: number }) {
  if (value === 0) {
    return <span className='text-muted-foreground/50'>—</span>
  }
  return <span className='text-foreground/80'>{formatMoney(value)}</span>
}

export function PartnerPayoutsTable({
  table,
  showCloser,
  showProfitShare,
}: PartnerPayoutsTableProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())

  const columns: PayoutColumn[] = [
    'payroll',
    'origination',
    ...(showCloser ? (['closer'] as const) : []),
    ...(showProfitShare ? (['profitShare'] as const) : []),
  ]
  const labels: Record<PayoutColumn, string> = {
    payroll: 'Payroll',
    origination: 'Origination',
    closer: 'Closer',
    profitShare: 'Profit share',
  }

  const toggle = (key: string) =>
    setExpanded(current => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <section
      aria-labelledby='partner-payouts-title'
      className='bg-card overflow-hidden rounded-xl border shadow-sm'
    >
      <div className='flex items-center justify-between gap-4 px-5 py-3.5'>
        <h2 id='partner-payouts-title' className='text-base font-semibold'>
          Payouts to send
        </h2>
        <div className='flex items-baseline gap-2'>
          <span className='text-muted-foreground text-xs'>
            {showProfitShare ? 'Including profit share' : 'Total'}
          </span>
          <span className='text-base font-semibold tabular-nums'>
            {formatMoney(table.totals.total)}
          </span>
        </div>
      </div>

      {table.rows.length === 0 ? (
        <p className='text-muted-foreground border-t px-5 py-8 text-center text-sm'>
          No payouts this month.
        </p>
      ) : (
        <Table layout='fixed'>
          <TableHeader>
            <TableRow className='bg-muted/50 hover:bg-muted/50 border-t'>
              <TableHead className='text-muted-foreground pl-12 text-xs font-medium'>
                Payee
              </TableHead>
              {columns.map(column => (
                <TableHead key={column} className={MONEY_HEAD}>
                  {labels[column]}
                </TableHead>
              ))}
              <TableHead className={cn(MONEY_HEAD, 'w-32 pr-5')}>
                Total
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.rows.map(row => {
              const isOpen = expanded.has(row.key)
              return (
                <Fragment key={row.key}>
                  <TableRow className={cn(isOpen && 'bg-muted/30 border-b-0')}>
                    <TableCell className='py-2.5 pl-3 whitespace-normal'>
                      <div className='flex items-center gap-2'>
                        <RowActionButton
                          type='button'
                          label={`${isOpen ? 'Hide' : 'Show'} ${row.name}'s breakdown`}
                          icon={isOpen ? <ChevronDown /> : <ChevronRight />}
                          className='text-muted-foreground'
                          aria-expanded={isOpen}
                          onClick={() => toggle(row.key)}
                        />
                        <PayeeAvatar
                          kind={row.kind}
                          id={row.id}
                          name={row.name}
                          avatarUpdatedAt={row.avatarUpdatedAt}
                        />
                        <div className='flex min-w-0 flex-col pl-1'>
                          <span className='flex min-w-0 items-center gap-2 font-medium'>
                            <span>{row.name}</span>
                            {row.kind === 'contact' ? (
                              <Badge variant='outline'>External</Badge>
                            ) : null}
                          </span>
                          <span className='text-muted-foreground text-xs tabular-nums'>
                            {row.secondary}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    {columns.map(column => (
                      <TableCell key={column} className={MONEY_CELL}>
                        <Amount value={row[column]} />
                      </TableCell>
                    ))}
                    <TableCell className={cn(MONEY_CELL, 'pr-5 font-semibold')}>
                      {formatMoney(row.total)}
                    </TableCell>
                  </TableRow>
                  {isOpen
                    ? row.details.map((line, index) => (
                        <TableRow
                          key={`${line.column}:${index}`}
                          className={cn(
                            'bg-muted/30 hover:bg-muted/30 text-muted-foreground text-[13px]',
                            index < row.details.length - 1 && 'border-b-0'
                          )}
                        >
                          <TableCell
                            className={cn(
                              'py-1 pl-23 whitespace-normal',
                              index === row.details.length - 1 && 'pb-3'
                            )}
                          >
                            {line.label}
                          </TableCell>
                          {columns.map(column => (
                            <TableCell
                              key={column}
                              className={cn(
                                MONEY_CELL,
                                'py-1',
                                index === row.details.length - 1 && 'pb-3'
                              )}
                            >
                              {column === line.column
                                ? formatMoney(line.amount)
                                : null}
                            </TableCell>
                          ))}
                          <TableCell className='pr-5' />
                        </TableRow>
                      ))
                    : null}
                </Fragment>
              )
            })}
          </TableBody>
          <TableFooter>
            <TableRow className='hover:bg-transparent'>
              <TableCell className='py-3 pl-12 font-medium'>Total</TableCell>
              {columns.map(column => (
                <TableCell
                  key={column}
                  className={cn(MONEY_CELL, 'font-medium')}
                >
                  {formatMoney(table.totals[column])}
                </TableCell>
              ))}
              <TableCell className={cn(MONEY_CELL, 'pr-5 font-semibold')}>
                {formatMoney(table.totals.total)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </section>
  )
}
