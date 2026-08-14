'use client'

import {
  createContext,
  memo,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { defaultAnimateLayoutChanges, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CheckCircle, Mail, Phone, User } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ENTITY_ACCENTS } from '@/lib/entity-accents'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@pts/ui/tooltip'
import { LEAD_ORIGINATION_LABELS } from '@/lib/leads/constants'
import type { LeadRecord } from '@/lib/leads/types'
import { cn } from '@/lib/utils'
import { formatPhoneUS } from '@/lib/utils/phone-format'

type LeadCardProps = {
  lead: LeadRecord
  columnId: string
  canManage: boolean
  onEditLead: (lead: LeadRecord) => void
  disableDropTransition?: boolean
  isActive?: boolean
}

export const LeadCard = memo(function LeadCard({
  lead,
  columnId,
  canManage,
  onEditLead,
  disableDropTransition = false,
  isActive = false,
}: LeadCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: lead.id,
    data: {
      type: 'lead',
      columnId,
    },
    disabled: !canManage,
    animateLayoutChanges: args => {
      if (!disableDropTransition) {
        return defaultAnimateLayoutChanges(args)
      }
      return false
    },
  })

  const listenersMap = listeners ?? {}
  const draggableKeyDown = (
    listenersMap as {
      onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void
    }
  ).onKeyDown
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const cleanedAttributes = useMemo(() => {
    if (!attributes) {
      return {}
    }

    const { ['aria-describedby']: _omitDescribedBy, ...rest } = attributes
    void _omitDescribedBy
    return rest
  }, [attributes])

  const shouldDisableTransition = disableDropTransition && !isDragging
  const style: CSSProperties = {
    opacity: isDragging ? 0 : 1,
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition: shouldDisableTransition
      ? 'none'
      : isDragging
        ? undefined
        : transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isMounted ? attributes : cleanedAttributes)}
      {...listenersMap}
      role='button'
      onClick={() => onEditLead(lead)}
      onKeyDown={event => {
        draggableKeyDown?.(event)
        if (event.defaultPrevented) {
          return
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onEditLead(lead)
        }
      }}
      className={cn(
        'group bg-card focus-visible:ring-ring focus-visible:ring-offset-background rounded-lg border p-4 text-left shadow-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        canManage ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        isDragging && 'ring-primary ring-2',
        (isActive || isDragging) && 'border-primary/50 bg-primary/5 shadow-md',
        !isActive && !isDragging && ENTITY_ACCENTS.lead.card
      )}
    >
      <LeadCardContent lead={lead} />
    </div>
  )
})

/**
 * The "overdue for contact" signal, resolved by the workspace and handed down.
 *
 * Resolved upstream rather than computed here so every card on the board shares
 * one threshold lookup and one `now` — see LeadStalenessProvider.
 */
export type LeadStaleSignal = {
  days: number
  lastTouchLabel: string
}

/**
 * Staleness reaches the card through context rather than props.
 *
 * The dot is purely presentational, and the alternative is threading a map
 * through LeadsBoard and LeadColumn — two components that have nothing to do
 * with cadence and would only be passing it along.
 */
const LeadStalenessContext = createContext<
  ReadonlyMap<string, LeadStaleSignal>
>(new Map())

export function LeadStalenessProvider({
  signals,
  children,
}: {
  signals: ReadonlyMap<string, LeadStaleSignal>
  children: ReactNode
}) {
  return (
    <LeadStalenessContext.Provider value={signals}>
      {children}
    </LeadStalenessContext.Provider>
  )
}

