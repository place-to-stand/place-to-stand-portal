'use client'

import { useState } from 'react'
import {
  Check,
  ChevronRight,
  Building2,
  Folder,
  Users,
  CheckCircle2,
  ArrowLeft,
  Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

const mockLead = {
  name: 'Sarah Chen',
  company: 'TechStart Inc',
  email: 'sarah@techstart.io',
  value: 15000,
  score: 82,
  contacts: [
    { id: '1', name: 'Sarah Chen', email: 'sarah@techstart.io', title: 'VP Engineering', primary: true },
    { id: '2', name: 'Mike Johnson', email: 'mike@techstart.io', title: 'CTO', primary: false },
  ],
}

const totalSteps = 5

export default function LeadConversionMinimalPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [complete, setComplete] = useState(false)

  const handleComplete = () => {
    setProcessing(true)
    setTimeout(() => {
      setProcessing(false)
      setComplete(true)
    }, 2000)
  }

  if (complete) {
    return (
      <div className="h-[calc(100vh-4rem)] bg-muted/30">
        <div className="max-w-lg mx-auto h-full flex flex-col bg-white dark:bg-neutral-900">
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <div className="mx-auto mb-6 flex items-center justify-center h-20 w-20 rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Done!</h1>
              <p className="text-muted-foreground mb-6">{mockLead.company} is now a client</p>
              <div className="space-y-3">
                <Button className="w-full rounded-xl"><Folder className="h-4 w-4 mr-2" />Open Project</Button>
                <Button variant="outline" className="w-full rounded-xl"><Building2 className="h-4 w-4 mr-2" />View Client</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (processing) {
    return (
      <div className="h-[calc(100vh-4rem)] bg-muted/30">
        <div className="max-w-lg mx-auto h-full flex flex-col bg-white dark:bg-neutral-900">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="font-medium">Setting up...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-4rem)] bg-muted/30">
      <div className="max-w-lg mx-auto h-full flex flex-col bg-white dark:bg-neutral-900">
        {/* Header */}
        <div className="p-4 flex items-center gap-3 border-b">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => currentStep > 0 && setCurrentStep(currentStep - 1)}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <p className="font-semibold">Convert Lead</p>
            <p className="text-xs text-muted-foreground">{mockLead.company}</p>
          </div>
          <Badge className="bg-green-100 text-green-700">${mockLead.value.toLocaleString()}</Badge>
        </div>

        {/* Progress */}
        <div className="px-4 py-3 border-b">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>Step {currentStep + 1} of {totalSteps}</span>
            <span>{Math.round(((currentStep + 1) / totalSteps) * 100)}%</span>
          </div>
          <Progress value={((currentStep + 1) / totalSteps) * 100} className="h-1.5" />
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {currentStep === 0 && (
              <>
                <div className="p-4 rounded-2xl bg-green-50 dark:bg-green-950/30 text-center">
                  <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="font-semibold text-green-700">Closed Won!</p>
                  <p className="text-sm text-green-600">Ready to convert</p>
                </div>
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-muted/50">
                    <p className="text-xs text-muted-foreground">Company</p>
                    <p className="font-medium">{mockLead.company}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-muted/50">
                    <p className="text-xs text-muted-foreground">Primary Contact</p>
                    <p className="font-medium">{mockLead.name}</p>
                    <p className="text-sm text-muted-foreground">{mockLead.email}</p>
                  </div>
                </div>
              </>
            )}

            {currentStep === 1 && (
              <>
                <h2 className="text-lg font-semibold">Client Details</h2>
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Client Name</Label>
                    <Input defaultValue={mockLead.company} className="mt-1 rounded-xl" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Billing</Label>
                    <Input defaultValue="Net 30" className="mt-1 rounded-xl" />
                  </div>
                </div>
              </>
            )}

            {currentStep === 2 && (
              <>
                <h2 className="text-lg font-semibold">Contacts</h2>
                <div className="space-y-3">
                  {mockLead.contacts.map(c => (
                    <div key={c.id} className="p-4 rounded-2xl bg-muted/50 flex items-center gap-3">
                      <Avatar><AvatarFallback>{c.name.split(' ').map(n => n[0]).join('')}</AvatarFallback></Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-sm text-muted-foreground">{c.title}</p>
                      </div>
                      <Switch defaultChecked={c.primary} />
                    </div>
                  ))}
                </div>
              </>
            )}

            {currentStep === 3 && (
              <>
                <h2 className="text-lg font-semibold">Project</h2>
                <div className="p-4 rounded-2xl bg-muted/50 flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Folder className="h-5 w-5" />
                    <span>Create project</span>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Project Name</Label>
                    <Input defaultValue={`${mockLead.company} - Web App`} className="mt-1 rounded-xl" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Budget</Label>
                    <Input type="number" defaultValue={mockLead.value} className="mt-1 rounded-xl" />
                  </div>
                </div>
              </>
            )}

            {currentStep === 4 && (
              <>
                <h2 className="text-lg font-semibold">Setup Options</h2>
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-muted/50 flex items-center justify-between">
                    <span>Create Drive folders</span>
                    <Switch defaultChecked />
                  </div>
                  <div className="p-4 rounded-2xl bg-muted/50 flex items-center justify-between">
                    <span>Link emails</span>
                    <Switch defaultChecked />
                  </div>
                  <div className="p-4 rounded-2xl bg-muted/50 flex items-center justify-between">
                    <span>Migrate documents</span>
                    <Switch defaultChecked />
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t">
          {currentStep < totalSteps - 1 ? (
            <Button className="w-full rounded-xl" onClick={() => setCurrentStep(currentStep + 1)}>
              Continue <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button className="w-full rounded-xl" onClick={handleComplete}>
              Complete <Check className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
