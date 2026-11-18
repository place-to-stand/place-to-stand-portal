import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { RESTRICTED_IMPORTS } from './base.mjs'

/**
 * The app's no-restricted-imports paths on top of base.mjs's: entity icons
 * only from the registry, and the shared sheet and form parts (EntityList's
 * +, the sheet chrome, the form footer) only through their components.
 */

function entityIconNames(dir, registry) {
  return [
    ...readFileSync(join(dir, registry), 'utf8').matchAll(
      /(?:iconName|retiredIcon): '(\w+)'/g
    ),
  ].map(match => match[1])
}

export function appRestrictedPaths({ dir, entityRegistry, sheetRegistry }) {
  const restrictedPaths = [...RESTRICTED_IMPORTS.paths]
  if (entityRegistry) {
    // Entity icons belong to the registry: read the list from it so a new
    // entity's icon is guarded the moment it is added.
    restrictedPaths.push({
      name: 'lucide-react',
      importNames: entityIconNames(dir, entityRegistry),
      message:
        'Entity icons come from the registry: ENTITIES.<entity>.icon / ENTITY_ICONS in @/lib/entity-accents. A client or sign-in is ENTITY_ICONS.client / .user (the company or person icon with its state dot), never Briefcase or UserRound. For a non-entity meaning pick another glyph (e.g. CalendarClock for a timestamp).',
    })
    // A sheet's related-records list (heading, +, empty state, cards) is
    // always EntityList, which imports the + by relative path.
    restrictedPaths.push({
      name: '@/components/sheets/section-add-button',
      message:
        'A section +, its list and its clickable empty state come together: use EntityList (@/components/sheets/entity-list). See docs/design-system/components/entity-list.md.',
    })
    // Every sheet shares one header and one footer, so none drifts from the
    // rest (the Filters sheet once did). The shared parts import these by
    // relative path.
    restrictedPaths.push({
      name: '@/components/ui/sheet',
      importNames: [
        'SheetHeader',
        'SheetTitle',
        'SheetDescription',
        'SheetClose',
        'SheetFooter',
      ],
      message:
        'Sheets share their chrome: use SheetFormHeader (@/components/sheets/sheet-form-header; leave out `entity` for a sheet that is not a record) and SheetFormFooter (@/components/sheets/sheet-form-footer; FormFooterBar for a form of your own). See docs/design-system/components/sheet.md.',
    })
  }
  if (sheetRegistry) {
    // Every form that saves shares one footer (FormFooterBar: undo and redo,
    // then the form's own actions), so a page's bar and a sheet's can't
    // drift. Read-only sheets that only need the chrome say why inline.
    restrictedPaths.push({
      name: '@/components/sheets/sheet-form-footer',
      importNames: ['SheetFooterBar'],
      message:
        'A form that saves uses FormFooterBar (@/components/sheets/sheet-form-footer): the sheet footer and the page save bar are one component. See docs/design-system/components/page-form.md.',
    })
  }
  return restrictedPaths
}
