'use client'

import { useRouter } from 'next/navigation'

import { TaskSheet } from '@/app/(dashboard)/projects/task-sheet'

import { NEW_SHEET_VALUE } from '../entities'
import { useSheetParams } from '../use-sheet-params'
import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

export function TaskSheetWrapper({ value, stack }: SheetWrapperProps) {
  const router = useRouter()
  const { close } = useSheetParams()
  const data = useSheetInit('task', value)

  if (!data) {
    return null
  }

  const isCreating = value === NEW_SHEET_VALUE
  // Creating a task while a lead sheet is open below in the stack links the
  // task to that lead and defaults it to the sales project.
  const leadBelow = stack.find(item => item.entity === 'lead')
  const leadId =
    isCreating && leadBelow && leadBelow.value !== NEW_SHEET_VALUE
      ? leadBelow.value
      : null

  return (
    <TaskSheet
      open
      onOpenChange={open => {
        if (!open) {
          close('task')
          router.refresh()
        }
      }}
      task={data.task ?? undefined}
      canManage
      admins={data.admins}
      currentUserId={data.currentUserId}
      defaultStatus='ON_DECK'
      defaultDueOn={null}
      projects={data.projects}
      defaultProjectId={
        leadId ? data.salesProjectId : (data.task?.project_id ?? null)
      }
      defaultAssigneeId={null}
      defaultLeadId={leadId}
    />
  )
}
