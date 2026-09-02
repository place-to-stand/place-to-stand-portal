import { redirect } from 'next/navigation'
import { Suspense } from 'react'

type PageProps = { params: Promise<{ clientSlug: string; projectSlug: string }> }

// The params await lives here, behind Suspense, so the page keeps a
// prerenderable shell (Cache Components instant-navigation pattern) — the
// route only ever redirects, so there is no chrome to mirror in a fallback.
async function ProjectScopeRedirect({ params }: PageProps) {
  const { clientSlug, projectSlug } = await params
  // `return` gives the component a `never` return type so TS accepts it as JSX.
  return redirect(`/projects/${clientSlug}/${projectSlug}/tasks`)
}

export default function ProjectScopeRoute({ params }: PageProps) {
  return (
    <Suspense fallback={null}>
      <ProjectScopeRedirect params={params} />
    </Suspense>
  )
}
