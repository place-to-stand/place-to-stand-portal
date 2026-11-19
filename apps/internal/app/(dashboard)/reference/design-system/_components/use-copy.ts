'use client'

import { useCallback } from 'react'

import { useToast } from '@/components/ui/use-toast'

/** Copies a token, class or import name and confirms with a toast. */
export function useCopy() {
  const { toast } = useToast()
  return useCallback(
    async (value: string) => {
      try {
        await navigator.clipboard.writeText(value)
        toast({ title: `Copied ${value}` })
      } catch {
        toast({
          title: 'Unable to copy',
          description: 'The browser blocked clipboard access.',
          variant: 'destructive',
        })
      }
    },
    [toast]
  )
}
