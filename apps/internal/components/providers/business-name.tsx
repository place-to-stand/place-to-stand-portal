'use client'

import { createContext, useContext, type ReactNode } from 'react'

import { DEFAULT_BRAND_NAME } from '@pts/portal-ui/brand'

const BusinessNameContext = createContext<string>(DEFAULT_BRAND_NAME)

/** The business name (Settings → Business), for client copy like "From …". */
export function BusinessNameProvider({
  name,
  children,
}: {
  name: string
  children: ReactNode
}) {
  return (
    <BusinessNameContext.Provider value={name}>
      {children}
    </BusinessNameContext.Provider>
  )
}

export function useBusinessName(): string {
  return useContext(BusinessNameContext)
}
