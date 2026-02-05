'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { format, formatDistanceToNow } from 'date-fns'
import { CheckCircle, PenLine } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { PROPOSAL_STATUS_CONFIG } from '@/lib/proposals/constants'

import { ProposalDetailSheet } from './proposal-detail-sheet'
import { useState } from 'react'

function getStatusDisplay(proposal: ProposalWithRelations) {
  const config = PROPOSAL_STATUS_CONFIG[proposal.status]
  const StatusIcon = config.icon

  if (proposal.status === 'ACCEPTED' && proposal.countersignedAt) {
    return (
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
          <CheckCircle className="mr-1 h-3 w-3" />
          Fully Executed
        </Badge>
      </div>
    )
  }

  if (proposal.status === 'ACCEPTED' && !proposal.countersignedAt) {
    return (
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className={`text-xs ${config.className}`}>
          <StatusIcon className="mr-1 h-3 w-3" />
          {config.label}
        </Badge>
        <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/20">
          <PenLine className="mr-1 h-3 w-3" />
          Awaiting Countersign
        </Badge>
      </div>
    )
  }

  return (
    <Badge variant="outline" className={`text-xs ${config.className}`}>
      <StatusIcon className="mr-1 h-3 w-3" />
      {config.label}
    </Badge>
  )
}

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
  const [selectedProposal, setSelectedProposal] = useState<ProposalWithRelations | null>(null)

  const statusFilter = searchParams.get('status') ?? 'ALL'

  const handleStatusFilterChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === 'ALL') {
        params.delete('status')
      } else {
        params.set('status', value)
      }
      const queryString = params.toString()
      router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const filtered =
    statusFilter === 'ALL'
      ? proposals
      : proposals.filter(p => p.status === statusFilter)

  return (
    <>
      <Card>
        <CardHeader className='pb-3'>
          <div className='flex items-center justify-between'>
            <CardTitle className='text-base'>
              All Proposals
              <span className='ml-2 text-sm font-normal text-muted-foreground'>
                {filtered.length} proposal{filtered.length !== 1 ? 's' : ''}
              </span>
            </CardTitle>
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
        </CardHeader>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
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
                    onClick={() => setSelectedProposal(proposal)}
                  >
                    <TableCell className='max-w-[200px] truncate font-medium'>
                      {proposal.title}
                    </TableCell>
                    <TableCell className='text-sm text-muted-foreground'>
                      {proposal.leadName ?? proposal.clientName ?? '—'}
                    </TableCell>
                    <TableCell>
                      {getStatusDisplay(proposal)}
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
        </CardContent>
      </Card>

      <ProposalDetailSheet
        proposal={selectedProposal}
        senderName={senderName}
        open={!!selectedProposal}
        onOpenChange={open => {
          if (!open) setSelectedProposal(null)
        }}
        onEdit={onEditProposal}
      />
    </>
  )
}
