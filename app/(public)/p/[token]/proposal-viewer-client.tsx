'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'

import type { ProposalContent } from '@/lib/proposals/types'
import { ProposalDocument } from '@/components/proposal-viewer/proposal-document'

import { PasswordGate } from './password-gate'
import { ProposalActions } from './proposal-actions'

type ProposalViewerClientProps = {
  token: string
  title: string
  content: ProposalContent
  estimatedValue: string | null
  expirationDate: string | null
  status: string
  acceptedAt: string | null
  rejectedAt: string | null
  clientComment: string | null
}

export function ProposalViewerClient({
  token,
  title,
  content,
  estimatedValue,
  expirationDate,
  status,
  acceptedAt,
  rejectedAt,
  clientComment,
}: ProposalViewerClientProps) {
  const [verified, setVerified] = useState(false)

  if (!verified) {
    return <PasswordGate token={token} title={title} onVerified={() => setVerified(true)} />
  }

  return (
    <>
      <ProposalDocument
        title={title}
        content={content}
        estimatedValue={estimatedValue}
        expirationDate={expirationDate}
      />
      <ProposalActions
        token={token}
        status={status}
        acceptedAt={acceptedAt}
        rejectedAt={rejectedAt}
        clientComment={clientComment}
      />
    </>
  )
}
