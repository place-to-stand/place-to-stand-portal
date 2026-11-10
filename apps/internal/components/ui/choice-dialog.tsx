'use client'

import type { ReactNode } from 'react'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@pts/ui/alert-dialog'

import { cn } from '@/lib/utils'

/** One way out of the dialog: what to press, and what it does. */
export type DialogChoice = {
  key: string
  label: string
  /** One short line on what happens, under the label. */
  detail: string
  /** `destructive` for the choice that loses someone's work. */
  tone?: 'default' | 'destructive'
  onSelect: () => void
}

/**
 * A decision the user has to make before going on: a title that says what
 * happened, an optional body (the facts to decide on), then each choice as
 * a row with its consequence under it, so the options scan at a glance.
 * The first choice is the safe one: Escape and the backdrop pick it too.
 * Used by the save conflict dialog; any later "pick what happens next"
 * dialog passes its own choices.
 */
export function ChoiceDialog({
  open,
  title,
  description,
  children,
  choices,
}: {
  open: boolean
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  choices: [DialogChoice, ...DialogChoice[]]
}) {
  const [safe] = choices
  return (
    <AlertDialog
      open={open}
      onOpenChange={next => {
        if (!next) safe.onSelect()
      }}
    >
      <AlertDialogContent onBackdropClick={safe.onSelect}>
        <AlertDialogHeader>
          <AlertDialogTitle className='leading-snug'>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        {children}
        <div className='flex flex-col gap-2'>
          {choices.map(choice => (
            <button
              key={choice.key}
              type='button'
              onClick={choice.onSelect}
              className={cn(
                'flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-md border px-3.5 py-2.5 text-left transition-colors outline-none focus-visible:ring-[3px]',
                choice.tone === 'destructive'
                  ? 'border-destructive/35 hover:bg-destructive/5 focus-visible:ring-destructive/30 dark:hover:bg-destructive/10'
                  : 'hover:bg-accent focus-visible:border-ring focus-visible:ring-ring/50'
              )}
            >
              <span
                className={cn(
                  'text-sm font-medium',
                  choice.tone === 'destructive' && 'text-destructive'
                )}
              >
                {choice.label}
              </span>
              <span className='text-muted-foreground text-sm'>
                {choice.detail}
              </span>
            </button>
          ))}
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
