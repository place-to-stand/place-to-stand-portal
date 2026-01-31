import { FileText } from 'lucide-react'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { fetchAllProposals } from '@/lib/queries/proposals'

import { ProposalsPipelineSummary } from './_components/proposals-pipeline-summary'
import { ProposalsTable } from './_components/proposals-table'

export const metadata = {
  title: 'Proposals',
}

export default async function ProposalsPage() {
  const user = await requireUser()
  assertAdmin(user)

  const proposals = await fetchAllProposals()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6" />
        <h1 className="text-2xl font-bold tracking-tight">Proposals</h1>
      </div>

      <ProposalsPipelineSummary proposals={proposals} />
      <ProposalsTable proposals={proposals} />
    </div>
  )
}
