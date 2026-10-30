import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { userRoleTerms, users } from '@/lib/db/schema'
import { currentMonthStartUtc } from '@/lib/queries/clients/billing-terms'
import { setRoleTerm } from '@/lib/queries/users/role-terms'
import { and, eq, gt, isNull } from 'drizzle-orm'

export async function POST() {
  // Hard guard: never available in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const user = await requireUser()
  const effectiveFrom = currentMonthStartUtc()

  // users.role and the role history move together, so the close and
  // applyDueRoleTerms agree with the role in force from this month on.
  await db.transaction(async tx => {
    await tx.update(users).set({ role: 'ADMIN' }).where(eq(users.id, user.id))
    const now = new Date().toISOString()
    await tx
      .update(userRoleTerms)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(userRoleTerms.userId, user.id),
          gt(userRoleTerms.effectiveFrom, effectiveFrom),
          isNull(userRoleTerms.deletedAt)
        )
      )
    await setRoleTerm(tx, {
      userId: user.id,
      role: 'ADMIN',
      effectiveFrom,
      createdBy: user.id,
    })
  })

  return NextResponse.json({ ok: true, userId: user.id, role: 'ADMIN' })
}
