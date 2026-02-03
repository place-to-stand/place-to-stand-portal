import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { fetchProposalByCountersignToken } from '@/lib/queries/proposals'

import { CountersignClient } from './countersign-client'

type Props = {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const proposal = await fetchProposalByCountersignToken(token)

  return {
    title: proposal ? `Countersign: ${proposal.title}` : 'Countersign Proposal',
    robots: { index: false, follow: false },
  }
}

export default async function CountersignPage({ params }: Props) {
  const { token } = await params
  const proposal = await fetchProposalByCountersignToken(token)

  if (!proposal) {
    notFound()
  }

  if (proposal.status !== 'ACCEPTED') {
    return (
      <div className="py-20 text-center">
        <h1 className="text-xl font-semibold">Unable to Countersign</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This proposal has not been accepted by the client yet.
        </p>
      </div>
    )
  }

  if (proposal.countersignedAt) {
    return (
      <div className="py-20 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="mt-3 text-xl font-semibold">Already Countersigned</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This proposal was countersigned on{' '}
          {new Date(proposal.countersignedAt).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
          .
        </p>
      </div>
    )
  }

  return (
    <CountersignClient
      token={token}
      proposalTitle={proposal.title}
      estimatedValue={proposal.estimatedValue}
      signerName={proposal.signerName}
      signerEmail={proposal.signerEmail}
      signatureData={proposal.signatureData}
      acceptedAt={proposal.acceptedAt}
    />
  )
}
