'use client'

import { useRouter } from 'next/navigation'

import { TaskSheet } from '@/app/(dashboard)/projects/task-sheet'

import { NEW_SHEET_VALUE } from '../entities'
import { useSheetParams } from '../use-sheet-params'
import { useSheetInit } from './use-sheet-init'
import type { SheetWrapperProps } from './types'

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

export function TaskSheetWrapper({
  value,
  open,
  stack,
  onRequestClose,
}: SheetWrapperProps) {
  const router = useRouter()
  const { getAux } = useSheetParams()
  const data = useSheetInit('task', value)

  if (!data) {
    return null
  }

  const isCreating = value === NEW_SHEET_VALUE
  // Creating a task while a lead sheet is open below in the stack anchors the
  // task to that lead. Lead tasks carry NO project (PRD 005 D8).
  const leadBelow = stack.find(item => item.entity === 'lead')
  const leadId =
    isCreating && leadBelow && leadBelow.value !== NEW_SHEET_VALUE
      ? leadBelow.value
      : null

  // Follow-up shortcut (D24): a create sheet opened from the lead update
  // composer carries the due date the composer resolved from the stage's
  // configured threshold. Guarded to a date-only shape so a hand-edited URL
  // can't push arbitrary text into the form.
  const auxDueOn = getAux('taskDueOn')
  const defaultDueOn =
    isCreating && auxDueOn && DATE_ONLY_RE.test(auxDueOn) ? auxDueOn : null

  return (
    <TaskSheet
      open={open}
      onOpenChange={next => {
        if (!next) {
          onRequestClose()
          router.refresh()
        }
      }}
      task={data.task ?? undefined}
      canManage
      admins={data.admins}
      currentUserId={data.currentUserId}
      defaultStatus='ON_DECK'
      defaultDueOn={defaultDueOn}
      projects={data.projects}
      defaultProjectId={leadId ? null : (data.task?.project_id ?? null)}
      defaultAssigneeId={null}
      defaultLeadId={leadId}
    />
  )
}