export function LeadCardContent({
  lead,
  staleSignal,
}: {
  lead: LeadRecord
  /** Explicit override; otherwise resolved from context. */
  staleSignal?: LeadStaleSignal | null
}) {
  const signals = useContext(LeadStalenessContext)
  const resolvedStaleSignal = staleSignal ?? signals.get(lead.id) ?? null
  const assigneeDisplay =
    lead.assigneeName ?? lead.assigneeEmail ?? 'Unassigned'
  const companyDisplay = lead.companyName?.trim()
  // D17: the origination badge takes the removed source badge's exact slot and
  // styling — kind as the label, referrer name on hover — so board card density
  // is unchanged. It is a DISPLAY over LeadRecord's origination fields and must
  // never grow its own resolution logic (W11).
  const originationLabel = lead.originationMode
    ? LEAD_ORIGINATION_LABELS[lead.originationMode]
    : null
  const originationName = (
    lead.originationMode === 'external'
      ? lead.originationContactName
      : lead.originationUserName
  )?.trim()
  const showSourceTooltip = Boolean(originationName && originationLabel)

  const sourceBadge = originationLabel ? (
    <Badge
      variant='outline'
      className='text-muted-foreground text-[10px] font-medium tracking-wide uppercase'
    >
      {originationLabel}
    </Badge>
  ) : null

  const convertedBadge = lead.convertedToClientId ? (
    <Badge
      variant='outline'
      className='gap-1 bg-green-500/10 text-green-600 border-green-500/20 text-[10px] font-medium dark:text-green-400'
    >
      <CheckCircle className='h-3 w-3' aria-hidden />
      Converted
    </Badge>
  ) : null

  return (
    <>
      <div className='space-y-0.5'>
        <h3 className='text-foreground flex items-start gap-1.5 text-sm leading-snug font-semibold'>
          <span className='line-clamp-2'>{lead.contactName}</span>
          {resolvedStaleSignal ? (
            <StalenessDot signal={resolvedStaleSignal} />
          ) : null}
        </h3>
        {companyDisplay ? (
          <p className='text-muted-foreground text-xs font-medium'>
            {companyDisplay}
          </p>
        ) : null}
      </div>
      <div className='mt-5 space-y-2'>
        {lead.contactEmail ? (
          <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-xs'>
            <AnchorRow
              icon={Mail}
              value={lead.contactEmail}
              href={`mailto:${lead.contactEmail}`}
            />
          </div>
        ) : null}
        {lead.contactPhone ? (
          <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-xs'>
            <AnchorRow
              icon={Phone}
              value={formatPhoneUS(lead.contactPhone)}
              href={`tel:${lead.contactPhone}`}
            />
          </div>
        ) : null}
        <div className='text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs'>
          {lead.assigneeId ? (
            <Avatar className='h-4 w-4'>
              {lead.assigneeAvatarUrl && (
                <AvatarImage
                  src={`/api/storage/user-avatar/${lead.assigneeId}`}
                />
              )}
              <AvatarFallback className='text-[8px]'>
                {assigneeDisplay.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <User className='h-3.5 w-3.5' aria-hidden />
          )}
          <span>{assigneeDisplay}</span>
        </div>
      </div>
      {(convertedBadge || sourceBadge) && (
        <div className='mt-3 flex flex-wrap items-center gap-1.5'>
          {showSourceTooltip && sourceBadge ? (
            <Tooltip>
              <TooltipTrigger asChild>{sourceBadge}</TooltipTrigger>
              <TooltipContent side='top'>{originationName}</TooltipContent>
            </Tooltip>
          ) : (
            sourceBadge
          )}
          {convertedBadge}
        </div>
      )}
    </>
  )
}

/**
 * A dot, deliberately not a badge: D17's badge slot belongs to origination and
 * card density must not move (W11).
 *
 * Color is never the only signal (WCAG 1.4.1) — the dot carries an `aria-label`
 * and a tooltip that both state the day count and the last-touch date, so a
 * screen-reader user gets exactly what a sighted user gets.
 */
function StalenessDot({ signal }: { signal: LeadStaleSignal }) {
  const description = `No contact in ${signal.days} ${
    signal.days === 1 ? 'day' : 'days'
  } — ${signal.lastTouchLabel}`

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role='img'
          aria-label={description}
          className='mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500 dark:bg-amber-400'
        />
      </TooltipTrigger>
      <TooltipContent side='top'>{description}</TooltipContent>
    </Tooltip>
  )
}

type AnchorRowProps = {
  icon: typeof Mail
  value: string
  href: string
}

function AnchorRow({ icon: Icon, value, href }: AnchorRowProps) {
  return (
    <a
      href={href}
      className='hover:text-foreground inline-flex min-w-0 max-w-full items-center gap-1 underline-offset-4 transition hover:underline'
      onClick={event => event.stopPropagation()}
      title={value}
    >
      <Icon className='h-3.5 w-3.5 shrink-0' aria-hidden />
      <span className='truncate'>{value}</span>
    </a>
  )
}

export function LeadCardPreview({ lead }: { lead: LeadRecord }) {
  return (
    <div
      className={cn(
        'bg-card w-80 rounded-lg border p-4 shadow-sm',
        ENTITY_ACCENTS.lead.cardStatic
      )}
    >
      <LeadCardContent lead={lead} />
    </div>
  )
}
