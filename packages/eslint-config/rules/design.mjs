/**
 * Design-system rules that used to be `(guard: review)` in
 * docs/design-system and can be checked from the source.
 */

const README = 'docs/design-system/README.md'

/** Every string literal under a JSX attribute's value (cn('a', x && 'b')). */
function attributeStrings(attribute) {
  const out = []
  const visit = node => {
    if (!node || typeof node !== 'object') return
    if (node.type === 'Literal' && typeof node.value === 'string') {
      out.push(node.value)
    } else if (node.type === 'TemplateElement') {
      out.push(node.value.raw)
    }
    for (const key of Object.keys(node)) {
      if (key === 'parent') continue
      const child = node[key]
      if (Array.isArray(child)) child.forEach(visit)
      else if (child && typeof child.type === 'string') visit(child)
    }
  }
  visit(attribute?.value)
  return out
}

function elementName(node) {
  const name = node.name
  if (name.type === 'JSXIdentifier') return name.name
  if (name.type === 'JSXMemberExpression') return name.property.name
  return ''
}

function attribute(node, name) {
  return node.attributes.find(
    attr => attr.type === 'JSXAttribute' && attr.name.name === name
  )
}

/** select.md: every floating panel uses the one elevation, shadow-popover. */
export const popoverShadow = {
  meta: {
    type: 'problem',
    docs: { description: 'Floating panels use shadow-popover' },
    schema: [],
    messages: {
      shadow: `components/select.md: "Everything that floats over the page … is popover + border + radius-md + shadow-popover, one elevation token." Drop {{shadow}}; the panel already has shadow-popover.`,
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const name = elementName(node)
        // Sheets and dialogs sit higher (shadow-lg); README → Borders.
        // Their primitives count too: <SheetPrimitive.Popup>.
        const owner =
          node.name.type === 'JSXMemberExpression' ? node.name.object.name : ''
        if (/^(?:Sheet|Dialog|AlertDialog|Drawer)/.test(owner || name)) return
        if (!/(?:Content|Popup|Positioner)$/.test(name)) return
        for (const value of attributeStrings(attribute(node, 'className'))) {
          const match = /(?:^|\s)(shadow-(?!popover\b|none\b)[\w-[\]/.]+)/.exec(
            value
          )
          if (match) {
            context.report({
              node,
              messageId: 'shadow',
              data: { shadow: match[1] },
            })
          }
        }
      },
    }
  },
}

const FIGURE_CALLS = new Set(['formatCurrency', 'formatHours', 'formatPercent'])

/** A figure printed straight into the cell: `{formatCurrency(n)}`. */
function callsFigure(node) {
  return node.children.some(
    child =>
      child.type === 'JSXExpressionContainer' &&
      child.expression.type === 'CallExpression' &&
      child.expression.callee.type === 'Identifier' &&
      FIGURE_CALLS.has(child.expression.callee.name)
  )
}

/** Only literal classes can be read; a shared constant is trusted. */
function literalOnly(attr) {
  if (!attr?.value) return true
  if (attr.value.type === 'Literal') return true
  const expression = attr.value.expression
  return (
    expression?.type === 'Literal' ||
    (expression?.type === 'TemplateLiteral' &&
      expression.expressions.length === 0)
  )
}

/** table.md: figures in a table are right-aligned with tabular-nums. */
export const figureCellAligned = {
  meta: {
    type: 'problem',
    docs: { description: 'Table figures are right-aligned with tabular-nums' },
    schema: [],
    messages: {
      align:
        'components/table.md: "Numbers (money, hours, counts) are right-aligned with tabular-nums." Add text-right tabular-nums to this TableCell.',
    },
  },
  create(context) {
    return {
      JSXElement(node) {
        if (elementName(node.openingElement) !== 'TableCell') return
        if (!callsFigure(node)) return
        const classAttr = attribute(node.openingElement, 'className')
        if (!literalOnly(classAttr)) return
        const classes = attributeStrings(classAttr).join(' ')
        if (
          !/\btext-right\b/.test(classes) ||
          !/\btabular-nums\b/.test(classes)
        ) {
          context.report({ node: node.openingElement, messageId: 'align' })
        }
      },
    }
  },
}

/** sheet.md: a section is named for what it holds, never "Details". */
export const noDetailsSection = {
  meta: {
    type: 'problem',
    docs: { description: 'No generic "Details" sheet section' },
    schema: [],
    messages: {
      details:
        'components/sheet.md: no generic "Details" heading; name the section for what it holds.',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (elementName(node) !== 'SheetSection') return
        const title = attribute(node, 'title')
        const value =
          title?.value?.type === 'Literal'
            ? title.value.value
            : title?.value?.expression?.value
        if (value === 'Details') context.report({ node, messageId: 'details' })
      },
    }
  },
}

const RAW_SIZE = /(?:^|[\s:])text-\[\d+(?:\.\d+)?px\]/

/** README → Type: the type roles are utilities; no raw pixel sizes. */
export const noRawTypeSize = {
  meta: {
    type: 'problem',
    docs: { description: 'Text sizes come from the type roles' },
    schema: [],
    messages: {
      raw: `README → Type (${README}): sizes come from the roles (text-micro, text-overline, text-xs, text-sm, …), never text-[Npx]. Brand-ground pages are turned off by file in the eslint config.`,
    },
  },
  create(context) {
    const check = (node, value) => {
      if (RAW_SIZE.test(value)) context.report({ node, messageId: 'raw' })
    }
    return {
      Literal(node) {
        if (typeof node.value === 'string') check(node, node.value)
      },
      TemplateElement(node) {
        check(node, node.value.raw)
      },
    }
  },
}

const UNDERLINES = /(?:^|\s)(?:[\w-]+:)*underline(?:\s|$)/
const TRUNCATE = /(?:^|\s)truncate(?:\s|$)/

const classTokens = node => attributeStrings(attribute(node, 'className'))

/**
 * README → Text links: link text that truncates uses `truncate-link`, never
 * `truncate`, whose overflow: hidden clips the underline so the hover only
 * changes colour (the task card's links did this while the lead card's
 * underlined).
 */
export const underlineNotClipped = {
  meta: {
    type: 'problem',
    docs: { description: 'Underlined link text truncates with truncate-link' },
    schema: [],
    messages: {
      clipped: `README → Text links (${README}): "When the link text truncates, use truncate-link, never truncate": truncate's overflow: hidden clips the underline, so the hover only changes colour. Use truncate-link here, or MetaLink (components/ui/meta-link.tsx) for a card or meta-line link.`,
    },
  },
  create(context) {
    const visitChildren = element => {
      for (const child of element.children ?? []) {
        if (child.type !== 'JSXElement') continue
        const strings = classTokens(child.openingElement)
        if (strings.some(s => TRUNCATE.test(s))) {
          context.report({ node: child.openingElement, messageId: 'clipped' })
        }
        visitChildren(child)
      }
    }
    return {
      JSXElement(element) {
        const strings = classTokens(element.openingElement)
        if (!strings.some(s => UNDERLINES.test(s))) return
        if (strings.some(s => TRUNCATE.test(s))) {
          context.report({ node: element.openingElement, messageId: 'clipped' })
        }
        visitChildren(element)
      },
    }
  },
}
