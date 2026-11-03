/**
 * `pts/*`: the repo's own lint rules. Each one quotes the rule it enforces
 * (a house rule in docs/design-system/README.md, or a past bug) and says what
 * to write instead.
 */
import { apiRouteGuard, noRoleLiteral } from './rules/auth.mjs'
import drizzleQualifiedSubquery from './rules/drizzle-qualified-subquery.mjs'
import {
  archiveConfirm,
  datesThroughUi,
  iconButtonTooltip,
  noAlignStart,
  noRadix,
  noSizeOverride,
  noTitleTooltip,
} from './rules/house-rules.mjs'
import {
  ellipsisCharacter,
  filterSelect,
  gridPhoneColumn,
  saveNotGatedOnDirty,
  toastCopy,
} from './rules/house-rules-copy.mjs'
import {
  envThroughSchema,
  noHardDelete,
  noRawColour,
  optionalLabel,
  sheetUrlThroughBuilders,
} from './rules/guards.mjs'
import { clientBoundary, queryLayerPurity } from './rules/layering.mjs'

export const pts = {
  meta: { name: 'pts' },
  rules: {
    'drizzle-qualified-subquery': drizzleQualifiedSubquery,
    'no-radix': noRadix,
    'no-align-start': noAlignStart,
    'dates-through-ui': datesThroughUi,
    'no-title-tooltip': noTitleTooltip,
    'icon-button-tooltip': iconButtonTooltip,
    'archive-confirm': archiveConfirm,
    'no-size-override': noSizeOverride,
    'toast-copy': toastCopy,
    'grid-phone-column': gridPhoneColumn,
    'save-not-gated-on-dirty': saveNotGatedOnDirty,
    'ellipsis-character': ellipsisCharacter,
    'filter-select': filterSelect,
    'client-boundary': clientBoundary,
    'query-layer-purity': queryLayerPurity,
    'api-route-guard': apiRouteGuard,
    'no-role-literal': noRoleLiteral,
    'no-raw-colour': noRawColour,
    'sheet-url-through-builders': sheetUrlThroughBuilders,
    'no-hard-delete': noHardDelete,
    'optional-label': optionalLabel,
    'env-through-schema': envThroughSchema,
  },
}
