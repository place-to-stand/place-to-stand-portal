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
  Link2,
  FileText,
  Mail,
  Phone,
  Globe,
  DollarSign,
  Calendar,
  Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const mockLead = {
  name: 'Sarah Chen',
  company: 'TechStart Inc',
  email: 'sarah@techstart.io',
  phone: '+1 (415) 555-0123',
  website: 'techstart.io',
  value: 15000,
  score: 82,
  contacts: [
    { id: '1', name: 'Sarah Chen', email: 'sarah@techstart.io', title: 'VP Engineering', primary: true },
    { id: '2', name: 'Mike Johnson', email: 'mike@techstart.io', title: 'CTO', primary: false },
  ],
}

const steps = [
  { id: 'review', label: 'Review Lead', icon: CheckCircle2 },
  { id: 'client', label: 'Create Client', icon: Building2 },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'project', label: 'Project', icon: Folder },
  { id: 'setup', label: 'Setup', icon: FolderPlus },
]

export default function LeadConversionSplitPage() {
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
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left Sidebar - Steps */}
      <div className="w-64 border-r flex flex-col bg-muted/20">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Convert Lead</h2>
          <p className="text-sm text-muted-foreground">{mockLead.company}</p>
        </div>

        <ScrollArea className="flex-1 p-2">
          {steps.map((step, idx) => (
            <button
              key={step.id}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
                idx === currentStep ? 'bg-primary text-primary-foreground' :
                idx < currentStep ? 'text-green-600 hover:bg-muted/50' :
                'text-muted-foreground'
              )}
              onClick={() => idx <= currentStep && setCurrentStep(idx)}
              disabled={idx > currentStep}
            >
              <div className={cn(
                'p-1.5 rounded-full',
                idx === currentStep ? 'bg-primary-foreground/20' :
                idx < currentStep ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'
              )}>
                {idx < currentStep ? <Check className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
              </div>
              <span className="text-sm font-medium">{step.label}</span>
            </button>
          ))}
        </ScrollArea>

        {/* Lead Summary */}
        <div className="p-4 border-t">
          <div className="text-xs text-muted-foreground mb-2">Lead Value</div>
          <div className="text-2xl font-bold text-green-600">${mockLead.value.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground mt-2">Score: {mockLead.score}/100</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {complete ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h1 className="text-xl font-bold mb-2">Conversion Complete!</h1>
              <p className="text-muted-foreground mb-6">{mockLead.company} is now a client</p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline"><Building2 className="h-4 w-4 mr-2" />View Client</Button>
                <Button><Folder className="h-4 w-4 mr-2" />Open Project</Button>
              </div>
            </div>
          </div>
        ) : processing ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="font-medium">Converting Lead...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="p-6 border-b bg-background">
              <h1 className="text-xl font-semibold">{steps[currentStep].label}</h1>
            </div>

            <ScrollArea className="flex-1 p-6">
              {currentStep === 0 && (
                <div className="max-w-2xl space-y-6">
                  <Card className="bg-green-50 dark:bg-green-950/30 border-green-200">
                    <CardContent className="p-4 flex items-center gap-4">
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                      <div>
                        <p className="font-semibold text-green-700">Lead Closed Won!</p>
                        <p className="text-sm text-green-600">Ready to convert to client</p>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Company Info</CardTitle></CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" />{mockLead.company}</div>
                        <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-muted-foreground" />{mockLead.website}</div>
                        <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{mockLead.phone}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Contacts ({mockLead.contacts.length})</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        {mockLead.contacts.map(c => (
                          <div key={c.id} className="flex items-center gap-2 text-sm">
                            <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px]">{c.name.split(' ').map(n => n[0]).join('')}</AvatarFallback></Avatar>
                            <span>{c.name}</span>
                            {c.primary && <Badge variant="secondary" className="text-[10px]">Primary</Badge>}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {currentStep === 1 && (
                <div className="max-w-2xl space-y-4">
                  <div>
                    <Label>Client Name</Label>
                    <Input defaultValue={mockLead.company} className="mt-1" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Website</Label><Input defaultValue={mockLead.website} className="mt-1" /></div>
                    <div><Label>Phone</Label><Input defaultValue={mockLead.phone} className="mt-1" /></div>
                  </div>
                  <div>
                    <Label>Billing Type</Label>
                    <Input defaultValue="Net 30" className="mt-1" />
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea placeholder="Internal notes..." className="mt-1" />
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="max-w-2xl space-y-4">
                  {mockLead.contacts.map(c => (
                    <Card key={c.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <Avatar><AvatarFallback>{c.name.split(' ').map(n => n[0]).join('')}</AvatarFallback></Avatar>
                            <div>
                              <p className="font-medium">{c.name}</p>
                              <p className="text-sm text-muted-foreground">{c.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch defaultChecked={c.primary} />
                            <Label>Primary</Label>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div><Label className="text-xs">Title</Label><Input defaultValue={c.title} className="h-8 mt-1" /></div>
                          <div><Label className="text-xs">Phone</Label><Input placeholder="Phone..." className="h-8 mt-1" /></div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {currentStep === 3 && (
                <div className="max-w-2xl space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Folder className="h-5 w-5" />
                      <span className="font-medium">Create initial project</span>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    <div><Label>Project Name</Label><Input defaultValue={`${mockLead.company} - Web Application`} className="mt-1" /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Budget</Label><Input type="number" defaultValue={mockLead.value} className="mt-1" /></div>
                      <div><Label>Start Date</Label><Input type="date" defaultValue="2025-01-15" className="mt-1" /></div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="max-w-2xl space-y-4">
                  <Card>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FolderPlus className="h-5 w-5 text-amber-500" />
                        <div>
                          <p className="font-medium">Create Drive Folders</p>
                          <p className="text-sm text-muted-foreground">Auto-create folder structure</p>
                        </div>
                      </div>
                      <Switch defaultChecked />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Link2 className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="font-medium">Link Email History</p>
                          <p className="text-sm text-muted-foreground">Move lead emails to client</p>
                        </div>
                      </div>
                      <Switch defaultChecked />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-green-500" />
                        <div>
                          <p className="font-medium">Migrate Documents</p>
                          <p className="text-sm text-muted-foreground">Move lead documents to client</p>
                        </div>
                      </div>
                      <Switch defaultChecked />
                    </CardContent>
                  </Card>
                </div>
              )}
            </ScrollArea>

            <div className="p-4 border-t flex justify-between bg-background">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0}
              >
                Back
              </Button>
              {currentStep < steps.length - 1 ? (
                <Button onClick={() => setCurrentStep(currentStep + 1)}>
                  Continue <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleComplete}>
                  Complete Conversion <Check className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
