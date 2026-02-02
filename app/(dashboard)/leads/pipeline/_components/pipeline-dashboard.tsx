'use client'

import { useCallback, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { PipelineAnalytics } from '@/lib/data/pipeline/types'

import { ConversionFunnel } from './conversion-funnel'
import { RevenueMetrics } from './revenue-metrics'
import { VelocityMetrics } from './velocity-metrics'
import { ActivitySummary } from './activity-summary'

type PipelineDashboardProps = {
  analytics: PipelineAnalytics
  start: string
  end: string
}

export function PipelineDashboard({
  analytics,
  start,
  end,
}: PipelineDashboardProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [startInput, setStartInput] = useState(start.slice(0, 10))
  const [endInput, setEndInput] = useState(end.slice(0, 10))

  const handleApplyDateRange = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('start', new Date(startInput).toISOString())
    params.set('end', new Date(endInput + 'T23:59:59.999Z').toISOString())
    router.push(`/leads/pipeline?${params.toString()}`)
  }, [startInput, endInput, searchParams, router])

  return (
    <div className='flex flex-1 flex-col gap-6'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4'>
        <div className='flex items-center gap-2'>
          <label className='text-muted-foreground text-sm'>From</label>
          <Input
            type='date'
            value={startInput}
            onChange={e => setStartInput(e.target.value)}
            className='w-auto'
          />
        </div>
        <div className='flex items-center gap-2'>
          <label className='text-muted-foreground text-sm'>To</label>
          <Input
            type='date'
            value={endInput}
            onChange={e => setEndInput(e.target.value)}
            className='w-auto'
          />
        </div>
        <Button size='sm' onClick={handleApplyDateRange}>
          Apply
        </Button>
      </div>

      <Tabs defaultValue='analytics' className='flex flex-1 flex-col'>
        <TabsList className='bg-muted/40 h-10 w-full justify-start gap-2 rounded-lg p-1 sm:w-auto'>
          <TabsTrigger value='analytics' className='px-3 py-1.5 text-sm'>
            Analytics
          </TabsTrigger>
          <TabsTrigger
            value='forecast'
            className='px-3 py-1.5 text-sm'
            disabled
          >
            Forecast
          </TabsTrigger>
          <TabsTrigger
            value='actions'
            className='px-3 py-1.5 text-sm'
            disabled
          >
            Actions
          </TabsTrigger>
        </TabsList>

        <TabsContent value='analytics' className='mt-4 flex flex-col gap-8'>
          <ConversionFunnel data={analytics.funnel} />
          <RevenueMetrics data={analytics.revenue} />
          <VelocityMetrics data={analytics.velocity} />
          <ActivitySummary data={analytics.activity} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
