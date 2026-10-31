import { TriangleAlert } from 'lucide-react'

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
} from '@pts/ui/alert'

type SnapshotErrorNoticeProps = {
  message: string
}

/**
 * A closed month whose saved numbers failed validation (F9). The page falls
 * back to a live derivation, and says so.
 */
export function SnapshotErrorNotice({ message }: SnapshotErrorNoticeProps) {
  return (
    <Alert variant='destructive' className='rounded-xl px-5 py-3.5'>
      <TriangleAlert />
      <AlertContent>
        <AlertTitle className='font-semibold'>
          Unable to read the saved close
        </AlertTitle>
        <AlertDescription className='text-foreground/80 text-[13px]'>
          {message} The figures below are live, not the saved close.
        </AlertDescription>
      </AlertContent>
    </Alert>
  )
}
