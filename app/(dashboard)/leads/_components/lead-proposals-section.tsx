'use client'

import { useState, useEffect, useCallback, useTransition, useMemo } from 'react'
import { format } from 'date-fns'
import {
  CheckCircle,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Link2,
  Mail,
  MoreHorizontal,
  PenLine,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
import type { ProposalContent } from '@/lib/proposals/types'
import type { ProposalWithRelations } from '@/lib/queries/proposals'

import { updateProposalStatus, prepareProposalSend, deleteProposalAction } from '../_actions'
import type { EditableProposal } from './proposal-builder/proposal-builder-sheet'
import { ProposalDetailSheet } from '../../proposals/_components/proposal-detail-sheet'
import { ProposalStatusBadge } from '../../proposals/_components/proposal-status-badge'
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
  content: ProposalContent | Record<string, never> | null
  estimatedValue: string | null
}

type LeadProposalsSectionProps = {
  lead: LeadRecord
  canManage: boolean
  senderName?: string
  onEditProposal?: (proposal: EditableProposal) => void
  onSuccess?: () => void
}

export function LeadProposalsSection({
  lead,
  canManage,
  senderName = '',
  onEditProposal,
  onSuccess,
}: LeadProposalsSectionProps) {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedProposal, setSelectedProposal] = useState<ProposalWithRelations | null>(null)

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

  const mapToViewProposal = useCallback(
    (p: Proposal): ProposalWithRelations => ({
      ...p,
      content: p.content ?? ({} as Record<string, never>),
      leadId: lead.id,
      clientId: null,
      templateDocId: null,
      expirationDate: null,
      createdBy: '',
      updatedAt: p.createdAt,
      sharePasswordHash: null,
      viewedAt: null,
      acceptedAt: null,
      rejectedAt: null,
      clientComment: null,
      signerName: null,
      signerEmail: null,
      signatureData: null,
      signerIpAddress: null,
      signatureConsent: null,
      contentHashAtSigning: null,
      countersignToken: null,
      countersignerName: null,
      countersignerEmail: null,
      countersignatureData: null,
      countersignerIpAddress: null,
      countersignatureConsent: null,
      executedPdfPath: null,
      leadName: lead.contactName,
      clientName: lead.companyName,
      creatorName: null,
    }),
    [lead]
  )

  const handleViewProposal = useCallback(
    (proposal: Proposal) => {
      setSelectedProposal(mapToViewProposal(proposal))
    },
    [mapToViewProposal]
  )

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
              onEditProposal={onEditProposal}
              onUpdate={handleProposalUpdate}
              onView={handleViewProposal}
            />
          ))}
        </div>
      )}

      <ProposalDetailSheet
        proposal={selectedProposal}
        senderName={senderName}
        open={!!selectedProposal}
        onOpenChange={open => {
          if (!open) setSelectedProposal(null)
        }}
      />
    </div>
  )
}

function ProposalCard({
  proposal,
  lead,
  canManage,
  senderName = '',
  onEditProposal,
  onUpdate,
  onView,
}: {
  proposal: Proposal
  lead: LeadRecord
  canManage: boolean
  senderName?: string
  onEditProposal?: (proposal: EditableProposal) => void
  onUpdate?: () => void
  onView?: (proposal: Proposal) => void
}) {
  const { toast } = useToast()
  const [isUpdating, startUpdateTransition] = useTransition()
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [emailInitialSubject, setEmailInitialSubject] = useState('')
  const [emailInitialBody, setEmailInitialBody] = useState('')
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)

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
    startUpdateTransition(async () => {
      const result = await deleteProposalAction({ proposalId: proposal.id })
      if (!result.success) {
        toast({
          variant: 'destructive',
          title: 'Unable to archive proposal',
          description: result.error ?? 'Please try again.',
        })
        return
      }
      toast({ title: 'Proposal archived' })
      setArchiveDialogOpen(false)
      onUpdate?.()
    })
  }, [proposal.id, toast, onUpdate])

  const handleEdit = useCallback(() => {
    if (!onEditProposal || !proposal.content) return
    onEditProposal({
      id: proposal.id,
      title: proposal.title,
      content: proposal.content,
      estimatedValue: proposal.estimatedValue,
    })
  }, [onEditProposal, proposal])

  return (
    <>
    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
      {/* Row 1: Title + dropdown */}
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium">{proposal.title}</p>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                disabled={isUpdating}
              >
                <span className="sr-only">Actions</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEditProposal && proposal.content && (proposal.status === 'DRAFT' || proposal.status === 'SENT') && (
                <DropdownMenuItem onClick={handleEdit}>
                  <PenLine className="mr-2 h-4 w-4" />
                  Edit Proposal
                </DropdownMenuItem>
              )}
              {lead.contactEmail && senderName && (
                <DropdownMenuItem onClick={handleSendViaEmail}>
                  <Mail className="mr-2 h-4 w-4" />
                  Send via Email
                </DropdownMenuItem>
              )}
              {canManage && (
                <DropdownMenuItem onClick={() => setShareDialogOpen(true)}>
                  <Link2 className="mr-2 h-4 w-4" />
                  Share Link
                </DropdownMenuItem>
              )}
              {proposal.docUrl && (
                <DropdownMenuItem asChild>
                  <a href={proposal.docUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Document
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
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
                onClick={() => setArchiveDialogOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Row 2: Status badges + estimated value */}
      <div className="flex flex-wrap items-center gap-1.5">
        <ProposalStatusBadge status={proposal.status} countersignedAt={proposal.countersignedAt} />
        {proposal.estimatedValue && (
          <span className="text-xs font-medium text-muted-foreground">
            ${Number(proposal.estimatedValue).toLocaleString()}
          </span>
        )}
      </div>

      {/* Row 3: Metadata + link */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3 w-3 shrink-0" />
        <span>{format(new Date(proposal.createdAt), 'MMM d, yyyy')}</span>
        {proposal.sentAt && (
          <>
            <span>·</span>
            <span>Sent {format(new Date(proposal.sentAt), 'MMM d')}</span>
          </>
        )}
        <span>·</span>
        <button
          type="button"
          onClick={() => onView?.(proposal)}
          className="inline-flex items-center gap-0.5 text-violet-600 hover:underline"
        >
          View
          <Eye className="h-3 w-3" />
        </button>
      </div>
    </div>
    <ConfirmDialog
      open={archiveDialogOpen}
      title="Archive this proposal?"
      description="Archiving removes the proposal from the active list. You can restore it from the archive."
      confirmLabel={isUpdating ? 'Archiving...' : 'Archive'}
      confirmVariant="destructive"
      confirmDisabled={isUpdating}
      onCancel={() => setArchiveDialogOpen(false)}
      onConfirm={handleDelete}
    />
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
