'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import type {
  LeadFormValues,
  LeadSheetProps,
} from '@/app/(dashboard)/leads/_components/lead-sheet/types'
import { useSaveConflict } from '@/lib/sheets/save-conflict/use-save-conflict'

type UseLeadFormSeedArgs = {
  form: UseFormReturn<LeadFormValues>
  open: boolean
  lead: LeadSheetProps['lead']
  duplicateOf?: LeadSheetProps['duplicateOf']
  initialStatus: LeadSheetProps['initialStatus']
  defaultValues: LeadFormValues
}

function sameVersion(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false
  return Date.parse(a) === Date.parse(b)
}

/**
 * Seeds the lead form from the record, and remembers which version of the
 * lead it was seeded from: Save sends that back, so a save someone else
 * made since is caught instead of overwritten.
 */
export function useLeadFormSeed({
  form,
  open,
  lead,
  duplicateOf,
  initialStatus,
  defaultValues,
}: UseLeadFormSeedArgs) {
  // Reset only when a different record (or a newer save of it) arrives. A
  // router refresh hands over a fresh but identical `lead` object, e.g. after
  // a sheet stacked on top saves, and must not wipe unsaved edits such as a
  // company just picked from that sheet.
  const resetKey = lead
    ? `${lead.id}:${lead.updatedAt}`
    : duplicateOf
      ? `copy:${duplicateOf.id}`
      : `new:${initialStatus ?? ''}`
  const lastResetKey = useRef<string | null>(null)
  const saveConflict = useSaveConflict()
  useEffect(() => {
    // Closing forgets the key, so reopening always starts from the record.
    if (!open) {
      lastResetKey.current = null
      return
    }
    if (lastResetKey.current === resetKey) return
    const sameLead = Boolean(
      lead?.id && lastResetKey.current?.startsWith(`${lead.id}:`)
    )
    // Our own keep-open save coming back: take the server's values but keep
    // fields edited since.
    const ourSave =
      sameLead && sameVersion(saveConflict.expected(), lead?.updatedAt)
    // Someone else's newer save never wipes edits in progress: Save then
    // reports the conflict and lets the user choose.
    if (sameLead && !ourSave && form.formState.isDirty) return
    lastResetKey.current = resetKey
    saveConflict.seed(lead?.updatedAt)
    form.reset(defaultValues, { keepDirtyValues: ourSave })
  }, [
    defaultValues,
    form,
    lead?.id,
    lead?.updatedAt,
    open,
    resetKey,
    saveConflict,
  ])

  /**
   * Drops the edits; the next record that arrives re-seeds the form, unless
   * the user has typed again by then (the key stays this lead's, so the
   * dirty check above still applies).
   */
  const reloadFromRecord = useCallback(() => {
    lastResetKey.current = lead ? `${lead.id}:reload` : null
    form.reset(defaultValues)
  }, [defaultValues, form, lead])

  return { saveConflict, reloadFromRecord }
}
