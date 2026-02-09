'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { ProposalTemplateRecord } from '@/lib/queries/proposal-templates'

import { ProposalTemplatesTable } from './_components/proposal-templates-table'
import { ProposalTemplateSheet } from './_components/proposal-template-sheet'

export default function ProposalTemplatesPage() {
  const [templates, setTemplates] = useState<ProposalTemplateRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ProposalTemplateRecord | null>(null)

  const loadTemplates = useCallback(async () => {
    try {
      const response = await fetch('/api/proposal-templates')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates ?? [])
      }
    } catch (error) {
      console.error('Failed to load templates:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  const handleEdit = (template: ProposalTemplateRecord) => {
    setEditingTemplate(template)
    setSheetOpen(true)
  }

  const handleCreate = () => {
    setEditingTemplate(null)
    setSheetOpen(true)
  }

  const handleSheetClose = (open: boolean) => {
    setSheetOpen(open)
    if (!open) {
      setEditingTemplate(null)
    }
  }

  const handleSuccess = () => {
    loadTemplates()
  }

  return (
    <>
      <section className="bg-background rounded-xl border shadow-sm">
        <div className="flex items-center justify-between p-6 pb-4">
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? 'Loading...'
              : `${templates.length} template${templates.length !== 1 ? 's' : ''}`}
          </p>
          <Button onClick={handleCreate} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        </div>
        <div className="px-6 pb-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading templates...</div>
            </div>
          ) : (
            <ProposalTemplatesTable
              templates={templates}
              onEdit={handleEdit}
              onRefresh={handleSuccess}
            />
          )}
        </div>
      </section>

      <ProposalTemplateSheet
        open={sheetOpen}
        onOpenChange={handleSheetClose}
        template={editingTemplate}
        onSuccess={handleSuccess}
      />
    </>
  )
}
