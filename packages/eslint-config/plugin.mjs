/**
 * `pts/*`: the repo's own lint rules. Each one quotes the rule it enforces
 * (a house rule in docs/design-system/README.md, or a past bug) and says what
 * to write instead.
 */
import drizzleQualifiedSubquery from './rules/drizzle-qualified-subquery.mjs'
import {
  datesThroughUi,
  ellipsisCharacter,
  filterSelect,
  gridPhoneColumn,
  noAlignStart,
  noRadix,
  noSizeOverride,
  noTitleTooltip,
  saveNotGatedOnDirty,
  toastCopy,
} from './rules/house-rules.mjs'

export const pts = {
  meta: { name: 'pts' },
  rules: {
    'drizzle-qualified-subquery': drizzleQualifiedSubquery,
    'no-radix': noRadix,
    'no-align-start': noAlignStart,
    'dates-through-ui': datesThroughUi,
    'no-title-tooltip': noTitleTooltip,
    'no-size-override': noSizeOverride,
    'toast-copy': toastCopy,
    'grid-phone-column': gridPhoneColumn,
    'save-not-gated-on-dirty': saveNotGatedOnDirty,
    'ellipsis-character': ellipsisCharacter,
    'filter-select': filterSelect,
  },
}
