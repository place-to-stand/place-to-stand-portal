'use client'

import { useState } from 'react'

import { Calendar } from '@pts/ui/calendar'
import { formatCalendarDate, formatRelativeTime } from '@pts/ui/dates'
import { formatCurrency, formatHours } from '@pts/ui/numbers'
import { DatePicker } from '@/components/ui/date-picker'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import {
  resolveDateRangePreset,
  WEEK_STARTS_ON,
  type CalendarDateRange,
} from '@/lib/dates/calendar-date'

import { Code, DesignSection, Example, Specimen } from './specimen'

// Fixed sample instants so server and client render the same text.
const SAMPLE_DATE = '2026-09-23'
const SAMPLE_TIMESTAMP = '2026-09-23T17:45:00Z'

export function ComponentsDates() {
  const [due, setDue] = useState<string>(SAMPLE_DATE)
  const [range, setRange] = useState<CalendarDateRange>(() =>
    resolveDateRangePreset('this-month')
  )
  const [day, setDay] = useState<Date | undefined>(() => new Date(2026, 8, 23))
  const [now] = useState(() => new Date())

  return (
    <DesignSection
      id='dates'
      title='Dates and numbers'
      when='DatePicker for one calendar date, DateRangePicker for list filters. Format every date with formatCalendarDate ("Sep 23, 2026") and relative time with formatRelativeTime; never toLocaleDateString. Hours and money go through formatHours and formatCurrency (@pts/ui/numbers) in pages, emails, PDFs and notifications alike; the lint fails on a hand-rolled copy.'
    >
      <Specimen
        label='Pickers'
        className='grid grid-cols-1 gap-6 md:grid-cols-2'
      >
        <Example
          caption={`DatePicker · value ${due || '""'}`}
          className='[&>div]:w-full'
        >
          <DatePicker
            value={due}
            onChange={setDue}
            clearLabel='due date'
            aria-label='Due date'
          />
        </Example>
        <Example caption={`DateRangePicker · ${range.from} → ${range.to}`}>
          <DateRangePicker value={range} onChange={setRange} />
        </Example>
      </Specimen>

      <Specimen
        label='Calendar and formatting'
        className='grid grid-cols-1 items-start gap-6 md:grid-cols-[auto_minmax(0,1fr)]'
      >
        <div className='w-fit rounded-lg border'>
          <Calendar
            mode='single'
            selected={day}
            onSelect={setDay}
            defaultMonth={new Date(2026, 8, 1)}
            weekStartsOn={WEEK_STARTS_ON}
          />
        </div>
        <dl className='grid grid-cols-1 gap-4 text-sm sm:grid-cols-2'>
          <Format
            call={`formatCalendarDate('${SAMPLE_DATE}')`}
            result={formatCalendarDate(SAMPLE_DATE)}
          />
          <Format
            call='formatCalendarDate(timestamp)'
            result={formatCalendarDate(SAMPLE_TIMESTAMP)}
          />
          <Format
            call="{ month: 'long', year: 'numeric' }"
            result={formatCalendarDate(SAMPLE_DATE, {
              month: 'long',
              year: 'numeric',
            })}
          />
          <Format
            call='formatRelativeTime(timestamp)'
            result={formatRelativeTime(SAMPLE_TIMESTAMP, now)}
          />
        </dl>
      </Specimen>

      <Specimen
        label='Hours and money'
        note='@pts/ui/numbers'
        className='block'
      >
        <dl className='grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4'>
          <Format call='formatHours(1.5)' result={formatHours(1.5)} />
          <Format call='formatHours(1250.256)' result={formatHours(1250.256)} />
          <Format
            call='formatHours(-2, { signed: true })'
            result={formatHours(-2, { signed: true })}
          />
          <Format call="formatHours('0')" result={formatHours('0')} />
          <Format call='formatCurrency(1234)' result={formatCurrency(1234)} />
          <Format
            call="formatCurrency('-12.5')"
            result={formatCurrency('-12.5')}
          />
          <Format
            call='formatCurrency(40, { signed: true })'
            result={formatCurrency(40, { signed: true })}
          />
          <Format
            call='formatCurrency(1234.5, { cents: false })'
            result={formatCurrency(1234.5, { cents: false })}
          />
        </dl>
      </Specimen>
    </DesignSection>
  )
}

function Format({ call, result }: { call: string; result: string | null }) {
  return (
    <div className='space-y-1'>
      <dt>
        <Code>{call}</Code>
      </dt>
      <dd className='font-medium'>{result}</dd>
    </div>
  )
}

export function ComponentsRichText() {
  const [value, setValue] = useState(
    '<p>Kickoff call notes. <strong>Scope</strong> agreed: a pricing page and a <a href="https://placetostandagency.com">new site</a>.</p><ul><li>Send the proposal</li><li>Book the design review</li></ul>'
  )
  return (
    <DesignSection
      id='rich-text'
      title='Rich text'
      when='Long-form content people format: task descriptions, lead notes, update emails. Inside a sheet, pass undoRedo={false} so the sheet’s own history owns ⌘Z.'
    >
      <Specimen
        label='RichTextEditor'
        note='TipTap; HTML in, HTML out'
        className='block overflow-x-auto'
      >
        <RichTextEditor
          value={value}
          onChange={setValue}
          placeholder='Write a note…'
          contentMinHeightClassName='min-h-32'
        />
      </Specimen>
    </DesignSection>
  )
}
