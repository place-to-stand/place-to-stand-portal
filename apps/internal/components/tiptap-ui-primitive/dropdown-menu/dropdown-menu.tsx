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
  ...props
}: MenuPrimitive.Item.Props & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) {
    return (
      <MenuPrimitive.Item
        render={children as React.ReactElement<Record<string, unknown>>}
        {...props}
      />
    )
  }

  return <MenuPrimitive.Item {...props}>{children}</MenuPrimitive.Item>
}

type PopupWithPortalProps = Omit<MenuPrimitive.Popup.Props, "className"> &
  Pick<MenuPrimitive.Positioner.Props, "align" | "side" | "sideOffset"> & {
    // Base UI also accepts a state callback here; every consumer passes a
    // plain string, and cn() only takes strings.
    className?: string
    /**
     * Accepted for API compatibility with the Radix version. Base UI requires
     * a Portal around the Positioner, so this no longer toggles portalling —
     * an object value still forwards props to the Portal. Both consumers
     * defaulted to `false` and neither overrode it, and Base UI positions the
     * popup with fixed coordinates anchored to the trigger, so the rendered
     * result is unchanged apart from no longer being clippable by the
     * toolbar's overflow.
     */
    portal?: boolean | MenuPrimitive.Portal.Props
  }

function DropdownMenuSubContent({
  className,
  portal = true,
  ...props
}: PopupWithPortalProps) {
  return renderPopup({
    className: cn("tiptap-dropdown-menu", className),
    portal,
    props,
  })
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  portal = false,
  ...props
}: PopupWithPortalProps) {
  return renderPopup({
    className: cn("tiptap-dropdown-menu", className),
    portal,
    props: { sideOffset, ...props },
  })
}

/**
 * Base UI splits Radix's single Content into Portal > Positioner > Popup. All
 * three are mandatory — rendering a Positioner outside a Portal throws
 * "<Menu.Portal> is missing" at render time, which is what the SSR smoke
 * harness caught when this kept Radix's optional-portal shape.
 */
function renderPopup({
  className,
  portal,
  props,
}: {
  className: string
  portal: boolean | MenuPrimitive.Portal.Props
  props: Omit<MenuPrimitive.Popup.Props, "className"> &
    Pick<MenuPrimitive.Positioner.Props, "align" | "side" | "sideOffset">
}) {
  const { align, side, sideOffset, ...popupProps } = props

  return (
    <DropdownMenuPortal {...(typeof portal === "object" ? portal : {})}>
      <MenuPrimitive.Positioner
        align={align}
        side={side}
        sideOffset={sideOffset}
        className="pointer-events-auto isolate z-50 outline-none"
      >
        <MenuPrimitive.Popup className={className} {...popupProps} />
      </MenuPrimitive.Positioner>
    </DropdownMenuPortal>
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
