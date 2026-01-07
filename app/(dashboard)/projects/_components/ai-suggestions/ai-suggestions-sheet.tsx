'use client'

import { Sparkles, Loader2, Mail, AlertCircle, ArrowLeft, Inbox, CheckCircle2, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

import type { UseAISuggestionsSheetReturn, SuggestionFilterType } from '@/lib/projects/board/state/use-ai-suggestions-sheet'
import { EmailSuggestionCard } from './email-suggestion-card'
import { PRGenerationPrompt } from './pr-generation-prompt'
import { PRPreviewDialog } from './pr-preview-dialog'

type AISuggestionsSheetProps = UseAISuggestionsSheetReturn

export function AISuggestionsSheet({
  isOpen,
  onOpenChange,
  filter,
  onFilterChange,
  emails,
  pendingCount,
  approvedCount,
  rejectedCount,
  unanalyzedCount,
  isLoading,
  isAnalyzing,
  isCreatingTask,
  error,
  onAnalyzeEmails,
  onCreateTask,
  onRejectSuggestion,
  onUnrejectSuggestion,
  // PR generation props
  createdTaskInfo,
  isGeneratingPR,
  isApprovingPR,
  prSuggestion,
  onGeneratePR,
  onApprovePR,
  onDismissPR,
}: AISuggestionsSheetProps) {
  const hasEmails = emails.length > 0
  const showPRPrompt = createdTaskInfo && !prSuggestion
  const showPRPreview = !!prSuggestion
  const showFilters = !showPRPrompt && !showPRPreview

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className='flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[700px]'>
        <SheetHeader className='border-b px-6 py-4'>
          <div className='flex items-center gap-2'>
            <Sparkles className='h-5 w-5 text-fuchsia-500' />
            <SheetTitle>Suggestions</SheetTitle>
          </div>
          <SheetDescription>
            Review task suggestions extracted from client emails
          </SheetDescription>
        </SheetHeader>

        {/* Filter Tabs - below header */}
        {showFilters && (
          <div className='flex flex-wrap items-center gap-2 border-b px-6 py-3'>
            <FilterBadge
              icon={<Inbox className='h-3.5 w-3.5' />}
              label='Pending'
              count={pendingCount}
              isActive={filter === 'pending'}
              onClick={() => onFilterChange('pending')}
            />
            <FilterBadge
              icon={<CheckCircle2 className='h-3.5 w-3.5' />}
              label='Approved'
              count={approvedCount}
              isActive={filter === 'approved'}
              colorClass='text-green-600 dark:text-green-400'
              onClick={() => onFilterChange('approved')}
            />
            <FilterBadge
              icon={<XCircle className='h-3.5 w-3.5' />}
              label='Rejected'
              count={rejectedCount}
              isActive={filter === 'rejected'}
              colorClass='text-red-600 dark:text-red-400'
              onClick={() => onFilterChange('rejected')}
            />
          </div>
        )}

        {/* Action Bar - only shown during PR flow or when there are unanalyzed emails */}
        {(showPRPrompt || showPRPreview || unanalyzedCount > 0) && (
          <div className='flex items-center justify-between border-b px-6 py-3'>
            <div>
              {(showPRPrompt || showPRPreview) && (
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={onDismissPR}
                  className='-ml-2'
                >
                  <ArrowLeft className='mr-1 h-3 w-3' />
                  Back to suggestions
                </Button>
              )}
            </div>
            {!(showPRPrompt || showPRPreview) && unanalyzedCount > 0 && (
              <Button
                variant='default'
                size='sm'
                onClick={onAnalyzeEmails}
                disabled={isAnalyzing}
                className='ml-auto'
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className='mr-1 h-3 w-3 animate-spin' />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className='mr-1 h-3 w-3' />
                    Analyze {unanalyzedCount} email{unanalyzedCount !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant='destructive' className='mx-6 mt-4'>
            <AlertCircle className='h-4 w-4' />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Content */}
        <ScrollArea className='min-h-0 flex-1'>
          <div className='p-6 pb-8'>
            {/* PR Generation Prompt - shown after task creation */}
            {showPRPrompt ? (
              <PRGenerationPrompt
                taskTitle={createdTaskInfo.title}
                repos={createdTaskInfo.githubRepos}
                isGenerating={isGeneratingPR}
                onGenerate={onGeneratePR}
                onSkip={onDismissPR}
              />
            ) : /* PR Preview Dialog - shown after PR generation */
            showPRPreview ? (
              <PRPreviewDialog
                suggestion={prSuggestion}
                isApproving={isApprovingPR}
                onApprove={onApprovePR}
                onCancel={onDismissPR}
              />
            ) : /* Normal content - email suggestions list */
            isLoading ? (
              <div className='flex flex-col items-center justify-center py-12 text-muted-foreground'>
                <Loader2 className='mb-3 h-8 w-8 animate-spin' />
                <p className='text-sm'>Loading suggestions...</p>
              </div>
            ) : hasEmails ? (
              <div className='space-y-4'>
                {emails.map(email => (
                  <EmailSuggestionCard
                    key={email.id}
                    email={email}
                    isCreatingTask={isCreatingTask}
                    onCreateTask={onCreateTask}
                    onReject={onRejectSuggestion}
                    onUnreject={onUnrejectSuggestion}
                    filter={filter}
                  />
                ))}
              </div>
            ) : (
              <EmptyState filter={filter} unanalyzedCount={unanalyzedCount} onAnalyze={onAnalyzeEmails} />
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

function EmptyState({
  filter,
  unanalyzedCount,
  onAnalyze,
}: {
  filter: SuggestionFilterType
  unanalyzedCount: number
  onAnalyze: () => void
}) {
  const messages = {
    pending: {
      title: 'No pending suggestions',
      description: unanalyzedCount > 0
        ? `There are ${unanalyzedCount} unanalyzed email${unanalyzedCount !== 1 ? 's' : ''} that may contain tasks.`
        : 'Link emails to this client to generate task suggestions.',
    },
    approved: {
      title: 'No approved suggestions',
      description: 'Approved suggestions will appear here after you create tasks from them.',
    },
    rejected: {
      title: 'No rejected suggestions',
      description: 'Rejected suggestions will appear here.',
    },
  }

  const { title, description } = messages[filter]

  return (
    <div className='flex flex-col items-center justify-center py-12 text-center'>
      <div className='mb-4 rounded-full bg-muted p-4'>
        <Mail className='h-8 w-8 text-muted-foreground' />
      </div>
      <h3 className='mb-1 font-medium'>{title}</h3>
      <p className='mb-4 text-sm text-muted-foreground'>{description}</p>
      {filter === 'pending' && unanalyzedCount > 0 && (
        <Button onClick={onAnalyze}>
          <Sparkles className='mr-2 h-4 w-4' />
          Analyze Emails
        </Button>
      )}
    </div>
  )
}

// Filter badge component for clickable status filters
function FilterBadge({
  icon,
  label,
  count,
  isActive,
  colorClass,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  count: number
  isActive: boolean
  colorClass?: string
  onClick: () => void
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all',
        isActive
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-muted',
        colorClass && !isActive && colorClass
      )}
    >
      {icon}
      <span>{label}</span>
      <span
        className={cn(
          'ml-1 rounded-full px-1.5 py-0.5 text-xs',
          isActive
            ? 'bg-primary/20 text-primary'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {count}
      </span>
    </button>
  )
}
