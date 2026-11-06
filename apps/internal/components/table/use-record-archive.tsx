'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { ArchiveConfirmDialog } from '@/components/sheets/archive-confirm-dialog'
import { toastLink, useToast } from '@/components/ui/use-toast'
import type { SheetEntityKey } from '@/lib/sheets/entities'

type ArchiveTarget = { id: string; name: string }

type UseRecordArchiveArgs = {
  /** The record's sheet key, for the toast's link. */
  entity: SheetEntityKey
  /** Lower-case noun for the dialog and toasts: "task", "lead". */
  noun: string
  /** Where it stops showing: "the project board". */
  list: string
  /** The server action; resolves to an error message, or null on success. */
  archive: (id: string) => Promise<string | null>
}

/**
 * Archive from a card or row that has no archive flow of its own (board
 * cards): the shared confirm dialog, the server action, the toasts and a
 * refresh, in one place. Lists keep their own flows, which predate this.
 */
export function useRecordArchive({
  entity,
  noun,
  list,
  archive,
}: UseRecordArchiveArgs) {
  const router = useRouter()
  const { toast } = useToast()
  const [target, setTarget] = useState<ArchiveTarget | null>(null)
  const [isPending, startTransition] = useTransition()
  const capitalised = noun.charAt(0).toUpperCase() + noun.slice(1)

  const confirm = () => {
    if (!target) return
    startTransition(async () => {
      const error = await archive(target.id)
      setTarget(null)
      if (error) {
        toast({
          variant: 'destructive',
          title: `Unable to archive ${noun}`,
          description: error,
          link: toastLink(entity, target.id),
        })
        return
      }
      toast({
        title: `${capitalised} archived`,
        description: target.name,
        link: toastLink(entity, target.id, { archived: true }),
      })
      router.refresh()
    })
  }

  const dialog = (
    <ArchiveConfirmDialog
      open={Boolean(target)}
      entity={noun}
      name={target?.name || `this ${noun}`}
      list={list}
      pending={isPending}
      onCancel={() => setTarget(null)}
      onConfirm={confirm}
    />
  )

  return { requestArchive: setTarget, isPending, dialog }
}
