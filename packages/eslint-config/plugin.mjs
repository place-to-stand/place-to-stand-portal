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
  onePagePanel,
  optionalLabel,
  sheetUrlThroughBuilders,
} from './rules/guards.mjs'
import { shortcutRegistry } from './rules/shortcuts.mjs'
import {
  sheetLayerZ,
  sheetParamThroughStack,
  useIdNotFixedId,
} from './rules/sheets.mjs'
import {
  figureCellAligned,
  noDetailsSection,
  noRawTypeSize,
  popoverShadow,
  sheetLinkInPlace,
  underlineNotClipped,
} from './rules/design.mjs'
import { clientBoundary, queryLayerPurity } from './rules/layering.mjs'
import { fixedTableColumns } from './rules/table-columns.mjs'

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
    'one-page-panel': onePagePanel,
    'popover-shadow': popoverShadow,
    'figure-cell-aligned': figureCellAligned,
    'fixed-table-columns': fixedTableColumns,
    'no-details-section': noDetailsSection,
    'no-raw-type-size': noRawTypeSize,
    'underline-not-clipped': underlineNotClipped,
    'sheet-link-in-place': sheetLinkInPlace,
    'sheet-url-through-builders': sheetUrlThroughBuilders,
    'sheet-param-through-stack': sheetParamThroughStack,
    'sheet-layer-z': sheetLayerZ,
    'use-id-not-fixed-id': useIdNotFixedId,
    'shortcut-registry': shortcutRegistry,
    'no-hard-delete': noHardDelete,
    'optional-label': optionalLabel,
    'env-through-schema': envThroughSchema,
  },
}
