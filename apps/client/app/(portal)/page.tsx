export const dynamic = 'force-dynamic'

import { and, eq, inArray, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { projects, clientMembers } from '@pts/db/schema'
import { requireClientUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'

export default async function DashboardPage() {
  const user = await requireClientUser()

  // Get client IDs the user has access to
  const memberships = isAdmin(user)
    ? []
    : await db
        .select({ clientId: clientMembers.clientId })
        .from(clientMembers)
        .where(
          and(
            eq(clientMembers.userId, user.id),
            isNull(clientMembers.deletedAt)
          )
        )

  const clientIds = memberships.map(m => m.clientId)

  // Get active projects for those clients
  const projectRows =
    clientIds.length === 0
      ? []
      : await db
          .select({
            id: projects.id,
            name: projects.name,
            status: projects.status,
            slug: projects.slug,
          })
          .from(projects)
          .where(
            and(
              inArray(projects.clientId, clientIds),
              isNull(projects.deletedAt)
            )
          )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Your Projects</h1>
        <p className="mt-1 text-sm text-foreground/60">
          View and manage your active projects.
        </p>
      </div>

      {projectRows.length === 0 ? (
        <div className="rounded-lg border border-foreground/10 p-8 text-center">
          <p className="text-sm text-foreground/60">
            No projects found. Contact your account manager to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projectRows.map(project => (
            <div
              key={project.id}
              className="rounded-lg border border-foreground/10 p-4"
            >
              <h3 className="font-medium text-foreground">{project.name}</h3>
              <span className="mt-1 inline-block rounded-full bg-foreground/5 px-2 py-0.5 text-xs text-foreground/60">
                {project.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
