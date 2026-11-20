'use client'

import * as React from 'react'
import { Menu as MenuPrimitive } from '@base-ui/react/menu'
import { cn } from '@/lib/tiptap-utils'
import '@/components/tiptap-ui-primitive/dropdown-menu/dropdown-menu.css'

/**
 * Vendored TipTap dropdown primitive, built on Base UI. It keeps TipTap's
 * export surface and the `tiptap-dropdown-menu` class that
 * dropdown-menu.css styles, for its two consumers (heading, list).
 *
 * No `forwardRef`: React 19 passes `ref` as an ordinary prop.
 */

function DropdownMenu({ ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root {...props} />
}

function DropdownMenuPortal({ ...props }: MenuPrimitive.Portal.Props) {
  return <MenuPrimitive.Portal {...props} />
}

function DropdownMenuTrigger({
  asChild,
  children,
  ...props
}: MenuPrimitive.Trigger.Props & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) {
    return (
      <MenuPrimitive.Trigger
        render={children as React.ReactElement<Record<string, unknown>>}
        {...props}
      />
    )
  }

  return <MenuPrimitive.Trigger {...props}>{children}</MenuPrimitive.Trigger>
}

function DropdownMenuGroup({ ...props }: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group {...props} />
}

function DropdownMenuSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
  return <MenuPrimitive.SubmenuRoot {...props} />
}

function DropdownMenuSubTrigger({
  ...props
}: MenuPrimitive.SubmenuTrigger.Props) {
  return <MenuPrimitive.SubmenuTrigger {...props} />
}

function DropdownMenuRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
  return <MenuPrimitive.RadioGroup {...props} />
}

function DropdownMenuItem({
  asChild,
  children,
  // Menu.Item defaults this to false, unlike Trigger and Tab which default to
  // true. Every asChild consumer here passes a tiptap Button, which renders a
  // real <button>, so the default is wrong for all of them and Base UI logs a
  // mismatch on every item. Overridable for a caller that renders otherwise.
  nativeButton = true,
  ...props
}: MenuPrimitive.Item.Props & { asChild?: boolean; nativeButton?: boolean }) {
  if (asChild && React.isValidElement(children)) {
    return (
      <MenuPrimitive.Item
        nativeButton={nativeButton}
        render={children as React.ReactElement<Record<string, unknown>>}
        {...props}
      />
    )
  }

  return <MenuPrimitive.Item {...props}>{children}</MenuPrimitive.Item>
}

type DropdownMenuContentProps = Omit<MenuPrimitive.Popup.Props, 'className'> &
  Pick<MenuPrimitive.Positioner.Props, 'align' | 'side' | 'sideOffset'> & {
    // Base UI also accepts a state callback here; every consumer passes a
    // plain string, and cn() only takes strings.
    className?: string
  }

function DropdownMenuSubContent({
  className,
  ...props
}: DropdownMenuContentProps) {
  return (
    <MenuPopup className={cn('tiptap-dropdown-menu', className)} {...props} />
  )
}

function DropdownMenuContent({
  className,
  // Left-aligned by default, like every popup (house rule 4).
  align = 'start',
  sideOffset = 4,
  ...props
}: DropdownMenuContentProps) {
  return (
    <MenuPopup
      className={cn('tiptap-dropdown-menu', className)}
      align={align}
      sideOffset={sideOffset}
      {...props}
    />
  )
}

/**
 * Base UI needs all three of Portal > Positioner > Popup.
 *
 * Menus always portal. The fixed toolbar is an `overflow-x: auto` scroll
 * container, so a popup rendered in place would be clipped by it and anchor
 * against the wrong box. Don't add a prop to render in place.
 */
function MenuPopup({
  className,
  align,
  side,
  sideOffset,
  ...popupProps
}: DropdownMenuContentProps & { className: string }) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        align={align}
        side={side}
        sideOffset={sideOffset}
        className='pointer-events-auto isolate z-50 outline-none'
      >
        <MenuPrimitive.Popup
          className={className}
          // These triggers are tabIndex={-1} toolbar buttons, so Base UI's
          // default of focusing the trigger on close would pull the caret out
          // of the document after picking a heading or list style.
          finalFocus={false}
          {...popupProps}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
}
