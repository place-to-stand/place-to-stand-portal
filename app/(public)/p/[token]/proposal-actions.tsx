'use client'

import { useCallback, useState } from 'react'
import { CheckCircle, XCircle, MessageSquare, PenLine } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

import { SignaturePad } from './signature-pad'

type ProposalActionsProps = {
  token: string
  status: string
  acceptedAt: string | null
  rejectedAt: string | null
  clientComment: string | null
  signatoryName?: string | null
  contactEmail?: string | null
  signatureDataUrl?: string | null
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
}: ProposalActionsProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [comment, setComment] = useState('')
  const [responseStatus, setResponseStatus] = useState(status)
  const [responseComment, setResponseComment] = useState(clientComment)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showSigningForm, setShowSigningForm] = useState(false)

  // Signing form state
  const [signerName, setSignerName] = useState(signatoryName ?? '')
  const [signerEmail, setSignerEmail] = useState(contactEmail ?? '')
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [consent, setConsent] = useState(false)
  const [submittedSignatureUrl, setSubmittedSignatureUrl] = useState<string | null>(signatureDataUrl ?? null)

  const alreadyResponded = Boolean(acceptedAt || rejectedAt)
  const canSign = signerName.trim() && signatureData && consent

  const handleSignatureChange = useCallback((dataUrl: string | null) => {
    setSignatureData(dataUrl)
  }, [])

  async function handleAcceptWithSignature() {
    if (!canSign) return
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      const res = await fetch(`/api/public/proposals/${token}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ACCEPTED',
          comment: comment || null,
          signerName: signerName.trim(),
          signerEmail: signerEmail.trim() || null,
          signatureData,
          signatureConsent: true,
        }),
      })
      if (res.ok) {
        setResponseStatus('ACCEPTED')
        setResponseComment(comment || null)
        setSubmittedSignatureUrl(signatureData)
      } else {
        const data = await res.json().catch(() => ({}))
        setErrorMessage(data.error || 'Failed to submit your response. Please try again.')
      }
    } catch {
      setErrorMessage('A network error occurred. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleReject() {
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      const res = await fetch(`/api/public/proposals/${token}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECTED', comment: comment || null }),
      })
      if (res.ok) {
        setResponseStatus('REJECTED')
        setResponseComment(comment || null)
      } else {
        const data = await res.json().catch(() => ({}))
        setErrorMessage(data.error || 'Failed to submit your response. Please try again.')
      }
    } catch {
      setErrorMessage('A network error occurred. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
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

  // Signing form (shown after clicking "Accept Proposal")
  if (showSigningForm) {
    return (
      <div className="mt-10 space-y-5 rounded-lg border p-6">
        <div className="flex items-center gap-2">
          <PenLine className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Sign to accept</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Please provide your signature below to formally accept this proposal.
        </p>

        {errorMessage && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="signer-name">Full name *</Label>
            <Input
              id="signer-name"
              value={signerName}
              onChange={e => setSignerName(e.target.value)}
              placeholder="Your full legal name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signer-email">Email</Label>
            <Input
              id="signer-email"
              type="email"
              value={signerEmail}
              onChange={e => setSignerEmail(e.target.value)}
              placeholder="your@email.com"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Signature *</Label>
          <SignaturePad onChange={handleSignatureChange} typedName={signerName} />
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="signature-consent"
            checked={consent}
            onCheckedChange={checked => setConsent(checked === true)}
          />
          <Label htmlFor="signature-consent" className="text-sm leading-snug font-normal">
            I agree that my electronic signature is the legal equivalent of my manual signature
            on this proposal.
          </Label>
        </div>

        <Textarea
          placeholder="Add a comment (optional)"
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
        />

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            className="flex-1"
            disabled={!canSign || isSubmitting}
            onClick={handleAcceptWithSignature}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            {isSubmitting ? 'Submitting...' : 'Sign & Accept'}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowSigningForm(false)}
            disabled={isSubmitting}
          >
            Back
          </Button>
        </div>
      </div>
    )
  }

  // Default: action buttons
  return (
    <div className="mt-10 space-y-4 rounded-lg border p-6">
      <h3 className="text-lg font-semibold">Ready to move forward?</h3>
      {errorMessage && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      <Textarea
        placeholder="Add a comment (optional)"
        value={comment}
        onChange={e => setComment(e.target.value)}
        rows={3}
      />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          className="flex-1"
          disabled={isSubmitting}
          onClick={() => setShowSigningForm(true)}
        >
          <CheckCircle className="mr-2 h-4 w-4" />
          Accept Proposal
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="flex-1" disabled={isSubmitting}>
              <XCircle className="mr-2 h-4 w-4" />
              Request Changes
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Request changes?</AlertDialogTitle>
              <AlertDialogDescription>
                Your feedback will be shared with our team. We will follow up
                to discuss adjustments.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleReject}>
                Submit Feedback
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
