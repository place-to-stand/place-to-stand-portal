'use client'

import { useState } from 'react'
import {
  ArrowRight,
  Check,
  ChevronRight,
  Building2,
  User,
  Folder,
  Mail,
  DollarSign,
  Calendar,
  FileText,
  Users,
  Sparkles,
  CheckCircle2,
  FolderPlus,
  Link2,
  Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

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

const steps = [
  { id: 'review', label: 'Review', icon: CheckCircle2 },
  { id: 'client', label: 'Client', icon: Building2 },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'project', label: 'Project', icon: Folder },
  { id: 'setup', label: 'Setup', icon: FolderPlus },
]

export default function LeadConversionCardsPage() {
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
      <div className="p-6">
        <div className="max-w-lg mx-auto text-center">
          <div className="mx-auto mb-6 flex items-center justify-center h-20 w-20 rounded-full bg-green-100 dark:bg-green-900">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Conversion Complete!</h1>
          <p className="text-muted-foreground mb-6">{mockLead.company} is now a client</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline"><Building2 className="h-4 w-4 mr-2" />View Client</Button>
            <Button><Folder className="h-4 w-4 mr-2" />Open Project</Button>
          </div>
        </div>
      </div>
    )
  }

  if (processing) {
    return (
      <div className="p-6">
        <div className="max-w-lg mx-auto text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Converting Lead...</h1>
          <p className="text-muted-foreground">Setting up your new client</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Convert Lead to Client</h1>
            <p className="text-muted-foreground">{mockLead.company} · {mockLead.name}</p>
          </div>
          <Button variant="outline">Cancel</Button>
        </div>

        {/* Progress */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {steps.map((step, idx) => (
                <div key={step.id} className="flex items-center flex-1">
                  <div className={`flex items-center gap-2 p-2 rounded-lg flex-1 ${
                    idx < currentStep ? 'bg-green-100 dark:bg-green-900/30' :
                    idx === currentStep ? 'bg-primary/10' : 'bg-muted/50'
                  }`}>
                    <div className={`p-1.5 rounded-full ${
                      idx < currentStep ? 'bg-green-500 text-white' :
                      idx === currentStep ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}>
                      {idx < currentStep ? <Check className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
                    </div>
                    <span className="text-sm font-medium">{step.label}</span>
                  </div>
                  {idx < steps.length - 1 && <ArrowRight className="h-4 w-4 mx-2 text-muted-foreground" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Step Content */}
        {currentStep === 0 && (
          <div className="grid grid-cols-2 gap-4">
            {/* Lead Summary */}
            <Card className="bg-green-50 dark:bg-green-950/30 border-green-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="font-bold text-green-700 dark:text-green-300">Lead Closed Won!</p>
                    <p className="text-sm text-green-600">Ready to convert</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Company</span>
                    <span className="font-medium">{mockLead.company}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Value</span>
                    <Badge variant="secondary">${mockLead.value.toLocaleString()}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Score</span>
                    <span className="font-medium">{mockLead.score}/100</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contacts */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Contacts ({mockLead.contacts.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {mockLead.contacts.map(contact => (
                  <div key={contact.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">{contact.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{contact.name}</p>
                      <p className="text-xs text-muted-foreground">{contact.title}</p>
                    </div>
                    {contact.primary && <Badge variant="secondary" className="text-xs">Primary</Badge>}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Create Client Record</CardTitle>
              <CardDescription>Set up the new client account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Client Name</Label>
                  <Input defaultValue={mockLead.company} className="mt-1" />
                </div>
                <div>
                  <Label>Billing Type</Label>
                  <Input defaultValue="Net 30" className="mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Migrate Contacts</CardTitle>
              <CardDescription>These contacts will be linked to the new client</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockLead.contacts.map(contact => (
                <div key={contact.id} className="p-4 border rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar><AvatarFallback>{contact.name.split(' ').map(n => n[0]).join('')}</AvatarFallback></Avatar>
                    <div>
                      <p className="font-medium">{contact.name}</p>
                      <p className="text-sm text-muted-foreground">{contact.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch defaultChecked={contact.primary} />
                    <Label className="text-sm">Primary</Label>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Initial Project</CardTitle>
              <CardDescription>Optionally create the first project</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Folder className="h-5 w-5" />
                  <span className="font-medium">Create initial project</span>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Project Name</Label>
                  <Input defaultValue={`${mockLead.company} - Web Application`} className="mt-1" />
                </div>
                <div>
                  <Label>Budget</Label>
                  <Input type="number" defaultValue={mockLead.value} className="mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 4 && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FolderPlus className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="font-medium">Create Google Drive Folders</p>
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

        {/* Navigation */}
        <div className="flex justify-between">
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
      </div>
    </div>
  )
}
