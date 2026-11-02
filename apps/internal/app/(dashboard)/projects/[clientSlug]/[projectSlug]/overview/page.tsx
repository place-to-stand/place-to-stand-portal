import { redirect } from 'next/navigation'

/** The project Overview is gone: old links land on the board (Tasks). */
export default async function ProjectOverviewRedirect({
  params,
}: PageProps<'/projects/[clientSlug]/[projectSlug]/overview'>) {
  const { clientSlug, projectSlug } = await params
  redirect(`/projects/${clientSlug}/${projectSlug}/tasks`)
}
