import Link from 'next/link'
import { IdCard } from 'lucide-react'

import {
  Alert,
  AlertAction,
  AlertContent,
  AlertDescription,
} from '@pts/ui/alert'
import { Button } from '@pts/ui/button'

/**
 * Shown to admins until someone saves Settings → Business: a new install
 * starts with Place To Stand's details, and everything the portal sends
 * (emails, invoices, share pages) prints them until they're changed.
 */
export function BusinessSetupBanner() {
  return (
    <div className='px-4 pt-3'>
      <Alert>
        <IdCard />
        <AlertContent>
          <AlertDescription>
            Emails and invoices show Place To Stand&rsquo;s details until you
            check your business settings.
          </AlertDescription>
        </AlertContent>
        <AlertAction>
          <Button asChild size='xs' variant='outline'>
            <Link href='/settings/business'>Check settings</Link>
          </Button>
        </AlertAction>
      </Alert>
    </div>
  )
}
