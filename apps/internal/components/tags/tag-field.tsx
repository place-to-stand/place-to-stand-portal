'use client'

import * as React from 'react'
import { CheckIcon } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@pts/ui/popover'
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { CommandCreateRows } from '@/components/ui/command-create-rows'
import { FieldTrigger } from '@/components/ui/field-trigger'
import {
  normalizeTagName,
  splitTagInput,
  tagKey,
  TAG_NAME_MAX,
  TAGS_PER_RECORD_MAX,
  uniqueTagNames,
  type TagEntity,
} from '@/lib/tags/names'

import { TagBadge } from './tag-badge'
import { useTagOptions } from './use-tag-options'

type TagFieldProps = {
  /** Which kind of record: its tags are offered, never another kind's. */
  entity: TagEntity
  value: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
  /** Set by `FormControl`: the label points at the field. */
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

/**
 * Tags on a record, Shopify-style: open the field and type. Existing tags
 * of this kind are offered (any case matches, so "salon" picks "Salon");
 * Enter or a comma adds what you typed as a new tag. Picks show as badges
 * under the field, each with a × to take it off. Only sets the form value:
 * the sheet saves the list with everything else.
 */
export function TagField({
  entity,
  value,
  onChange,
  disabled,
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
}: TagFieldProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const { data: options = [] } = useTagOptions(entity)

  const selectedKeys = React.useMemo(() => new Set(value.map(tagKey)), [value])
  const full = value.length >= TAGS_PER_RECORD_MAX

  const add = React.useCallback(
    (names: string[]) => {
      // An existing tag keeps its own spelling.
      const spelled = names.map(
        name =>
          options.find(option => tagKey(option.name) === tagKey(name))?.name ??
          normalizeTagName(name).slice(0, TAG_NAME_MAX)
      )
      const next = uniqueTagNames([...value, ...spelled]).slice(
        0,
        TAGS_PER_RECORD_MAX
      )
      if (next.length !== value.length) onChange(next)
    },
    [onChange, options, value]
  )
  const remove = React.useCallback(
    (name: string) =>
      onChange(value.filter(entry => tagKey(entry) !== tagKey(name))),
    [onChange, value]
  )
  const toggle = (name: string) => {
    if (selectedKeys.has(tagKey(name))) remove(name)
    else if (!full) add([name])
  }

  // A comma ends a tag: "salon, spa" adds Salon (or salon) and keeps "spa"
  // in the box.
  const handleQueryChange = (text: string) => {
    if (!text.includes(',')) {
      setQuery(text)
      return
    }
    const parts = text.split(',')
    const rest = parts.pop() ?? ''
    add(splitTagInput(parts.join(',')))
    setQuery(rest.trimStart())
  }

  const typed = normalizeTagName(query)
  const exists = options.some(option => tagKey(option.name) === tagKey(typed))
  const canCreate =
    typed.length > 0 && !exists && !selectedKeys.has(tagKey(typed)) && !full

  return (
    <div className='space-y-2'>
      <Popover
        open={open}
        onOpenChange={next => {
          if (disabled) return
          setOpen(next)
          if (!next) setQuery('')
        }}
        modal
      >
        <PopoverTrigger asChild>
          <FieldTrigger
            id={id}
            role='combobox'
            aria-expanded={open}
            aria-haspopup='listbox'
            aria-describedby={ariaDescribedBy}
            aria-invalid={ariaInvalid}
            disabled={disabled}
            placeholder
            label={full ? `Up to ${TAGS_PER_RECORD_MAX} tags` : 'Add tags…'}
          />
        </PopoverTrigger>
        <PopoverContent
          sideOffset={8}
          className='w-(--radix-popover-trigger-width) min-w-64 p-0'
        >
          <Command>
            <CommandInput
              placeholder='Find or create a tag…'
              className='h-9'
              value={query}
              onValueChange={handleQueryChange}
              maxLength={TAG_NAME_MAX}
            />
            <CommandList className='max-h-[min(60vh,260px)] overflow-y-auto overscroll-contain'>
              {options.length ? (
                <CommandGroup>
                  {options.map(option => {
                    const picked = selectedKeys.has(tagKey(option.name))
                    return (
                      <CommandItem
                        key={option.id}
                        value={option.name}
                        disabled={full && !picked}
                        onSelect={() => {
                          toggle(option.name)
                          setQuery('')
                        }}
                        className='pr-3'
                      >
                        <span className='flex min-w-0 flex-1'>
                          <TagBadge name={option.name} />
                        </span>
                        <span className='text-muted-foreground ml-2 text-xs tabular-nums'>
                          {option.count}
                        </span>
                        {picked ? (
                          <CheckIcon className='ml-2 size-4 shrink-0' />
                        ) : null}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              ) : null}
              {canCreate ? (
                <CommandCreateRows
                  query={typed}
                  entityLabel='tag'
                  onCreate={name => {
                    add([name])
                    setQuery('')
                  }}
                />
              ) : (
                <EmptyLine
                  show={typed.length > 0 && !exists}
                  text={
                    full
                      ? `Up to ${TAGS_PER_RECORD_MAX} tags.`
                      : 'Already added.'
                  }
                />
              )}
              {!options.length && !typed ? (
                <p className='text-muted-foreground px-3 py-6 text-center text-sm'>
                  No tags yet. Type one to create it.
                </p>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value.length ? (
        <ul className='flex flex-wrap gap-1.5' aria-label='Tags'>
          {value.map(name => (
            <li key={tagKey(name)} className='max-w-full'>
              <TagBadge
                name={name}
                disabled={disabled}
                onRemove={disabled ? undefined : () => remove(name)}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function EmptyLine({ show, text }: { show: boolean; text: string }) {
  if (!show) return null
  return (
    <p className='text-muted-foreground px-3 py-6 text-center text-sm'>
      {text}
    </p>
  )
}
