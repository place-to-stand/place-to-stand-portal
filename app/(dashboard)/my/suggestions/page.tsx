import { requireUser } from '@/lib/auth/session'
import {
  getSuggestions,
  getSuggestionCounts,
  getProjectsForDropdown,
  type SuggestionFilter,
} from '@/lib/data/suggestions'
import { SuggestionsPanel } from './_components/suggestions-panel'

type PageProps = {
  searchParams: Promise<{ filter?: string }>
}

const VALID_FILTERS: SuggestionFilter[] = ['pending', 'approved', 'rejected', 'all']

export default async function SuggestionsPage({ searchParams }: PageProps) {
  const user = await requireUser()

  const params = await searchParams
  const filterParam = params.filter
  const filter: SuggestionFilter = filterParam && VALID_FILTERS.includes(filterParam as SuggestionFilter)
    ? (filterParam as SuggestionFilter)
    : 'pending'

  const [suggestions, counts, projects] = await Promise.all([
    getSuggestions({ limit: 50, filter, userId: user.id }),
    getSuggestionCounts({ userId: user.id }),
    getProjectsForDropdown(),
  ])

  return (
    <SuggestionsPanel
      initialSuggestions={suggestions}
      initialCounts={counts}
      projects={projects}
      currentFilter={filter}
    />
  )
}
