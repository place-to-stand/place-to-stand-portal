import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import type { Metadata } from 'next'

import { fetchProposalByShareToken, recordProposalView } from '@/lib/queries/proposals'
import type { ProposalContent } from '@/lib/proposals/types'
import { ProposalDocument } from '@/components/proposal-viewer/proposal-document'
import { verifyTokenSignature } from '@/lib/auth/crypto'
import { getSession } from '@/lib/auth/session'

import { ProposalViewerClient } from './proposal-viewer-client'
import { ProposalActions } from './proposal-actions'

type Props = {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const proposal = await fetchProposalByShareToken(token)

  return {
    title: proposal ? `${proposal.title} — Proposal` : 'Proposal',
    robots: { index: false, follow: false },
  }
}

export default async function PublicProposalPage({ params }: Props) {
  const { token } = await params
  const proposal = await fetchProposalByShareToken(token)

  if (!proposal) {
    notFound()
  }

  const hasPassword = Boolean(proposal.sharePasswordHash)

  // If password-protected, check the verification cookie SERVER-SIDE.
  // Never send proposal content to the client until verified.
  if (hasPassword) {
    const cookieStore = await cookies()
    const verified = cookieStore.get(`proposal_verified_${token}`)
    if (!verified?.value || !verifyTokenSignature(token, verified.value)) {
      // Only send the title — no content, no metadata
      return <ProposalViewerClient token={token} title={proposal.title} needsPassword />
    }
  }

  const content = proposal.content as ProposalContent | Record<string, never>
  const hasContent = 'client' in content && 'phases' in content

  // Skip view tracking for authenticated users (admins previewing their own proposals)
  const session = await getSession()
  if (!session) {
    recordProposalView(proposal.id).catch((err) => {
      console.error('[proposal-view] Failed to record view for proposal', proposal.id, err)
    })
  }

  if (!hasContent) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-xl font-semibold">{proposal.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This proposal does not have viewable content yet.
        </p>
      </div>
    )
  }

  return (
    <>
      <ProposalDocument
        title={proposal.title}
        content={content as ProposalContent}
        estimatedValue={proposal.estimatedValue}
        expirationDate={proposal.expirationDate}
        signature={proposal.acceptedAt ? {
          signerName: proposal.signerName,
          signerEmail: proposal.signerEmail,
          signatureData: proposal.signatureData,
          acceptedAt: proposal.acceptedAt,
          countersignerName: proposal.countersignerName,
          countersignerEmail: proposal.countersignerEmail,
          countersignatureData: proposal.countersignatureData,
          countersignedAt: proposal.countersignedAt,
        } : undefined}
      />
      <ProposalActions
        token={token}
        status={proposal.status}
        acceptedAt={proposal.acceptedAt}
        rejectedAt={proposal.rejectedAt}
        clientComment={proposal.clientComment}
        signatoryName={(content as ProposalContent).client?.signatoryName ?? (content as ProposalContent).client?.contactName ?? null}
        contactEmail={(content as ProposalContent).client?.contactEmail ?? null}
        signatureDataUrl={proposal.signatureData ?? null}
        proposalTitle={proposal.title}
        estimatedValue={proposal.estimatedValue}
        expirationDate={proposal.expirationDate}
      />
    </>
  )
}
