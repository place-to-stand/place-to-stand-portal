'use client'

import { useState } from 'react'
import {
  Settings,
  Sparkles,
  Mail,
  Calendar,
  FileText,
  MessageSquare,
  Bell,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Info,
  Undo2,
  History,
  Eye,
  Send,
  RefreshCw,
  Zap,
  Brain,
  Target,
  Users,
  Building2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AppShellHeader } from '@/components/layout/app-shell'

// Autonomy levels
const autonomyLevels = [
  {
    id: 'suggest',
    name: 'Suggest Only',
    description: 'AI suggests actions, you decide',
    icon: Eye,
    color: 'text-blue-500',
  },
  {
    id: 'draft',
    name: 'Draft & Review',
    description: 'AI drafts, you review before sending',
    icon: FileText,
    color: 'text-amber-500',
  },
  {
    id: 'auto',
    name: 'Auto-Execute',
    description: 'AI acts automatically within limits',
    icon: Zap,
    color: 'text-green-500',
  },
]

// Action types with autonomy settings
const mockActionSettings = [
  {
    id: 'email_followup',
    name: 'Follow-up Emails',
    description: 'Send follow-up emails after meetings or no response',
    category: 'email',
    autonomyLevel: 'draft',
    enabled: true,
    executions: 47,
    acceptanceRate: 82,
  },
  {
    id: 'email_reply',
    name: 'Email Replies',
    description: 'Draft replies to incoming emails',
    category: 'email',
    autonomyLevel: 'suggest',
    enabled: true,
    executions: 156,
    acceptanceRate: 91,
  },
  {
    id: 'meeting_prep',
    name: 'Meeting Prep Briefs',
    description: 'Generate meeting preparation documents',
    category: 'calendar',
    autonomyLevel: 'auto',
    enabled: true,
    executions: 23,
    acceptanceRate: 100,
  },
  {
    id: 'meeting_followup',
    name: 'Post-Meeting Notes',
    description: 'Create meeting summaries and action items',
    category: 'calendar',
    autonomyLevel: 'draft',
    enabled: true,
    executions: 18,
    acceptanceRate: 78,
  },
  {
    id: 'lead_scoring',
    name: 'Lead Scoring Updates',
    description: 'Automatically update lead scores',
    category: 'crm',
    autonomyLevel: 'auto',
    enabled: true,
    executions: 312,
    acceptanceRate: 100,
  },
  {
    id: 'lead_stage',
    name: 'Lead Stage Changes',
    description: 'Suggest stage changes based on activity',
    category: 'crm',
    autonomyLevel: 'suggest',
    enabled: true,
    executions: 28,
    acceptanceRate: 64,
  },
  {
    id: 'proposal_generate',
    name: 'Proposal Generation',
    description: 'Generate proposals from templates',
    category: 'documents',
    autonomyLevel: 'draft',
    enabled: true,
    executions: 8,
    acceptanceRate: 75,
  },
  {
    id: 'task_create',
    name: 'Task Creation',
    description: 'Create tasks from emails and meetings',
    category: 'tasks',
    autonomyLevel: 'suggest',
    enabled: false,
    executions: 0,
    acceptanceRate: 0,
  },
]

// Recent autonomous actions for audit
const mockAuditLog = [
  {
    id: '1',
    action: 'Email drafted',
    description: 'Follow-up to Sarah Chen re: proposal',
    status: 'pending_review',
    timestamp: '10 minutes ago',
    canUndo: true,
  },
  {
    id: '2',
    action: 'Meeting prep generated',
    description: 'Brief for TechStart discovery call',
    status: 'auto_executed',
    timestamp: '2 hours ago',
    canUndo: false,
  },
  {
    id: '3',
    action: 'Lead score updated',
    description: 'TechStart Inc: 78 → 82',
    status: 'auto_executed',
    timestamp: '3 hours ago',
    canUndo: true,
  },
  {
    id: '4',
    action: 'Email draft rejected',
    description: 'Follow-up to Acme Corp',
    status: 'rejected',
    timestamp: '5 hours ago',
    canUndo: false,
  },
  {
    id: '5',
    action: 'Email sent',
    description: 'Weekly update to Enterprise Solutions',
    status: 'approved',
    timestamp: 'Yesterday',
    canUndo: false,
  },
]

