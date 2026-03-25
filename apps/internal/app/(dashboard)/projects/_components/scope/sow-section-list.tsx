'use client'

import { Badge } from '@/components/ui/badge'

type SowSection = {
  id: string
  headingLevel: number
  headingText: string
  bodyText: string | null
  sectionOrder: number
  firstSeenInVersion: number
}

type SowSectionListProps = {
  sections: SowSection[]
  currentVersion: number
}

export function SowSectionList({
  sections,
  currentVersion,
}: SowSectionListProps) {
  if (sections.length === 0) {
    return (
      <p className='py-4 text-center text-xs text-muted-foreground'>
        No sections parsed from this document.
      </p>
    )
  }

  return (
    <div className='space-y-2'>
      {sections.map(section => {
        const isNew = section.firstSeenInVersion === currentVersion && currentVersion > 1
        const headingClass = getHeadingClass(section.headingLevel)

        return (
          <div
            key={section.id}
            className='rounded-md border px-3 py-2'
          >
            <div className='flex items-center gap-2'>
              <span className={headingClass}>{section.headingText}</span>
              {isNew && (
                <Badge variant='secondary' className='text-[10px]'>
                  New in v{currentVersion}
                </Badge>
              )}
            </div>
            {section.bodyText && (
              <p className='mt-1 line-clamp-2 text-xs text-muted-foreground'>
                {section.bodyText}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function getHeadingClass(level: number): string {
  switch (level) {
    case 1:
      return 'text-sm font-semibold'
    case 2:
      return 'text-xs font-semibold'
    case 3:
      return 'text-xs font-medium'
    default:
      return 'text-xs'
  }
}
