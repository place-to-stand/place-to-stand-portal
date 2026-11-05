import type { ComponentProps, ReactNode } from 'react'

import { Label } from '@pts/ui/label'
import {
  ENTITY_ACCENTS,
  ENTITY_ICONS,
  type AccentEntity,
} from '@/lib/entity-accents'
import { cn } from '@/lib/utils'

/**
 * The entity's registry icon, in its colour, before a picker field's label:
 * "[icon] Person", "[icon] Company", "[icon] Assignee". Decorative: the label
 * text still names the field. Reach it through `FormLabel entity='…'` or
 * `EntityFieldLabel`, so every picker label matches.
 *
 * It sits in the line of text like a word, with one word space after it, so
 * a label that names two entities ("[icon] Project or [icon] Lead") spaces
 * evenly. Put it inside `EntityLabelText`, never as a flex item of a label.
 */
export function EntityLabelIcon({
  entity,
  className,
}: {
  entity: AccentEntity
  className?: string
}) {
  const Icon = ENTITY_ICONS[entity]
  return (
    <Icon
      aria-hidden
      className={cn(
        'me-1 inline-block size-3.5 shrink-0 align-[-0.15em]',
        ENTITY_ACCENTS[entity].icon,
        className
      )}
    />
  )
}

/**
 * A picker field's label outside react-hook-form (`FormLabel entity` inside
 * it): the entity's icon, then the text. Point `htmlFor` at the picker.
 */
export function EntityFieldLabel({
  entity,
  children,
  ...props
}: ComponentProps<typeof Label> & { entity: AccentEntity }) {
  return (
    <Label {...props}>
      <EntityLabelText entity={entity}>{children}</EntityLabelText>
    </Label>
  )
}

/**
 * A label's text with its entity icons in the line, so icons and words space
 * as text does rather than by the label's flex gap.
 */
export function EntityLabelText({
  entity,
  children,
}: {
  entity?: AccentEntity
  children: ReactNode
}) {
  return (
    <span>
      {entity ? <EntityLabelIcon entity={entity} /> : null}
      {children}
    </span>
  )
}
