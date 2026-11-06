/** README rule 16: keyboard shortcuts come from the registry. */
import { README } from './utils.mjs'

const MODIFIERS = new Set(['metaKey', 'ctrlKey'])
const FUNCTIONS = [
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]
// `e`, `ev`, `evt`, `event`, `keyboardEvent`, `e.nativeEvent`: what a handler
// calls its event. Keeps `col.key` or `row.key` from reading as a key handler.
const EVENT_NAME = /^(e|ev|evt|event)$|Event$/i

function isEventLike(node) {
  if (node.type === 'Identifier') return EVENT_NAME.test(node.name)
  if (node.type === 'MemberExpression' && !node.computed) {
    return EVENT_NAME.test(node.property.name ?? '')
  }
  return false
}

/**
 * README rule 16: every keyboard shortcut is in the registry
 * (lib/keyboard/shortcuts.ts) and matched with `matchesShortcut`, so the
 * shortcuts list (`?`) can't miss one. A function that reads an event's `key`
 * and its `metaKey`/`ctrlKey` (as properties or destructured) is a hand-rolled
 * shortcut. Reading the modifiers alone (⌘-click opens in a new tab) is fine.
 * A modifier helper declared outside the function that reads the key is not
 * caught; review covers that.
 */
export const shortcutRegistry = {
  meta: {
    type: 'problem',
    docs: { description: 'Keyboard shortcuts come from the registry' },
    schema: [],
    messages: {
      handRolled: `README rule 16 (${README}): this reads metaKey/ctrlKey in a key handler. Add the shortcut to SHORTCUTS in @/lib/keyboard/shortcuts and test it with matchesShortcut(event, SHORTCUTS.<id>) from @/lib/keyboard/match, so it shows in the keyboard shortcuts list.`,
    },
  },
  create(context) {
    const stack = []
    const enter = () => stack.push({ modifiers: [], readsKey: false })
    const exit = () => {
      const frame = stack.pop()
      if (frame.readsKey) {
        for (const node of frame.modifiers) {
          context.report({ node, messageId: 'handRolled' })
        }
      } else if (stack.length && frame.modifiers.length) {
        // A nested helper may test modifiers while its caller reads the key.
        stack.at(-1).modifiers.push(...frame.modifiers)
      }
    }
    const listeners = { Program: enter, 'Program:exit': exit }
    for (const type of FUNCTIONS) {
      listeners[type] = enter
      listeners[`${type}:exit`] = exit
    }
    listeners.MemberExpression = node => {
      if (node.computed || node.property.type !== 'Identifier') return
      if (!isEventLike(node.object)) return
      const frame = stack.at(-1)
      if (MODIFIERS.has(node.property.name)) frame.modifiers.push(node)
      if (node.property.name === 'key') frame.readsKey = true
    }
    // `const { key, metaKey } = event` or `({ key, ctrlKey }) => …`
    listeners.ObjectPattern = node => {
      const named = node.properties.filter(
        p => p.type === 'Property' && p.key.type === 'Identifier'
      )
      const modifiers = named.filter(p => MODIFIERS.has(p.key.name))
      const fromEvent =
        node.parent.type === 'VariableDeclarator' &&
        node.parent.init &&
        isEventLike(node.parent.init)
      if (!modifiers.length && !fromEvent) return
      const frame = stack.at(-1)
      frame.modifiers.push(...modifiers)
      if (named.some(p => p.key.name === 'key')) frame.readsKey = true
    }
    return listeners
  },
}
