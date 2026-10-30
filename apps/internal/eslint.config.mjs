import { readFileSync } from 'node:fs'
import { defineConfig, globalIgnores } from 'eslint/config'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

// Entity icons belong to the registry (lib/entity-accents.ts): read the
// list from it so a new entity's icon is guarded the moment it is added.
const ENTITY_ICON_NAMES = [
  ...readFileSync(
    new URL('./lib/entity-accents.ts', import.meta.url),
    'utf8'
  ).matchAll(/iconName: '(\w+)'/g),
].map(match => match[1])

const eslintConfig = defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'lucide-react',
              importNames: ENTITY_ICON_NAMES,
              message:
                'Entity icons come from the registry: ENTITIES.<entity>.icon / ENTITY_ICONS in @/lib/entity-accents. For a non-entity meaning pick another glyph (e.g. CalendarClock for a timestamp).',
            },
          ],
        },
      ],
      // Entity colours come from the registry too (ENTITY_ACCENTS.<entity>).
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/(^|[\\s:])[a-z-]*-entity-[a-z]/]',
          message:
            'Entity colours come from the registry: ENTITY_ACCENTS.<entity> (icon, card, cardStatic, tint, badge, sheetHeader) in @/lib/entity-accents.',
        },
        {
          selector:
            'TemplateElement[value.raw=/(^|[\\s:])[a-z-]*-entity-[a-z]/]',
          message:
            'Entity colours come from the registry: ENTITY_ACCENTS.<entity> in @/lib/entity-accents.',
        },
      ],
    },
  },
  {
    files: ['lib/entity-accents.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  // Ensure temporary build artifacts stay out of lint runs.
  globalIgnores([
    'node_modules/**',
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
])

export default eslintConfig
