'use client'

import { useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, type UseFormReturn } from 'react-hook-form'

import type { TaskWithRelations } from '@/lib/types'
import type { BoardColumnId } from '@/lib/projects/board/board-constants'

import { createDefaultValues } from '../task-sheet-utils'
import {
  taskSheetFormSchema,
  type TaskSheetFormValues,
} from '../task-sheet-schema'

export type UseTaskSheetFormArgs = {
  task?: TaskWithRelations
  /** Create a new task filled in from this one (Duplicate). */
  duplicateOf?: TaskWithRelations
  defaultStatus: BoardColumnId
  defaultDueOn: string | null
  defaultProjectId: string | null
  defaultAssigneeId: string | null
  defaultLeadId: string | null
}

export type UseTaskSheetFormReturn = {
  form: UseFormReturn<TaskSheetFormValues>
  defaultValues: TaskSheetFormValues
  sheetTitle: string
  editorKey: string
}

export const useTaskSheetForm = ({
  task,
  duplicateOf,
  defaultStatus,
  defaultDueOn,
  defaultProjectId,
  defaultAssigneeId,
  defaultLeadId,
}: UseTaskSheetFormArgs): UseTaskSheetFormReturn => {
  // A duplicate starts from its source's values; it is still a new task.
  const source = task ?? duplicateOf
  const currentAssigneeId = source?.assignees[0]?.user_id ?? null

  const defaultValues = useMemo(() => {
    const values = createDefaultValues({
      task: source,
      currentAssigneeId,
      defaultStatus,
      defaultDueOn,
      defaultProjectId,
      defaultAssigneeId,
      defaultLeadId,
    })
    // A copy is new work: it starts in the first column, not where its
    // source has got to.
    return task ? values : { ...values, status: defaultStatus }
  }, [
    task,
    source,
    currentAssigneeId,
    defaultStatus,
    defaultDueOn,
    defaultProjectId,
    defaultAssigneeId,
    defaultLeadId,
  ])

  const form = useForm<TaskSheetFormValues>({
    resolver: zodResolver(taskSheetFormSchema),
    defaultValues,
  })

  // Edit shows the task's name; create says what it does.
  const sheetTitle = useMemo(
    () =>
      task
        ? task.title || 'Task'
        : duplicateOf
          ? 'Duplicate task'
          : 'Create task',
    [task, duplicateOf]
  )

  const editorKey = useMemo(
    () =>
      task ? task.id : duplicateOf ? `copy-${duplicateOf.id}` : 'new-task',
    [task, duplicateOf]
  )

  return {
    form,
    defaultValues,
    sheetTitle,
    editorKey,
  }
}
