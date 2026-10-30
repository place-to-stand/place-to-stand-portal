'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound } from 'lucide-react'

import { Button } from '@pts/ui/button'
import { ConfirmDialog } from '@pts/ui/confirm-dialog'
import { formatRelativeTime } from '@pts/ui/dates'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@pts/ui/dialog'
import { Input } from '@pts/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pts/ui/select'
import { Skeleton } from '@pts/ui/skeleton'
import { Switch } from '@pts/ui/switch'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { useToast } from '@/components/ui/use-toast'
import { useViewerAccess } from '@/components/providers/viewer-access-provider'
import {
  restoreUser,
  setUserDisabled,
  softDeleteUser,
  updateUser,
} from '@/app/(dashboard)/settings/users/actions'
import { ROLE_LABELS } from '@/lib/auth/roles'
import type { PortalAccountSummary } from '@/lib/queries/users/portal-account'
import { USER_ROLES } from '@/lib/settings/users/user-validation'

import { getContactPortalAccount } from '../../actions'

type Role = (typeof USER_ROLES)[number]

type ContactSignInSectionProps = {
  /** `contacts.user_id`. */
  userId: string
  /** The person's name, for copy and the update payload. */
  personName: string
}

type PendingConfirm =
  | { kind: 'disable' }
  | { kind: 'archive' }
  | { kind: 'role'; role: Role }

/**
 * A person's sign-in (admins only): sign-in email, role, the "Can sign in"
 * off switch, a temporary password, and archive. Each control applies right
 * away, like the switch on the People list — it is an emergency control.
 */
