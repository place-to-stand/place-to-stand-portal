import type { ActivityFact } from './changes'
import { formatCalendarDate } from '@pts/ui/dates'
import { formatCurrency, formatHours } from '@pts/ui/numbers'

export function formatFact(fact: ActivityFact): string {
  switch (fact.kind) {
    case 'money': {
      const amount = Number(fact.value)
      return Number.isFinite(amount) ? formatCurrency(amount) : fact.value
    }
    case 'hours': {
      const hours = Number(fact.value)
      return Number.isFinite(hours) ? formatHours(hours) : fact.value
    }
    case 'date':
      return formatCalendarDate(fact.value) ?? fact.value
    default:
      return fact.value
  }
}
