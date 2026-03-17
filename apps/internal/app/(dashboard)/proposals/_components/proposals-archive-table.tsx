'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { RotateCcw, Loader2, Eye } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import type { ProposalWithRelations } from '@/lib/queries/proposals'
import { PROPOSAL_STATUS_CONFIG } from '@/lib/proposals/constants'

import { ProposalDetailSheet } from './proposal-detail-sheet'
import { restoreProposalAction } from '../_actions/restore-proposal'

type ProposalsArchiveTableProps = {
  proposals: ProposalWithRelations[]
}

export function ProposalsArchiveTable({ proposals }: ProposalsArchiveTableProps) {
  const [selectedProposal, setSelectedProposal] = useState<ProposalWithRelations | null>(null)

  if (proposals.length === 0) {
    return (
      <div className='grid h-full w-full place-items-center rounded-xl border border-dashed p-12 text-center'>
        <div className='space-y-2'>
          <h2 className='text-lg font-semibold'>No archived proposals</h2>
          <p className='text-muted-foreground text-sm'>
            Deleted proposals will appear here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className='rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <TableHead>Title</TableHead>
              <TableHead>Lead / Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className='text-right'>Value</TableHead>
              <TableHead>Archived</TableHead>
              <TableHead className='w-32' />
            </TableRow>
          </TableHeader>
          <TableBody>
            {proposals.map(proposal => (
              <ArchiveRow
                key={proposal.id}
                proposal={proposal}
                onView={() => setSelectedProposal(proposal)}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <ProposalDetailSheet
        proposal={selectedProposal}
        open={!!selectedProposal}
        onOpenChange={open => { if (!open) setSelectedProposal(null) }}
        senderName=""
      />
    </>
  )
}

function ArchiveRow({ proposal, onView }: { proposal: ProposalWithRelations; onView: () => void }) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const config = PROPOSAL_STATUS_CONFIG[proposal.status]
  const StatusIcon = config.icon

  const handleRestore = useCallback(() => {
    startTransition(async () => {
      const result = await restoreProposalAction(proposal.id)
      if (result.success) {
        toast({ title: 'Proposal restored' })
        router.refresh()
      } else {
        toast({ variant: 'destructive', title: 'Restore failed', description: result.error })
      }
    })
  }, [proposal.id, toast, router])

  return (
    <TableRow>
      <TableCell className='max-w-[200px] truncate font-medium'>
        {proposal.title}
      </TableCell>
      <TableCell className='text-sm text-muted-foreground'>
        {proposal.leadName ?? proposal.clientName ?? '—'}
      </TableCell>
      <TableCell>
        <Badge variant='outline' className={`text-xs ${config.className}`}>
          <StatusIcon className='mr-1 h-3 w-3' />
          {config.label}
        </Badge>
      </TableCell>
      <TableCell className='text-right tabular-nums'>
        {proposal.estimatedValue
          ? `$${parseFloat(proposal.estimatedValue).toLocaleString()}`
          : '—'}
      </TableCell>
      <TableCell className='text-sm text-muted-foreground'>
        {proposal.updatedAt
          ? format(new Date(proposal.updatedAt), 'MMM d, yyyy')
          : '—'}
      </TableCell>
      <TableCell>
        <div className='flex items-center justify-end gap-1'>
          <Button
            variant='ghost'
            size='sm'
            onClick={onView}
            className='gap-1.5'
          >
            <Eye className='h-3.5 w-3.5' />
            View
          </Button>
          <Button
            variant='ghost'
            size='sm'
            onClick={handleRestore}
            disabled={isPending}
            className='gap-1.5'
          >
            {isPending ? (
              <Loader2 className='h-3.5 w-3.5 animate-spin' />
            ) : (
              <RotateCcw className='h-3.5 w-3.5' />
            )}
            Restore
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
