'use client'

import { useRouter } from 'next/navigation'

import { TaskSheet } from '@/app/(dashboard)/projects/task-sheet'

import { NEW_SHEET_VALUE, parseDuplicateSourceId } from '../entities'
import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

export function TaskSheetWrapper({
  value,
  open,
  stack,
  stackKey,
  onRequestClose,
}: SheetWrapperProps) {
  const router = useRouter()
  // A duplicate loads its source task and opens it as a new one.
  const sourceId = parseDuplicateSourceId(value)
  const data = useSheetInit('task', sourceId ?? value)

  if (!data) {
    return null
  }

  const isCreating = value === NEW_SHEET_VALUE
  // Creating a task while a lead sheet is open below in the stack puts the
  // task on the nearest one.
  const ownIndex = stack.findIndex(item => item.key === stackKey)
  const leadBelow = (ownIndex === -1 ? stack : stack.slice(0, ownIndex))
    .toReversed()
    .find(item => item.entity === 'lead')
  const leadId =
    isCreating && leadBelow && leadBelow.value !== NEW_SHEET_VALUE
      ? leadBelow.value
      : null

  return (
    <TaskSheet
      open={open}
      onOpenChange={next => {
        if (!next) {
          onRequestClose()
          router.refresh()
        }
      }}
      task={sourceId ? undefined : (data.task ?? undefined)}
      duplicateOf={sourceId ? (data.task ?? undefined) : undefined}
      canManage
      admins={data.admins}
      currentUserId={data.currentUserId}
      defaultStatus='ON_DECK'
      defaultDueOn={null}
      projects={data.projects}
      defaultProjectId={sourceId ? null : (data.task?.project_id ?? null)}
      defaultAssigneeId={data.currentUserId}
      defaultLeadId={leadId}
    />
  )
}
