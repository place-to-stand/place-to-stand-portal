'use client'

import { useRouter } from 'next/navigation'

import { DropdownMenuItem } from '@pts/ui/dropdown-menu'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

/** The account menu's sign-out row. The item itself is the control. */
export function SignOutMenuItem() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/sign-in')
  }

  return (
    <DropdownMenuItem onSelect={() => void handleSignOut()}>
      Sign out
    </DropdownMenuItem>
  )
}
