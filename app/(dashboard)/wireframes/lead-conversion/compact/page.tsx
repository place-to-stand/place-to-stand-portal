'use client'

import { useState } from 'react'
import {
  Check,
  ChevronRight,
  Building2,
  Folder,
  Users,
  CheckCircle2,
  FolderPlus,
  Loader2,
  Circle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
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

const steps = ['Review', 'Client', 'Contacts', 'Project', 'Setup']

export default function LeadConversionCompactPage() {
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

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="border-b px-4 py-2 flex items-center justify-between bg-background">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold">Convert Lead</h1>
          <Badge variant="secondary">{mockLead.company}</Badge>
          <Badge className="bg-green-100 text-green-700 border-green-200">${mockLead.value.toLocaleString()}</Badge>
        </div>
        <Button variant="outline" size="sm">Cancel</Button>
      </div>

      {/* Progress Steps */}
      <div className="border-b px-4 py-2 flex items-center gap-1 bg-muted/30">
        {steps.map((step, idx) => (
          <div key={step} className="flex items-center">
            <button
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded text-xs',
                idx < currentStep ? 'text-green-600' :
                idx === currentStep ? 'bg-primary text-primary-foreground' :
                'text-muted-foreground'
              )}
              onClick={() => idx < currentStep && setCurrentStep(idx)}
            >
              {idx < currentStep ? <Check className="h-3 w-3" /> : <span className="font-medium">{idx + 1}</span>}
              <span>{step}</span>
            </button>
            {idx < steps.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground mx-1" />}
          </div>
        ))}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-4">
        {complete ? (
          <div className="text-center py-8">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold mb-1">Conversion Complete!</h2>
            <p className="text-muted-foreground mb-4">{mockLead.company} is now a client</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm"><Building2 className="h-4 w-4 mr-1" />View Client</Button>
              <Button size="sm"><Folder className="h-4 w-4 mr-1" />Open Project</Button>
            </div>
          </div>
        ) : processing ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
            <p className="font-medium">Converting...</p>
          </div>
        ) : (
          <div className="max-w-lg mx-auto space-y-4">
            {currentStep === 0 && (
              <>
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="font-medium text-green-700">Lead Closed Won - Ready to convert</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">Company</span>
                    <p className="font-medium">{mockLead.company}</p>
                  </div>
                  <div className="p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">Primary</span>
                    <p className="font-medium">{mockLead.name}</p>
                  </div>
                  <div className="p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">Email</span>
                    <p className="font-medium">{mockLead.email}</p>
                  </div>
                  <div className="p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">Score</span>
                    <p className="font-medium">{mockLead.score}/100</p>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Contacts</Label>
                  <div className="mt-1 space-y-1">
                    {mockLead.contacts.map(c => (
                      <div key={c.id} className="flex items-center gap-2 p-2 rounded bg-muted/50 text-sm">
                        <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px]">{c.name.split(' ').map(n => n[0]).join('')}</AvatarFallback></Avatar>
                        <span className="flex-1">{c.name} · {c.title}</span>
                        {c.primary && <Badge variant="secondary" className="text-[10px]">Primary</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {currentStep === 1 && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Client Name</Label>
                  <Input defaultValue={mockLead.company} className="h-8 mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Billing Type</Label>
                    <Input defaultValue="Net 30" className="h-8 mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Phone</Label>
                    <Input placeholder="Phone..." className="h-8 mt-1" />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-2">
                {mockLead.contacts.map(c => (
                  <div key={c.id} className="p-3 border rounded-lg flex items-center gap-3">
                    <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{c.name.split(' ').map(n => n[0]).join('')}</AvatarFallback></Avatar>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.email}</p>
                    </div>
                    <Switch defaultChecked={c.primary} />
                    <span className="text-xs text-muted-foreground">Primary</span>
                  </div>
                ))}
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4" />
                    <span className="text-sm font-medium">Create project</span>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div>
                  <Label className="text-xs">Project Name</Label>
                  <Input defaultValue={`${mockLead.company} - Web Application`} className="h-8 mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Budget</Label>
                  <Input type="number" defaultValue={mockLead.value} className="h-8 mt-1" />
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm">Create Drive folders</span>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm">Link email history</span>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm">Migrate documents</span>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                  <span className="text-sm text-muted-foreground">Archive lead record</span>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      {!complete && !processing && (
        <div className="border-t px-4 py-2 flex justify-between bg-background">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
          >
            Back
          </Button>
          {currentStep < steps.length - 1 ? (
            <Button size="sm" onClick={() => setCurrentStep(currentStep + 1)}>
              Continue <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleComplete}>
              Complete <Check className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
