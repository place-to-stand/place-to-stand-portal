'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { RevenueMetrics as RevenueMetricsType } from '@/lib/data/pipeline/types'

type RevenueMetricsProps = {
  data: RevenueMetricsType
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function RevenueMetrics({ data }: RevenueMetricsProps) {
  const totalResolved = data.wonCount + data.lostCount

  const kpis = [
    { label: 'Pipeline Value', value: formatCurrency(data.totalPipeline), description: 'Open deals not yet resolved' },
    {
      label: 'Weighted Pipeline',
      value: formatCurrency(data.weightedPipeline),
      description: 'Adjusted by AI close probability',
    },
    {
      label: 'Closed Won',
      value: formatCurrency(data.totalWonRevenue),
      description: data.wonCount > 0
        ? `${data.wonCount} deal${data.wonCount === 1 ? '' : 's'} · ${formatCurrency(data.avgDealSize)} avg`
        : 'No closed-won deals in period',
    },
    {
      label: 'Win Rate',
      value: formatPercent(data.winRate),
      description: totalResolved > 0
        ? `${data.wonCount}W / ${data.lostCount}L of ${totalResolved} resolved`
        : 'No resolved deals in period',
    },
  ]

  return (
    <div className='flex flex-col gap-4'>
      <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
        {kpis.map(kpi => (
          <Card key={kpi.label}>
            <CardHeader className='pb-2'>
              <CardDescription>{kpi.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className='text-2xl font-bold'>{kpi.value}</p>
              {kpi.description && (
                <p className='text-muted-foreground mt-1 text-xs'>{kpi.description}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {data.monthlyWon.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Won Revenue</CardTitle>
            <CardDescription>
              Revenue from closed-won deals by month
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='h-[250px] w-full'>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart data={data.monthlyWon}>
                  <XAxis dataKey='month' tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={v =>
                      formatCurrency(v as number)
                    }
                  />
                  <Tooltip
                    formatter={(value: number | undefined) => [
                      formatCurrency(value ?? 0),
                      'Revenue',
                    ]}
                  />
                  <Bar
                    dataKey='total'
                    fill='#10b981'
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
