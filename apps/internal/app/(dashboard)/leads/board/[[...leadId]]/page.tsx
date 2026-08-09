import { redirect } from 'next/navigation'

type LegacyBoardPageProps = {
  params: Promise<{ leadId?: string[] }>
}

/** Legacy path: the board moved to /leads (PRD 004 polish). */
export default async function LegacyLeadsBoardPage({
  params,
}: LegacyBoardPageProps) {
  const { leadId } = await params
  redirect(leadId?.length ? `/leads/${leadId.join('/')}` : '/leads')
}
