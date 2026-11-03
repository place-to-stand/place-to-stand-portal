// permission: public — error page
import Link from 'next/link'

import { PagePanel } from '@/components/layout/page-panel'

export default function UnauthorizedPage() {
  return (
    <div className='bg-muted/40 flex min-h-screen flex-col items-center justify-center px-6 py-12'>
      <PagePanel className='w-full max-w-md space-y-6 p-10 text-center'>
        <h1 className='text-3xl font-semibold tracking-tight'>Access denied</h1>
        <p className='text-muted-foreground text-sm'>
          You do not have permission to view this page. If you believe this is
          an error, reach out to an administrator.
        </p>
        <Link className='text-primary text-sm font-medium underline' href='/'>
          Go back to dashboard
        </Link>
      </PagePanel>
    </div>
  )
}
