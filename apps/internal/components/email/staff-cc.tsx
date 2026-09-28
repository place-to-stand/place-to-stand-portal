'use client'

import { Checkbox } from '@pts/ui/checkbox'
import { Label } from '@pts/ui/label'

import type { StaffMember } from '@/lib/updates/staff'

type StaffCcProps = {
  staff: StaffMember[]
  /** Current `cc` list, lowercase emails. */
  cc: string[]
  onChange: (cc: string[]) => void
  /**
   * Left off the list when set: a Gmail send already lands in the sender's
   * Sent folder. Omit it when the sender needs copying like anyone else.
   */
  senderEmail?: string
  disabled?: boolean
}

/** Who on our side is copied: one checkbox per active admin. */
export function StaffCc({
  staff,
  cc,
  onChange,
  senderEmail,
  disabled,
}: StaffCcProps) {
  const others = senderEmail
    ? staff.filter(member => member.email !== senderEmail.toLowerCase())
    : staff

  if (others.length === 0) {
    return (
      <p className='text-muted-foreground text-sm'>No other staff to copy.</p>
    )
  }

  const toggle = (email: string, checked: boolean) =>
    onChange(
      checked ? [...new Set([...cc, email])] : cc.filter(item => item !== email)
    )

  return (
    <ul className='space-y-2'>
      {others.map(member => {
        const inputId = `cc-${member.id}`
        return (
          <li key={member.id} className='flex items-start gap-2'>
            <Checkbox
              id={inputId}
              checked={cc.includes(member.email)}
              onCheckedChange={checked =>
                toggle(member.email, checked === true)
              }
              disabled={disabled}
              className='mt-0.5'
            />
            <Label
              htmlFor={inputId}
              className='flex min-w-0 flex-col items-start gap-0.5 font-normal'
            >
              <span className='truncate text-sm'>{member.name}</span>
              <span className='text-muted-foreground truncate text-xs'>
                {member.email}
              </span>
            </Label>
          </li>
        )
      })}
    </ul>
  )
}
