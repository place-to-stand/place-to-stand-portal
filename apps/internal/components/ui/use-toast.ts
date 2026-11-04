import { useCallback } from 'react'

import {
  toast as dispatchToast,
  toastLink,
  type ToastOptions,
} from '@/components/ui/toast'

export { toastLink, type ToastOptions }

export function useToast() {
  const toast = useCallback((options: ToastOptions) => {
    dispatchToast(options)
  }, [])

  return { toast }
}

export const toast = dispatchToast
