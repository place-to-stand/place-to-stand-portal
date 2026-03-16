'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  FolderKanban,
  X,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  HelpCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { ThreadSummary } from '@/lib/types/messages'

type Project = {
  id: string
  name: string
}

type ProjectSuggestion = {
  projectId: string
  projectName: string
  confidence: number
  reasoning?: string
  matchType?: 'NAME' | 'CONTENT' | 'CONTEXTUAL'
}

type ThreadProjectLinkingPanelProps = {
  thread: ThreadSummary
  projects: Project[]
  suggestions: ProjectSuggestion[]
  suggestionsLoading: boolean
  isLinking: boolean
  onLinkProject: (projectId: string) => void
  onUnlinkProject: () => void
}

export function ThreadProjectLinkingPanel({
  thread,
  projects,
  suggestions,
  suggestionsLoading,
  isLinking,
  onLinkProject,
  onUnlinkProject,
}: ThreadProjectLinkingPanelProps) {
  const [selectedProject, setSelectedProject] = useState('')
  const [isManualOpen, setIsManualOpen] = useState(false)

  // Filter out already-linked project from options
  const availableProjects = thread.project
    ? projects.filter(p => p.id !== thread.project?.id)
    : projects

  const handleLinkFromSuggestion = (projectId: string) => {
    onLinkProject(projectId)
    setSelectedProject('')
  }

  const handleLinkFromManual = () => {
    if (selectedProject) {
      onLinkProject(selectedProject)
      setSelectedProject('')
      setIsManualOpen(false)
    }
  }

  return (
    <div className='space-y-3'>
      {/* Section Header */}
      <div className='flex items-center gap-2'>
        <FolderKanban className='text-muted-foreground h-4 w-4' />
        <span className='text-sm font-medium'>Project Association</span>
      </div>

      {/* Current Link Status */}
      {thread.project ? (
        <div className='bg-muted/30 rounded-lg border p-2'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <FolderKanban className='h-4 w-4 text-emerald-500' />
              {thread.project.slug ? (
                <Link
                  href={`/projects/${thread.project.clientSlug ?? thread.project.id}/${thread.project.slug}/board`}
                  className='hover:text-primary font-medium underline-offset-4 hover:underline'
                >
                  {thread.project.name}
                </Link>
              ) : (
                <span className='font-medium'>{thread.project.name}</span>
              )}
              <Badge variant='secondary' className='text-xs'>
                Linked
              </Badge>
            </div>
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={onUnlinkProject}
              disabled={isLinking}
            >
              {isLinking ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                <X className='h-4 w-4' />
              )}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* AI Suggestions */}
          <div className='space-y-2'>
            <div className='text-muted-foreground flex items-center gap-2 text-xs'>
              <Sparkles className='h-3 w-3' />
              <span>Suggestions</span>
            </div>

            {suggestionsLoading ? (
              <div className='bg-muted/30 flex items-center gap-2 rounded-lg border p-3'>
                <Loader2 className='text-muted-foreground h-4 w-4 animate-spin' />
                <span className='text-muted-foreground text-sm'>
                  Analyzing...
                </span>
              </div>
            ) : suggestions.length > 0 ? (
              <TooltipProvider delayDuration={200}>
                <div className='space-y-2'>
                  {suggestions.map(s => (
                    <div
                      key={s.projectId}
                      className='bg-muted/30 flex items-center justify-between gap-2 rounded-lg border p-2'
                    >
                      <div className='flex min-w-0 items-center gap-2'>
                        <FolderKanban className='text-muted-foreground h-4 w-4 shrink-0' />
                        <span className='truncate text-sm font-medium'>
                          {s.projectName}
                        </span>
                        <Badge
                          variant={
                            s.confidence >= 0.8 ? 'default' : 'secondary'
                          }
                          className='shrink-0 text-xs'
                        >
                          {Math.round(s.confidence * 100)}%
                        </Badge>
                      </div>
                      <div className='flex shrink-0 items-center gap-1'>
                        <Button
                          size='sm'
                          variant='outline'
                          className='h-7 text-xs'
                          onClick={() => handleLinkFromSuggestion(s.projectId)}
                          disabled={isLinking}
                        >
                          {isLinking ? (
                            <Loader2 className='h-3 w-3 animate-spin' />
                          ) : (
                            'Link'
                          )}
                        </Button>
                        {s.reasoning && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type='button'
                                className='text-muted-foreground hover:text-foreground p-1 transition-colors'
                              >
                                <HelpCircle className='h-4 w-4' />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side='left' className='max-w-xs'>
                              <p className='text-sm'>{s.reasoning}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </TooltipProvider>
            ) : (
              <p className='text-muted-foreground text-sm'>
                No project matches found.
              </p>
            )}
          </div>

          {/* Manual Link - Collapsible */}
          {availableProjects.length > 0 && (
            <Collapsible open={isManualOpen} onOpenChange={setIsManualOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-muted-foreground w-full justify-between text-xs'
                >
                  <span>Link manually</span>
                  {isManualOpen ? (
                    <ChevronUp className='h-3 w-3' />
                  ) : (
                    <ChevronDown className='h-3 w-3' />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className='pt-2'>
                <div className='flex gap-2'>
                  <Select
                    value={selectedProject}
                    onValueChange={setSelectedProject}
                  >
                    <SelectTrigger className='h-8 flex-1 text-sm'>
                      <SelectValue placeholder='Select project...' />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProjects.map(project => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size='sm'
                    className='h-8'
                    onClick={handleLinkFromManual}
                    disabled={!selectedProject || isLinking}
                  >
                    {isLinking ? (
                      <Loader2 className='h-4 w-4 animate-spin' />
                    ) : (
                      'Link'
                    )}
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      )}
    </div>
  )
}
