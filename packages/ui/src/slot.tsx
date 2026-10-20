'use client'

import * as React from 'react'
import { useRender } from '@base-ui/react/use-render'

/**
 * Drop-in replacement for Radix's `Slot`, built on Base UI's `useRender`.
 *
 * Every consumer here follows the same shape — `const Comp = asChild ? Slot :
 * 'button'` — so keeping Slot's component form (rather than rewriting each
 * caller to Base UI's `render` prop) leaves all 90-odd `asChild` call sites
 * untouched. It also keeps `asChild` as the app's one composition idiom
 * instead of splitting it across two spellings.
 *
 * `useRender` rather than `mergeProps`: mergeProps documents that it does not
 * merge `ref`, and Slot's whole job includes forwarding a ref through to the
 * child. useRender composes both props and refs.
 *
 * Behavioral notes, matching Radix:
 * - Event handlers compose, className/style merge, other child props win.
 * - A non-element child renders nothing, and logs in development. Radix threw
 *   here; rendering nothing in production is the safer failure for a live app,
 *   but silence would let a malformed child erase a button with no trace, so
 *   the dev build names the problem instead.
 */

// @pts/ui carries no node types; NODE_ENV is inlined by the bundler. The file
// is a module, so this declaration stays module-scoped.
declare const process: { env?: { NODE_ENV?: string } } | undefined

// Stable placeholder so the hook below is never called conditionally. Its
// output is discarded whenever there is no valid child.
const NO_CHILD = <span />

const REACT_LAZY_TYPE = Symbol.for('react.lazy')

type LazyNode = {
  $$typeof: symbol
  _payload: PromiseLike<React.ReactNode>
}

/**
 * When a server component hands this client component a child that is itself
 * a client component (`<Button asChild><Link …/></Button>` in a page), the RSC
 * payload can deliver that child as a lazy node wrapping a pending chunk
 * rather than an element. `isValidElement` rejects it, so without unwrapping,
 * SSR renders nothing while the browser (chunk already resolved) renders the
 * link — a hydration mismatch. Radix's Slot unwraps the same way.
 */
function isLazyNode(node: React.ReactNode): node is React.ReactNode & LazyNode {
  return (
    typeof node === 'object' &&
    node !== null &&
    (node as Partial<LazyNode>).$$typeof === REACT_LAZY_TYPE &&
    typeof (node as Partial<LazyNode>)._payload?.then === 'function'
  )
}

function Slot({
  children: rawChildren,
  ref,
  ...props
}: React.ComponentProps<'span'> & {
  ref?: React.Ref<HTMLElement>
}) {
  // `use` may be called conditionally, unlike the other hooks.
  const children = isLazyNode(rawChildren)
    ? React.use(rawChildren._payload)
    : rawChildren
  const child = React.isValidElement(children) ? children : null

  if (process?.env?.NODE_ENV !== 'production' && children != null && !child) {
    console.error(
      'Slot expected a single React element child (this is what `asChild` ' +
        'forwards props onto), but received %s. Nothing will render.',
      typeof children
    )
  }

  const rendered = useRender({
    render: child ?? NO_CHILD,
    props,
    ref: ref as React.Ref<HTMLSpanElement>,
  })

  return child ? rendered : null
}

/**
 * Namespace alias so `Slot.Root` keeps resolving — that is how sidebar.tsx
 * spells it, matching the shape shadcn's generator emits.
 */
const SlotNamespace = { Root: Slot }

export { Slot, SlotNamespace }
