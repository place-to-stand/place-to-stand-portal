'use client'

import type { UseFormReturn } from 'react-hook-form'
import { AlertTriangle, Loader2, FileText, Sparkles } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

import type { ProposalTemplateRecord } from '@/lib/queries/proposal-templates'

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
  isEditing?: boolean
  onCancel: () => void
  onBuild: () => void
  onGenerateDraft?: () => void
  existingProposalCount?: number
  existingProposalsFetchFailed?: boolean
  termsTemplates: ProposalTemplateRecord[]
}

export function EditorPanel({
  form,
  isBuilding,
  isGenerating,
  isEditing = false,
  onCancel,
  onBuild,
  onGenerateDraft,
  existingProposalCount = 0,
  existingProposalsFetchFailed = false,
  termsTemplates,
}: EditorPanelProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      {/* Scrollable form content */}
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 overflow-y-auto">
          <div className="space-y-6 p-6">
          {/* Header with Generate Draft button */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Proposal Editor</h2>
              <p className="text-sm text-muted-foreground">
                {onGenerateDraft
                  ? 'Fill in the details or let AI generate a draft'
                  : 'Fill in the proposal details'}
              </p>
            </div>
            {onGenerateDraft && (
              <div className="flex items-center gap-2">
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
            )}
          </div>

          {/* Existing proposal warning */}
          {existingProposalCount > 0 && (
            <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-amber-700 dark:text-amber-400">
                This lead already has {existingProposalCount} proposal
                {existingProposalCount > 1 ? 's' : ''}. Building will create an
                additional proposal.
              </AlertDescription>
            </Alert>
          )}

          {/* Warning when duplicate check couldn't be performed */}
          {existingProposalsFetchFailed && existingProposalCount === 0 && (
            <Alert variant="default" className="border-muted-foreground/30 bg-muted/30">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <AlertDescription className="text-muted-foreground">
                Unable to check for existing proposals. Duplicates may exist.
              </AlertDescription>
            </Alert>
          )}

          <fieldset disabled={isGenerating} className={isGenerating ? 'opacity-60' : ''}>
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
          <RisksSection form={form} termsTemplates={termsTemplates} />

          {/* Rates & Terms */}
          <RatesSection form={form} />
          </fieldset>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex-shrink-0 border-t bg-muted/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isBuilding}>
            Cancel
          </Button>
          <Button type="button" onClick={onBuild} disabled={isBuilding || isGenerating}>
            {isBuilding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEditing ? 'Saving...' : 'Building...'}
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                {isEditing ? 'Update Proposal' : 'Build Proposal'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
