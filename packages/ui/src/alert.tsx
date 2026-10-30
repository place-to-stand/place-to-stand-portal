import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from './cn'

/**
 * A notice inside the page or a sheet: an icon, a title and/or description,
 * and an optional action (AlertAction) that sits after the text and wraps
 * under it on narrow screens. The icon and the action are each one text line
 * tall, so both centre on the first line of text however the text wraps.
 */
const alertVariants = cva(
  'relative flex w-full flex-wrap items-start gap-x-3 gap-y-2 rounded-lg border px-3.5 py-2.5 text-sm leading-snug [&>svg]:h-[1lh] [&>svg]:w-4 [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground [&>svg]:text-muted-foreground',
        destructive:
          'border-destructive/35 bg-destructive/5 text-destructive dark:bg-destructive/10 [&>svg]:text-destructive',
        warning:
          'border-warning/40 bg-warning/10 text-foreground [&>svg]:text-warning',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot='alert'
      role='alert'
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

/** The text column: title and description stack here. */
function AlertContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='alert-content'
      className={cn('flex min-w-0 flex-1 flex-col gap-0.5', className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot='alert-title'
      className={cn('leading-snug font-medium', className)}
      {...props}
    />
  )
}

function AlertDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot='alert-description'
      className={cn('leading-snug opacity-90', className)}
      {...props}
    />
  )
}

/** Buttons for the alert, after the text (right-aligned when it fits). */
function AlertAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='alert-action'
      className={cn('ml-auto flex h-[1lh] shrink-0 items-center gap-2', className)}
      {...props}
    />
  )
}

export {
  Alert,
  AlertAction,
  AlertContent,
  AlertDescription,
  AlertTitle,
  alertVariants,
}
