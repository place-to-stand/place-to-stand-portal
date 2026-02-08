'use client'

import { useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format, formatDistanceToNow } from 'date-fns'
import {
  CheckCircle,
  Download,
  ExternalLink,
  Eye,
  Link2,
  Mail,
  PenLine,
  Send,
  Loader2,
  Hash,
  User,
  DollarSign,
  CalendarDays,
  Trash2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useToast } from '@/components/ui/use-toast'
import type { ProposalWithRelations } from '@/lib/queries/proposals'

import { ShareProposalDialog } from '../../leads/_components/share-proposal-dialog'
import { SendEmailDialog } from '../../leads/_components/send-email-dialog'
import { prepareProposalSend } from '../../leads/_actions/prepare-proposal-send'
import { deleteProposalAction } from '../../leads/_actions/delete-proposal'

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ proposal }: { proposal: ProposalWithRelations }) {
  if (proposal.status === 'ACCEPTED' && proposal.countersignedAt) {
    return (
      <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
        <CheckCircle className="mr-1 h-3 w-3" />
        Fully Executed
      </Badge>
    )
  }

  if (proposal.status === 'ACCEPTED' && !proposal.countersignedAt) {
    return (
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
          <CheckCircle className="mr-1 h-3 w-3" />
          Accepted
        </Badge>
        <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/20">
          <PenLine className="mr-1 h-3 w-3" />
          Awaiting Countersign
        </Badge>
      </div>
    )
  }

  const config: Record<string, { label: string; className: string }> = {
    DRAFT: { label: 'Draft', className: 'bg-gray-500/10 text-gray-600 border-gray-500/20' },
    SENT: { label: 'Sent', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
    VIEWED: { label: 'Viewed', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    REJECTED: { label: 'Rejected', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
  }

  const c = config[proposal.status] ?? config.DRAFT
  return (
    <Badge variant="outline" className={`text-xs ${c.className}`}>
      {c.label}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Signature card
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

  // Keep a cached version of the last non-null proposal so content stays visible during close animation
  const [cachedProposal, setCachedProposal] = useState<ProposalWithRelations | null>(null)
  if (proposal && proposal !== cachedProposal) {
    setCachedProposal(proposal)
  }

  const displayProposal = proposal ?? cachedProposal

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
    if (!confirm('Delete this proposal? This cannot be undone.')) return

    startDelete(async () => {
      const result = await deleteProposalAction({ proposalId: displayProposal.id })
      if (!result.success) {
        toast({ variant: 'destructive', title: 'Unable to delete', description: result.error })
        return
      }
      toast({ title: 'Proposal deleted' })
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
  const canEdit = p.status === 'DRAFT' && !!onEdit

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
        <SheetContent side="right" className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          <SheetHeader className="bg-transparent p-0 px-6 pt-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-lg leading-tight">{p.title}</SheetTitle>
                <div className="mt-2">
                  <StatusBadge proposal={p} />
                </div>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-6 px-6 py-5">
            {/* Summary */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Summary</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {p.estimatedValue && (
                  <>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <DollarSign className="h-3.5 w-3.5" /> Value
                    </span>
                    <span className="font-medium tabular-nums">
                      ${parseFloat(p.estimatedValue).toLocaleString()}
                    </span>
                  </>
                )}
                {p.sentAt && (
                  <>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Send className="h-3.5 w-3.5" /> Sent
                    </span>
                    <span>{format(new Date(p.sentAt), 'MMM d, yyyy')}</span>
                  </>
                )}
                {p.expirationDate && (
                  <>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" /> Expires
                    </span>
                    <span>{format(new Date(p.expirationDate), 'MMM d, yyyy')}</span>
                  </>
                )}
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Eye className="h-3.5 w-3.5" /> Views
                </span>
                <span>
                  {p.viewedCount ?? 0}
                  {p.viewedAt && (
                    <span className="ml-1 text-muted-foreground">
                      (last {formatDistanceToNow(new Date(p.viewedAt), { addSuffix: true })})
                    </span>
                  )}
                </span>
                {(p.leadName || p.clientName) && (
                  <>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <User className="h-3.5 w-3.5" /> Contact
                    </span>
                    <span>{p.leadName ?? p.clientName}</span>
                  </>
                )}
              </div>
            </section>

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
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    <Hash className="h-3.5 w-3.5" /> Content Hash
                  </h3>
                  <p className="break-all font-mono text-xs text-muted-foreground">
                    {p.contentHashAtSigning}
                  </p>
                </section>
              </>
            )}

            {/* Actions */}
            <Separator />
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Actions</h3>
              <div className="flex flex-col gap-2">
                {canEdit && (
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => {
                      onOpenChange(false)
                      onEdit!(p)
                    }}
                  >
                    <PenLine className="mr-2 h-4 w-4" />
                    Edit Proposal
                  </Button>
                )}

                {canSendEmail && (
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={handleSendEmail}
                    disabled={isPreparing}
                  >
                    {isPreparing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="mr-2 h-4 w-4" />
                    )}
                    Send via Email
                  </Button>
                )}

                {isAcceptedNotCountersigned && p.countersignToken && (
                  <Button
                    className="justify-start"
                    onClick={() => {
                      window.open(`/p/${p.countersignToken}/countersign`, '_blank')
                    }}
                  >
                    <PenLine className="mr-2 h-4 w-4" />
                    Countersign Now
                  </Button>
                )}

                {isFullyExecuted && (
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={handleDownloadCertificate}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Certificate
                  </Button>
                )}

                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => setShareDialogOpen(true)}
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  Share Link
                </Button>

                {p.shareToken && p.shareEnabled && (
                  <Button
                    variant="outline"
                    className="justify-start"
                    asChild
                  >
                    <a href={`/p/${p.shareToken}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open in New Tab
                    </a>
                  </Button>
                )}

                {p.docUrl && (
                  <Button
                    variant="ghost"
                    className="justify-start"
                    asChild
                  >
                    <a href={p.docUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open Document
                    </a>
                  </Button>
                )}

                <Separator />

                <Button
                  variant="ghost"
                  className="justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Delete Proposal
                </Button>
              </div>
            </section>
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
          lead={leadShim}
          senderName={senderName}
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          initialSubject={emailSubject}
          initialBodyHtml={emailBody}
        />
      )}
    </>
  )
}
