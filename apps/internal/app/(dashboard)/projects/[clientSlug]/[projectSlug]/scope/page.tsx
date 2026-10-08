import { redirect } from 'next/navigation'

export default async function ProjectScopeRoute({
  params,
}: PageProps<'/projects/[clientSlug]/[projectSlug]/scope'>) {
  const { clientSlug, projectSlug } = await params
  redirect(`/projects/${clientSlug}/${projectSlug}/tasks`)
}
