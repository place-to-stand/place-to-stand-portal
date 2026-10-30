'use server'

import { ensureClientCompany } from '@/lib/companies/billing/ensure-client-company'
import { eq } from 'drizzle-orm'

import { creatableProjectTypes, roleCan } from '@/lib/auth/capabilities'
import { requireStaffUser, type AppUser } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import { projectCreatedEvent, projectUpdatedEvent } from '@/lib/activity/events'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db, uniqueViolation, type DbTx } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import {
  assertValidProjectMemberIds,
  InvalidProjectMemberError,
  logProjectMembersChanged,
  writeProjectMembers,
} from '@/lib/projects/members'
import { diffProjectFields } from '@/lib/settings/projects/project-field-changes'
import {
  logProjectLinkChanges,
  prepareProjectLinkChanges,
  writeProjectLinkChanges,
  type PreparedLinkChanges,
  type WrittenLinkChanges,
} from '@/lib/settings/projects/project-link-changes'
import {
  generateUniqueProjectSlug,
  projectSchema,
  projectSlugExists,
  toProjectSlug,
  type ProjectActionResult,
  type ProjectInput,
} from '@/lib/settings/projects/project-service'

import {
  revalidateProjectDetailRoutes,
  revalidateProjectSettings,
} from './shared'

const INSERT_RETRY_LIMIT = 3
const PROJECT_SLUG_INDEX = 'idx_projects_slug'

type RelatedWrites = {
  members: { added: string[]; removed: string[] }
  links: WrittenLinkChanges
}

/**
 * Saves the whole project sheet — the project row, its members, GitHub repo
 * links and Vercel/Supabase links — in one database transaction. Every
 * outside check (GitHub, Vercel, Supabase) runs before the transaction opens;
 * activity rows are written after it commits.
 */
export async function saveProject(
  input: ProjectInput
): Promise<ProjectActionResult> {
  const user = await requireStaffUser()
  const parsed = projectSchema.safeParse(input)
  const canManage = roleCan(user.role, 'projects.manage')

  if (!parsed.success) {
    const { fieldErrors, formErrors } = parsed.error.flatten()
    const message = formErrors[0] ?? 'Please correct the highlighted fields.'

    return { error: message, fieldErrors }
  }

  const {
    id,
    name,
    companyId: pickedCompanyId,
    projectType,
    status,
    startsOn,
    endsOn,
    slug,
  } = parsed.data

  // Without `projects.manage` the sheet can only create a project of a type
  // the role may create, owned by the user: no edits, client, members or
  // links.
  if (!canManage) {
    const allowed = creatableProjectTypes(user.role, [projectType])
    if (id || allowed.length === 0) {
      return { error: 'You can’t create that kind of project.' }
    }
  }
  const ownerId = canManage ? parsed.data.ownerId : user.id
  const memberIds = canManage ? parsed.data.memberIds : undefined
  const repoLinks = canManage ? parsed.data.repoLinks : undefined
  const integrationLinks = canManage ? parsed.data.integrationLinks : undefined

  if (memberIds !== undefined) {
    try {
      await assertValidProjectMemberIds(memberIds)
    } catch (error) {
      if (error instanceof InvalidProjectMemberError) {
        return { error: error.message }
      }
      throw error
    }
  }

  const trimmedName = name.trim()
  const providedSlug = slug?.trim() ? toProjectSlug(slug.trim()) : null

  if (providedSlug && providedSlug.length < 3) {
    return { error: 'Slug must be at least 3 characters.' }
  }

  if (!trimmedName) {
    return { error: 'Project name is required.' }
  }

  const companyId = projectType === 'CLIENT' ? pickedCompanyId : null
  if (projectType === 'CLIENT') {
    const notClient = await ensureClientCompany(companyId)
    if (notClient)
      return { error: notClient, fieldErrors: { companyId: [notClient] } }
  }
  const fields = {
    name: trimmedName,
    companyId,
    status,
    type: projectType,
    startsOn: startsOn ?? null,
    endsOn: endsOn ?? null,
    ownerId: ownerId ?? null,
  }

  const result = await trackSettingsServerInteraction<ProjectActionResult>(
    {
      entity: 'project',
      mode: id ? 'edit' : 'create',
      targetId: id ?? null,
      metadata: { companyId, status },
    },
    async () => {
      // Reads and outside calls first: nothing is written until the
      // transaction, so a failed check leaves no half-saved project.
      const existing = id ? await loadProjectFields(id) : null
      if (id && !existing) {
        return { error: 'Project not found.' }
      }
      if (id && providedSlug) {
        if (await projectSlugExists(providedSlug, { excludeId: id })) {
          return { error: 'Another project already uses this slug.' }
        }
      }

      const links = await prepareProjectLinkChanges({
        user,
        projectId: id ?? null,
        companyId,
        repoLinks,
        integrationLinks,
      })
      if ('error' in links) {
        return { error: links.error }
      }

      const writeRelated = (tx: DbTx, projectId: string) =>
        writeRelatedRows(tx, projectId, user.id, memberIds, links.prepared)

      if (!id) {
        const created = await insertProject(
          { ...fields, createdBy: user.id },
          providedSlug ?? toProjectSlug(trimmedName),
          writeRelated
        )
        if ('error' in created) return created

        const event = projectCreatedEvent({ name: trimmedName, status })
        await logActivity({
          actorId: user.id,
          actorRole: user.role,
          verb: event.verb,
          summary: event.summary,
          targetType: 'PROJECT',
          targetId: created.projectId,
          targetProjectId: created.projectId,
          targetCompanyId: companyId,
          metadata: event.metadata,
        })
        await logRelatedChanges(user, created.projectId, created.related)
        return { projectId: created.projectId }
      }

      if (!existing) {
        return { error: 'Project not found.' }
      }

      let related: RelatedWrites
      try {
        related = await db.transaction(async tx => {
          await tx
            .update(projects)
            .set({ ...fields, slug: providedSlug })
            .where(eq(projects.id, id))
          return writeRelated(tx, id)
        })
      } catch (error) {
        if (uniqueViolation(error) === PROJECT_SLUG_INDEX) {
          return { error: 'Another project already uses this slug.' }
        }
        console.error('Failed to update project', error)
        return { error: 'Unable to update project.' }
      }

      const { changedFields, details } = diffProjectFields(existing, {
        ...fields,
        slug: providedSlug,
      })
      if (changedFields.length > 0) {
        const event = projectUpdatedEvent({
          name: trimmedName,
          changedFields,
          details,
        })
        await logActivity({
          actorId: user.id,
          actorRole: user.role,
          verb: event.verb,
          summary: event.summary,
          targetType: 'PROJECT',
          targetId: id,
          targetProjectId: id,
          targetCompanyId: companyId,
          metadata: event.metadata,
        })
      }
      await logRelatedChanges(user, id, related)
      return { projectId: id }
    }
  )

  if (!result.error) {
    await revalidateProjectSettings()
    await revalidateProjectDetailRoutes()
  }

  return result
}

