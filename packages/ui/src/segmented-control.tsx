'use client'

import * as React from 'react'
import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'

import { cn } from './cn'

export type SegmentedOption<T extends string> = {
  value: T
  label: React.ReactNode
  disabled?: boolean
}

type SegmentedControlProps<T extends string> = {
  value: T
  onValueChange?: (value: T) => void
  options: readonly SegmentedOption<T>[]
  disabled?: boolean
  /** Names the choice for assistive tech when no visible label points at it. */
  'aria-label'?: string
  'aria-labelledby'?: string
  id?: string
  className?: string
}

/**
 * A one-of-a-few choice that is a form value (not a view): a radio group
 * drawn as the Tabs pill. Each option is a radio (arrow keys move, Space
 * picks), so it binds to a form and applies on Save like any field. To flip
 * what a page or sheet *shows*, use Tabs instead.
 */
function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  disabled = false,
  className,
  ...props
}: SegmentedControlProps<T>) {
  return (
    <RadioGroup
      data-slot='segmented-control'
      value={value}
      onValueChange={next => onValueChange?.(next as T)}
      disabled={disabled}
      className={cn(
        'bg-muted text-muted-foreground inline-flex h-9 w-fit max-w-full items-center rounded-lg p-[3px]',
        className
      )}
      {...props}
    >
      {options.map(option => (
        <Radio.Root
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          data-slot='segmented-control-item'
          className={cn(
            'text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] outline-none select-none',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'not-data-checked:hover:bg-muted/60 not-data-checked:hover:text-foreground',
            'data-checked:bg-background data-checked:shadow-sm dark:data-checked:border-input dark:data-checked:bg-input/30 dark:data-checked:text-foreground',
            'data-disabled:cursor-not-allowed data-disabled:opacity-50 data-disabled:not-data-checked:hover:bg-transparent',
            // The chosen option stays readable when the whole group is locked.
            'data-checked:data-disabled:opacity-80'
          )}
        >
          {option.label}
        </Radio.Root>
      ))}
    </RadioGroup>
  )
}

export { SegmentedControl }