// Approval queue items
const mockApprovalQueue = [
  {
    id: '1',
    type: 'email',
    title: 'Follow-up email to Sarah Chen',
    preview: 'Hi Sarah, Following up on our conversation about the proposal timeline...',
    createdAt: '10 minutes ago',
    linkedTo: { type: 'lead', name: 'TechStart Web App' },
  },
  {
    id: '2',
    type: 'email',
    title: 'Introduction email to David Kim',
    preview: 'Hi David, I wanted to introduce myself and discuss how we might help...',
    createdAt: '1 hour ago',
    linkedTo: { type: 'lead', name: 'Enterprise Solutions' },
  },
]

// Action setting card
function ActionSettingCard({ action, onUpdate }: {
  action: typeof mockActionSettings[0],
  onUpdate: (id: string, updates: Partial<typeof action>) => void
}) {
  return (
    <Card className={!action.enabled ? 'opacity-60' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{action.name}</h3>
              {action.enabled && action.autonomyLevel === 'auto' && (
                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                  <Zap className="h-3 w-3 mr-1" />
                  Auto
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
          </div>
          <Switch
            checked={action.enabled}
            onCheckedChange={(enabled: boolean) => onUpdate(action.id, { enabled })}
          />
        </div>

        {action.enabled && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <Label className="text-sm">Autonomy Level:</Label>
              <Select
                value={action.autonomyLevel}
                onValueChange={(value) => onUpdate(action.id, { autonomyLevel: value })}
              >
                <SelectTrigger className="w-40 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {autonomyLevels.map(level => (
                    <SelectItem key={level.id} value={level.id}>
                      <div className="flex items-center gap-2">
                        <level.icon className={`h-4 w-4 ${level.color}`} />
                        {level.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>{action.executions} executions</span>
              <span>·</span>
              <span className={action.acceptanceRate > 80 ? 'text-green-600' : action.acceptanceRate > 60 ? 'text-amber-600' : 'text-red-600'}>
                {action.acceptanceRate}% acceptance rate
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// Status badge helper
function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'pending_review':
      return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pending Review</Badge>
    case 'auto_executed':
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Auto-Executed</Badge>
    case 'approved':
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Approved</Badge>
    case 'rejected':
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Rejected</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

// Main autonomy settings page
export default function AutonomySettingsWireframePage() {
  const [activeTab, setActiveTab] = useState('settings')
  const [actions, setActions] = useState(mockActionSettings)
  const [globalEnabled, setGlobalEnabled] = useState(true)
  const [rateLimit, setRateLimit] = useState([10])

  const handleUpdateAction = (id: string, updates: Partial<typeof mockActionSettings[0]>) => {
    setActions(actions.map(a => a.id === id ? { ...a, ...updates } : a))
  }

  const categories = [
    { id: 'email', name: 'Email', icon: Mail },
    { id: 'calendar', name: 'Calendar', icon: Calendar },
    { id: 'crm', name: 'CRM', icon: Target },
    { id: 'documents', name: 'Documents', icon: FileText },
    { id: 'tasks', name: 'Tasks', icon: CheckCircle2 },
  ]

  return (
    <TooltipProvider>
      <>
        <AppShellHeader>
          <div className="flex items-center justify-between w-full">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">AI Autonomy Settings</h1>
              <p className="text-muted-foreground text-sm">
                Configure how AI agents act on your behalf
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm">AI Actions</Label>
                <Switch checked={globalEnabled} onCheckedChange={setGlobalEnabled} />
                <Badge variant={globalEnabled ? 'default' : 'secondary'}>
                  {globalEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            </div>
          </div>
        </AppShellHeader>

        <div className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="settings">Action Settings</TabsTrigger>
              <TabsTrigger value="queue">
                Approval Queue
                {mockApprovalQueue.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{mockApprovalQueue.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="audit">Audit Log</TabsTrigger>
              <TabsTrigger value="limits">Rate Limits</TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="mt-6">
              <div className="grid grid-cols-3 gap-6">
                {/* Autonomy level overview */}
                <Card className="col-span-3 bg-gradient-to-r from-violet-500/5 to-purple-500/5 border-violet-500/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-violet-500" />
                      Autonomy Levels
                    </CardTitle>
                    <CardDescription>Choose how much control AI has for each action type</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      {autonomyLevels.map(level => (
                        <div key={level.id} className="flex items-start gap-3 p-4 rounded-lg border bg-background">
                          <level.icon className={`h-6 w-6 ${level.color} shrink-0`} />
                          <div>
                            <p className="font-medium">{level.name}</p>
                            <p className="text-sm text-muted-foreground">{level.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Action settings by category */}
                {categories.map(category => {
                  const categoryActions = actions.filter(a => a.category === category.id)
                  if (categoryActions.length === 0) return null

                  return (
                    <div key={category.id} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <category.icon className="h-4 w-4 text-muted-foreground" />
                        <h2 className="font-semibold">{category.name}</h2>
                      </div>
                      {categoryActions.map(action => (
                        <ActionSettingCard
                          key={action.id}
                          action={action}
                          onUpdate={handleUpdateAction}
                        />
                      ))}
                    </div>
                  )
                })}
              </div>
            </TabsContent>

            <TabsContent value="queue" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Pending Approvals</CardTitle>
                  <CardDescription>Review AI-drafted content before it&apos;s sent</CardDescription>
                </CardHeader>
                <CardContent>
                  {mockApprovalQueue.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No items pending approval</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {mockApprovalQueue.map(item => (
                        <div key={item.id} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{item.title}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{item.createdAt}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{item.preview}</p>
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="gap-1">
                              <Target className="h-3 w-3" />
                              {item.linkedTo.name}
                            </Badge>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4 mr-1" />
                                Review
                              </Button>
                              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                              <Button size="sm">
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Approve & Send
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Action History</CardTitle>
                  <CardDescription>Track all AI autonomous actions</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockAuditLog.map(log => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{log.action}</p>
                              <p className="text-sm text-muted-foreground">{log.description}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={log.status} />
                          </TableCell>
                          <TableCell className="text-muted-foreground">{log.timestamp}</TableCell>
                          <TableCell>
                            {log.canUndo && (
                              <Button variant="ghost" size="sm">
                                <Undo2 className="h-4 w-4 mr-1" />
                                Undo
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="limits" className="mt-6">
              <div className="grid grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Rate Limits</CardTitle>
                    <CardDescription>Control how many automated actions per hour</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Max auto-actions per hour</Label>
                        <span className="font-medium">{rateLimit[0]}</span>
                      </div>
                      <Slider
                        value={rateLimit}
                        onValueChange={setRateLimit}
                        max={50}
                        step={5}
                        className="w-full"
                      />
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <Label>Per-action limits</Label>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Emails per hour</span>
                          <Input type="number" className="w-20 h-8" defaultValue={5} />
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Lead updates per hour</span>
                          <Input type="number" className="w-20 h-8" defaultValue={20} />
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Documents per day</span>
                          <Input type="number" className="w-20 h-8" defaultValue={10} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Safety Controls</CardTitle>
                    <CardDescription>Additional safeguards for AI actions</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Require approval for new contacts</Label>
                        <p className="text-xs text-muted-foreground">First email to any contact needs review</p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Pause on weekends</Label>
                        <p className="text-xs text-muted-foreground">No auto-actions on Sat/Sun</p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>High-value lead protection</Label>
                        <p className="text-xs text-muted-foreground">Leads over $10k always require review</p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Daily summary email</Label>
                        <p className="text-xs text-muted-foreground">Receive daily digest of AI actions</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </CardContent>
                </Card>

                <Card className="col-span-2">
                  <CardHeader>
                    <CardTitle>Trust Score</CardTitle>
                    <CardDescription>AI learns from your feedback to improve suggestions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-8">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Overall Trust Score</span>
                          <span className="text-2xl font-bold text-green-600">87%</span>
                        </div>
                        <Progress value={87} className="h-3" />
                        <p className="text-xs text-muted-foreground mt-2">
                          Based on 243 actions with 211 approvals
                        </p>
                      </div>
                      <Separator orientation="vertical" className="h-20" />
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold text-green-600">91%</p>
                          <p className="text-xs text-muted-foreground">Email replies</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-green-600">100%</p>
                          <p className="text-xs text-muted-foreground">Meeting prep</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-amber-600">64%</p>
                          <p className="text-xs text-muted-foreground">Stage changes</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </>
    </TooltipProvider>
  )
}

// Input component for rate limits (simple)
function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  )
}
