'use client'

import { useCallback } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { useFieldArray } from 'react-hook-form'
import {
  Layers,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  GripVertical,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import type { ProposalFormValues } from '../proposal-builder'

type PhasesSectionProps = {
  form: UseFormReturn<ProposalFormValues>
}

export function PhasesSection({ form }: PhasesSectionProps) {
  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'phases',
  })

  const handleAddPhase = useCallback(() => {
    append({
      index: fields.length + 1,
      title: '',
      purpose: '',
      deliverables: [''],
      isOpen: true,
    })
  }, [append, fields.length])

  const handleTogglePhase = useCallback(
    (index: number) => {
      const phase = fields[index]
      if (phase) {
        update(index, { ...phase, isOpen: !phase.isOpen })
      }
    },
    [fields, update]
  )

  const handleAddDeliverable = useCallback(
    (phaseIndex: number) => {
      const phase = fields[phaseIndex]
      if (phase) {
        update(phaseIndex, {
          ...phase,
          deliverables: [...phase.deliverables, ''],
        })
      }
    },
    [fields, update]
  )

  const handleRemoveDeliverable = useCallback(
    (phaseIndex: number, deliverableIndex: number) => {
      const phase = fields[phaseIndex]
      if (phase && phase.deliverables.length > 1) {
        update(phaseIndex, {
          ...phase,
          deliverables: phase.deliverables.filter(
            (_, i) => i !== deliverableIndex
          ),
        })
      }
    },
    [fields, update]
  )

  const handleUpdateDeliverable = useCallback(
    (phaseIndex: number, deliverableIndex: number, value: string) => {
      const phase = fields[phaseIndex]
      if (phase) {
        const newDeliverables = [...phase.deliverables]
        newDeliverables[deliverableIndex] = value
        update(phaseIndex, { ...phase, deliverables: newDeliverables })
      }
    },
    [fields, update]
  )

  return (
    <Collapsible defaultOpen>
      <div className="rounded-lg border">
        <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Phases</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {fields.length}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=closed]_&]:rotate-[-90deg]" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-3 border-t p-4">
            {fields.map((phase, phaseIndex) => (
              <Collapsible
                key={phase.id}
                open={phase.isOpen !== false}
                onOpenChange={() => handleTogglePhase(phaseIndex)}
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
                        Phase {phaseIndex + 1}:{' '}
                        {form.watch(`phases.${phaseIndex}.title`) ||
                          '(untitled)'}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={e => {
                          e.stopPropagation()
                          remove(phaseIndex)
                        }}
                        disabled={fields.length <= 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="space-y-3 border-t p-3">
                      {/* Phase Title */}
                      <div className="space-y-1.5">
                        <Label
                          htmlFor={`phase-${phaseIndex}-title`}
                          className="text-xs"
                        >
                          Phase Title
                        </Label>
                        <Input
                          id={`phase-${phaseIndex}-title`}
                          placeholder="e.g., Discovery & Scoping"
                          className="h-8 text-sm"
                          {...form.register(`phases.${phaseIndex}.title`)}
                        />
                      </div>

                      {/* Phase Purpose */}
                      <div className="space-y-1.5">
                        <Label
                          htmlFor={`phase-${phaseIndex}-purpose`}
                          className="text-xs"
                        >
                          Purpose
                        </Label>
                        <Textarea
                          id={`phase-${phaseIndex}-purpose`}
                          placeholder="Describe the purpose of this phase..."
                          className="min-h-[60px] text-sm"
                          {...form.register(`phases.${phaseIndex}.purpose`)}
                        />
                      </div>

                      {/* Deliverables */}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Deliverables</Label>
                        <div className="space-y-2">
                          {phase.deliverables.map(
                            (deliverable, deliverableIndex) => (
                              <div
                                key={deliverableIndex}
                                className="flex items-center gap-2"
                              >
                                <span className="text-xs text-muted-foreground">
                                  •
                                </span>
                                <Input
                                  value={deliverable}
                                  onChange={e =>
                                    handleUpdateDeliverable(
                                      phaseIndex,
                                      deliverableIndex,
                                      e.target.value
                                    )
                                  }
                                  placeholder="Deliverable item"
                                  className="h-8 flex-1 text-sm"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                  onClick={() =>
                                    handleRemoveDeliverable(
                                      phaseIndex,
                                      deliverableIndex
                                    )
                                  }
                                  disabled={phase.deliverables.length <= 1}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleAddDeliverable(phaseIndex)}
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
              onClick={handleAddPhase}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Phase
            </Button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
