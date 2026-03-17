'use client'

import { useCallback, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { format, formatDistanceToNow } from 'date-fns'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { ProposalWithRelations } from '@/lib/queries/proposals'

import { ProposalDetailSheet } from './proposal-detail-sheet'
import { ProposalStatusBadge } from './proposal-status-badge'

function getViewsDisplay(proposal: ProposalWithRelations) {
  const count = proposal.viewedCount ?? 0
  if (count === 0) return <span className="text-muted-foreground">—</span>

  const lastViewed = proposal.viewedAt
    ? formatDistanceToNow(new Date(proposal.viewedAt), { addSuffix: true })
    : null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-default">
            {count}
          </span>
        </TooltipTrigger>
        {lastViewed && (
          <TooltipContent>
            <p>Last viewed {lastViewed}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  )
}

type ProposalsTableProps = {
  proposals: ProposalWithRelations[]
  senderName: string
  onEditProposal?: (proposal: ProposalWithRelations) => void
}

export function ProposalsTable({ proposals, senderName, onEditProposal }: ProposalsTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [selectedProposal, setSelectedProposal] = useState<ProposalWithRelations | null>(() => {
    const idParam = searchParams.get('id')
    if (idParam) {
      return proposals.find(p => p.id === idParam) ?? null
    }
    return null
  })

  const statusFilter = searchParams.get('status') ?? 'ALL'

  const buildQueryString = useCallback(
    (overrides: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(overrides)) {
        if (value === null) {
          params.delete(key)
        } else {
          params.set(key, value)
        }
      }
      const qs = params.toString()
      return qs ? `${pathname}?${qs}` : pathname
    },
    [pathname, searchParams]
  )

  const handleStatusFilterChange = useCallback(
    (value: string) => {
      router.push(
        buildQueryString({ status: value === 'ALL' ? null : value }),
        { scroll: false }
      )
    },
    [buildQueryString, router]
  )

  const handleSelectProposal = useCallback(
    (proposal: ProposalWithRelations) => {
      setSelectedProposal(proposal)
      router.push(buildQueryString({ id: proposal.id }), { scroll: false })
    },
    [buildQueryString, router]
  )

  const handleCloseSheet = useCallback(
    (open: boolean) => {
      if (!open) {
        setSelectedProposal(null)
        router.push(buildQueryString({ id: null }), { scroll: false })
      }
    },
    [buildQueryString, router]
  )

  const filtered =
    statusFilter === 'ALL'
      ? proposals
      : proposals.filter(p => p.status === statusFilter)

  return (
    <>
      <div className='flex items-center justify-between pb-4'>
        <span className='text-muted-foreground text-sm'>
          {filtered.length} proposal{filtered.length !== 1 ? 's' : ''}
        </span>
        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
          <SelectTrigger className='w-[160px]'>
            <SelectValue placeholder='Filter by status' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='ALL'>All Statuses</SelectItem>
            <SelectItem value='DRAFT'>Draft</SelectItem>
            <SelectItem value='SENT'>Sent</SelectItem>
            <SelectItem value='VIEWED'>Viewed</SelectItem>
            <SelectItem value='ACCEPTED'>Accepted</SelectItem>
            <SelectItem value='REJECTED'>Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className='rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <TableHead>Title</TableHead>
              <TableHead>Lead / Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className='text-right'>Value</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead className='text-right'>Views</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className='h-24 text-center text-muted-foreground'>
                  No proposals found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(proposal => (
                <TableRow
                  key={proposal.id}
                  className='cursor-pointer'
                  onClick={() => handleSelectProposal(proposal)}
                >
                  <TableCell className='max-w-[200px] truncate font-medium'>
                    {proposal.title}
                  </TableCell>
                  <TableCell className='text-sm text-muted-foreground'>
                    {proposal.leadName ?? proposal.clientName ?? '—'}
                  </TableCell>
                  <TableCell>
                    <ProposalStatusBadge status={proposal.status} countersignedAt={proposal.countersignedAt} />
                  </TableCell>
                  <TableCell className='text-right tabular-nums'>
                    {proposal.estimatedValue
                      ? `$${parseFloat(proposal.estimatedValue).toLocaleString()}`
                      : '—'}
                  </TableCell>
                  <TableCell className='text-sm text-muted-foreground'>
                    {proposal.sentAt
                      ? format(new Date(proposal.sentAt), 'MMM d, yyyy')
                      : '—'}
                  </TableCell>
                  <TableCell className='text-right tabular-nums'>
                    {getViewsDisplay(proposal)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ProposalDetailSheet
        proposal={selectedProposal}
        senderName={senderName}
        open={!!selectedProposal}
        onOpenChange={handleCloseSheet}
        onEdit={onEditProposal}
      />
    </>
  )
}
