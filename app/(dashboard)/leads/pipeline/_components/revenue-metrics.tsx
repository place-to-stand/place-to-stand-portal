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
  const kpis = [
    { label: 'Pipeline Value', value: formatCurrency(data.totalPipeline) },
    {
      label: 'Weighted Pipeline',
      value: formatCurrency(data.weightedPipeline),
    },
    { label: 'Win Rate', value: formatPercent(data.winRate) },
    { label: 'Avg Deal Size', value: formatCurrency(data.avgDealSize) },
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
