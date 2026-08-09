'use client'

import * as React from 'react'
import { Select as SelectPrimitive } from '@base-ui/react/select'
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react'

import { cn } from './cn'

type SelectItemEntry = { value: string; label: React.ReactNode }

/**
 * Base UI's `Select.Value` renders the raw value unless the Root receives an
 * `items` map (labels can't be derived from unmounted popup items). Radix
 * renders the selected item's content instead. To preserve Radix semantics for
 * unchanged consumers, walk the JSX tree and collect `SelectItem`
 * value → label pairs.
 */
function collectSelectItems(
  children: React.ReactNode,
  acc: SelectItemEntry[]
): void {
  React.Children.forEach(children, child => {
    if (!React.isValidElement(child)) {
      return
    }

    const props = child.props as {
      value?: unknown
      children?: React.ReactNode
    }

    // Structural match (any element carrying a string `value` inside the
    // Select subtree is an item) rather than `child.type === SelectItem`:
    // identity comparison breaks when the element was created by a second
    // module instance of this file (observed as trigger labels degrading
    // to raw values after hydration).
    if (typeof props.value === 'string') {
      acc.push({ value: props.value, label: props.children })
      return
    }

    if (props.children) {
      collectSelectItems(props.children, acc)
    }
  })
}

/**
 * Radix-compatible control props. Declared in method syntax (bivariant) so
 * consumers passing handlers typed with narrower literal unions — accepted by
 * Radix's own method-syntax props — keep compiling.
 */
interface SelectRadixCompatProps {
  value?: string
  defaultValue?: string
  /** Radix-compatible signature: called with the newly selected string value. */
  onValueChange?(value: string): void
  /** Radix-compatible signature: called with the new open state. */
  onOpenChange?(open: boolean): void
}

type SelectProps = Omit<
  SelectPrimitive.Root.Props<string, false>,
  'value' | 'defaultValue' | 'onValueChange' | 'onOpenChange' | 'items' | 'multiple'
> &
  SelectRadixCompatProps

function Select({
  children,
  onValueChange,
  onOpenChange,
  ...props
}: SelectProps) {
  const items = React.useMemo(() => {
    const acc: SelectItemEntry[] = []
    collectSelectItems(children, acc)
    return acc
  }, [children])

  const handleValueChange = React.useMemo(() => {
    if (!onValueChange) {
      return undefined
    }
    return (value: string | null) => {
      if (typeof value === 'string') {
        onValueChange(value)
      }
    }
  }, [onValueChange])

  const handleOpenChange = React.useMemo(() => {
    if (!onOpenChange) {
      return undefined
    }
    return (open: boolean) => {
      onOpenChange(open)
    }
  }, [onOpenChange])

  return (
    <SelectPrimitive.Root
      data-slot='select'
      items={items}
      onValueChange={handleValueChange}
      onOpenChange={handleOpenChange}
      {...props}
    >
      {children}
    </SelectPrimitive.Root>
  )
}

function SelectGroup({ ...props }: SelectPrimitive.Group.Props) {
  return <SelectPrimitive.Group data-slot='select-group' {...props} />
}

function SelectValue({ children, ...props }: SelectPrimitive.Value.Props) {
  // Radix shows `placeholder` whenever no value is selected, even when a
  // `children` expression is passed (it evaluates to false/null while empty).
  // Base UI only falls back to `placeholder` when `children` is nullish, so
  // normalize falsy non-function children away to keep Radix semantics.
  const resolvedChildren =
    children == null || children === false ? undefined : children

  return (
    <SelectPrimitive.Value data-slot='select-value' {...props}>
      {resolvedChildren}
    </SelectPrimitive.Value>
  )
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: 'sm' | 'default'
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot='select-trigger'
      data-size={size}
      className={cn(
        "border-input data-placeholder:text-muted-foreground [&_svg]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-left text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={<ChevronDownIcon className='size-4 opacity-50' />}
      />
    </SelectPrimitive.Trigger>
  )
}

/**
 * Aliases the Radix CSS variables referenced in class strings onto Base UI's
 * Positioner-provided vars so the existing styles keep working unchanged.
 */
const radixVarAliases = {
  '--radix-select-content-available-height': 'var(--available-height)',
  '--radix-select-content-transform-origin': 'var(--transform-origin)',
  '--radix-select-trigger-width': 'var(--anchor-width)',
} as React.CSSProperties

function SelectContent({
  className,
  children,
  position = 'popper',
  align = 'center',
  alignOffset = 0,
  side = 'bottom',
  sideOffset = 0,
  style,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    'align' | 'alignOffset' | 'side' | 'sideOffset'
  > & {
    /** Radix compatibility: `popper` maps to `alignItemWithTrigger={false}`. */
    position?: 'popper' | 'item-aligned'
  }) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        alignItemWithTrigger={position === 'item-aligned'}
        className='pointer-events-auto isolate z-50'
      >
        <SelectPrimitive.Popup
          data-slot='select-content'
          style={{ ...radixVarAliases, ...style }}
          className={cn(
            'bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fill-mode-forwards data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-(--radix-select-content-available-height) min-w-32 origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border shadow-md',
            position === 'popper' &&
              'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
            className
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List
            className={cn(
              'p-1',
              position === 'popper' &&
                'w-full min-w-(--radix-select-trigger-width) scroll-my-1'
            )}
          >
            {children}
          </SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({ className, ...props }: React.ComponentProps<'div'>) {
  // Plain div, not Select.GroupLabel: Base UI's GroupLabel throws unless
  // nested in <Select.Group>; Radix's SelectLabel worked free-standing.
  // Same runtime-invariant trap as DropdownMenuLabel — presentation only.
  return (
    <div
      data-slot='select-label'
      className={cn('text-muted-foreground px-2 py-1.5 text-xs', className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot='select-item'
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground hover:bg-accent hover:text-accent-foreground [&_svg]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <span className='absolute right-2 flex size-3.5 items-center justify-center'>
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className='size-4' />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot='select-separator'
      className={cn('bg-border pointer-events-none -mx-1 my-1 h-px', className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot='select-scroll-up-button'
      className={cn(
        'flex cursor-default items-center justify-center py-1',
        'bg-popover top-0 z-10 w-full',
        className
      )}
      {...props}
    >
      <ChevronUpIcon className='size-4' />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot='select-scroll-down-button'
      className={cn(
        'flex cursor-default items-center justify-center py-1',
        'bg-popover bottom-0 z-10 w-full',
        className
      )}
      {...props}
    >
      <ChevronDownIcon className='size-4' />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
