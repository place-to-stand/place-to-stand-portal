'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import type { ArchivedLead } from '@/lib/data/leads'
import { restoreLead, destroyLead } from '../_actions'

type LeadsArchiveSectionProps = {
  leads: ArchivedLead[]
}

export function LeadsArchiveSection({ leads }: LeadsArchiveSectionProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null)
  const [pendingDestroyId, setPendingDestroyId] = useState<string | null>(null)
  const [destroyTarget, setDestroyTarget] = useState<ArchivedLead | null>(null)

  const handleRestore = (lead: ArchivedLead) => {
    setPendingRestoreId(lead.id)
    startTransition(async () => {
      const result = await restoreLead({ leadId: lead.id })
      setPendingRestoreId(null)

      if (!result.success) {
        toast({
          title: 'Failed to restore lead',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Lead restored',
        description: `${lead.contactName} has been restored to the board.`,
      })
      router.refresh()
    })
  }

  const handleRequestDestroy = (lead: ArchivedLead) => {
    setDestroyTarget(lead)
  }

  const handleCancelDestroy = () => {
    setDestroyTarget(null)
  }

  const handleConfirmDestroy = () => {
    if (!destroyTarget) return

    const lead = destroyTarget
    setPendingDestroyId(lead.id)
    setDestroyTarget(null)

    startTransition(async () => {
      const result = await destroyLead({ leadId: lead.id })
      setPendingDestroyId(null)

      if (!result.success) {
        toast({
          title: 'Failed to delete lead',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Lead permanently deleted',
        description: `${lead.contactName} has been permanently removed.`,
      })
      router.refresh()
    })
  }

  if (leads.length === 0) {
    return (
      <div className='text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm'>
        No archived leads. Leads will appear here when archived from the board.
      </div>
    )
  }

  return (
    <>
      <ConfirmDialog
        open={Boolean(destroyTarget)}
        title='Permanently delete lead?'
        description={
          destroyTarget
            ? `Permanently deleting ${destroyTarget.contactName} removes this lead and all associated data. This action cannot be undone.`
            : 'Permanently deleting this lead removes it. This action cannot be undone.'
        }
        confirmLabel='Delete forever'
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={handleCancelDestroy}
        onConfirm={handleConfirmDestroy}
      />
      <div className='rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <TableHead className='w-[30%]'>Contact</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Last Status</TableHead>
              <TableHead>Archived</TableHead>
              <TableHead className='w-28 text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map(lead => {
              const isRestoring = isPending && pendingRestoreId === lead.id
              const isDestroying = isPending && pendingDestroyId === lead.id
              const rowDisabled = isRestoring || isDestroying

              const statusLabel = lead.status
                .replace(/_/g, ' ')
                .replace(/\b\w/g, c => c.toUpperCase())

              return (
                <TableRow key={lead.id} className='opacity-60'>
                  <TableCell className='font-medium'>
                    {lead.contactName}
                  </TableCell>
                  <TableCell>
                    {lead.companyName ?? (
                      <span className='text-muted-foreground/40'>—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {lead.contactEmail ? (
                      <span className='text-muted-foreground text-sm'>
                        {lead.contactEmail}
                      </span>
                    ) : (
                      <span className='text-muted-foreground/40'>—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className='text-muted-foreground text-sm'>
                      {statusLabel}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className='text-muted-foreground text-sm'>
                      {formatDistanceToNow(new Date(lead.deletedAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </TableCell>
                  <TableCell className='text-right'>
                    <div className='flex justify-end gap-2'>
                      <Button
                        variant='secondary'
                        size='icon'
                        onClick={() => handleRestore(lead)}
                        disabled={rowDisabled}
                        title='Restore lead'
                        aria-label={`Restore ${lead.contactName}`}
                      >
                        <RefreshCw className='h-4 w-4' />
                        <span className='sr-only'>Restore</span>
                      </Button>
                      <Button
                        variant='destructive'
                        size='icon'
                        onClick={() => handleRequestDestroy(lead)}
                        disabled={rowDisabled}
                        title='Permanently delete lead'
                        aria-label={`Permanently delete ${lead.contactName}`}
                      >
                        <Trash2 className='h-4 w-4' />
                        <span className='sr-only'>Delete permanently</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
