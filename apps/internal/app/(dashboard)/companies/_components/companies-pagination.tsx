'use client'

import { PaginationControls } from '@/components/ui/pagination-controls'
import { useListParams } from '@/hooks/use-list-params'

/** The shared page controls and rows-per-page select, `?page=` in the URL. */
export function CompaniesPagination({
  basePath,
  currentPage,
  totalPages,
  totalItems,
  pageSize,
}: {
  basePath: string
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
}) {
  const { update } = useListParams({ basePath, resetKeys: [] })
  return (
    <PaginationControls
      mode='paged'
      currentPage={currentPage}
      totalPages={totalPages}
      totalItems={totalItems}
      pageSize={pageSize}
      onPageChange={page =>
        update({ page: page <= 1 ? undefined : String(page) })
      }
    />
  )
}
