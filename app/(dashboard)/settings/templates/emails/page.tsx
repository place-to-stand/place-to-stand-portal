'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { EmailTemplateRecord } from '@/lib/email/templates'

import { TemplateTable } from '../_components/template-table'
import { TemplateSheet } from '../_components/template-sheet'

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplateRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplateRecord | null>(null)

  const loadTemplates = useCallback(async () => {
    try {
      const response = await fetch('/api/email-templates')
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

  const handleEdit = (template: EmailTemplateRecord) => {
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
            <TemplateTable templates={templates} onEdit={handleEdit} />
          )}
        </div>
      </section>

      <TemplateSheet
        open={sheetOpen}
        onOpenChange={handleSheetClose}
        template={editingTemplate}
        onSuccess={handleSuccess}
      />
    </>
  )
}
