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
     * `false` keeps the menu in the toolbar's own DOM position; `true` sends
     * it to the document body. RichTextEditor passes `portal={isMobile}`, so
     * this is a live responsive choice, not compatibility baggage.
     */
    portal?: boolean | MenuPrimitive.Portal.Props
  }

function DropdownMenuSubContent({
  className,
  portal = true,
  ...props
}: PopupWithPortalProps) {
  return (
    <MenuPopup
      className={cn("tiptap-dropdown-menu", className)}
      portal={portal}
      {...props}
    />
  )
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  portal = false,
  ...props
}: PopupWithPortalProps) {
  return (
    <MenuPopup
      className={cn("tiptap-dropdown-menu", className)}
      portal={portal}
      sideOffset={sideOffset}
      {...props}
    />
  )
}

/**
 * Base UI splits Radix's single Content into Portal > Positioner > Popup, and
 * all three are mandatory — rendering a Positioner outside a Portal throws
 * "<Menu.Portal> is missing", which the SSR smoke harness caught.
 *
 * That would flatten `portal={false}` into "always portal to body", quietly
 * dropping the desktop/mobile distinction RichTextEditor asks for. Instead the
 * inline case portals into an anchor rendered right here, so the popup keeps
 * its original DOM position while still satisfying Base UI's requirement.
 */
function MenuPopup({
  className,
  portal,
  align,
  side,
  sideOffset,
  ...popupProps
}: PopupWithPortalProps & { className: string }) {
  const [inlineContainer, setInlineContainer] =
    React.useState<HTMLElement | null>(null)

  const renderInline = portal === false

  return (
    <>
      {renderInline ? (
        <span ref={setInlineContainer} data-slot="tiptap-dropdown-anchor" />
      ) : null}
      <MenuPrimitive.Portal
        {...(typeof portal === "object" ? portal : {})}
        // Rendering into the anchor above keeps the menu inline. Until the ref
        // resolves this is null, which Base UI reads as the body — harmless,
        // because the anchor mounts with the closed menu, long before it opens.
        container={renderInline ? inlineContainer : undefined}
      >
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
            // default of focusing the trigger on close would pull the caret
            // out of the document after picking a heading or list style.
            finalFocus={false}
            {...popupProps}
          />
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </>
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
