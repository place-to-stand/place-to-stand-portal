'use client'

import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

type Props = {
  children: ReactNode
}

export function ReactQueryProvider({ children }: Props) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            staleTime: 60 * 1000,
            gcTime: 5 * 60 * 1000,
            retry: 1,
          },
        },
      })
  )

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
