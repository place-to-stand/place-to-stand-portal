import { DollarSign, Send, Eye, CheckCircle } from 'lucide-react'
import type { ProposalWithRelations } from '@/lib/queries/proposals'

type PipelineSummaryProps = {
  proposals: ProposalWithRelations[]
}

export function ProposalsPipelineSummary({ proposals }: PipelineSummaryProps) {
  const stats = {
    draft: proposals.filter(p => p.status === 'DRAFT').length,
    sent: proposals.filter(p => p.status === 'SENT').length,
    viewed: proposals.filter(p => p.status === 'VIEWED').length,
    accepted: proposals.filter(p => p.status === 'ACCEPTED').length,
    rejected: proposals.filter(p => p.status === 'REJECTED').length,
  }

  const pipelineValue = proposals
    .filter(p => ['SENT', 'VIEWED'].includes(p.status))
    .reduce((sum, p) => sum + (parseFloat(p.estimatedValue ?? '0') || 0), 0)

  const wonValue = proposals
    .filter(p => p.status === 'ACCEPTED')
    .reduce((sum, p) => sum + (parseFloat(p.estimatedValue ?? '0') || 0), 0)

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        label="Pipeline Value"
        value={`$${pipelineValue.toLocaleString()}`}
        description={`${stats.sent + stats.viewed} active proposals`}
        icon={DollarSign}
      />
      <SummaryCard
        label="Won"
        value={`$${wonValue.toLocaleString()}`}
        description={`${stats.accepted} accepted`}
        icon={CheckCircle}
        iconClassName="text-green-600"
      />
      <SummaryCard
        label="Awaiting Response"
        value={String(stats.sent + stats.viewed)}
        description={`${stats.viewed} viewed, ${stats.sent} sent`}
        icon={Send}
        iconClassName="text-blue-600"
      />
      <SummaryCard
        label="Drafts"
        value={String(stats.draft)}
        description="Not yet sent"
        icon={Eye}
        iconClassName="text-gray-500"
      />
    </div>
  )
}

function SummaryCard({
  label,
  value,
  description,
  icon: Icon,
  iconClassName,
}: {
  label: string
  value: string
  description: string
  icon: typeof DollarSign
  iconClassName?: string
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 ${iconClassName ?? 'text-muted-foreground'}`} />
      </div>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  )
}
