'use client'

import * as React from 'react'
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'

import { cn } from './cn'

/**
 * Tabs on Base UI, with these adapters:
 *
 * 1. `TabsTrigger`/`TabsContent` keep their shadcn names. Base UI calls these
 *    `Tab` and `Panel`.
 * 2. `onValueChange` is declared in method syntax so it stays bivariant.
 *    Base UI's signature is `(value, eventDetails)` while every consumer here
 *    passes `(value: string) => void`; without the bivariance the narrower
 *    handlers stop type-checking.
 * 3. `asChild` maps to Base UI's `render` prop. The projects board renders its
 *    tabs as `<Link>`s so each tab is a real navigable URL.
 *
 * Selected state is Base UI's `data-active` (never `data-state="active"`):
 * the classes below are written against it, and the inactive hover is
 * `not-data-[active]:` because Base UI emits no inactive marker.
 */

type TabsRootProps = Omit<
  React.ComponentProps<typeof TabsPrimitive.Root>,
  'onValueChange'
> & {
  onValueChange?(value: string, eventDetails?: unknown): void
}

function Tabs({ className, onValueChange, ...props }: TabsRootProps) {
  return (
    <TabsPrimitive.Root
      data-slot='tabs'
      className={cn('flex flex-col gap-2', className)}
      onValueChange={
        onValueChange
          ? (value, eventDetails) => onValueChange(String(value), eventDetails)
          : undefined
      }
      {...props}
    />
  )
}

type TabsListProps = React.ComponentProps<typeof TabsPrimitive.List> & {
  /**
   * `default`: the pill segmented control. `line`: shadcn's underline
   * variant, transparent, with a rule under the active tab.
   */
  variant?: 'default' | 'line'
}

function TabsList({ className, variant = 'default', ...props }: TabsListProps) {
  return (
    <TabsPrimitive.List
      data-slot='tabs-list'
      data-variant={variant}
      className={cn(
        'group/tabs-list text-muted-foreground inline-flex w-fit items-center justify-center',
        variant === 'line'
          ? 'h-9 gap-4 rounded-none bg-transparent p-0'
          : 'bg-muted h-9 rounded-lg p-[3px]',
        className
      )}
      {...props}
    />
  )
}

/**
 * The trigger's classes, exported so a control that only *looks* like a tab
 * (the toolbar's phone tab menu) wears exactly the same pill. Styled against
 * `data-active`: set that attribute to get the selected look.
 */
export const TABS_TRIGGER_CLASS = cn(
  // shadcn v4's trigger with our hover and cursor, styled against Base UI's
  // data-active.
  // Line variant: no pill; a 2px rule marks the active tab.
  'group-data-[variant=line]/tabs-list:data-[active]:border-foreground dark:group-data-[variant=line]/tabs-list:data-[active]:border-foreground group-data-[variant=line]/tabs-list:h-full group-data-[variant=line]/tabs-list:flex-none group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:border-0 group-data-[variant=line]/tabs-list:border-b-2 group-data-[variant=line]/tabs-list:border-transparent group-data-[variant=line]/tabs-list:px-0.5 group-data-[variant=line]/tabs-list:not-data-[active]:hover:bg-transparent group-data-[variant=line]/tabs-list:data-[active]:bg-transparent group-data-[variant=line]/tabs-list:data-[active]:shadow-none dark:group-data-[variant=line]/tabs-list:data-[active]:border-x-0 dark:group-data-[variant=line]/tabs-list:data-[active]:border-t-0 dark:group-data-[variant=line]/tabs-list:data-[active]:bg-transparent',
  "data-[active]:bg-background focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring not-data-[active]:hover:bg-muted/60 not-data-[active]:hover:text-foreground text-foreground dark:text-muted-foreground dark:data-[active]:text-foreground dark:data-[active]:border-input dark:data-[active]:bg-input/30 inline-flex h-[calc(100%-1px)] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 data-[active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
)

type TabsTriggerProps = React.ComponentProps<typeof TabsPrimitive.Tab> & {
  asChild?: boolean
}

function TabsTrigger({
  className,
  asChild = false,
  children,
  ...props
}: TabsTriggerProps) {
  // `render` takes over the element entirely, so the child carries its own
  // content; passing `children` alongside it would double up.
  //
  // nativeButton must follow what actually renders: Base UI defaults it to
  // true, and leaving it true while rendering the board's <Link> anchors makes
  // it treat the element as a real button -- it warns, and drops Space-key
  // activation because an anchor has no native space handling.
  const renderProps =
    asChild && React.isValidElement(children)
      ? { render: children as React.ReactElement, nativeButton: false }
      : { children }

  return (
    <TabsPrimitive.Tab
      data-slot='tabs-trigger'
      {...renderProps}
      className={cn(TABS_TRIGGER_CLASS, className)}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Panel>) {
  return (
    <TabsPrimitive.Panel
      data-slot='tabs-content'
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
