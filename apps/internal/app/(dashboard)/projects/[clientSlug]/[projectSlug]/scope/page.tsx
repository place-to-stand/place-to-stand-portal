import { redirect } from 'next/navigation'

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

type PageProps = { params: Promise<{ clientSlug: string; projectSlug: string }> }

export default async function ProjectScopeRoute({ params }: PageProps) {
  const { clientSlug, projectSlug } = await params
  redirect(`/projects/${clientSlug}/${projectSlug}/tasks`)
}
