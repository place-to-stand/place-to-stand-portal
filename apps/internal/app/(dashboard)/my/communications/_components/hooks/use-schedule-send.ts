'use client'

import { useState, useCallback } from 'react'
import { parseISO } from 'date-fns'

interface UseScheduleSendOptions {
  toast: (options: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void
}

interface UseScheduleSendReturn {
  scheduledAt: Date | null
  setScheduledAt: React.Dispatch<React.SetStateAction<Date | null>>
  showSchedulePicker: boolean
  setShowSchedulePicker: React.Dispatch<React.SetStateAction<boolean>>
  customScheduleDate: string
  setCustomScheduleDate: React.Dispatch<React.SetStateAction<string>>
  handleCustomScheduleConfirm: () => void
}

export function useScheduleSend({
  toast,
}: UseScheduleSendOptions): UseScheduleSendReturn {
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null)
  const [showSchedulePicker, setShowSchedulePicker] = useState(false)
  const [customScheduleDate, setCustomScheduleDate] = useState('')

  const handleCustomScheduleConfirm = useCallback(() => {
    if (!customScheduleDate) return
    const date = parseISO(customScheduleDate)
    if (date > new Date()) {
      setScheduledAt(date)
      setShowSchedulePicker(false)
      setCustomScheduleDate('')
    } else {
      toast({
        title: 'Invalid date',
        description: 'Please select a date in the future',
        variant: 'destructive',
      })
    }
  }, [customScheduleDate, toast])

  return {
    scheduledAt,
    setScheduledAt,
    showSchedulePicker,
    setShowSchedulePicker,
    customScheduleDate,
    setCustomScheduleDate,
    handleCustomScheduleConfirm,
  }
}
