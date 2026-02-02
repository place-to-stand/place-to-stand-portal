'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  LEAD_STATUS_ORDER,
  LEAD_STATUS_LABELS,
} from '@/lib/leads/constants'
import type { FunnelData } from '@/lib/data/pipeline/types'

const STATUS_COLORS: Record<string, string> = {
  NEW_OPPORTUNITIES: '#38bdf8',
  ACTIVE_OPPORTUNITIES: '#8b5cf6',
  PROPOSAL_SENT: '#f59e0b',
  ON_ICE: '#94a3b8',
  CLOSED_WON: '#10b981',
  CLOSED_LOST: '#f43f5e',
  UNQUALIFIED: '#6b7280',
}

type ConversionFunnelProps = {
  data: FunnelData
}

export function ConversionFunnel({ data }: ConversionFunnelProps) {
  const countsMap = new Map(
    data.statusCounts.map(s => [s.status, s.count])
  )

  const chartData = LEAD_STATUS_ORDER.map(status => ({
    name: LEAD_STATUS_LABELS[status],
    status,
    count: countsMap.get(status) ?? 0,
  }))

  const totalLeads = chartData.reduce((sum, d) => sum + d.count, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead Funnel</CardTitle>
        <CardDescription>
          Current distribution across pipeline stages ({totalLeads} total)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='h-[300px] w-full'>
          <ResponsiveContainer width='100%' height='100%'>
            <BarChart
              data={chartData}
              layout='vertical'
              margin={{ top: 0, right: 24, bottom: 0, left: 0 }}
            >
              <XAxis type='number' allowDecimals={false} />
              <YAxis
                type='category'
                dataKey='name'
                width={160}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number | undefined) => [value ?? 0, 'Leads']}
              />
              <Bar dataKey='count' radius={[0, 4, 4, 0]}>
                {chartData.map(entry => (
                  <Cell
                    key={entry.status}
                    fill={STATUS_COLORS[entry.status] ?? '#6b7280'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
