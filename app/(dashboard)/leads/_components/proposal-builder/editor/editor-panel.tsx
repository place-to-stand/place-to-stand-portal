'use client'

import type { UseFormReturn } from 'react-hook-form'
import { Loader2, FileText, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import type { ProposalFormValues } from '../proposal-builder'
import { ClientSection } from './client-section'
import { OverviewSection } from './overview-section'
import { PhasesSection } from './phases-section'
import { RisksSection } from './risks-section'
import { RatesSection } from './rates-section'

type EditorPanelProps = {
  form: UseFormReturn<ProposalFormValues>
  isBuilding: boolean
  isGenerating: boolean
  onCancel: () => void
  onBuild: () => void
  onGenerateDraft: () => void
}

export function EditorPanel({
  form,
  isBuilding,
  isGenerating,
  onCancel,
  onBuild,
  onGenerateDraft,
}: EditorPanelProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col border-r">
      {/* Scrollable form content */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-6 p-6">
          {/* Header with Generate Draft button */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Proposal Editor</h2>
              <p className="text-sm text-muted-foreground">
                Fill in the details or let AI generate a draft
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={onGenerateDraft}
                  disabled={isGenerating || isBuilding}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate Draft
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Use AI to generate a proposal draft from lead context</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Proposal Title */}
          <div className="space-y-2">
            <label
              htmlFor="proposal-title"
              className="text-sm font-medium leading-none"
            >
              Proposal Title
            </label>
            <input
              id="proposal-title"
              type="text"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              {...form.register('title')}
            />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>

          {/* Client Information */}
          <ClientSection form={form} />

          {/* Project Overview */}
          <OverviewSection form={form} />

          {/* Phases */}
          <PhasesSection form={form} />

          {/* Risks */}
          <RisksSection form={form} />

          {/* Rates & Terms */}
          <RatesSection form={form} />
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="flex-shrink-0 border-t bg-muted/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onCancel} disabled={isBuilding}>
            Cancel
          </Button>
          <Button onClick={onBuild} disabled={isBuilding}>
            {isBuilding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Building...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Build Proposal
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
