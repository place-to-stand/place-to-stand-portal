import type { ComponentProps } from 'react'

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
      className={cn('size-3.5 shrink-0', ENTITY_ACCENTS[entity].icon, className)}
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
      <EntityLabelIcon entity={entity} />
      {children}
    </Label>
  )
}
