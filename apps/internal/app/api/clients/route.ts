import { wasClientCompany, clientEndedAtSql } from '@pts/db/client-state'
import { clientNameSql } from '@pts/db/names'
import { NextResponse } from 'next/server'
import { and, isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { companies, } from '@/lib/db/schema'

export async function GET() {
  await requireUser()

  const rows = await db
    .select({ id: companies.id, name: clientNameSql })
    .from(companies)
    .where(and(wasClientCompany(), isNull(clientEndedAtSql)))
    .orderBy(clientNameSql)

  return NextResponse.json(rows)
}
