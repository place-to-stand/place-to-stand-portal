'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { formatPhoneUS, unformatPhone } from '@/lib/utils/phone-format'
import { cn } from '@/lib/utils'

export type PhoneInputProps = Omit<
  React.ComponentProps<typeof Input>,
  'type' | 'onChange' | 'value'
> & {
  value?: string | null
  onChange?: (value: string) => void
  /** Store raw digits (default) or formatted string */
  storeFormatted?: boolean
}

function PhoneInput({
  className,
  value,
  onChange,
  storeFormatted = false,
  ...props
}: PhoneInputProps) {
  // Display formatted value
  const displayValue = React.useMemo(() => {
    const raw = value ?? ''
    return formatPhoneUS(raw)
  }, [value])

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value
      const digits = unformatPhone(inputValue)

      if (onChange) {
        onChange(storeFormatted ? formatPhoneUS(digits) : digits)
      }
    },
    [onChange, storeFormatted]
  )

  return (
    <Input
      type='tel'
      inputMode='numeric'
      autoComplete='tel-national'
      placeholder='(555) 123-4567'
      className={cn(className)}
      value={displayValue}
      onChange={handleChange}
      {...props}
    />
  )
}

export { PhoneInput }
