'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type PromoteToClientDialogValues = {
  clientName: string
  projectName: string
  billingType: 'prepaid' | 'net_30'
}

type PromoteToClientDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactName: string
  isPending: boolean
  onSubmit: (values: PromoteToClientDialogValues) => void
}

export function PromoteToClientDialog({
  open,
  onOpenChange,
  contactName,
  isPending,
  onSubmit,
}: PromoteToClientDialogProps) {
  const [clientName, setClientName] = useState(contactName)
  const [projectName, setProjectName] = useState(contactName)
  const [billingType, setBillingType] = useState<'prepaid' | 'net_30'>('prepaid')

  // Reset fields when dialog opens
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setClientName(contactName)
      setProjectName(contactName)
      setBillingType('prepaid')
    }
    onOpenChange(nextOpen)
  }

  const canSubmit = clientName.trim().length > 0 && projectName.trim().length > 0 && !isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    onSubmit({
      clientName: clientName.trim(),
      projectName: projectName.trim(),
      billingType,
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Client</DialogTitle>
            <DialogDescription>
              This will create a new client, an onboarding project, and send a
              portal invite to {contactName}.
            </DialogDescription>
          </DialogHeader>
          <div className='mt-4 flex flex-col gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='promote-client-name'>Client Name</Label>
              <Input
                id='promote-client-name'
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                disabled={isPending}
                autoFocus
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='promote-project-name'>Project Name</Label>
              <Input
                id='promote-project-name'
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='promote-billing-type'>Billing Type</Label>
              <Select
                value={billingType}
                onValueChange={v => setBillingType(v as 'prepaid' | 'net_30')}
                disabled={isPending}
              >
                <SelectTrigger id='promote-billing-type'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='prepaid'>Prepaid</SelectItem>
                  <SelectItem value='net_30'>Net 30</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className='mt-6'>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={!canSubmit}>
              {isPending ? 'Creating...' : 'Create Client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
