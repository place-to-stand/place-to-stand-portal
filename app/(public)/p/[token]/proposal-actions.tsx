'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, MessageSquare } from 'lucide-react'

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

  const alreadyResponded = Boolean(acceptedAt || rejectedAt)

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

  // Default: show signing flow inline
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
