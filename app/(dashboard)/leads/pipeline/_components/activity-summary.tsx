'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
import type { ActivityMetrics } from '@/lib/data/pipeline/types'

type ActivitySummaryProps = {
  data: ActivityMetrics
}

export function ActivitySummary({ data }: ActivitySummaryProps) {
  const kpis = [
    { label: 'Meetings Scheduled', value: data.meetingsScheduled },
    { label: 'Proposals Sent', value: data.proposalsSent },
    { label: 'Leads Contacted', value: data.leadsContacted },
    { label: 'New Leads', value: data.newLeads },
  ]

  return (
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
  )
}
