'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'

import type { UserRole } from '@/lib/auth/session'
import { isAdminRole } from '@/lib/auth/roles'

type ViewerAccess = {
  role: UserRole | null
  /** The signed-in user (defaults such as "assign to me"). */
  userId: string | null
  /** Admin-only controls (conversion, portal accounts…). */
  isAdmin: boolean
}

// Defaults to the least access: a component rendered outside the dashboard
// shell hides admin-only controls rather than showing them. The server still
// enforces every rule; this only keeps the UI honest.
const ViewerAccessContext = createContext<ViewerAccess>({
  role: null,
  userId: null,
  isAdmin: false,
})

export function ViewerAccessProvider({
  role,
  userId,
  children,
}: {
  role: UserRole
  userId: string
  children: ReactNode
}) {
  const value = useMemo(
    () => ({ role, userId, isAdmin: isAdminRole(role) }),
    [role, userId]
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
