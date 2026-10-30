/**
 * `pts/*`: the repo's own lint rules. Each one quotes the rule it enforces
 * (a house rule in docs/design-system/README.md, or a past bug) and says what
 * to write instead.
 */
import drizzleQualifiedSubquery from './rules/drizzle-qualified-subquery.mjs'

export const pts = {
  meta: { name: 'pts' },
  rules: {
    'drizzle-qualified-subquery': drizzleQualifiedSubquery,
  },
}
