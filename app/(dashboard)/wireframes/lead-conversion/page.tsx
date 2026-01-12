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
  Phone,
  Globe,
  MapPin,
  DollarSign,
  Calendar,
  FileText,
  Users,
  Plus,
  X,
  Sparkles,
  CheckCircle2,
  Circle,
  Loader2,
  ExternalLink,
  FolderPlus,
  Link2,
  Settings,
  AlertCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AppShellHeader } from '@/components/layout/app-shell'

// Mock lead data for conversion
const mockLead = {
  id: '1',
  name: 'Sarah Chen',
  company: 'TechStart Inc',
  email: 'sarah@techstart.io',
  phone: '+1 (415) 555-0123',
  website: 'techstart.io',
  value: 15000,
  stage: 'Closed Won',
  score: 82,
  source: 'Website',
  createdAt: 'Jan 5, 2025',
  contacts: [
    { id: '1', name: 'Sarah Chen', email: 'sarah@techstart.io', title: 'VP Engineering', primary: true },
    { id: '2', name: 'Mike Johnson', email: 'mike@techstart.io', title: 'CTO', primary: false },
  ],
}

// Wizard steps
type Step = { id: string; label: string }

const steps: Step[] = [
  { id: 'review', label: 'Review Lead' },
  { id: 'client', label: 'Create Client' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'project', label: 'Initial Project' },
  { id: 'setup', label: 'Setup & Folders' },
  { id: 'complete', label: 'Complete' },
]

