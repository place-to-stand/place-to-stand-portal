import { clientNameSql } from '@pts/db/names'
import { NextResponse } from 'next/server'
import { isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { clients } from '@/lib/db/schema'

export async function GET() {
  await requireUser()

  const rows = await db
    .select({ id: clients.id, name: clientNameSql })
    .from(clients)
    .where(isNull(clients.deletedAt))
    .orderBy(clientNameSql)

  return NextResponse.json(rows)
}
