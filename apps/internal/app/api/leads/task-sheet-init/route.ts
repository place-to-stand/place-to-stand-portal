import { NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import { fetchAdminUsers } from '@/lib/data/users'
import { fetchProjectsWithRelations } from '@/lib/data/projects'

const SALES_PROJECT_SLUG = 'sales-strategy'
const SALES_PROJECT_NAME = 'Sales Strategy'

/**
 * Find or create the internal Sales Strategy project.
 */
async function getOrCreateSalesProject(userId: string): Promise<string> {
  const [existingProject] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.slug, SALES_PROJECT_SLUG),
        eq(projects.type, 'INTERNAL'),
        isNull(projects.deletedAt)
      )
    )
    .limit(1)

  if (existingProject) {
    return existingProject.id
  }

  const timestamp = new Date().toISOString()
  const [newProject] = await db
    .insert(projects)
    .values({
      name: SALES_PROJECT_NAME,
      slug: SALES_PROJECT_SLUG,
      type: 'INTERNAL',
      status: 'ACTIVE',
      createdBy: userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning({ id: projects.id })

  if (!newProject) {
    throw new Error('Failed to create Sales Strategy project')
  }

  return newProject.id
}

/**
 * GET /api/leads/task-sheet-init
 *
 * Returns the data needed to initialize the TaskSheet for lead task creation:
 * - Admin users (for assignee selection)
 * - Projects with relations (for project selection)
 * - Sales Strategy project ID (default project)
 * - Current user info
 */
export async function GET() {
  try {
    const user = await requireUser()
    assertAdmin(user)

    const [admins, allProjects, salesProjectId] = await Promise.all([
      fetchAdminUsers(),
      fetchProjectsWithRelations({ forUserId: user.id, forRole: user.role }),
      getOrCreateSalesProject(user.id),
    ])

    return NextResponse.json({
      ok: true,
      data: {
        admins,
        projects: allProjects,
        salesProjectId,
        currentUserId: user.id,
        currentUserRole: user.role,
      },
    })
  } catch (error) {
    console.error('Failed to fetch task sheet init data:', error)
    return NextResponse.json(
      { ok: false, error: 'Unable to initialize task creation.' },
      { status: 500 }
    )
  }
}
