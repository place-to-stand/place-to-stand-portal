import { redirect } from 'next/navigation'

type Props = {
  params: Promise<{ token: string }>
}

/**
 * Backwards-compatible redirect from the old /p/[token] URL
 * to the new /share/proposals/[token] location.
 */
export default async function LegacyProposalRedirect({ params }: Props) {
  const { token } = await params
  redirect(`/share/proposals/${token}`)
}
