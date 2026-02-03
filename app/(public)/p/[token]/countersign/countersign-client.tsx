'use client'

import { useCallback, useState } from 'react'
import { CheckCircle, ArrowRight, ArrowLeft, PenLine, Loader2 } from 'lucide-react'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

import { SignaturePad } from '../signature-pad'
import { SigningSteps } from '../signing-steps'

const STEPS = ['Your Details', 'Sign', 'Confirm']

type CountersignClientProps = {
  token: string
  proposalTitle: string
  estimatedValue: string | null
  signerName: string | null
  signerEmail: string | null
  signatureData: string | null
  acceptedAt: string | null
}

export function CountersignClient({
  token,
  proposalTitle,
  estimatedValue,
  signerName,
  signerEmail,
  signatureData,
  acceptedAt,
}: CountersignClientProps) {
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)

  // Step 1
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  // Step 2
  const [signature, setSignature] = useState<string | null>(null)
  const [consent, setConsent] = useState(false)

  const handleSignatureChange = useCallback((dataUrl: string | null) => {
    setSignature(dataUrl)
  }, [])

  const canProceedStep1 = name.trim().length > 0
  const canProceedStep2 = Boolean(signature) && consent

  async function handleSubmit() {
    if (!signature || !consent || !name.trim()) return
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      const res = await fetch(`/api/public/proposals/${token}/countersign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countersignerName: name.trim(),
          countersignerEmail: email.trim() || null,
          countersignatureData: signature,
          countersignatureConsent: true,
        }),
      })
      if (res.ok) {
        setCompleted(true)
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

  if (completed) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-6 w-6 text-green-600" />
        </div>
        <h1 className="mt-3 text-xl font-semibold">Proposal Fully Executed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Both parties have signed. A confirmation email will be sent to all parties.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl py-10">
      <h1 className="text-2xl font-bold">{proposalTitle}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Countersign this proposal</p>

      {/* Client signature summary */}
      <div className="mt-6 rounded-lg border bg-muted/30 p-4 space-y-3">
        <h3 className="text-sm font-medium">Client Signature</h3>
        <div className="flex items-start gap-4">
          {signatureData && (
            <div className="rounded-md border bg-white p-2 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={signatureData} alt="Client signature" className="h-12 w-auto" />
            </div>
          )}
          <div className="text-sm">
            <p className="font-medium">{signerName ?? 'Unknown'}</p>
            {signerEmail && <p className="text-muted-foreground">{signerEmail}</p>}
            {acceptedAt && (
              <p className="text-muted-foreground">
                Signed {format(new Date(acceptedAt), 'MMM d, yyyy \'at\' h:mm a')}
              </p>
            )}
          </div>
        </div>
        {estimatedValue && (
          <div className="text-sm">
            <span className="text-muted-foreground">Value: </span>
            <span className="font-medium">${parseFloat(estimatedValue).toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Countersign flow */}
      <div className="mt-6 rounded-lg border bg-card">
        <div className="border-b px-6 py-4">
          <div className="flex items-center gap-2 mb-3">
            <PenLine className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Add Your Countersignature</h3>
          </div>
          <SigningSteps currentStep={step} steps={STEPS} />
        </div>

        <div className="px-6 py-5">
          {errorMessage && (
            <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </p>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Confirm your identity before countersigning.
              </p>
              <div className="space-y-2">
                <Label htmlFor="cs-name">Full name *</Label>
                <Input
                  id="cs-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your full name"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cs-email">Email</Label>
                <Input
                  id="cs-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Create your countersignature below.
              </p>
              <div className="space-y-2">
                <Label>Signature *</Label>
                <SignaturePad onChange={handleSignatureChange} typedName={name} />
              </div>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="cs-consent"
                  checked={consent}
                  onCheckedChange={checked => setConsent(checked === true)}
                />
                <Label htmlFor="cs-consent" className="text-sm leading-snug font-normal">
                  I agree that my electronic signature is the legal equivalent of my
                  manual signature on this proposal.
                </Label>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Review and confirm your countersignature.
              </p>
              <div className="rounded-md border bg-muted/30 p-4 space-y-2">
                <span className="text-xs font-medium text-muted-foreground">Countersigner</span>
                <p className="text-sm font-medium">{name}</p>
                {email && <p className="text-sm text-muted-foreground">{email}</p>}
              </div>
              {signature && (
                <div className="rounded-md border bg-white p-3 inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={signature} alt="Your signature" className="h-16 w-auto" />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t px-6 py-4">
          <Button
            variant="ghost"
            onClick={() => setStep(s => s - 1)}
            disabled={step === 1 || isSubmitting}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back
          </Button>

          {step < 3 ? (
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
            >
              Next
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-1.5 h-4 w-4" />
                  Countersign Proposal
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
