'use client'

import { useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format, formatDistanceToNow } from 'date-fns'
import {
  Download,
  ExternalLink,
  Eye,
  FileText,
  Link2,
  Loader2,
  Mail,
  MessageSquare,
  MoreHorizontal,
  PenLine,
  Send,
  Trash2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useToast } from '@/components/ui/use-toast'
import { ProposalDocument } from '@/components/proposal-viewer/proposal-document'
import type { ProposalContent } from '@/lib/proposals/types'
import type { ProposalWithRelations } from '@/lib/queries/proposals'

import { ShareProposalDialog } from '../../leads/_components/share-proposal-dialog'
import { SendEmailDialog } from '../../leads/_components/send-email-dialog'
import { prepareProposalSend } from '../../leads/_actions/prepare-proposal-send'
import { deleteProposalAction } from '../../leads/_actions/delete-proposal'
import { ProposalStatusBadge } from './proposal-status-badge'

// ---------------------------------------------------------------------------
// Signature card (kept for metadata section below document)
// ---------------------------------------------------------------------------

function SignatureCard({
  label,
  name,
  email,
  signatureData,
  timestamp,
  ipAddress,
  pending,
}: {
  label: string
  name: string | null
  email: string | null
  signatureData: string | null
  timestamp: string | null
  ipAddress: string | null
  pending?: boolean
}) {
  if (pending) {
    return (
      <div className="rounded-lg border border-dashed p-4">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm text-muted-foreground">Awaiting signature...</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border p-4 space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">Name</span>
        <span>{name ?? '—'}</span>
        <span className="text-muted-foreground">Email</span>
        <span className="truncate">{email ?? '—'}</span>
        <span className="text-muted-foreground">Signed</span>
        <span>{timestamp ? format(new Date(timestamp), 'MMM d, yyyy h:mm a') : '—'}</span>
        <span className="text-muted-foreground">IP</span>
        <span className="font-mono text-xs">{ipAddress ?? '—'}</span>
      </div>
      {signatureData?.startsWith('data:image/') && (
        <div className="mt-2 rounded border bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={signatureData} alt="Signature" className="h-12 object-contain" />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasProposalContent(
  content: ProposalContent | Record<string, never> | null
): content is ProposalContent {
  return !!content && 'client' in content && 'phases' in content
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type ProposalDetailSheetProps = {
  proposal: ProposalWithRelations | null
  senderName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (proposal: ProposalWithRelations) => void
}

export function ProposalDetailSheet({
  proposal,
  senderName,
  open,
  onOpenChange,
  onEdit,
}: ProposalDetailSheetProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [isPreparing, startPrepare] = useTransition()
  const [isDeleting, startDelete] = useTransition()
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)

  const displayProposal = proposal

  const handleSendEmail = useCallback(() => {
    if (!displayProposal) return

    startPrepare(async () => {
      const result = await prepareProposalSend({ proposalId: displayProposal.id })
      if (!result.success) {
        toast({ variant: 'destructive', title: 'Error', description: result.error })
        return
      }

      setEmailSubject(`Proposal: ${displayProposal.title}`)
      setEmailBody(
        `<p>Hi ${displayProposal.leadName ?? 'there'},</p>` +
        `<p>Please find your proposal linked below:</p>` +
        `<p><a href="${result.shareUrl}">${result.shareUrl}</a></p>` +
        `<p>Best regards,<br/>${senderName}</p>`
      )
      setEmailDialogOpen(true)
    })
  }, [displayProposal, senderName, toast])

  const handleDownloadCertificate = useCallback(async () => {
    if (!displayProposal) return
    try {
      const res = await fetch(`/api/proposals/${displayProposal.id}/certificate`)
      if (!res.ok) {
        const data = await res.json()
        toast({ variant: 'destructive', title: 'Download failed', description: data.error })
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `certificate-${displayProposal.title.replace(/\s+/g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast({ variant: 'destructive', title: 'Download failed' })
    }
  }, [displayProposal, toast])

  const handleDelete = useCallback(() => {
    if (!displayProposal) return

    startDelete(async () => {
      const result = await deleteProposalAction({ proposalId: displayProposal.id })
      if (!result.success) {
        toast({ variant: 'destructive', title: 'Unable to archive', description: result.error })
        return
      }
      toast({ title: 'Proposal archived' })
      setArchiveDialogOpen(false)
      onOpenChange(false)
      router.refresh()
    })
  }, [displayProposal, toast, onOpenChange, router])

  if (!displayProposal) return null

  const p = displayProposal
  const isFullyExecuted = p.status === 'ACCEPTED' && !!p.countersignedAt
  const isAcceptedNotCountersigned = p.status === 'ACCEPTED' && !p.countersignedAt
  const hasLead = !!p.leadId
  const canSendEmail = hasLead && ['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED'].includes(p.status)
  const canEdit = ['DRAFT', 'SENT'].includes(p.status) && !!onEdit
  const contentExists = hasProposalContent(p.content)

  const leadShim = hasLead
    ? {
        id: p.leadId!,
        contactName: p.leadName ?? 'Recipient',
        contactEmail: p.sentToEmail ?? p.signerEmail ?? '',
        companyName: p.clientName ?? null,
      }
    : null

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col overflow-hidden sm:max-w-3xl"
        >
          {/* Compact header with metadata + actions */}
          <SheetHeader className="flex-shrink-0 border-b-2 border-b-indigo-500/60 px-6 pt-4">
            <div className="flex items-start justify-between gap-3 pr-8">
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-lg leading-tight">{p.title}</SheetTitle>
                {/* Metadata row */}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                  <ProposalStatusBadge status={p.status} countersignedAt={p.countersignedAt} />
                  {p.estimatedValue && (
                    <span className="text-muted-foreground tabular-nums">
                      ${parseFloat(p.estimatedValue).toLocaleString()}
                    </span>
                  )}
                  {p.sentAt && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Send className="h-3 w-3" />
                      {format(new Date(p.sentAt), 'MMM d, yyyy')}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Eye className="h-3 w-3" />
                    {p.viewedCount ?? 0} view{(p.viewedCount ?? 0) !== 1 ? 's' : ''}
                    {p.viewedAt && (
                      <span className="ml-0.5">
                        ({formatDistanceToNow(new Date(p.viewedAt), { addSuffix: true })})
                      </span>
                    )}
                  </span>
                  {(p.leadName || p.clientName) && (
                    <span className="text-muted-foreground">
                      {p.leadName ?? p.clientName}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {canEdit && (
                    <DropdownMenuItem
                      onClick={() => {
                        onOpenChange(false)
                        onEdit!(p)
                      }}
                    >
                      <PenLine className="mr-2 h-4 w-4" />
                      Edit Proposal
                    </DropdownMenuItem>
                  )}
                  {canSendEmail && (
                    <DropdownMenuItem onClick={handleSendEmail} disabled={isPreparing}>
                      {isPreparing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="mr-2 h-4 w-4" />
                      )}
                      Send via Email
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => setShareDialogOpen(true)}>
                    <Link2 className="mr-2 h-4 w-4" />
                    Share Link
                  </DropdownMenuItem>
                  {isAcceptedNotCountersigned && p.countersignToken && (
                    <DropdownMenuItem
                      onClick={() => {
                        window.open(`/share/proposals/${p.countersignToken}/countersign`, '_blank')
                      }}
                    >
                      <PenLine className="mr-2 h-4 w-4" />
                      Countersign Now
                    </DropdownMenuItem>
                  )}
                  {isFullyExecuted && (
                    <DropdownMenuItem onClick={handleDownloadCertificate}>
                      <Download className="mr-2 h-4 w-4" />
                      Download Certificate
                    </DropdownMenuItem>
                  )}
                  {p.shareToken && p.shareEnabled && (
                    <DropdownMenuItem asChild>
                      <a href={`/share/proposals/${p.shareToken}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open in New Tab
                      </a>
                    </DropdownMenuItem>
                  )}
                  {p.docUrl && (
                    <DropdownMenuItem asChild>
                      <a href={p.docUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open Document
                      </a>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setArchiveDialogOpen(true)}
                    disabled={isDeleting}
                    className="text-destructive focus:text-destructive"
                  >
                    {isDeleting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Archive
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SheetHeader>

          {/* Scrollable body: rendered proposal + signatures */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {contentExists ? (
              <div className="space-y-8">
                {/* Rendered proposal document */}
                <ProposalDocument
                  title={p.title}
                  content={p.content as ProposalContent}
                  estimatedValue={p.estimatedValue}
                  expirationDate={p.expirationDate}
                />

                {/* Client feedback */}
                {p.clientComment && (
                  <>
                    <Separator />
                    <section className="space-y-2">
                      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        <MessageSquare className="h-3.5 w-3.5" /> Client Feedback
                      </h3>
                      <p className="text-sm whitespace-pre-wrap">{p.clientComment}</p>
                    </section>
                  </>
                )}

                {/* Signatures */}
                {(p.signerName || isAcceptedNotCountersigned || isFullyExecuted) && (
                  <>
                    <Separator />
                    <section className="space-y-3">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Signatures</h3>
                      <div className="space-y-3">
                        <SignatureCard
                          label="Client"
                          name={p.signerName}
                          email={p.signerEmail}
                          signatureData={p.signatureData}
                          timestamp={p.acceptedAt}
                          ipAddress={p.signerIpAddress}
                        />
                        <SignatureCard
                          label="Countersigner"
                          name={p.countersignerName}
                          email={p.countersignerEmail}
                          signatureData={p.countersignatureData}
                          timestamp={p.countersignedAt}
                          ipAddress={p.countersignerIpAddress}
                          pending={isAcceptedNotCountersigned}
                        />
                      </div>
                    </section>
                  </>
                )}

                {/* Content hash */}
                {p.contentHashAtSigning && (
                  <>
                    <Separator />
                    <section className="space-y-1">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Content Hash
                      </h3>
                      <p className="break-all font-mono text-xs text-muted-foreground">
                        {p.contentHashAtSigning}
                      </p>
                    </section>
                  </>
                )}
              </div>
            ) : (
              /* Legacy proposal — no structured content */
              <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/40" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Google Docs Proposal</p>
                  <p className="text-sm text-muted-foreground">
                    This proposal was created as a Google Doc and cannot be previewed here.
                  </p>
                </div>
                {p.docUrl && (
                  <Button variant="outline" asChild>
                    <a href={p.docUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open in Google Docs
                    </a>
                  </Button>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ShareProposalDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        proposalId={p.id}
        proposalTitle={p.title}
        shareToken={p.shareToken}
        shareEnabled={p.shareEnabled}
        viewedCount={p.viewedCount}
      />

      {emailDialogOpen && leadShim && (
        <SendEmailDialog
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- shim provides only the fields SendEmailDialog uses
          lead={leadShim as any}
          senderName={senderName}
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          initialSubject={emailSubject}
          initialBodyHtml={emailBody}
        />
      )}

      <ConfirmDialog
        open={archiveDialogOpen}
        title="Archive this proposal?"
        description="Archiving removes the proposal from the active list. You can restore it from the archive."
        confirmLabel={isDeleting ? 'Archiving...' : 'Archive'}
        confirmVariant="destructive"
        confirmDisabled={isDeleting}
        onCancel={() => setArchiveDialogOpen(false)}
        onConfirm={handleDelete}
      />
    </>
  )
}
