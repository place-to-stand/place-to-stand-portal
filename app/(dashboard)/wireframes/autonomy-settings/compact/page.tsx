'use client'

import { useState } from 'react'
import {
  Sparkles,
  Mail,
  Calendar,
  FileText,
  Target,
  CheckCircle2,
  XCircle,
  Eye,
  Zap,
  ChevronRight,
  Undo2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const mockActions = [
  { id: '1', name: 'Follow-up Emails', category: 'email', level: 'draft', enabled: true, executions: 47, rate: 82 },
  { id: '2', name: 'Email Replies', category: 'email', level: 'suggest', enabled: true, executions: 156, rate: 91 },
  { id: '3', name: 'Meeting Prep', category: 'calendar', level: 'auto', enabled: true, executions: 23, rate: 100 },
  { id: '4', name: 'Post-Meeting Notes', category: 'calendar', level: 'draft', enabled: true, executions: 18, rate: 78 },
  { id: '5', name: 'Lead Scoring', category: 'crm', level: 'auto', enabled: true, executions: 312, rate: 100 },
  { id: '6', name: 'Lead Stage Changes', category: 'crm', level: 'suggest', enabled: true, executions: 28, rate: 64 },
  { id: '7', name: 'Proposal Generation', category: 'documents', level: 'draft', enabled: true, executions: 8, rate: 75 },
  { id: '8', name: 'Task Creation', category: 'tasks', level: 'suggest', enabled: false, executions: 0, rate: 0 },
]

const mockAuditLog = [
  { id: '1', action: 'Email drafted', desc: 'Follow-up to Sarah Chen', status: 'pending', time: '10m ago', canUndo: true },
  { id: '2', action: 'Meeting prep generated', desc: 'TechStart discovery call', status: 'auto', time: '2h ago', canUndo: false },
  { id: '3', action: 'Lead score updated', desc: 'TechStart Inc: 78 → 82', status: 'auto', time: '3h ago', canUndo: true },
  { id: '4', action: 'Email rejected', desc: 'Follow-up to Acme Corp', status: 'rejected', time: '5h ago', canUndo: false },
]

const mockQueue = [
  { id: '1', type: 'email', title: 'Follow-up to Sarah Chen', preview: 'Hi Sarah, Following up on our conversation...', time: '10m ago' },
  { id: '2', type: 'email', title: 'Introduction to David Kim', preview: 'Hi David, I wanted to introduce myself...', time: '1h ago' },
]

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'pending': return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">Pending</Badge>
    case 'auto': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">Auto</Badge>
    case 'approved': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">Approved</Badge>
    case 'rejected': return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">Rejected</Badge>
    default: return <Badge variant="secondary" className="text-xs">{status}</Badge>
  }
}

function LevelBadge({ level }: { level: string }) {
  switch (level) {
    case 'suggest': return <Badge variant="outline" className="text-blue-600 text-xs"><Eye className="h-3 w-3 mr-1" />Suggest</Badge>
    case 'draft': return <Badge variant="outline" className="text-amber-600 text-xs"><FileText className="h-3 w-3 mr-1" />Draft</Badge>
    case 'auto': return <Badge variant="outline" className="text-green-600 text-xs"><Zap className="h-3 w-3 mr-1" />Auto</Badge>
    default: return <Badge variant="secondary" className="text-xs">{level}</Badge>
  }
}

export default function AutonomySettingsCompactPage() {
  const [globalEnabled, setGlobalEnabled] = useState(true)
  const [activeTab, setActiveTab] = useState('actions')

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="border-b px-4 py-2 flex items-center justify-between bg-background">
        <div className="flex items-center gap-4">
          <h1 className="font-semibold">AI Autonomy</h1>
          <div className="flex items-center gap-2">
            <Switch checked={globalEnabled} onCheckedChange={setGlobalEnabled} />
            <Badge variant={globalEnabled ? 'default' : 'secondary'} className="text-xs">
              {globalEnabled ? 'ON' : 'OFF'}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">Trust: <span className="font-medium text-green-600">87%</span></span>
          <span className="text-muted-foreground">Actions: <span className="font-medium">243</span></span>
          {mockQueue.length > 0 && (
            <Badge variant="destructive" className="text-xs">{mockQueue.length} pending</Badge>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-10 p-0 px-4">
          <TabsTrigger value="actions" className="rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary h-10">
            Actions
          </TabsTrigger>
          <TabsTrigger value="queue" className="rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary h-10">
            Queue ({mockQueue.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary h-10">
            History
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <TabsContent value="actions" className="m-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Executions</TableHead>
                  <TableHead>Acceptance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockActions.map(action => (
                  <TableRow key={action.id} className={cn(!action.enabled && 'opacity-50')}>
                    <TableCell>
                      <Switch checked={action.enabled} />
                    </TableCell>
                    <TableCell className="font-medium">{action.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{action.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <Select defaultValue={action.level}>
                        <SelectTrigger className="h-7 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="suggest">Suggest</SelectItem>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="auto">Auto</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{action.executions}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={action.rate} className="w-16 h-1.5" />
                        <span className={cn(
                          'text-xs',
                          action.rate > 80 ? 'text-green-600' : action.rate > 60 ? 'text-amber-600' : 'text-red-600'
                        )}>{action.rate}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="queue" className="m-0 p-4">
            {mockQueue.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No items pending</p>
              </div>
            ) : (
              <div className="space-y-2">
                {mockQueue.map(item => (
                  <div key={item.id} className="p-3 rounded-lg border flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{item.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.preview}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{item.time}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-red-600"><XCircle className="h-3 w-3" /></Button>
                      <Button size="sm" className="h-7"><CheckCircle2 className="h-3 w-3 mr-1" />Approve</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="m-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockAuditLog.map(log => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{log.action}</p>
                        <p className="text-xs text-muted-foreground">{log.desc}</p>
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge status={log.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.time}</TableCell>
                    <TableCell>
                      {log.canUndo && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                          <Undo2 className="h-3 w-3 mr-1" />Undo
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  )
}
