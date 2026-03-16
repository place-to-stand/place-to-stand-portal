'use client'

import { useCallback, useState } from 'react'
import { CheckCircle, ArrowRight, ArrowLeft, PenLine, Loader2, XCircle } from 'lucide-react'

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
import { SigningSteps } from './signing-steps'

const STEPS = ['Your Details', 'Sign', 'Review & Confirm']

type SigningFlowProps = {
  token: string
  defaultName?: string
  defaultEmail?: string
  proposalTitle?: string
  estimatedValue?: string | null
  expirationDate?: string | null
  onComplete: (data: {
    status: string
    signatureData: string
    comment: string | null
  }) => void
  onReject: (comment: string | null) => void
}

export function SigningFlow({
  token,
  defaultName = '',
  defaultEmail = '',
  proposalTitle,
  estimatedValue,
  expirationDate,
  onComplete,
  onReject,
}: SigningFlowProps) {
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Step 1: details
  const [signerName, setSignerName] = useState(defaultName)
  const [signerEmail, setSignerEmail] = useState(defaultEmail)

  // Step 2: signature
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [consent, setConsent] = useState(false)

  // Step 3: comment
  const [comment, setComment] = useState('')

  // Request changes
  const [rejectComment, setRejectComment] = useState('')
  const [isRejecting, setIsRejecting] = useState(false)

  const handleSignatureChange = useCallback((dataUrl: string | null) => {
    setSignatureData(dataUrl)
  }, [])

  const canProceedStep1 = signerName.trim().length > 0
  const canProceedStep2 = Boolean(signatureData) && consent

  async function handleSubmit() {
    if (!signatureData || !consent || !signerName.trim()) return
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
        onComplete({
          status: 'ACCEPTED',
          signatureData,
          comment: comment || null,
        })
      } else {
        const data = await res.json().catch(() => ({}))
        setErrorMessage(data.error || 'Failed to submit. Please try again.')
      }
    } catch {
      setErrorMessage('A network error occurred. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleReject() {
    setIsRejecting(true)
    setErrorMessage(null)
    try {
      const res = await fetch(`/api/public/proposals/${token}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECTED', comment: rejectComment || null }),
      })
      if (res.ok) {
        onReject(rejectComment || null)
      } else {
        const data = await res.json().catch(() => ({}))
        setErrorMessage(data.error || 'Failed to submit your response. Please try again.')
      }
    } catch {
      setErrorMessage('A network error occurred. Please check your connection and try again.')
    } finally {
      setIsRejecting(false)
    }
  }

  return (
    <div className="mt-10 rounded-lg border bg-card">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-2 mb-3">
          <PenLine className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Sign to Accept</h3>
        </div>
        <SigningSteps currentStep={step} steps={STEPS} />
      </div>

      {/* Content */}
      <div className="px-6 py-5">
        {errorMessage && (
          <p
            role="alert"
            aria-live="assertive"
            className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {errorMessage}
          </p>
        )}

        {/* Step 1: Your Details */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please confirm your identity before signing.
            </p>
            <div className="space-y-2">
              <Label htmlFor="sf-signer-name">Full name *</Label>
              <Input
                id="sf-signer-name"
                value={signerName}
                onChange={e => setSignerName(e.target.value)}
                placeholder="Your full legal name"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sf-signer-email">Email</Label>
              <Input
                id="sf-signer-email"
                type="email"
                value={signerEmail}
                onChange={e => setSignerEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>
          </div>
        )}

        {/* Step 2: Sign */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Create your signature below.
            </p>
            <div className="space-y-2">
              <Label>Signature *</Label>
              <SignaturePad onChange={handleSignatureChange} typedName={signerName} />
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="sf-consent"
                checked={consent}
                onCheckedChange={checked => setConsent(checked === true)}
              />
              <Label htmlFor="sf-consent" className="text-sm leading-snug font-normal">
                I agree that my electronic signature is the legal equivalent of my
                manual signature on this proposal.
              </Label>
            </div>
          </div>
        )}

        {/* Step 3: Review & Confirm */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Review the details below, then sign and accept.
            </p>

            {/* Summary card */}
            <div className="rounded-md border bg-muted/30 p-4 space-y-3">
              {proposalTitle && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Proposal</span>
                  <p className="text-sm font-medium">{proposalTitle}</p>
                </div>
              )}
              {estimatedValue && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Value</span>
                  <p className="text-sm font-medium">
                    ${parseFloat(estimatedValue).toLocaleString()}
                  </p>
                </div>
              )}
              {expirationDate && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Valid until</span>
                  <p className="text-sm font-medium">
                    {new Date(expirationDate).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>

            {/* Signer info */}
            <div className="rounded-md border bg-muted/30 p-4 space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Signer</span>
              <p className="text-sm font-medium">{signerName}</p>
              {signerEmail && (
                <p className="text-sm text-muted-foreground">{signerEmail}</p>
              )}
            </div>

            {/* Signature preview */}
            {signatureData && (
              <div className="rounded-md border bg-white p-3 inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={signatureData}
                  alt="Your signature"
                  className="h-16 w-auto"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="sf-comment">Comment (optional)</Label>
              <Textarea
                id="sf-comment"
                placeholder="Add a comment..."
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t px-6 py-4">
        <div className="flex items-center gap-2">
          {step > 1 && (
            <Button
              variant="ghost"
              onClick={() => setStep(s => s - 1)}
              disabled={isSubmitting}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Button>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={isSubmitting || isRejecting}
              >
                <XCircle className="mr-1.5 h-4 w-4" />
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
              <Textarea
                placeholder="What changes would you like? (optional)"
                value={rejectComment}
                onChange={e => setRejectComment(e.target.value)}
                rows={3}
              />
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReject} disabled={isRejecting}>
                  {isRejecting ? 'Submitting...' : 'Submit Feedback'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {step < 3 ? (
          <Button
            onClick={() => setStep(s => s + 1)}
            disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
          >
            Next
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle className="mr-1.5 h-4 w-4" />
                Sign & Accept Proposal
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
