'use client'

import { useCallback } from 'react'
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

export interface Phase {
  index: number
  title: string
  purpose: string
  deliverables: string[]
  isOpen?: boolean
}

interface ProposalPhaseEditorProps {
  phases: Phase[]
  onChange: (phases: Phase[]) => void
}

export function ProposalPhaseEditor({ phases, onChange }: ProposalPhaseEditorProps) {
  const addPhase = useCallback(() => {
    const newPhase: Phase = {
      index: phases.length + 1,
      title: '',
      purpose: '',
      deliverables: [''],
      isOpen: true,
    }
    onChange([...phases, newPhase])
  }, [phases, onChange])

  const updatePhase = useCallback(
    (phaseIndex: number, updates: Partial<Phase>) => {
      const newPhases = phases.map((p, i) =>
        i === phaseIndex ? { ...p, ...updates } : p
      )
      onChange(newPhases)
    },
    [phases, onChange]
  )

  const removePhase = useCallback(
    (phaseIndex: number) => {
      const newPhases = phases
        .filter((_, i) => i !== phaseIndex)
        .map((p, i) => ({ ...p, index: i + 1 }))
      onChange(newPhases)
    },
    [phases, onChange]
  )

  const addDeliverable = useCallback(
    (phaseIndex: number) => {
      const phase = phases[phaseIndex]
      if (!phase) return
      updatePhase(phaseIndex, {
        deliverables: [...phase.deliverables, ''],
      })
    },
    [phases, updatePhase]
  )

  const updateDeliverable = useCallback(
    (phaseIndex: number, deliverableIndex: number, value: string) => {
      const phase = phases[phaseIndex]
      if (!phase) return
      const newDeliverables = [...phase.deliverables]
      newDeliverables[deliverableIndex] = value
      updatePhase(phaseIndex, { deliverables: newDeliverables })
    },
    [phases, updatePhase]
  )

  const removeDeliverable = useCallback(
    (phaseIndex: number, deliverableIndex: number) => {
      const phase = phases[phaseIndex]
      if (!phase || phase.deliverables.length <= 1) return
      const newDeliverables = phase.deliverables.filter((_, i) => i !== deliverableIndex)
      updatePhase(phaseIndex, { deliverables: newDeliverables })
    },
    [phases, updatePhase]
  )

  const togglePhase = useCallback(
    (phaseIndex: number) => {
      const phase = phases[phaseIndex]
      if (!phase) return
      updatePhase(phaseIndex, { isOpen: !phase.isOpen })
    },
    [phases, updatePhase]
  )

  return (
    <div className="space-y-3">
      {phases.map((phase, phaseIndex) => (
        <Collapsible
          key={phaseIndex}
          open={phase.isOpen !== false}
          onOpenChange={() => togglePhase(phaseIndex)}
        >
          <div className="rounded-lg border bg-muted/30">
            <CollapsibleTrigger asChild>
              <div className="flex cursor-pointer items-center gap-2 p-3 hover:bg-muted/50">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                {phase.isOpen !== false ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <span className="flex-1 text-sm font-medium">
                  Phase {phase.index}: {phase.title || '(untitled)'}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={e => {
                    e.stopPropagation()
                    removePhase(phaseIndex)
                  }}
                  disabled={phases.length <= 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="space-y-3 border-t p-3">
                {/* Phase Title */}
                <div className="space-y-1.5">
                  <Label htmlFor={`phase-${phaseIndex}-title`} className="text-xs">
                    Phase Title
                  </Label>
                  <Input
                    id={`phase-${phaseIndex}-title`}
                    value={phase.title}
                    onChange={e => updatePhase(phaseIndex, { title: e.target.value })}
                    placeholder="e.g., Discovery & Scoping"
                    className="h-8 text-sm"
                  />
                </div>

                {/* Phase Purpose */}
                <div className="space-y-1.5">
                  <Label htmlFor={`phase-${phaseIndex}-purpose`} className="text-xs">
                    Purpose
                  </Label>
                  <Textarea
                    id={`phase-${phaseIndex}-purpose`}
                    value={phase.purpose}
                    onChange={e => updatePhase(phaseIndex, { purpose: e.target.value })}
                    placeholder="Describe the purpose of this phase..."
                    className="min-h-[60px] text-sm"
                  />
                </div>

                {/* Deliverables */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Deliverables</Label>
                  <div className="space-y-2">
                    {phase.deliverables.map((deliverable, deliverableIndex) => (
                      <div key={deliverableIndex} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">•</span>
                        <Input
                          value={deliverable}
                          onChange={e =>
                            updateDeliverable(phaseIndex, deliverableIndex, e.target.value)
                          }
                          placeholder="Deliverable item"
                          className="h-8 flex-1 text-sm"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => removeDeliverable(phaseIndex, deliverableIndex)}
                          disabled={phase.deliverables.length <= 1}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => addDeliverable(phaseIndex)}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Add Deliverable
                    </Button>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={addPhase}
      >
        <Plus className="mr-1 h-4 w-4" />
        Add Phase
      </Button>
    </div>
  )
}
