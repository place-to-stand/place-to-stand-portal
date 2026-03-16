import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { fetchAllProposals } from '@/lib/queries/proposals'
import { fetchLeadsBoard } from '@/lib/data/leads'

import { fetchClientsForProposals } from './_actions/fetch-clients-for-proposals'
import { ProposalsContent } from './_components/proposals-content'

export const metadata = {
  title: 'Proposals',
}

export default async function ProposalsPage() {
  const user = await requireUser()
  assertAdmin(user)

  const [proposals, board, clients] = await Promise.all([
    fetchAllProposals(),
    fetchLeadsBoard(user),
    fetchClientsForProposals(),
  ])

  const leads = board.flatMap(col => col.leads)
  const senderName = user.full_name ?? user.email ?? 'Team'

  return (
    <ProposalsContent
      proposals={proposals}
      leads={leads}
      clients={clients}
      senderName={senderName}
    />
  )
}
