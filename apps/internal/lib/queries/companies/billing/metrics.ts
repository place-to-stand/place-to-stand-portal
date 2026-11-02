import 'server-only'

import { eq, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { hourBlocks, projects } from '@/lib/db/schema'

export async function countProjectsForClient(companyId: string) {
  const result = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(projects)
    .where(eq(projects.companyId, companyId))

  return Number(result[0]?.count ?? 0)
}

export async function countHourBlocksForClient(companyId: string) {
  const result = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(hourBlocks)
    .where(eq(hourBlocks.companyId, companyId))

  return Number(result[0]?.count ?? 0)
}
