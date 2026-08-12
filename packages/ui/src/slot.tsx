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
 * - A non-element child renders nothing rather than throwing.
 */

// Stable placeholder so the hook below is never called conditionally. Its
// output is discarded whenever there is no valid child.
const NO_CHILD = <span />

function Slot({
  children,
  ref,
  ...props
}: React.ComponentProps<'span'> & {
  ref?: React.Ref<HTMLElement>
}) {
  const child = React.isValidElement(children) ? children : null

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
