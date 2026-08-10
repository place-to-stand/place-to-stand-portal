import { redirect } from 'next/navigation'

type PageProps = { params: Promise<{ clientSlug: string; projectSlug: string }> }

export default async function ProjectScopeRoute({ params }: PageProps) {
  const { clientSlug, projectSlug } = await params
  redirect(`/projects/${clientSlug}/${projectSlug}/tasks`)
}
