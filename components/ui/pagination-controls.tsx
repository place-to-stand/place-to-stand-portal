'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

type CursorPaginationProps = {
  mode?: 'cursor'
  hasNextPage: boolean
  hasPreviousPage: boolean
  onNext: () => void
  onPrevious: () => void
  disableAll?: boolean
}

type PagedPaginationProps = {
  mode: 'paged'
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  showCount?: boolean
}

type PaginationControlsProps = CursorPaginationProps | PagedPaginationProps

export function PaginationControls(props: PaginationControlsProps) {
  if (props.mode === 'paged') {
    return <PagedPagination {...props} />
  }
  return <CursorPagination {...props} />
}

function CursorPagination({
  hasNextPage,
  hasPreviousPage,
  onNext,
  onPrevious,
  disableAll = false,
}: CursorPaginationProps) {
  const isPrevDisabled = disableAll || !hasPreviousPage
  const isNextDisabled = disableAll || !hasNextPage

  if (!hasNextPage && !hasPreviousPage) {
    return null
  }

  return (
    <div className='flex justify-end gap-1'>
      <Button
        type='button'
        variant='outline'
        size='icon-sm'
        onClick={onPrevious}
        disabled={isPrevDisabled}
        aria-label='Previous page'
      >
        <ChevronLeft className='size-4' />
      </Button>
      <Button
        type='button'
        variant='outline'
        size='icon-sm'
        onClick={onNext}
        disabled={isNextDisabled}
        aria-label='Next page'
      >
        <ChevronRight className='size-4' />
      </Button>
    </div>
  )
}

/**
 * Generate pagination items with fixed width (9 slots) to prevent layout shifts.
 * Always shows first and last page with ellipsis when needed.
 *
 * Examples (totalPages=20):
 *   Page 1:   [1]  2   3   4   5   6   7  ...  20
 *   Page 5:   1   2   3   4  [5]  6   7  ...  20
 *   Page 6:   1  ...  4   5  [6]  7   8  ...  20
 *   Page 10:  1  ...  8   9 [10] 11  12  ...  20
 *   Page 16:  1  ... 14  15 [16] 17  18  19   20
 *   Page 20:  1  ... 14  15  16  17  18  19  [20]
 */
function generatePaginationItems(
  currentPage: number,
  totalPages: number
): Array<number | 'ellipsis'> {
  const TOTAL_SLOTS = 9

  // For small page counts, show all pages
  if (totalPages <= TOTAL_SLOTS) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  // Near start: show first 7 pages, ellipsis, last
  if (currentPage <= 5) {
    return [1, 2, 3, 4, 5, 6, 7, 'ellipsis', totalPages]
  }

  // Near end: show first, ellipsis, last 7 pages
  if (currentPage >= totalPages - 4) {
    return [
      1,
      'ellipsis',
      totalPages - 6,
      totalPages - 5,
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ]
  }

  // Middle: first, ellipsis, 5 pages centered on current, ellipsis, last
  return [
    1,
    'ellipsis',
    currentPage - 2,
    currentPage - 1,
    currentPage,
    currentPage + 1,
    currentPage + 2,
    'ellipsis',
    totalPages,
  ]
}

function PagedPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  showCount = true,
}: PagedPaginationProps) {
  if (totalPages <= 1) {
    return null
  }

  const paginationItems = generatePaginationItems(currentPage, totalPages)

  const controls = (
    <div className='flex items-center gap-1'>
      <Button
        type='button'
        variant='outline'
        size='icon-sm'
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        aria-label='Previous page'
      >
        <ChevronLeft className='size-4' />
      </Button>
      <div className='flex items-center'>
        {paginationItems.map((item, index) => {
          if (item === 'ellipsis') {
            return (
              <span
                key={`ellipsis-${index}`}
                className='text-muted-foreground px-1.5 py-1 text-sm'
                aria-hidden='true'
              >
                ...
              </span>
            )
          }

          const isActive = currentPage === item
          return (
            <button
              key={item}
              type='button'
              className={`px-2 py-1 text-sm tabular-nums underline-offset-4 transition-colors hover:underline ${
                isActive ? 'font-medium underline' : 'text-muted-foreground'
              }`}
              onClick={() => onPageChange(item)}
              aria-label={`Page ${item}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {item}
            </button>
          )
        })}
      </div>
      <Button
        type='button'
        variant='outline'
        size='icon-sm'
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        aria-label='Next page'
      >
        <ChevronRight className='size-4' />
      </Button>
    </div>
  )

  if (!showCount) {
    return controls
  }

  return (
    <div className='flex items-center justify-between'>
      <p className='text-muted-foreground text-sm tabular-nums'>
        {(currentPage - 1) * pageSize + 1}–
        {Math.min(currentPage * pageSize, totalItems)} of {totalItems}
      </p>
      {controls}
    </div>
  )
}