export function ContactSignInSection({
  userId,
  personName,
}: ContactSignInSectionProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { userId: viewerId } = useViewerAccess()
  const isSelf = viewerId === userId
  // undefined = loading, null = the id no longer resolves to a user.
  const [account, setAccount] = useState<PortalAccountSummary | null>()
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [isPending, startTransition] = useTransition()

  const load = useCallback(async () => {
    try {
      setAccount(await getContactPortalAccount(userId))
    } catch (error) {
      console.error('Failed to load sign-in:', error)
      setAccount(null)
    }
  }, [userId])

  useEffect(() => {
    let cancelled = false
    getContactPortalAccount(userId)
      .then(result => {
        if (!cancelled) setAccount(result)
      })
      .catch(error => {
        console.error('Failed to load sign-in:', error)
        if (!cancelled) setAccount(null)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const run = useCallback(
    (
      action: () => Promise<{ error?: string | null }>,
      success: string,
      after?: () => void
    ) => {
      startTransition(async () => {
        const result = await action()
        if (result.error) {
          toast({
            title: 'Sign-in not changed',
            description: result.error,
            variant: 'destructive',
          })
          return
        }
        toast({ title: success, description: personName })
        after?.()
        await load()
        router.refresh()
      })
    },
    [load, personName, router, toast]
  )

  if (account === undefined) {
    return (
      <div className='space-y-2'>
        <Skeleton className='h-9 w-full' />
        <Skeleton className='h-9 w-full' />
      </div>
    )
  }
  if (account === null) {
    return (
      <p className='text-muted-foreground text-sm'>
        This sign-in could not be loaded.
      </p>
    )
  }

  const isArchived = Boolean(account.deletedAt)
  const canSignIn = !account.disabledAt && !isArchived
  const selfReason = isSelf ? 'You can’t change your own sign-in here.' : null
  const pendingReason = isPending ? 'Saving…' : null
  const lockedReason = selfReason ?? pendingReason
  const fullName = personName || account.email

  const setRole = (role: Role) =>
    run(
      () => updateUser({ id: userId, fullName, role }),
      `Role changed to ${ROLE_LABELS[role]}`
    )
  const setCanSignIn = (next: boolean) =>
    run(
      () => setUserDisabled({ id: userId, disabled: !next }),
      next ? 'Sign-in turned on' : 'Sign-in turned off'
    )

  return (
    <div className='space-y-3'>
      <dl className='grid grid-cols-[8rem_1fr] items-center gap-x-4 gap-y-3 text-sm'>
        <dt className='text-muted-foreground'>Sign-in email</dt>
        <dd className='truncate'>{account.email}</dd>

        <dt className='text-muted-foreground'>Last sign-in</dt>
        <dd>{formatRelativeTime(account.lastSignInAt) ?? 'Never'}</dd>

        <dt className='text-muted-foreground'>Role</dt>
        <dd>
          <DisabledFieldTooltip
            disabled={Boolean(lockedReason) || isArchived}
            reason={lockedReason ?? 'Restore the sign-in to change its role.'}
            className='w-48'
          >
            <Select
              value={account.role}
              onValueChange={value =>
                value !== account.role &&
                setConfirm({ kind: 'role', role: value as Role })
              }
              disabled={Boolean(lockedReason) || isArchived}
            >
              <SelectTrigger className='h-8 w-48' aria-label='Role'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USER_ROLES.map(role => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DisabledFieldTooltip>
        </dd>

        <dt className='text-muted-foreground'>Can sign in</dt>
        <dd>
          <DisabledFieldTooltip
            disabled={Boolean(lockedReason) || isArchived}
            reason={lockedReason ?? 'This sign-in is archived.'}
            className='w-auto'
          >
            <Switch
              checked={canSignIn}
              aria-label='Can sign in'
              disabled={Boolean(lockedReason) || isArchived}
              onCheckedChange={next =>
                next ? setCanSignIn(true) : setConfirm({ kind: 'disable' })
              }
            />
          </DisabledFieldTooltip>
        </dd>
      </dl>

      <div className='flex flex-wrap gap-2'>
        <DisabledFieldTooltip
          disabled={Boolean(lockedReason) || isArchived}
          reason={lockedReason ?? 'Restore the sign-in first.'}
          className='w-auto'
        >
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={Boolean(lockedReason) || isArchived}
            onClick={() => {
              setPassword('')
              setPasswordOpen(true)
            }}
          >
            <KeyRound />
            Set temporary password
          </Button>
        </DisabledFieldTooltip>
        <DisabledFieldTooltip
          disabled={Boolean(lockedReason)}
          reason={lockedReason}
          className='w-auto'
        >
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className={
              isArchived ? undefined : 'text-muted-foreground hover:text-destructive'
            }
            disabled={Boolean(lockedReason)}
            onClick={() =>
              isArchived
                ? run(() => restoreUser({ id: userId }), 'Sign-in restored')
                : setConfirm({ kind: 'archive' })
            }
          >
            {isArchived ? 'Restore sign-in' : 'Archive sign-in'}
          </Button>
        </DisabledFieldTooltip>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.kind === 'disable'
            ? 'Turn off sign-in?'
            : confirm?.kind === 'archive'
              ? 'Archive sign-in?'
              : `Make ${fullName} ${confirm?.kind === 'role' ? ROLE_LABELS[confirm.role] : ''}?`
        }
        description={
          confirm?.kind === 'disable'
            ? `${fullName} is signed out and can’t sign in until this is turned back on.`
            : confirm?.kind === 'archive'
              ? `${fullName} can no longer sign in. The person stays; their sign-in can be restored.`
              : confirm?.kind === 'role' && confirm.role === 'CLIENT'
                ? `${fullName} loses access to the internal portal and signs in to the client portal instead.`
                : confirm?.kind === 'role' && confirm.role === 'ADMIN'
                  ? `${fullName} gets full access, including billing and sign-ins.`
                  : `${fullName} can use leads, people and companies, but not billing.`
        }
        confirmLabel={
          confirm?.kind === 'disable'
            ? 'Turn off'
            : confirm?.kind === 'archive'
              ? 'Archive'
              : 'Change role'
        }
        confirmVariant={confirm?.kind === 'role' ? 'default' : 'destructive'}
        confirmDisabled={isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const current = confirm
          setConfirm(null)
          if (!current) return
          if (current.kind === 'disable') setCanSignIn(false)
          else if (current.kind === 'archive')
            run(() => softDeleteUser({ id: userId }), 'Sign-in archived')
          else setRole(current.role)
        }}
      />

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Set temporary password</DialogTitle>
            <DialogDescription>
              {fullName} signs in with this once, then picks their own. Share
              it with them directly.
            </DialogDescription>
          </DialogHeader>
          <Input
            type='text'
            autoComplete='off'
            value={password}
            onChange={event => setPassword(event.target.value)}
            placeholder='At least 8 characters'
            aria-label='Temporary password'
          />
          <DialogFooter className='mt-2'>
            <Button
              type='button'
              variant='outline'
              onClick={() => setPasswordOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type='button'
              disabled={isPending || password.length < 8}
              onClick={() =>
                run(
                  () =>
                    updateUser({
                      id: userId,
                      fullName,
                      role: account.role,
                      password,
                    }),
                  'Temporary password set',
                  () => setPasswordOpen(false)
                )
              }
            >
              Set password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