async function loadProjectFields(id: string) {
  const [row] = await db
    .select({
      name: projects.name,
      status: projects.status,
      type: projects.type,
      startsOn: projects.startsOn,
      endsOn: projects.endsOn,
      slug: projects.slug,
      ownerId: projects.ownerId,
    })
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1)
  return row ?? null
}

/** Members (when the sheet sent them) and link changes, in the save's tx. */
async function writeRelatedRows(
  tx: DbTx,
  projectId: string,
  actorId: string,
  memberIds: string[] | undefined,
  prepared: PreparedLinkChanges
): Promise<RelatedWrites> {
  // An omitted member list leaves the current members untouched.
  const members =
    memberIds === undefined
      ? { added: [], removed: [] }
      : await writeProjectMembers(tx, { actorId, projectId, memberIds })
  const links = await writeProjectLinkChanges(tx, projectId, prepared, actorId)
  return { members, links }
}

/**
 * Inserts the project and its related rows in one transaction. A slug taken
 * between picking it and inserting rolls the whole transaction back and
 * retries with a fresh slug.
 */
async function insertProject(
  values: Omit<typeof projects.$inferInsert, 'slug'>,
  baseSlug: string,
  writeRelated: (tx: DbTx, projectId: string) => Promise<RelatedWrites>
): Promise<{ projectId: string; related: RelatedWrites } | { error: string }> {
  for (let attempt = 0; attempt < INSERT_RETRY_LIMIT; attempt += 1) {
    const slug = await generateUniqueProjectSlug(baseSlug)
    try {
      return await db.transaction(async tx => {
        const [inserted] = await tx
          .insert(projects)
          .values({ ...values, slug })
          .returning({ id: projects.id })
        const related = await writeRelated(tx, inserted.id)
        return { projectId: inserted.id, related }
      })
    } catch (error) {
      if (uniqueViolation(error) === PROJECT_SLUG_INDEX) continue
      console.error('Failed to create project', error)
      return { error: 'Unable to create project.' }
    }
  }
  return { error: 'Could not generate a unique slug. Please try again.' }
}

async function logRelatedChanges(
  actor: Pick<AppUser, 'id' | 'role'>,
  projectId: string,
  related: RelatedWrites
) {
  await logProjectMembersChanged({ actor, projectId, ...related.members })
  await logProjectLinkChanges(actor, projectId, related.links)
}
