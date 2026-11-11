/**
 * `pts/class-names`: every check on Tailwind classes, one rule. Each check
 * quotes the design-system rule it enforces and says what to write instead.
 *
 * Checks on any string (classes live in literals, cn() calls and templates):
 *   raw-colour        README → Color: tokens, never a palette shade or hex
 *   raw-type-size     README → Type: the type roles, never text-[Npx]
 *   grid-phone-column House rule 15: a responsive grid writes grid-cols-1
 *   state-attribute   House rule 1: Base UI's attributes, never data-[state=…]
 *   entity-colour     Entities: *-entity-* classes only in the registry
 *                     (on when the `entities` option is set)
 *   page-panel        README → Borders: no copy of PagePanel's classes
 *                     (on when `pagePanel` is true)
 * Checks on an element's className:
 *   popover-shadow    select.md: floating panels keep shadow-popover
 *   size-override     House rule 12 and badge.md: Button, Avatar and Badge
 *                     take their size from the component
 *   underline-clipped README → Text links: truncate-link, never truncate
 *
 * Options: `entities` ('registry' or 'none': the app has an entity registry,
 * or none), `pagePanel` (boolean), and `exceptions`, the files where one check
 * is off: `{ 'raw-colour': ['**\/badge-tints.ts'] }`.
 */
import {
  EXCEPTIONS_SCHEMA,
  README,
  attrValue,
  checkIsOn,
  findAttr,
  jsxName,
  rawStrings,
} from './utils.mjs'

const HUES =
  'red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone'
const COLOUR_UTILITIES =
  'bg|text|border(?:-[trblxyse])?|ring|fill|stroke|from|to|via|shadow|outline|divide|decoration|caret|accent|placeholder'
// `bg-amber-500`, `dark:text-red-300/80`, `border-[#65a30d]/60`
const RAW_PALETTE = new RegExp(
  `(?:^|[\\s:])(?:${COLOUR_UTILITIES})-(?:${HUES})-\\d{2,3}\\b`
)
const RAW_HEX = new RegExp(
  `(?:^|[\\s:])(?:${COLOUR_UTILITIES})-\\[#[0-9a-fA-F]{3,8}\\]`
)
const RAW_SIZE = /(?:^|[\s:])text-\[\d+(?:\.\d+)?px\]/
const ENTITY_CLASS = /(^|[\s:])[a-z-]*-entity-[a-z]/
const PANEL_TOKENS = [/(^|\s)rounded-xl(\s|$)/, /(^|\s)shadow-sm(\s|$)/]

/** House rule 15: a grid with a breakpoint column count but no base one. */
function gridWithoutPhoneColumn(value) {
  const tokens = value.split(/\s+/)
  if (!tokens.includes('grid')) return false
  const responsive = tokens.some(t =>
    /^(?:sm|md|lg|xl|2xl|@[\w/-]*):grid-cols-/.test(t)
  )
  return responsive && !tokens.some(t => /^grid-cols-/.test(t))
}

const SIZE_OVERRIDE = /(?:^|\s)(?:[\w-]+:)*!?(h-(?:\d|\[|px\b)|text-\[[^\]]*\])/
const BADGE_OVERRIDE =
  /(?<![\w:-])(uppercase|lowercase|capitalize|tracking-[\w-]+|font-(?:thin|light|normal|semibold|bold|extrabold|black)|text-(?:\[[^\]]+\]|sm|base|lg|xl|2xs)|h-\d+(?:\.\d+)?|py-\d+(?:\.\d+)?|rounded-(?:none|sm|md|lg|xl))(?![\w-])/

const UNDERLINES = /(?:^|\s)(?:[\w-]+:)*underline(?:\s|$)/
const TRUNCATE = /(?:^|\s)truncate(?:\s|$)/

/** The strings of an element's className, whatever builds it. */
function classStrings(opening) {
  const attr = findAttr(opening, 'className')
  return attr ? rawStrings(attrValue(attr)) : []
}

