'use server'

import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { users } from '@pts/db/schema'
import { requireClientUser } from '@/lib/auth/session'

export async function completeOnboarding() {
  const user = await requireClientUser()

  await db
    .update(users)
    .set({ onboardingCompletedAt: new Date().toISOString() })
    .where(eq(users.id, user.id))

  redirect('/')
}
