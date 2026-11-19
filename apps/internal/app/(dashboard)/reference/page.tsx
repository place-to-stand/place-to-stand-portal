import { redirect } from 'next/navigation'

import { requirePage } from '@/lib/auth/session'
import { referenceTabsFor } from '@/lib/navigation/reference-tabs'

/** Admin → Reference opens its first tab the viewer may see. */
export default async function ReferencePage() {
  const user = await requirePage('settings.permissions')
  const [first] = referenceTabsFor(user.role)
  redirect(first?.href ?? '/my/home')
}
