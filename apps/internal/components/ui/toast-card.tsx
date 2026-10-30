import type { ReactNode } from 'react'
import { cva } from 'class-variance-authority'
import { CircleCheck, Info, TriangleAlert, X } from 'lucide-react'

import { firstLineIcon } from '@pts/ui/alert'
import { Button } from '@pts/ui/button'
import { cn } from '@/lib/utils'

import type { ToastVariant } from './toast'

/**
 * One toast. Built like an Alert (icon, title, description) so the two read
 * as one family: the icon and the close button each sit on the first line of
 * text, whatever wraps. `default` is a success: almost every plain toast
 * confirms something that just happened.
 */
const toastVariants = cva(
  cn(
    'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border px-4 py-3 text-sm leading-snug shadow-lg',
    firstLineIcon
  ),
  {
    variants: {
      variant: {
        success:
          'bg-popover text-popover-foreground border-border [&>svg]:text-success',
        info: 'bg-popover text-popover-foreground border-border [&>svg]:text-muted-foreground',
        warning:
          'text-popover-foreground border-warning/40 bg-[color-mix(in_oklch,var(--warning)_8%,var(--popover))] [&>svg]:text-warning',
        destructive:
          'text-popover-foreground border-destructive/40 bg-[color-mix(in_oklch,var(--destructive)_8%,var(--popover))] [&>svg]:text-destructive',
      },
    },
  }
)

const ICONS = {
  success: CircleCheck,
  info: Info,
  warning: TriangleAlert,
  destructive: TriangleAlert,
} as const

export function ToastCard({
  title,
  description,
  variant = 'default',
  onDismiss,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  variant?: ToastVariant
  /** Shows the close button. */
  onDismiss?: () => void
  className?: string
}) {
  const look = variant === 'default' ? 'success' : variant
  const Icon = ICONS[look]
  return (
    <div
      className={cn(toastVariants({ variant: look }), className)}
      role={look === 'destructive' ? 'alert' : 'status'}
      data-toast
      data-variant={look}
    >
      <Icon aria-hidden />
      <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
        <p
          className={cn(
            'font-semibold',
            look === 'destructive' && 'text-destructive'
          )}
        >
          {title}
        </p>
        {description ? (
          <p className='text-muted-foreground'>{description}</p>
        ) : null}
      </div>
      {onDismiss ? (
        <div className='-mr-1.5 flex h-[1lh] shrink-0 items-center'>
          <Button
            variant='ghost'
            size='icon-sm'
            onClick={onDismiss}
            className='text-muted-foreground hover:text-foreground'
          >
            <X />
            <span className='sr-only'>Dismiss</span>
          </Button>
        </div>
      ) : null}
    </div>
  )
}
