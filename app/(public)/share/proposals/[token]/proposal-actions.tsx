'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, MessageSquare, PenLine, ArrowRight, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

import { SigningFlow } from './signing-flow'

type ProposalActionsProps = {
  token: string
  status: string
  acceptedAt: string | null
  rejectedAt: string | null
  clientComment: string | null
  signatoryName?: string | null
  contactEmail?: string | null
  signatureDataUrl?: string | null
  proposalTitle?: string
  estimatedValue?: string | null
  expirationDate?: string | null
}

export function ProposalActions({
  token,
  status,
  acceptedAt,
  rejectedAt,
  clientComment,
  signatoryName,
  contactEmail,
  signatureDataUrl,
  proposalTitle,
  estimatedValue,
  expirationDate,
}: ProposalActionsProps) {
  const [responseStatus, setResponseStatus] = useState(status)
  const [responseComment, setResponseComment] = useState(clientComment)
  const [submittedSignatureUrl, setSubmittedSignatureUrl] = useState<string | null>(signatureDataUrl ?? null)
  const [showSigningFlow, setShowSigningFlow] = useState(false)
  const [showRequestChanges, setShowRequestChanges] = useState(false)
  const [rejectComment, setRejectComment] = useState('')
  const [isRejecting, setIsRejecting] = useState(false)
  const [rejectError, setRejectError] = useState<string | null>(null)

  const alreadyResponded = Boolean(acceptedAt || rejectedAt)

  async function handleRejectSubmit() {
    setIsRejecting(true)
    setRejectError(null)
    try {
      const res = await fetch(`/api/public/proposals/${token}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECTED', comment: rejectComment || null }),
      })
      if (res.ok) {
        setResponseStatus('REJECTED')
        setResponseComment(rejectComment || null)
      } else {
        const data = await res.json().catch(() => ({}))
        setRejectError(data.error || 'Failed to submit. Please try again.')
      }
    } catch {
      setRejectError('A network error occurred. Please try again.')
    } finally {
      setIsRejecting(false)
    }
  }

  // Already responded — show confirmation
  if (alreadyResponded || responseStatus === 'ACCEPTED' || responseStatus === 'REJECTED') {
    const isAccepted = responseStatus === 'ACCEPTED'
    return (
      <div className="mt-10 rounded-lg border p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          {isAccepted ? (
            <CheckCircle className="h-6 w-6 text-green-600" />
          ) : (
            <XCircle className="h-6 w-6 text-red-600" />
          )}
        </div>
        <h3 className="mt-3 text-lg font-semibold">
          Proposal {isAccepted ? 'Accepted' : 'Changes Requested'}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAccepted
            ? 'Thank you! We will be in touch to schedule the kickoff.'
            : 'Your feedback has been received. We will follow up shortly.'}
        </p>
        {isAccepted && submittedSignatureUrl && (
          <div className="mt-4 inline-block rounded-md border bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={submittedSignatureUrl}
              alt="Your signature"
              className="h-16 w-auto"
            />
          </div>
        )}
        {responseComment && (
          <div className="mt-4 rounded-md bg-muted p-3 text-left text-sm">
            <div className="mb-1 flex items-center gap-1 font-medium">
              <MessageSquare className="h-3.5 w-3.5" />
              Your comment
            </div>
            <p className="text-muted-foreground">{responseComment}</p>
          </div>
        )}
      </div>
    )
  }

  // Request changes flow — standalone, no signing required
  if (showRequestChanges) {
    return (
      <div className="mt-10 rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold">Request Changes</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Let us know what you&apos;d like adjusted. We&apos;ll follow up to discuss.
        </p>
        {rejectError && (
          <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {rejectError}
          </p>
        )}
        <div className="mt-4 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="reject-comment">Your feedback</Label>
            <Textarea
              id="reject-comment"
              placeholder="What changes would you like?"
              value={rejectComment}
              onChange={e => setRejectComment(e.target.value)}
              rows={4}
              autoFocus
            />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleRejectSubmit} disabled={isRejecting}>
              {isRejecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Feedback'
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowRequestChanges(false)}
              disabled={isRejecting}
            >
              Back
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Not yet responded — show CTA buttons first, then signing flow on click
  if (!showSigningFlow) {
    return (
      <div className="mt-10 rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold">Ready to proceed?</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the proposal above, then accept or request changes.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={() => setShowSigningFlow(true)}>
            <PenLine className="mr-2 h-4 w-4" />
            Accept Proposal
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowRequestChanges(true)}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Request Changes
          </Button>
        </div>
      </div>
    )
  }

  return (
    <SigningFlow
      token={token}
      defaultName={signatoryName ?? ''}
      defaultEmail={contactEmail ?? ''}
      proposalTitle={proposalTitle}
      estimatedValue={estimatedValue}
      expirationDate={expirationDate}
      onComplete={({ signatureData, comment: c }) => {
        setResponseStatus('ACCEPTED')
        setResponseComment(c)
        setSubmittedSignatureUrl(signatureData)
      }}
      onReject={(comment: string | null) => {
        setResponseStatus('REJECTED')
        setResponseComment(comment)
      }}
    />
  )
}