// Step indicator component
function StepIndicator({ steps, currentStep }: { steps: Step[], currentStep: number }) {
  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
              index < currentStep
                ? 'bg-primary border-primary text-primary-foreground'
                : index === currentStep
                  ? 'border-primary text-primary'
                  : 'border-muted text-muted-foreground'
            }`}>
              {index < currentStep ? (
                <Check className="h-4 w-4" />
              ) : (
                <span className="text-sm font-medium">{index + 1}</span>
              )}
            </div>
            <span className={`text-xs mt-1 ${index <= currentStep ? 'text-foreground' : 'text-muted-foreground'}`}>
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className={`w-16 h-0.5 mx-2 ${index < currentStep ? 'bg-primary' : 'bg-muted'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// Step 1: Review Lead
function ReviewLeadStep({ lead, onNext }: { lead: typeof mockLead, onNext: () => void }) {
  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Review Lead Details</CardTitle>
        <CardDescription>Confirm the lead information before conversion</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4 p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
          <div>
            <p className="font-medium text-green-700 dark:text-green-300">Lead Closed Won!</p>
            <p className="text-sm text-green-600 dark:text-green-400">Ready to convert to client</p>
          </div>
          <Badge className="ml-auto" variant="secondary">${lead.value.toLocaleString()}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-muted-foreground">Company</Label>
            <p className="font-medium">{lead.company}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Primary Contact</Label>
            <p className="font-medium">{lead.name}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Email</Label>
            <p className="font-medium">{lead.email}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Phone</Label>
            <p className="font-medium">{lead.phone}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Website</Label>
            <p className="font-medium">{lead.website}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Lead Score</Label>
            <p className="font-medium">{lead.score}/100</p>
          </div>
        </div>

        <Separator />

        <div>
          <Label className="text-muted-foreground mb-2 block">Contacts ({lead.contacts.length})</Label>
          <div className="space-y-2">
            {lead.contacts.map(contact => (
              <div key={contact.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {contact.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium">{contact.name}</p>
                  <p className="text-xs text-muted-foreground">{contact.title} · {contact.email}</p>
                </div>
                {contact.primary && <Badge variant="secondary">Primary</Badge>}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={onNext}>
            Continue to Client Setup
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Step 2: Create Client
function CreateClientStep({ lead, onNext, onBack }: { lead: typeof mockLead, onNext: () => void, onBack: () => void }) {
  const [clientName, setClientName] = useState(lead.company)
  const [billingType, setBillingType] = useState('net_30')

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create Client Record</CardTitle>
        <CardDescription>Set up the new client account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <Label>Client Name</Label>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} className="mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Website</Label>
              <Input defaultValue={lead.website} className="mt-1" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input defaultValue={lead.phone} className="mt-1" />
            </div>
          </div>

          <div>
            <Label>Billing Type</Label>
            <Select value={billingType} onValueChange={setBillingType}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prepaid">Prepaid (Hour Blocks)</SelectItem>
                <SelectItem value="net_30">Net 30</SelectItem>
                <SelectItem value="net_15">Net 15</SelectItem>
                <SelectItem value="due_on_receipt">Due on Receipt</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Address (Optional)</Label>
            <Textarea placeholder="Street address, city, state, zip..." className="mt-1" />
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea placeholder="Internal notes about this client..." className="mt-1" />
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onNext}>
            Continue to Contacts
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Step 3: Contacts
function ContactsStep({ lead, onNext, onBack }: { lead: typeof mockLead, onNext: () => void, onBack: () => void }) {
  const [contacts, setContacts] = useState(lead.contacts)

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Migrate Contacts</CardTitle>
        <CardDescription>These contacts will be linked to the new client</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          {contacts.map((contact, index) => (
            <div key={contact.id} className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {contact.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{contact.name}</p>
                    <p className="text-sm text-muted-foreground">{contact.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={contact.primary} onCheckedChange={(checked: boolean) => {
                    setContacts(contacts.map((c, i) => ({
                      ...c,
                      primary: i === index ? checked : (checked ? false : c.primary)
                    })))
                  }} />
                  <Label className="text-sm">Primary</Label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Title</Label>
                  <Input defaultValue={contact.title} className="h-8 mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Phone</Label>
                  <Input placeholder="Phone number..." className="h-8 mt-1" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button variant="outline" className="w-full gap-2">
          <Plus className="h-4 w-4" />
          Add Another Contact
        </Button>

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onNext}>
            Continue to Project
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Step 4: Initial Project
function ProjectStep({ lead, onNext, onBack }: { lead: typeof mockLead, onNext: () => void, onBack: () => void }) {
  const [createProject, setCreateProject] = useState(true)

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Initial Project</CardTitle>
        <CardDescription>Optionally create the first project for this client</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div className="flex items-center gap-3">
            <Folder className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Create initial project</p>
              <p className="text-sm text-muted-foreground">Start tracking work immediately</p>
            </div>
          </div>
          <Switch checked={createProject} onCheckedChange={setCreateProject} />
        </div>

        {createProject && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <div>
              <Label>Project Name</Label>
              <Input defaultValue={`${lead.company} - Web Application`} className="mt-1" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Budget</Label>
                <Input type="number" defaultValue={lead.value} className="mt-1" />
              </div>
              <div>
                <Label>Start Date</Label>
                <Input type="date" defaultValue="2025-01-15" className="mt-1" />
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                placeholder="Project description..."
                defaultValue="Custom web application development project based on requirements discussed."
                className="mt-1"
              />
            </div>

            <div className="flex items-center gap-2 p-3 rounded-md bg-violet-500/10 border border-violet-500/20">
              <Sparkles className="h-4 w-4 text-violet-500" />
              <p className="text-sm">AI can generate tasks from your proposal and meeting notes</p>
              <Button variant="outline" size="sm" className="ml-auto">
                Generate Tasks
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onNext}>
            Continue to Setup
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Step 5: Setup & Folders
function SetupStep({ lead, onNext, onBack }: { lead: typeof mockLead, onNext: () => void, onBack: () => void }) {
  const [createFolders, setCreateFolders] = useState(true)
  const [linkEmails, setLinkEmails] = useState(true)

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Automation & Setup</CardTitle>
        <CardDescription>Configure automatic setup tasks</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Google Drive folders */}
        <div className="p-4 border rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <FolderPlus className="h-5 w-5 text-amber-500" />
              <div>
                <p className="font-medium">Create Google Drive Folders</p>
                <p className="text-sm text-muted-foreground">Auto-create standard folder structure</p>
              </div>
            </div>
            <Switch checked={createFolders} onCheckedChange={setCreateFolders} />
          </div>

          {createFolders && (
            <div className="ml-8 mt-3 space-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4" />
                <span>📁 {lead.company}</span>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Folder className="h-4 w-4" />
                <span>📁 Proposals</span>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Folder className="h-4 w-4" />
                <span>📁 Contracts</span>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Folder className="h-4 w-4" />
                <span>📁 Deliverables</span>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Folder className="h-4 w-4" />
                <span>📁 Meeting Notes</span>
              </div>
            </div>
          )}
        </div>

        {/* Email linking */}
        <div className="p-4 border rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link2 className="h-5 w-5 text-blue-500" />
              <div>
                <p className="font-medium">Link Email History</p>
                <p className="text-sm text-muted-foreground">Move lead emails to client record</p>
              </div>
            </div>
            <Switch checked={linkEmails} onCheckedChange={setLinkEmails} />
          </div>
        </div>

        {/* Move documents */}
        <div className="p-4 border rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium">Migrate Documents</p>
                <p className="text-sm text-muted-foreground">Move lead documents to client folders</p>
              </div>
            </div>
            <Switch defaultChecked />
          </div>
        </div>

        {/* Archive lead */}
        <div className="p-4 border rounded-lg bg-muted/30">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Archive Lead Record</p>
              <p className="text-sm text-muted-foreground">Lead will be marked as converted and archived</p>
            </div>
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onNext}>
            Complete Conversion
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Step 6: Complete
function CompleteStep({ lead }: { lead: typeof mockLead }) {
  const [status, setStatus] = useState<'processing' | 'complete'>('processing')

  // Simulate processing
  useState(() => {
    setTimeout(() => setStatus('complete'), 2000)
  })

  const tasks = [
    { label: 'Create client record', done: true },
    { label: 'Migrate contacts', done: true },
    { label: 'Create initial project', done: true },
    { label: 'Set up Google Drive folders', done: status === 'complete' },
    { label: 'Link email history', done: status === 'complete' },
    { label: 'Archive lead', done: status === 'complete' },
  ]

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader className="text-center">
        {status === 'processing' ? (
          <>
            <div className="mx-auto mb-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
            <CardTitle>Converting Lead...</CardTitle>
            <CardDescription>Setting up your new client</CardDescription>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle>Conversion Complete!</CardTitle>
            <CardDescription>{lead.company} is now a client</CardDescription>
          </>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          {tasks.map((task, i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              {task.done ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground animate-pulse" />
              )}
              <span className={task.done ? '' : 'text-muted-foreground'}>{task.label}</span>
            </div>
          ))}
        </div>

        {status === 'complete' && (
          <>
            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" asChild>
                <a href="/clients/techstart-inc">
                  <Building2 className="h-4 w-4 mr-2" />
                  View Client
                </a>
              </Button>
              <Button asChild>
                <a href="/projects/techstart-inc/web-application/board">
                  <Folder className="h-4 w-4 mr-2" />
                  Open Project
                </a>
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// Main lead conversion wizard page
export default function LeadConversionWireframePage() {
  const [currentStep, setCurrentStep] = useState(0)

  const handleNext = () => setCurrentStep(prev => Math.min(prev + 1, steps.length - 1))
  const handleBack = () => setCurrentStep(prev => Math.max(prev - 1, 0))

  return (
    <>
      <AppShellHeader>
        <div className="flex items-center justify-between w-full">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Convert Lead to Client</h1>
            <p className="text-muted-foreground text-sm">
              {mockLead.company} · {mockLead.name}
            </p>
          </div>
          <Button variant="outline" asChild>
            <a href="/leads/board">
              <X className="h-4 w-4 mr-2" />
              Cancel
            </a>
          </Button>
        </div>
      </AppShellHeader>

      <div className="p-6">
        <StepIndicator steps={steps} currentStep={currentStep} />

        {currentStep === 0 && <ReviewLeadStep lead={mockLead} onNext={handleNext} />}
        {currentStep === 1 && <CreateClientStep lead={mockLead} onNext={handleNext} onBack={handleBack} />}
        {currentStep === 2 && <ContactsStep lead={mockLead} onNext={handleNext} onBack={handleBack} />}
        {currentStep === 3 && <ProjectStep lead={mockLead} onNext={handleNext} onBack={handleBack} />}
        {currentStep === 4 && <SetupStep lead={mockLead} onNext={handleNext} onBack={handleBack} />}
        {currentStep === 5 && <CompleteStep lead={mockLead} />}
      </div>
    </>
  )
}
