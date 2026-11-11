'use client'

import { CommandGroup, CommandItem } from '@/components/ui/command'
import { CompanyBillingMark } from '@/components/billing/company-billing-mark'
import { ENTITY_ACCENTS, ENTITY_ICONS } from '@/lib/entity-accents'
import {
  PALETTE_GROUPS,
  type PaletteRecord,
  type PaletteSearchResult,
} from '@/lib/command-palette/types'
import { cn } from '@/lib/utils'

/**
 * ⌘K record results: one group per kind of record, every row drawn the same
 * way (coloured icon, title, muted detail) and opening its sheet.
 */
export function CommandPaletteRecords({
  records,
  onSelect,
}: {
  records: PaletteSearchResult | null
  onSelect: (href: string) => void
}) {
  if (!records) return null
  return PALETTE_GROUPS.map(({ key, heading }) => {
    const items = records[key] ?? []
    if (items.length === 0) return null
    return (
      <CommandGroup key={key} heading={heading}>
        {items.map(record => (
          <RecordItem
            key={record.id}
            group={key}
            record={record}
            onSelect={onSelect}
          />
        ))}
      </CommandGroup>
    )
  })
}

function RecordItem({
  group,
  record,
  onSelect,
}: {
  group: string
  record: PaletteRecord
  onSelect: (href: string) => void
}) {
  const Icon = ENTITY_ICONS[record.entity]
  return (
    <CommandItem
      // cmdk filters items by `value` even for server-fetched results — the
      // visible text must be part of it or typing the name hides the match.
      // The id suffix keeps values unique across same-named records.
      value={`${record.title} ${record.detail ?? ''} ${group}-${record.id}`}
      keywords={record.keywords}
      onSelect={() => onSelect(record.href)}
    >
      <Icon
        data-accent=''
        className={cn('size-4', ENTITY_ACCENTS[record.entity].icon)}
      />
      <span className='min-w-0 truncate'>
        {record.title}
        {record.detail ? (
          <span className='text-muted-foreground'> {record.detail}</span>
        ) : null}
      </span>
      {record.entity === 'client' ? (
        <CompanyBillingMark
          billingType={record.billingType ?? null}
          className='ml-auto'
        />
      ) : null}
    </CommandItem>
  )
}
