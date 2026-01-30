'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import {
  FileText,
  ExternalLink,
  Eye,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Link2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
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
import type { ProposalWithRelations } from '@/lib/queries/proposals'

import { ShareProposalDialog } from '../../leads/_components/share-proposal-dialog'

type ProposalStatus = 'DRAFT' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'REJECTED'

const STATUS_CONFIG: Record<
  ProposalStatus,
  { label: string; icon: typeof FileText; className: string }
> = {
  DRAFT: {
    label: 'Draft',
    icon: FileText,
    className: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  },
  SENT: {
    label: 'Sent',
    icon: Send,
    className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  },
  VIEWED: {
    label: 'Viewed',
    icon: Eye,
    className: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  },
  ACCEPTED: {
    label: 'Accepted',
    icon: CheckCircle,
    className: 'bg-green-500/10 text-green-600 border-green-500/20',
  },
  REJECTED: {
    label: 'Rejected',
    icon: XCircle,
    className: 'bg-red-500/10 text-red-600 border-red-500/20',
  },
}

type ProposalsTableProps = {
  proposals: ProposalWithRelations[]
}

export function ProposalsTable({ proposals }: ProposalsTableProps) {
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [shareDialog, setShareDialog] = useState<{
    open: boolean
    proposal: ProposalWithRelations | null
  }>({ open: false, proposal: null })

  const filtered =
    statusFilter === 'ALL'
      ? proposals
      : proposals.filter(p => p.status === statusFilter)

  return (
    <>
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="SENT">Sent</SelectItem>
            <SelectItem value="VIEWED">Viewed</SelectItem>
            <SelectItem value="ACCEPTED">Accepted</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {filtered.length} proposal{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Lead / Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No proposals found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(proposal => {
                const statusConfig = STATUS_CONFIG[proposal.status]
                const StatusIcon = statusConfig.icon
                return (
                  <TableRow key={proposal.id}>
                    <TableCell className="max-w-[200px] truncate font-medium">
                      {proposal.title}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {proposal.leadName ?? proposal.clientName ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${statusConfig.className}`}>
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {proposal.estimatedValue
                        ? `$${parseFloat(proposal.estimatedValue).toLocaleString()}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {proposal.sentAt
                        ? format(new Date(proposal.sentAt), 'MMM d, yyyy')
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {proposal.viewedCount ?? 0}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShareDialog({ open: true, proposal })}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Share"
                        >
                          <Link2 className="h-4 w-4" />
                        </button>
                        {proposal.docUrl && (
                          <a
                            href={proposal.docUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Open document"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {shareDialog.proposal && (
        <ShareProposalDialog
          open={shareDialog.open}
          onOpenChange={open => setShareDialog(prev => ({ ...prev, open }))}
          proposalId={shareDialog.proposal.id}
          proposalTitle={shareDialog.proposal.title}
          shareToken={shareDialog.proposal.shareToken}
          shareEnabled={shareDialog.proposal.shareEnabled}
          viewedCount={shareDialog.proposal.viewedCount}
        />
      )}
    </>
  )
}
