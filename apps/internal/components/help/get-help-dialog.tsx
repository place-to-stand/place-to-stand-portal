'use client'

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Mail } from 'lucide-react'

import { BrandLogo } from '@pts/ui/brand'
import { Button } from '@pts/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@pts/ui/dialog'

import { SiteMark } from '@/components/ui/site-mark'
import { PTS_CONTACT } from '@/lib/help/pts-contact'

type GetHelpContextValue = {
  setOpen: (open: boolean) => void
}

const GetHelpContext = createContext<GetHelpContextValue | null>(null)

export function useGetHelp() {
  const context = useContext(GetHelpContext)
  if (!context) {
    throw new Error('useGetHelp must be used within AppShell')
  }
  return context
}

/**
 * Owns the Get help dialog for the whole dashboard. It opens from the user
 * menu and ⌘K: people need it seldom, so it takes no room on the page.
 */
export function GetHelpProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  // Only the setter is shared, so opening the dialog re-renders no caller.
  const value = useMemo(() => ({ setOpen }), [])

  return (
    <GetHelpContext.Provider value={value}>
      {children}
      <GetHelpDialog open={open} onOpenChange={setOpen} />
    </GetHelpContext.Provider>
  )
}

/**
 * Who built the portal and how to reach them. The card is fixed
 * (`PTS_CONTACT`), so it reads the same on every install whatever the
 * business set on Settings → Business.
 */
function GetHelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const host = new URL(PTS_CONTACT.website).host

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[calc(100dvh-4rem)] overflow-y-auto sm:max-w-md'>
        <DialogHeader className='gap-4'>
          <BrandLogo size='lg' />
          <DialogTitle>Get help</DialogTitle>
          <DialogDescription>
            {PTS_CONTACT.name} built this portal. Want something changed, added
            or set up? Talk to the engineers who built it.
          </DialogDescription>
        </DialogHeader>
        <div className='flex flex-col gap-2'>
          <Button asChild>
            <a href={PTS_CONTACT.bookingUrl} target='_blank' rel='noreferrer'>
              <SiteMark href={PTS_CONTACT.bookingUrl} />
              Book a call
            </a>
          </Button>
          <Button asChild variant='outline'>
            <a href={`mailto:${PTS_CONTACT.email}`}>
              <Mail aria-hidden />
              {PTS_CONTACT.email}
            </a>
          </Button>
          <Button asChild variant='outline'>
            <a href={PTS_CONTACT.website} target='_blank' rel='noreferrer'>
              <SiteMark href={PTS_CONTACT.website} />
              {host}
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
