"use client"

import * as React from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { cn } from "@/lib/tiptap-utils"
import "@/components/tiptap-ui-primitive/dropdown-menu/dropdown-menu.scss"

/**
 * Vendored TipTap primitive, rebased from Radix onto Base UI. The export
 * surface and the `tiptap-dropdown-menu` class hook are unchanged, so the
 * editor's SCSS and both consumers (heading, list) keep working as-is.
 *
 * `forwardRef` is gone: React 19 passes `ref` as an ordinary prop, and these
 * wrappers only forwarded it through.
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

type DropdownMenuContentProps = Omit<
  MenuPrimitive.Popup.Props,
  "className"
> &
  Pick<MenuPrimitive.Positioner.Props, "align" | "side" | "sideOffset"> & {
    // Base UI also accepts a state callback here; every consumer passes a
    // plain string, and cn() only takes strings.
    className?: string
  }

function DropdownMenuSubContent({
  className,
  ...props
}: DropdownMenuContentProps) {
  return <MenuPopup className={cn("tiptap-dropdown-menu", className)} {...props} />
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: DropdownMenuContentProps) {
  return (
    <MenuPopup
      className={cn("tiptap-dropdown-menu", className)}
      sideOffset={sideOffset}
      {...props}
    />
  )
}

/**
 * Base UI splits Radix's single Content into Portal > Positioner > Popup, and
 * all three are mandatory.
 *
 * The Radix version took a `portal` prop so the toolbar could render menus in
 * place on desktop. That does not survive the port: the fixed toolbar is an
 * `overflow-x: auto` scroll container, so an in-place popup is clipped by it
 * and anchors against the wrong box. The prop is gone rather than kept as a
 * no-op — a prop that claims to control DOM placement while doing nothing is
 * worse than no prop.
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
        className="pointer-events-auto isolate z-50 outline-none"
      >
        <MenuPrimitive.Popup
          className={className}
          // Restores the Radix version's onCloseAutoFocus preventDefault.
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
