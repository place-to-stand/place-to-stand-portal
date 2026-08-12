"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { cn } from "@/lib/tiptap-utils"
import "@/components/tiptap-ui-primitive/popover/popover.scss"

/**
 * Vendored TipTap primitive, rebased from Radix onto Base UI. The export
 * surface and the `tiptap-popover` class hook are unchanged, so the editor's
 * SCSS and both consumers (link, color-highlight) keep working as-is.
 */

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root {...props} />
}

function PopoverTrigger({
  asChild,
  children,
  ...props
}: PopoverPrimitive.Trigger.Props & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) {
    return (
      <PopoverPrimitive.Trigger
        render={children as React.ReactElement<Record<string, unknown>>}
        {...props}
      />
    )
  }

  return <PopoverPrimitive.Trigger {...props}>{children}</PopoverPrimitive.Trigger>
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: Omit<PopoverPrimitive.Popup.Props, "className"> &
  Pick<PopoverPrimitive.Positioner.Props, "align" | "sideOffset"> & {
    // Base UI also accepts a state callback here; every consumer passes a
    // plain string, and cn() only takes strings.
    className?: string
  }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        sideOffset={sideOffset}
        className="pointer-events-auto isolate z-50"
      >
        <PopoverPrimitive.Popup
          className={cn("tiptap-popover", className)}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverTrigger, PopoverContent }
