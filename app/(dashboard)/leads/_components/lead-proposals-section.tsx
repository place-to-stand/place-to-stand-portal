'use client'

import { useState, useTransition, useCallback } from 'react'
import { format } from 'date-fns'
import {
  FileText,
  ExternalLink,
  Plus,
  Send,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/use-toast'
import type { GoogleProposalRef, GoogleProposalStatus, LeadRecord } from '@/lib/leads/types'

import { CreateProposalDialog } from './create-proposal-dialog'
import { updateProposalStatus } from '../_actions'

type LeadProposalsSectionProps = {
  lead: LeadRecord
  canManage: boolean
  onSuccess?: () => void
}

const STATUS_CONFIG: Record<
  GoogleProposalStatus,
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

export function LeadProposalsSection({
  lead,
  canManage,
  onSuccess,
}: LeadProposalsSectionProps) {
  const [isDialogOpen, setDialogOpen] = useState(false)

  const proposals = lead.googleProposals ?? []

  // Sort proposals: most recent first
  const sortedProposals = [...proposals].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Proposals</span>
          {proposals.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {proposals.length}
            </Badge>
          )}
        </div>
        {canManage && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="mr-1 h-3 w-3" />
            Create
          </Button>
        )}
      </div>

      {proposals.length === 0 ? (
        <p className="text-sm text-muted-foreground">No proposals created yet.</p>
      ) : (
        <div className="space-y-2">
          {sortedProposals.map(proposal => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              lead={lead}
              canManage={canManage}
              onUpdate={onSuccess}
            />
          ))}
        </div>
      )}

      <CreateProposalDialog
        lead={lead}
        open={isDialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          setDialogOpen(false)
          onSuccess?.()
        }}
      />
    </div>
  )
}

function ProposalCard({
  proposal,
  lead,
  canManage,
  onUpdate,
}: {
  proposal: GoogleProposalRef
  lead: LeadRecord
  canManage: boolean
  onUpdate?: () => void
}) {
  const { toast } = useToast()
  const [isUpdating, startUpdateTransition] = useTransition()

  const statusConfig = STATUS_CONFIG[proposal.status]
  const StatusIcon = statusConfig.icon

  const handleStatusChange = useCallback(
    (newStatus: GoogleProposalStatus) => {
      startUpdateTransition(async () => {
        const result = await updateProposalStatus({
          leadId: lead.id,
          proposalId: proposal.id,
          status: newStatus,
          // For SENT status, use lead's email
          sendToEmail: newStatus === 'SENT' ? lead.contactEmail ?? undefined : undefined,
        })

        if (!result.success) {
          toast({
            variant: 'destructive',
            title: 'Unable to update proposal',
            description: result.error ?? 'Please try again.',
          })
          return
        }

        const actionLabel =
          newStatus === 'SENT'
            ? 'shared with lead'
            : `marked as ${STATUS_CONFIG[newStatus].label.toLowerCase()}`

        toast({
          title: 'Proposal updated',
          description: `Proposal ${actionLabel}.`,
        })

        onUpdate?.()
      })
    },
    [lead.id, lead.contactEmail, proposal.id, toast, onUpdate]
  )

  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{proposal.title}</p>
            <Badge variant="outline" className={`text-xs ${statusConfig.className}`}>
              <StatusIcon className="mr-1 h-3 w-3" />
              {statusConfig.label}
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Created {format(new Date(proposal.createdAt), 'MMM d, yyyy')}</span>
            {proposal.sentAt && (
              <>
                <span>·</span>
                <span>Sent {format(new Date(proposal.sentAt), 'MMM d')}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <a
            href={proposal.docUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-500/20"
          >
            <FileText className="h-3 w-3" />
            Open
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={isUpdating}
                >
                  <span className="sr-only">Actions</span>
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                    />
                  </svg>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {proposal.status === 'DRAFT' && lead.contactEmail && (
                  <DropdownMenuItem onClick={() => handleStatusChange('SENT')}>
                    <Send className="mr-2 h-4 w-4" />
                    Send to Lead
                  </DropdownMenuItem>
                )}
                {proposal.status === 'SENT' && (
                  <DropdownMenuItem onClick={() => handleStatusChange('VIEWED')}>
                    <Eye className="mr-2 h-4 w-4" />
                    Mark as Viewed
                  </DropdownMenuItem>
                )}
                {(proposal.status === 'SENT' || proposal.status === 'VIEWED') && (
                  <>
                    <DropdownMenuItem onClick={() => handleStatusChange('ACCEPTED')}>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Mark as Accepted
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange('REJECTED')}>
                      <XCircle className="mr-2 h-4 w-4" />
                      Mark as Rejected
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  )
}
