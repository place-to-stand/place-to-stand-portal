import type { ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'

import { Alert, AlertContent, AlertDescription } from '@pts/ui/alert'

/**
 * What Save will do beyond the form itself ("Saving emails a portal invite
 * to Ada Lovelace."): one caution alert, the only way a sheet shows a save
 * side effect. It never blocks saving.
 */
export function SaveSideEffect({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <Alert variant='warning' className={className}>
      <TriangleAlert />
      <AlertContent>
        <AlertDescription>{children}</AlertDescription>
      </AlertContent>
    </Alert>
  )
}
