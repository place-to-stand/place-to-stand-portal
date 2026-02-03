'use client'

import { useState } from 'react'

import type { ProposalContent } from '@/lib/proposals/types'
import { ProposalDocument } from '@/components/proposal-viewer/proposal-document'

import { PasswordGate } from './password-gate'
import { ProposalActions } from './proposal-actions'

type ProposalViewerClientProps = {
  token: string
  title: string
  needsPassword: boolean
}

type ProposalData = {
  title: string
  content: ProposalContent
  estimatedValue: string | null
  expirationDate: string | null
  status: string
  acceptedAt: string | null
  rejectedAt: string | null
  clientComment: string | null
  signatoryName: string | null
  contactEmail: string | null
  signatureDataUrl: string | null
}

export function ProposalViewerClient({
  token,
  title,
  needsPassword,
}: ProposalViewerClientProps) {
  const [proposalData, setProposalData] = useState<ProposalData | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleVerified() {
    try {
      const res = await fetch(`/api/public/proposals/${token}`)
      if (!res.ok) {
        setError('Failed to load proposal. Please try again.')
        return
      }
      const json = await res.json()
      if (!json.ok || !json.data?.proposal) {
        setError('Failed to load proposal data.')
        return
      }
      const p = json.data.proposal
      const content = p.content as ProposalContent
      setProposalData({
        title: p.title,
        content,
        estimatedValue: p.estimatedValue ?? null,
        expirationDate: p.expirationDate ?? null,
        status: p.status,
        acceptedAt: p.acceptedAt ?? null,
        rejectedAt: p.rejectedAt ?? null,
        clientComment: p.clientComment ?? null,
        signatoryName: content?.client?.signatoryName ?? content?.client?.contactName ?? null,
        contactEmail: content?.client?.contactEmail ?? null,
        signatureDataUrl: p.signatureData ?? null,
      })
    } catch {
      setError('A network error occurred. Please refresh and try again.')
    }
  }

  if (error) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-destructive">{error}</p>
      </div>
    )
  }

  if (!proposalData) {
    return <PasswordGate token={token} title={title} onVerified={handleVerified} />
  }

  return (
    <>
      <ProposalDocument
        title={proposalData.title}
        content={proposalData.content}
        estimatedValue={proposalData.estimatedValue}
        expirationDate={proposalData.expirationDate}
      />
      <ProposalActions
        token={token}
        status={proposalData.status}
        acceptedAt={proposalData.acceptedAt}
        rejectedAt={proposalData.rejectedAt}
        clientComment={proposalData.clientComment}
        signatoryName={proposalData.signatoryName}
        contactEmail={proposalData.contactEmail}
        signatureDataUrl={proposalData.signatureDataUrl}
        proposalTitle={proposalData.title}
        estimatedValue={proposalData.estimatedValue}
        expirationDate={proposalData.expirationDate}
      />
    </>
  )
}
