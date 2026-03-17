'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { LEAD_STATUS_LABELS } from '@/lib/leads/constants'
import { getLeadStatusToken } from '@/lib/leads/constants'
import type { VelocityMetrics as VelocityMetricsType } from '@/lib/data/pipeline/types'

type VelocityMetricsProps = {
  data: VelocityMetricsType
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function VelocityMetrics({ data }: VelocityMetricsProps) {
  return (
    <div className='flex flex-col gap-4'>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <Card>
          <CardHeader className='pb-2'>
            <CardDescription>Avg Days to Close</CardDescription>
          </CardHeader>
          <CardContent>
            <p className='text-2xl font-bold'>
              {data.avgDaysToClose > 0
                ? `${Math.round(data.avgDaysToClose)} days`
                : 'N/A'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Time in Stage</CardTitle>
            <CardDescription>Average days per stage</CardDescription>
          </CardHeader>
          <CardContent>
            {data.timeInStage.length > 0 ? (
              <div className='flex flex-col gap-2'>
                {data.timeInStage.map(entry => (
                  <div
                    key={entry.status}
                    className='flex items-center justify-between text-sm'
                  >
                    <span>
                      {LEAD_STATUS_LABELS[entry.status] ?? entry.status}
                    </span>
                    <span className='text-muted-foreground'>
                      {Math.round(entry.avgDays)}d
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className='text-muted-foreground text-sm'>
                No stage history data yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {data.agingLeads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Aging Leads</CardTitle>
            <CardDescription>
              Open leads sorted by time in current stage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className='text-right'>Value</TableHead>
                  <TableHead className='text-right'>Days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.agingLeads.map(lead => (
                  <TableRow key={lead.id}>
                    <TableCell className='font-medium'>
                      {lead.contactName}
                    </TableCell>
                    <TableCell>{lead.companyName ?? '—'}</TableCell>
                    <TableCell>
                      <Badge
                        variant='outline'
                        className={getLeadStatusToken(lead.status)}
                      >
                        {LEAD_STATUS_LABELS[lead.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-right'>
                      {lead.estimatedValue > 0
                        ? formatCurrency(lead.estimatedValue)
                        : '—'}
                    </TableCell>
                    <TableCell className='text-right'>
                      {lead.daysInStage}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
