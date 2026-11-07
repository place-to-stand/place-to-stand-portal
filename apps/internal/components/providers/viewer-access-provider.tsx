'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'

import type { UserRole } from '@/lib/auth/session'
import { roleCan } from '@/lib/auth/capabilities'

type ViewerAccess = {
  role: UserRole | null
  /** The signed-in user (defaults such as "assign to me"). */
  userId: string | null
  /** Admin-only controls (conversion, portal accounts…). */
  isAdmin: boolean
  /** How others see the viewer (who else has a sheet open). */
  name: string | null
  hasPhoto: boolean
  /** Secret that names sheet presence channels; null outside the shell. */
  presenceKey: string | null
}

// Defaults to the least access: a component rendered outside the dashboard
// shell hides admin-only controls rather than showing them. The server still
// enforces every rule; this only keeps the UI honest.
const ViewerAccessContext = createContext<ViewerAccess>({
  role: null,
  userId: null,
  isAdmin: false,
  name: null,
  hasPhoto: false,
  presenceKey: null,
})

export function ViewerAccessProvider({
  role,
  userId,
  name = null,
  hasPhoto = false,
  presenceKey = null,
  children,
}: {
  role: UserRole
  userId: string
  name?: string | null
  hasPhoto?: boolean
  presenceKey?: string | null
  children: ReactNode
}) {
  const value = useMemo(
    () => ({
      role,
      userId,
      isAdmin: roleCan(role, 'portal.admin'),
      name,
      hasPhoto,
      presenceKey,
    }),
    [role, userId, name, hasPhoto, presenceKey]
  )

  return (
    <ViewerAccessContext.Provider value={value}>
      {children}
    </ViewerAccessContext.Provider>
  )
}

export function useViewerAccess(): ViewerAccess {
  return useContext(ViewerAccessContext)
}
