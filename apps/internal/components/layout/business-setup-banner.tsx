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
 * Shown to admins until someone saves Settings → Business: until then,
 * emails, invoices and share pages carry no address, phone, website or
 * inbox for replies.
 */
export function BusinessSetupBanner() {
  return (
    <div className='px-4 pt-3'>
      <Alert>
        <IdCard />
        <AlertContent>
          <AlertDescription>
            Add your business details so emails and invoices show your address,
            website and where replies go.
          </AlertDescription>
        </AlertContent>
        <AlertAction>
          <Button asChild size='xs' variant='outline'>
            <Link href='/settings/business'>Add details</Link>
          </Button>
        </AlertAction>
      </Alert>
    </div>
  )
}
