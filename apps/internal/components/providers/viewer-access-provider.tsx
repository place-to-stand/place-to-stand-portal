'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'

import type { UserRole } from '@/lib/auth/session'
import { isAdminRole } from '@/lib/auth/roles'

type ViewerAccess = {
  role: UserRole | null
  /** Admin-only controls (conversion, portal accounts, hard deletes…). */
  isAdmin: boolean
}

// Defaults to the least access: a component rendered outside the dashboard
// shell hides admin-only controls rather than showing them. The server still
// enforces every rule; this only keeps the UI honest.
const ViewerAccessContext = createContext<ViewerAccess>({
  role: null,
  isAdmin: false,
})

export function ViewerAccessProvider({
  role,
  children,
}: {
  role: UserRole
  children: ReactNode
}) {
  const value = useMemo(
    () => ({ role, isAdmin: isAdminRole(role) }),
    [role]
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
