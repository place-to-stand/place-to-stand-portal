import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { fetchProposalByShareToken, recordProposalView } from '@/lib/queries/proposals'
import type { ProposalContent } from '@/lib/proposals/types'
import { ProposalDocument } from '@/components/proposal-viewer/proposal-document'

import { ProposalViewerClient } from './proposal-viewer-client'

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
  const content = proposal.content as ProposalContent | Record<string, never>
  const hasContent = 'client' in content && 'phases' in content

  // Record view (fire-and-forget)
  recordProposalView(proposal.id).catch(() => {})

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

  if (hasPassword) {
    return (
      <ProposalViewerClient
        token={token}
        title={proposal.title}
        content={content as ProposalContent}
        estimatedValue={proposal.estimatedValue}
        expirationDate={proposal.expirationDate}
        status={proposal.status}
        acceptedAt={proposal.acceptedAt}
        rejectedAt={proposal.rejectedAt}
        clientComment={proposal.clientComment}
      />
    )
  }

  return (
    <>
      <ProposalDocument
        title={proposal.title}
        content={content as ProposalContent}
        estimatedValue={proposal.estimatedValue}
        expirationDate={proposal.expirationDate}
      />
      <ProposalActionsWrapper
        token={token}
        status={proposal.status}
        acceptedAt={proposal.acceptedAt}
        rejectedAt={proposal.rejectedAt}
        clientComment={proposal.clientComment}
      />
    </>
  )
}

// Thin wrapper to import client component
import { ProposalActions } from './proposal-actions'

function ProposalActionsWrapper(props: {
  token: string
  status: string
  acceptedAt: string | null
  rejectedAt: string | null
  clientComment: string | null
}) {
  return <ProposalActions {...props} />
}
