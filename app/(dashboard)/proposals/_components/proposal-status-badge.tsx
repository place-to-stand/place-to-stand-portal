import { CheckCircle, PenLine } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  PROPOSAL_STATUS_CONFIG,
  type ProposalStatusValue,
} from '@/lib/proposals/constants'

type ProposalStatusBadgeProps = {
  status: ProposalStatusValue | string
  countersignedAt?: string | null
}

export function ProposalStatusBadge({ status, countersignedAt }: ProposalStatusBadgeProps) {
  if (status === 'ACCEPTED' && countersignedAt) {
    return (
      <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
        <CheckCircle className="mr-1 h-3 w-3" />
        Fully Executed
      </Badge>
    )
  }

  if (status === 'ACCEPTED' && !countersignedAt) {
    return (
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
          <CheckCircle className="mr-1 h-3 w-3" />
          Accepted
        </Badge>
        <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/20">
          <PenLine className="mr-1 h-3 w-3" />
          Awaiting Countersign
        </Badge>
      </div>
    )
  }

  const config = PROPOSAL_STATUS_CONFIG[status as ProposalStatusValue] ?? PROPOSAL_STATUS_CONFIG.DRAFT
  const StatusIcon = config.icon

  return (
    <Badge variant="outline" className={`text-xs ${config.className}`}>
      <StatusIcon className="mr-1 h-3 w-3" />
      {config.label}
    </Badge>
  )
}
