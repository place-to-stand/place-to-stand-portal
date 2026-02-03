'use client'

import { useState, useEffect, useCallback, useTransition, useMemo } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import {
  FileText,
  ExternalLink,
  Send,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Link2,
  Mail,
  PenLine,
  ArrowUpRight,
  Trash2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/use-toast'
import type { LeadRecord } from '@/lib/leads/types'
import {
  PROPOSAL_STATUS_CONFIG,
  type ProposalStatusValue,
} from '@/lib/proposals/constants'

import { updateProposalStatus, prepareProposalSend, deleteProposalAction } from '../_actions'
import { ShareProposalDialog } from './share-proposal-dialog'
import { SendEmailDialog } from './send-email-dialog'

type Proposal = {
  id: string
  title: string
  docUrl: string | null
  docId: string | null
  status: ProposalStatusValue
  sentAt: string | null
  sentToEmail: string | null
  createdAt: string
  shareToken: string | null
  shareEnabled: boolean | null
  viewedCount: number | null
  countersignedAt: string | null
}

type LeadProposalsSectionProps = {
  lead: LeadRecord
  canManage: boolean
  senderName?: string
  onSuccess?: () => void
}

export function LeadProposalsSection({
  lead,
  canManage,
  senderName = '',
  onSuccess,
}: LeadProposalsSectionProps) {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProposals = useCallback(async () => {
    setError(null)
    try {
      const response = await fetch(`/api/leads/${lead.id}/proposals`)
      if (!response.ok) {
        throw new Error('Failed to load proposals')
      }
      const data = await response.json()
      setProposals(data.proposals ?? [])
    } catch (err) {
      console.error('Failed to fetch lead proposals:', err)
      setError('Failed to load proposals. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [lead.id])

  useEffect(() => {
    fetchProposals()
  }, [fetchProposals])

  const handleProposalUpdate = useCallback(() => {
    fetchProposals()
    onSuccess?.()
  }, [fetchProposals, onSuccess])

  // Sort proposals: most recent first (memoized to avoid re-sorting on every render)
  const sortedProposals = useMemo(
    () =>
      [...proposals].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [proposals]
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Proposals</span>
        {proposals.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {proposals.length}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-between rounded-md border border-destructive/20 bg-destructive/5 p-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="ghost" size="sm" onClick={fetchProposals}>
            Retry
          </Button>
        </div>
      ) : proposals.length === 0 ? (
        <p className="text-sm text-muted-foreground">No proposals created yet.</p>
      ) : (
        <div className="space-y-2">
          {sortedProposals.map(proposal => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              lead={lead}
              canManage={canManage}
              senderName={senderName}
              onUpdate={handleProposalUpdate}
            />
          ))}
        </div>
      )}

    </div>
  )
}

function ProposalCard({
  proposal,
  lead,
  canManage,
  senderName = '',
  onUpdate,
}: {
  proposal: Proposal
  lead: LeadRecord
  canManage: boolean
  senderName?: string
  onUpdate?: () => void
}) {
  const { toast } = useToast()
  const [isUpdating, startUpdateTransition] = useTransition()
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [emailInitialSubject, setEmailInitialSubject] = useState('')
  const [emailInitialBody, setEmailInitialBody] = useState('')

  const handleSendViaEmail = useCallback(async () => {
    startUpdateTransition(async () => {
      const result = await prepareProposalSend({ proposalId: proposal.id })
      if (!result.success) {
        toast({
          variant: 'destructive',
          title: 'Unable to prepare proposal',
          description: result.error ?? 'Please try again.',
        })
        return
      }

      setEmailInitialSubject(`Proposal: ${proposal.title}`)
      setEmailInitialBody(
        `<p>Hi ${lead.contactName?.split(' ')[0] ?? 'there'},</p>` +
        `<p>Please find our proposal linked below for your review:</p>` +
        `<p><a href="${result.shareUrl}">${result.shareUrl}</a></p>` +
        `<p>Feel free to reach out with any questions.</p>` +
        `<p>Best regards</p>`
      )
      setEmailDialogOpen(true)
      onUpdate?.()
    })
  }, [proposal.id, proposal.title, lead.contactName, toast, onUpdate])

  const statusConfig = PROPOSAL_STATUS_CONFIG[proposal.status]
  const StatusIcon = statusConfig.icon

  const handleStatusChange = useCallback(
    (newStatus: ProposalStatusValue) => {
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
            : `marked as ${PROPOSAL_STATUS_CONFIG[newStatus].label.toLowerCase()}`

        toast({
          title: 'Proposal updated',
          description: `Proposal ${actionLabel}.`,
        })

        onUpdate?.()
      })
    },
    [lead.id, lead.contactEmail, proposal.id, toast, onUpdate]
  )

  const handleDelete = useCallback(() => {
    if (!confirm('Delete this proposal? This cannot be undone.')) return

    startUpdateTransition(async () => {
      const result = await deleteProposalAction({ proposalId: proposal.id })
      if (!result.success) {
        toast({
          variant: 'destructive',
          title: 'Unable to delete proposal',
          description: result.error ?? 'Please try again.',
        })
        return
      }
      toast({ title: 'Proposal deleted' })
      onUpdate?.()
    })
  }, [proposal.id, toast, onUpdate])

  return (
    <>
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{proposal.title}</p>
            {proposal.status === 'ACCEPTED' && proposal.countersignedAt ? (
              <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
                <CheckCircle className="mr-1 h-3 w-3" />
                Fully Executed
              </Badge>
            ) : (
              <Badge variant="outline" className={`text-xs ${statusConfig.className}`}>
                <StatusIcon className="mr-1 h-3 w-3" />
                {statusConfig.label}
              </Badge>
            )}
            {proposal.status === 'ACCEPTED' && !proposal.countersignedAt && (
              <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/20">
                <PenLine className="mr-1 h-3 w-3" />
                Countersign
              </Badge>
            )}
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
            <span>·</span>
            <Link
              href="/proposals"
              className="inline-flex items-center gap-0.5 text-violet-600 hover:underline"
            >
              View in Proposals
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canManage && (
            <button
              type="button"
              onClick={() => setShareDialogOpen(true)}
              className="flex items-center gap-1 rounded-md bg-violet-500/10 px-2 py-1 text-xs font-medium text-violet-600 hover:bg-violet-500/20"
            >
              <Link2 className="h-3 w-3" />
              Share
            </button>
          )}
          {proposal.docUrl && (
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
          )}
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
                {lead.contactEmail && senderName && (
                  <DropdownMenuItem onClick={handleSendViaEmail}>
                    <Mail className="mr-2 h-4 w-4" />
                    Send via Email
                  </DropdownMenuItem>
                )}
                {proposal.status === 'DRAFT' && lead.contactEmail && (
                  <DropdownMenuItem onClick={() => handleStatusChange('SENT')}>
                    <Send className="mr-2 h-4 w-4" />
                    Mark as Sent
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
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
    {canManage && (
      <ShareProposalDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        proposalId={proposal.id}
        proposalTitle={proposal.title}
        shareToken={proposal.shareToken}
        shareEnabled={proposal.shareEnabled}
        viewedCount={proposal.viewedCount}
        onUpdate={onUpdate}
      />
    )}
    {canManage && lead.contactEmail && senderName && (
      <SendEmailDialog
        lead={lead}
        senderName={senderName}
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        onSuccess={onUpdate}
        initialSubject={emailInitialSubject}
        initialBodyHtml={emailInitialBody}
      />
    )}
    </>
  )
}
