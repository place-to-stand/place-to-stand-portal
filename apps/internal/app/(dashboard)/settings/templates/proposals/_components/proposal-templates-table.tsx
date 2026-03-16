'use client'

import { useState, useTransition } from 'react'
import { Archive, Pencil } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { ProposalTemplateRecord } from '@/lib/queries/proposal-templates'
import { cn } from '@/lib/utils'

import { deleteProposalTemplateAction } from '../_actions'

const TYPE_LABELS: Record<ProposalTemplateRecord['type'], string> = {
  TERMS_AND_CONDITIONS: 'Terms & Conditions',
}

type ProposalTemplatesTableProps = {
  templates: ProposalTemplateRecord[]
  onEdit: (template: ProposalTemplateRecord) => void
  onRefresh: () => void
}

export function ProposalTemplatesTable({
  templates,
  onEdit,
  onRefresh,
}: ProposalTemplatesTableProps) {
  const { toast } = useToast()
  const [isDeleting, startDeleteTransition] = useTransition()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState<ProposalTemplateRecord | null>(null)

  const handleDelete = () => {
    if (!templateToDelete) return

    startDeleteTransition(async () => {
      const result = await deleteProposalTemplateAction({ templateId: templateToDelete.id })

      if (!result.success) {
        toast({
          variant: 'destructive',
          title: 'Unable to archive template',
          description: result.error ?? 'Please try again.',
        })
        return
      }

      toast({
        title: 'Template archived',
        description: `"${templateToDelete.name}" has been archived.`,
      })

      setDeleteDialogOpen(false)
      setTemplateToDelete(null)
      onRefresh()
    })
  }

  const openDeleteDialog = (template: ProposalTemplateRecord) => {
    setTemplateToDelete(template)
    setDeleteDialogOpen(true)
  }

  if (templates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">No proposal templates yet.</p>
        <p className="text-muted-foreground text-sm">
          Create a template to customize your proposal terms and conditions.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Sections</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map(template => (
              <TableRow key={template.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{template.name}</span>
                    {template.isDefault && (
                      <Badge variant="secondary" className="text-xs">
                        Default
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <TypeBadge type={template.type} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {template.content.length} section{template.content.length !== 1 ? 's' : ''}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onEdit(template)}
                      title="Edit template"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => openDeleteDialog(template)}
                      title="Archive template"
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Archive template?"
        description={`Are you sure you want to archive "${templateToDelete?.name}"? Existing proposals using this template will not be affected.`}
        confirmLabel={isDeleting ? 'Archiving...' : 'Archive'}
        confirmVariant="destructive"
        confirmDisabled={isDeleting}
        onCancel={() => {
          if (!isDeleting) {
            setDeleteDialogOpen(false)
            setTemplateToDelete(null)
          }
        }}
        onConfirm={handleDelete}
      />
    </>
  )
}

function TypeBadge({ type }: { type: ProposalTemplateRecord['type'] }) {
  const label = TYPE_LABELS[type]

  const colorClass = {
    TERMS_AND_CONDITIONS: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  }[type]

  return (
    <Badge variant="outline" className={cn('text-xs', colorClass)}>
      {label}
    </Badge>
  )
}
