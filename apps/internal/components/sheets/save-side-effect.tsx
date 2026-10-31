import type { ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'

import { Alert, AlertContent, AlertDescription } from '@pts/ui/alert'

/**
 * What Save will do beyond the form itself ("Ada Lovelace will get an email
 * invite to the client portal when you save."): one caution alert, the only
 * way a sheet shows a save side effect. It never blocks saving. Copy: the
 * person or thing first, what happens, then "when you save".
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
