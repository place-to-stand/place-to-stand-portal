/**
 * Shared flat config for the two Next.js apps (apps/internal, apps/client),
 * so both portals get the same rules.
 *
 *   import { nextApp } from '@pts/eslint-config/next'
 *   export default nextApp({ dir: import.meta.dirname, entityRegistry: 'lib/entity-accents.ts' })
 *
 * `entityRegistry`: the app's entity registry (internal only). With it, entity
 * icons from lucide-react are banned outside the registry; the `*-entity-*`
 * colour classes are banned in every app either way.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

import { IGNORES } from './base.mjs'

function entityIconNames(dir, registry) {
  return [
    ...readFileSync(join(dir, registry), 'utf8').matchAll(/iconName: '(\w+)'/g),
  ].map(match => match[1])
}

export function nextApp({ dir, entityRegistry } = {}) {
  const restrictedImports = []
  if (entityRegistry) {
    // Entity icons belong to the registry: read the list from it so a new
    // entity's icon is guarded the moment it is added.
    restrictedImports.push({
      name: 'lucide-react',
      importNames: entityIconNames(dir, entityRegistry),
      message:
        'Entity icons come from the registry: ENTITIES.<entity>.icon / ENTITY_ICONS in @/lib/entity-accents. For a non-entity meaning pick another glyph (e.g. CalendarClock for a timestamp).',
    })
  }

  const entityColourMessage = entityRegistry
    ? 'Entity colours come from the registry: ENTITY_ACCENTS.<entity> (icon, card, cardStatic, tint, badge, sheetHeader) in @/lib/entity-accents.'
    : 'Entity colours belong to the internal portal\'s entity registry (apps/internal/lib/entity-accents.ts); this app has none. Use the semantic tokens.'

  return [
    ...nextCoreWebVitals,
    ...nextTypescript,
    {
      rules: {
        ...(restrictedImports.length && {
          'no-restricted-imports': ['error', { paths: restrictedImports }],
        }),
        'no-restricted-syntax': [
          'error',
          {
            selector: 'Literal[value=/(^|[\\s:])[a-z-]*-entity-[a-z]/]',
            message: entityColourMessage,
          },
          {
            selector:
              'TemplateElement[value.raw=/(^|[\\s:])[a-z-]*-entity-[a-z]/]',
            message: entityColourMessage,
          },
        ],
      },
    },
    ...(entityRegistry
      ? [{ files: [entityRegistry], rules: { 'no-restricted-syntax': 'off' } }]
      : []),
    IGNORES,
  ]
}
