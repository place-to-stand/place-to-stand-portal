'use client'

import { useState, useTransition } from 'react'
import { MoreHorizontal, Pencil, Star, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { EMAIL_TEMPLATE_CATEGORY_LABELS, type EmailTemplateRecord } from '@/lib/email/templates'
import { cn } from '@/lib/utils'

import { deleteTemplate } from '../_actions'

type TemplateTableProps = {
  templates: EmailTemplateRecord[]
  onEdit: (template: EmailTemplateRecord) => void
}

export function TemplateTable({ templates, onEdit }: TemplateTableProps) {
  const { toast } = useToast()
  const [isDeleting, startDeleteTransition] = useTransition()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState<EmailTemplateRecord | null>(null)

  const handleDelete = () => {
    if (!templateToDelete) return

    startDeleteTransition(async () => {
      const result = await deleteTemplate({ templateId: templateToDelete.id })

      if (!result.success) {
        toast({
          variant: 'destructive',
          title: 'Unable to delete template',
          description: result.error ?? 'Please try again.',
        })
        return
      }

      toast({
        title: 'Template deleted',
        description: `"${templateToDelete.name}" has been deleted.`,
      })

      setDeleteDialogOpen(false)
      setTemplateToDelete(null)
    })
  }

  const openDeleteDialog = (template: EmailTemplateRecord) => {
    setTemplateToDelete(template)
    setDeleteDialogOpen(true)
  }

  if (templates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">No email templates yet.</p>
        <p className="text-muted-foreground text-sm">
          Create your first template to start sending personalized emails to leads.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map(template => (
              <TableRow key={template.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{template.name}</span>
                    {template.isDefault && (
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <CategoryBadge category={template.category} />
                </TableCell>
                <TableCell className="max-w-[300px] truncate text-muted-foreground">
                  {template.subject}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(template)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => openDeleteDialog(template)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete template?"
        description={`Are you sure you want to delete "${templateToDelete?.name}"? This action cannot be undone.`}
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
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

function CategoryBadge({ category }: { category: EmailTemplateRecord['category'] }) {
  const label = EMAIL_TEMPLATE_CATEGORY_LABELS[category]

  const colorClass = {
    FOLLOW_UP: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    PROPOSAL: 'bg-green-500/10 text-green-600 border-green-500/20',
    MEETING: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    INTRODUCTION: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  }[category]

  return (
    <Badge variant="outline" className={cn('text-xs', colorClass)}>
      {label}
    </Badge>
  )
}
