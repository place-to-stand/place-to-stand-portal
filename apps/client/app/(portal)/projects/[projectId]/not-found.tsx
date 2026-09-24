import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'

import { EmptyState } from '@pts/ui/empty-state'

export default function ProjectNotFound() {
  return (
    <div className='space-y-6'>
      <Link
        href='/'
        className='text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm'
      >
        <ArrowLeftIcon className='size-4' />
        Back to dashboard
      </Link>
      <EmptyState message="This project doesn't exist or you don't have access to it." />
    </div>
  )
}
