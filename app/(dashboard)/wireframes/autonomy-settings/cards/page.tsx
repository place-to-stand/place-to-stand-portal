'use client'

import { useState } from 'react'
import {
  Sparkles,
  Mail,
  Calendar,
  FileText,
  Target,
  CheckCircle2,
  Eye,
  Zap,
  Brain,
  Shield,
  Clock,
  Settings,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const autonomyLevels = [
  { id: 'suggest', name: 'Suggest Only', description: 'AI suggests, you decide', icon: Eye, color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' },
  { id: 'draft', name: 'Draft & Review', description: 'AI drafts, you approve', icon: FileText, color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' },
  { id: 'auto', name: 'Auto-Execute', description: 'AI acts automatically', icon: Zap, color: 'bg-green-100 dark:bg-green-900/30 text-green-600' },
]

const categories = [
  { id: 'email', name: 'Email Actions', icon: Mail, actions: 3, enabled: 2, autoEnabled: 0, trustScore: 91 },
  { id: 'calendar', name: 'Calendar Actions', icon: Calendar, actions: 2, enabled: 2, autoEnabled: 1, trustScore: 100 },
  { id: 'crm', name: 'CRM Actions', icon: Target, actions: 2, enabled: 2, autoEnabled: 1, trustScore: 82 },
  { id: 'documents', name: 'Document Actions', icon: FileText, actions: 1, enabled: 1, autoEnabled: 0, trustScore: 75 },
]

const stats = [
  { label: 'Total Actions', value: '243', change: '+12 today' },
  { label: 'Approval Rate', value: '87%', change: '+3% this week' },
  { label: 'Time Saved', value: '4.2h', change: 'this week' },
  { label: 'Pending', value: '2', change: 'items' },
]

export default function AutonomySettingsCardsPage() {
  const [globalEnabled, setGlobalEnabled] = useState(true)

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">AI Autonomy Settings</h1>
            <p className="text-muted-foreground">Configure how AI agents act on your behalf</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">AI Actions</span>
            <Switch checked={globalEnabled} onCheckedChange={setGlobalEnabled} />
            <Badge variant={globalEnabled ? 'default' : 'secondary'}>
              {globalEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {stats.map(stat => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-xs text-green-600 mt-1">{stat.change}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Autonomy Levels */}
        <Card>
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
                <div key={level.id} className={`p-4 rounded-xl ${level.color} flex items-center gap-4`}>
                  <div className="p-3 rounded-lg bg-white/50 dark:bg-black/20">
                    <level.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold">{level.name}</p>
                    <p className="text-sm opacity-80">{level.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Category Cards */}
        <div className="grid grid-cols-2 gap-4">
          {categories.map(category => (
            <Card key={category.id} className="hover:shadow-md transition-all cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-muted">
                      <category.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{category.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {category.enabled}/{category.actions} actions enabled
                      </p>
                    </div>
                  </div>
                  {category.autoEnabled > 0 && (
                    <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">
                      <Zap className="h-3 w-3 mr-1" />{category.autoEnabled} Auto
                    </Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Trust Score</span>
                    <span className="font-medium">{category.trustScore}%</span>
                  </div>
                  <Progress value={category.trustScore} className="h-2" />
                </div>

                <Button variant="outline" className="w-full mt-4">
                  <Settings className="h-4 w-4 mr-2" />Configure
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">2 Pending Approvals</h3>
                <p className="text-sm text-muted-foreground">Review AI-drafted content</p>
              </div>
              <Button variant="outline">Review</Button>
            </CardContent>
          </Card>

          <Card className="bg-violet-50 dark:bg-violet-950/30 border-violet-200">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-violet-100 dark:bg-violet-900/30">
                <Shield className="h-6 w-6 text-violet-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Safety Controls</h3>
                <p className="text-sm text-muted-foreground">Configure limits and safeguards</p>
              </div>
              <Button variant="outline">Configure</Button>
            </CardContent>
          </Card>
        </div>

        {/* Trust Score Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Overall Trust Score</CardTitle>
            <CardDescription>AI learns from your feedback to improve suggestions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Combined Score</span>
                  <span className="text-3xl font-bold text-green-600">87%</span>
                </div>
                <Progress value={87} className="h-3" />
                <p className="text-sm text-muted-foreground mt-2">Based on 243 actions with 211 approvals</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
