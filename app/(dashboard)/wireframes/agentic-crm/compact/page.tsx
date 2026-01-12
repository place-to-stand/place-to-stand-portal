'use client'

import { useState } from 'react'
import {
  Brain,
  Users,
  Mail,
  Calendar,
  FileText,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  MoreHorizontal,
  Search,
  Filter,
  Play,
  Eye,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

// Mock data
const mockAiActions = [
  { id: '1', type: 'email', title: 'Draft follow-up to Acme Corp', client: 'Acme Corp', confidence: 94, status: 'pending', time: '2m ago' },
  { id: '2', type: 'task', title: 'Create project proposal', client: 'TechStart', confidence: 87, status: 'pending', time: '15m ago' },
  { id: '3', type: 'schedule', title: 'Schedule check-in call', client: 'Innovate Co', confidence: 82, status: 'pending', time: '1h ago' },
  { id: '4', type: 'document', title: 'Generate invoice', client: 'TechStart', confidence: 91, status: 'executed', time: '2h ago' },
  { id: '5', type: 'email', title: 'Send meeting recap', client: 'Acme Corp', confidence: 89, status: 'executed', time: '3h ago' },
]

const mockClients = [
  { id: '1', name: 'Acme Corp', contact: 'Jennifer Adams', email: 'jadams@acme.com', health: 85, revenue: 24500, tasks: 3, trend: 'up' },
  { id: '2', name: 'TechStart', contact: 'Robert Kim', email: 'rkim@techstart.io', health: 72, revenue: 18200, tasks: 5, trend: 'down' },
  { id: '3', name: 'Innovate Co', contact: 'Lisa Park', email: 'lpark@innovate.co', health: 90, revenue: 32100, tasks: 2, trend: 'up' },
  { id: '4', name: 'DataFlow', contact: 'Mike Chen', email: 'mchen@dataflow.io', health: 65, revenue: 15800, tasks: 4, trend: 'down' },
  { id: '5', name: 'CloudNine', contact: 'Sarah Lee', email: 'slee@cloudnine.com', health: 88, revenue: 28400, tasks: 1, trend: 'up' },
]

export default function AgenticCrmCompactPage() {
  const [selectedTab, setSelectedTab] = useState<'actions' | 'clients'>('actions')

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Compact Header */}
      <div className="border-b px-4 py-2 flex items-center gap-4 bg-background">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-violet-500" />
          <h1 className="font-semibold">Agentic CRM</h1>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Actions:</span>
            <Badge variant="secondary" className="h-5">{mockAiActions.filter(a => a.status === 'pending').length}</Badge>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Clients:</span>
            <span className="font-medium">{mockClients.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Revenue:</span>
            <span className="font-medium text-green-600">$119K</span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." className="h-8 pl-8 text-sm" />
          </div>
          <Button variant="outline" size="sm" className="h-8">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="border-b px-4 flex items-center gap-1 bg-muted/30">
        <button
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            selectedTab === 'actions'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setSelectedTab('actions')}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Actions
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
              {mockAiActions.filter(a => a.status === 'pending').length}
            </Badge>
          </div>
        </button>
        <button
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            selectedTab === 'clients'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setSelectedTab('clients')}
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Clients
          </div>
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {selectedTab === 'actions' ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-8"></TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="text-center">Confidence</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockAiActions.map(action => {
                const icons = { email: Mail, task: CheckCircle2, schedule: Calendar, document: FileText }
                const Icon = icons[action.type as keyof typeof icons]
                return (
                  <TableRow key={action.id} className={cn(action.status === 'executed' && 'opacity-60')}>
                    <TableCell>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell className="font-medium">{action.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{action.client}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Progress value={action.confidence} className="w-16 h-1.5" />
                        <span className="text-xs text-muted-foreground w-8">{action.confidence}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={action.status === 'pending' ? 'default' : 'secondary'} className="text-xs">
                        {action.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{action.time}</TableCell>
                    <TableCell>
                      {action.status === 'pending' && (
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600">
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Client</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-center">Health</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-center">Tasks</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockClients.map(client => (
                <TableRow key={client.id} className="cursor-pointer">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[10px]">
                          {client.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{client.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="text-sm">{client.contact}</div>
                      <div className="text-xs text-muted-foreground">{client.email}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Progress
                        value={client.health}
                        className={cn(
                          'w-16 h-1.5',
                          client.health >= 80 ? '[&>div]:bg-green-500' :
                          client.health >= 60 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-red-500'
                        )}
                      />
                      <span className="text-xs w-8">{client.health}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      ${(client.revenue / 1000).toFixed(1)}K
                      {client.trend === 'up' ? (
                        <TrendingUp className="h-3 w-3 text-green-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="text-xs">{client.tasks}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ScrollArea>

      {/* Footer Stats */}
      <div className="border-t px-4 py-2 flex items-center gap-6 text-xs text-muted-foreground bg-muted/30">
        <span>Last synced: 2 minutes ago</span>
        <Separator orientation="vertical" className="h-4" />
        <span>AI Engine: Active</span>
        <Separator orientation="vertical" className="h-4" />
        <span>{mockAiActions.filter(a => a.status === 'executed').length} actions executed today</span>
      </div>
    </div>
  )
}