export const classNames = {
  meta: {
    type: 'problem',
    docs: { description: 'Tailwind classes follow the design system' },
    schema: [
      {
        type: 'object',
        properties: {
          entities: { enum: ['registry', 'none'] },
          pagePanel: { type: 'boolean' },
          exceptions: EXCEPTIONS_SCHEMA,
        },
        additionalProperties: false,
      },
    ],
    messages: {
      'raw-colour': `README → Color (${README}): "never a raw red, green, emerald or amber shade", "never with raw grays", "never their hex values". Use a token: text-destructive, text-warning, bg-muted, border-brand-lime, … The listed exceptions are in the eslint config (pts/class-names exceptions).`,
      'raw-type-size': `README → Type (${README}): sizes come from the roles (text-micro, text-overline, text-xs, text-sm, …), never text-[Npx]. Brand-ground pages are listed in the eslint config (pts/class-names exceptions).`,
      'grid-phone-column': `House rule 15 (${README}): "A responsive grid declares its phone column. Write grid grid-cols-1 lg:grid-cols-2, never a bare grid lg:grid-cols-2" (the implicit column grows to its widest child and pushes the page sideways on a phone). Add grid-cols-1.`,
      'state-attribute': `House rule 1 (${README}): "Don't write data-[state=…]." Style against Base UI's attributes: data-active (tabs), data-checked / data-unchecked (switch, checkbox), data-highlighted / data-open / data-closed (popups).`,
      'entity-registry':
        'Entity colours come from the registry: ENTITY_ACCENTS.<entity> (icon, card, cardStatic, tint, badge, sheetHeader) in @/lib/entity-accents.',
      'entity-none':
        "Entity colours belong to the internal portal's entity registry (apps/internal/lib/entity-accents.ts); this app has none. Use the semantic tokens.",
      'page-panel':
        'This copies the page panel (rounded-xl + shadow-sm). Use <PagePanel> or pagePanelClass from @/components/layout/page-panel.',
      'popover-shadow': `components/select.md: "Everything that floats over the page … is popover + border + radius-md + shadow-popover, one elevation token." Drop {{shadow}}; the panel already has shadow-popover.`,
      'size-override': `House rule 12 (${README}): "Pick a size, don't override it … No h-* or text-[9px] overrides." Drop "{{token}}" from this {{element}} and pass size (Button: xs, sm, default, lg; RowActionButton: icon-sm, icon; Avatar: xs–lg).`,
      'badge-override':
        'components/badge.md: a badge takes its size, weight and case from @pts/ui/badge. Drop "{{token}}"; colour (a status tint or an entity accent) and layout (gap, margin, shrink) are fine.',
      'underline-clipped': `README → Text links (${README}): "When the link text truncates, use truncate-link, never truncate": truncate's overflow: hidden clips the underline, so the hover only changes colour. Use truncate-link here, or MetaLink (components/ui/meta-link.tsx) for a card or meta-line link.`,
    },
  },
  create(context) {
    const { entities, pagePanel = false } = context.options[0] ?? {}
    const on = checkIsOn(context)

    function checkString(node, value) {
      const report = messageId => context.report({ node, messageId })
      if (on('raw-colour') && (RAW_PALETTE.test(value) || RAW_HEX.test(value)))
        report('raw-colour')
      if (on('raw-type-size') && RAW_SIZE.test(value)) report('raw-type-size')
      if (on('grid-phone-column') && gridWithoutPhoneColumn(value))
        report('grid-phone-column')
      if (on('state-attribute') && /data-\[state=/.test(value))
        report('state-attribute')
      if (entities && on('entity-colour') && ENTITY_CLASS.test(value))
        report(`entity-${entities}`)
      if (
        pagePanel &&
        on('page-panel') &&
        PANEL_TOKENS.every(token => token.test(value))
      ) {
        report('page-panel')
      }
    }

    function checkPopoverShadow(node) {
      const name = jsxName(node.name)
      const short = name.split('.').pop()
      // Sheets and dialogs sit higher (shadow-lg); README → Borders.
      // Their primitives count too: <SheetPrimitive.Popup>.
      if (/^(?:Sheet|Dialog|AlertDialog|Drawer)/.test(name)) return
      if (!/(?:Content|Popup|Positioner)$/.test(short)) return
      for (const { value } of classStrings(node)) {
        const match = /(?:^|\s)(shadow-(?!popover\b|none\b)[\w-[\]/.]+)/.exec(
          value
        )
        if (match) {
          context.report({
            node,
            messageId: 'popover-shadow',
            data: { shadow: match[1] },
          })
        }
      }
    }

    function checkSizeOverride(node) {
      const element = jsxName(node.name)
      const badge = element === 'Badge'
      if (!badge && !/^(Button|RowActionButton|Avatar)$/.test(element)) return
      for (const { node: str, value } of classStrings(node)) {
        const match = value.match(badge ? BADGE_OVERRIDE : SIZE_OVERRIDE)
        if (match) {
          context.report({
            node: str,
            messageId: badge ? 'badge-override' : 'size-override',
            data: { token: match[1], element },
          })
        }
      }
    }

    const truncates = opening =>
      classStrings(opening).some(({ value }) => TRUNCATE.test(value))

    function checkUnderline(element) {
      const underlined = classStrings(element.openingElement).some(
        ({ value }) => UNDERLINES.test(value)
      )
      if (!underlined) return
      const visit = el => {
        if (truncates(el.openingElement)) {
          context.report({
            node: el.openingElement,
            messageId: 'underline-clipped',
          })
        }
        for (const child of el.children ?? []) {
          if (child.type === 'JSXElement') visit(child)
        }
      }
      visit(element)
    }

    return {
      Literal(node) {
        if (typeof node.value === 'string') checkString(node, node.value)
      },
      TemplateElement(node) {
        checkString(node, node.value.raw)
      },
      JSXOpeningElement(node) {
        if (on('popover-shadow')) checkPopoverShadow(node)
        if (on('size-override')) checkSizeOverride(node)
      },
      JSXElement(node) {
        if (on('underline-clipped')) checkUnderline(node)
      },
    }
  },
}
