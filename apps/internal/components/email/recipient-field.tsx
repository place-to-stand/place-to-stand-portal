'use client'

import { useState } from 'react'
import { Check, Plus, X } from 'lucide-react'

import { Badge } from '@pts/ui/badge'
import { Button } from '@pts/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@pts/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'

export type RecipientOption = {
  id: string
  name: string
  /** Lowercase. */
  email: string
  isPrimary?: boolean
}

type RecipientFieldProps = {
  /** The row's label, "To" or "Cc". */
  label: string
  options: RecipientOption[]
  /** Heading over the options in the picker, e.g. "BBX Co contacts". */
  groupHeading: string
  searchPlaceholder: string
  /** Current list, lowercase emails. */
  value: string[]
  onChange: (next: string[]) => void
  /** Offer "Add <typed address>" for someone who isn't an option. */
  allowTyped?: boolean
  error?: string | null
  disabled?: boolean
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * One line of a mail-style header: the label, a chip per recipient, and an
 * Add button whose picker lists the options as checkboxes (it stays open, so
 * several can be ticked in a row).
 *
 * Chips wrap onto new lines, but Add is pinned to the row's top-right corner
 * and the picker hangs from it, so ticking another recipient never moves the
 * button or the open picker.
 */
export function RecipientField({
  label,
  options,
  groupHeading,
  searchPlaceholder,
  value,
  onChange,
  allowTyped = false,
  error,
  disabled,
}: RecipientFieldProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const byEmail = new Map(options.map(option => [option.email, option]))
  const typed = query.trim().toLowerCase()
  const canAddTyped =
    allowTyped &&
    EMAIL_RE.test(typed) &&
    !value.includes(typed) &&
    !byEmail.has(typed)

  const toggle = (email: string) =>
    onChange(
      value.includes(email)
        ? value.filter(item => item !== email)
        : [...value, email]
    )

  return (
    // Every item sits on a 28px line box (label, chips, Add), so the label and
    // Add line up with the first row of chips however many rows there are.
    <div className='flex shrink-0 items-start gap-3 border-b px-6 py-3'>
      <span className='text-muted-foreground w-13 shrink-0 text-sm leading-7'>
        {label}
      </span>
      <div className='flex min-h-7 min-w-0 flex-1 flex-wrap items-center gap-1.5'>
        {value.map(email => {
          const option = byEmail.get(email)
          const name = option?.name ?? email
          return (
            <span
              key={email}
              title={email}
              className='bg-muted inline-flex h-6.5 max-w-full items-center gap-1.5 rounded-full border pr-0.5 pl-2.5 text-[13px] font-medium'
            >
              <span className='truncate'>{name}</span>
              <button
                type='button'
                onClick={() => toggle(email)}
                disabled={disabled}
                aria-label={`Remove ${name}`}
                className='text-muted-foreground hover:bg-input hover:text-foreground focus-visible:ring-ring/50 flex size-5 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-[3px]'
              >
                <X className='size-3' />
              </button>
            </span>
          )
        })}
        {error ? (
          <span className='text-destructive text-[13px]'>{error}</span>
        ) : null}
      </div>
      <Popover
        open={open}
        onOpenChange={next => {
          setOpen(next)
          if (!next) setQuery('')
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type='button'
            variant='ghost'
            size='xs'
            disabled={disabled}
            className='text-muted-foreground shrink-0 gap-1'
          >
            <Plus />
            Add
          </Button>
        </PopoverTrigger>
        {/* Add sits at the row's right edge; open back over the form. */}
        <PopoverContent align='end' className='w-86 p-0'>
          <Command>
            <CommandInput
              placeholder={searchPlaceholder}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>
                {allowTyped
                  ? 'No matches. Type a full email address to add it.'
                  : 'No matches.'}
              </CommandEmpty>
              {options.length > 0 ? (
                <CommandGroup heading={groupHeading}>
                  {options.map(option => {
                    const checked = value.includes(option.email)
                    return (
                      <CommandItem
                        key={option.id}
                        value={`${option.name} ${option.email}`}
                        onSelect={() => toggle(option.email)}
                        data-checked={checked}
                        className='gap-2.5'
                      >
                        <span
                          aria-hidden
                          className={cn(
                            'flex size-4 shrink-0 items-center justify-center rounded-[4px] border',
                            checked
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-input'
                          )}
                        >
                          {checked ? (
                            <Check className='text-primary-foreground! size-3' />
                          ) : null}
                        </span>
                        <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
                          <span className='flex items-center gap-1.5'>
                            <span className='truncate'>{option.name}</span>
                            {option.isPrimary ? (
                              <Badge
                                variant='outline'
                                className='text-muted-foreground px-1.5 text-[10px]'
                              >
                                Primary
                              </Badge>
                            ) : null}
                          </span>
                          <span className='text-muted-foreground truncate text-xs'>
                            {option.email}
                          </span>
                        </span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              ) : null}
              {canAddTyped ? (
                <CommandGroup forceMount>
                  <CommandItem
                    forceMount
                    value={`add ${typed}`}
                    onSelect={() => {
                      onChange([...value, typed])
                      setQuery('')
                    }}
                  >
                    <Plus />
                    <span className='truncate'>
                      Add <span className='font-medium'>{typed}</span>
                    </span>
                  </CommandItem>
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
