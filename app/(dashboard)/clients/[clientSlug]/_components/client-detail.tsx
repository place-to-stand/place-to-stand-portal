'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Building2,
  Calendar,
  CreditCard,
  FolderKanban,
  Globe,
  LinkIcon,
  Pencil,
  UserPlus,
} from 'lucide-react'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/components/ui/use-toast'
import { softDeleteClient } from '@/app/(dashboard)/clients/actions'
import { getProjectStatusLabel, getProjectStatusToken } from '@/lib/constants'
import type {
  ClientDetail as ClientDetailType,
  ClientProject,
} from '@/lib/data/clients'
import type { ContactWithClientLink } from '@/lib/types/client-contacts'
import type { MessageForClient } from '@/lib/queries/messages'
import { getBillingTypeLabel } from '@/lib/settings/clients/billing-types'
import {
  ARCHIVE_CLIENT_CONFIRM_LABEL,
  ARCHIVE_CLIENT_DIALOG_TITLE,
  PENDING_REASON,
  getArchiveClientDialogDescription,
} from '@/lib/settings/clients/client-sheet-constants'
import type {
  ClientRow,
  ClientUserSummary,
} from '@/lib/settings/clients/client-sheet-utils'
import { cn } from '@/lib/utils'
import { ViewLogger } from '@/components/activity/view-logger'
import { ActivityVerbs } from '@/lib/activity/types'

import { ClientSheet } from '../../_components/clients-sheet'
import { ClientContactsSection } from './client-contacts-section'
import { ClientEmailsSection } from './client-emails-section'
import { ClientNotesSection } from './client-notes-section'

type HydratedClientDetail = ClientDetailType & { resolvedId: string }

export type ReferralContactInfo = {
  id: string
  name: string | null
  email: string
} | null

type ClientDetailProps = {
  client: HydratedClientDetail
  projects: ClientProject[]
  contacts: ContactWithClientLink[]
  messages: MessageForClient[]
  canManageClients: boolean
  clientUsers: ClientUserSummary[]
  clientMembers: Record<string, ClientUserSummary[]>
  clientRow: ClientRow
  currentUserId: string
  referralContact: ReferralContactInfo
}

export function ClientDetail({
  client,
  projects,
  contacts,
  messages,
  canManageClients,
  clientUsers,
  clientMembers,
  clientRow,
  currentUserId,
  referralContact,
}: ClientDetailProps) {
  const activeProjects = projects.filter(p => p.status === 'ACTIVE')
  const otherProjects = projects.filter(p => p.status !== 'ACTIVE')

  return (
    <div className='space-y-4'>
      <ViewLogger
        actorId={currentUserId}
        verb={ActivityVerbs.CLIENT_VIEWED}
        summary={`Viewed client "${client.name}"`}
        targetType='CLIENT'
        targetId={client.id}
        targetClientId={client.id}
        metadata={{ hasSlug: Boolean(client.slug) }}
      />

      {/* Action bar */}
      {canManageClients ? (
        <div className='flex items-center justify-end'>
          <ClientOverviewActions
            client={client}
            clientRow={clientRow}
            clientUsers={clientUsers}
            clientMembers={clientMembers}
            contacts={contacts}
          />
        </div>
      ) : null}

      {/* Two-column layout */}
      <div className='grid gap-4 lg:grid-cols-2'>
        {/* Left column: Details, Contacts, Messages */}
        <div className='space-y-4'>
          {/* Client Details Widget */}
          <ClientDetailsWidget
            client={client}
            activeProjectCount={activeProjects.length}
            otherProjectCount={otherProjects.length}
            referralContact={referralContact}
          />

          {/* Notes Section */}
          <ClientNotesSection
            clientId={client.id}
            initialNotes={client.notes}
          />
        </div>

        {/* Right column: Projects, Notes */}
        <div className='space-y-4'>
          {/* Projects Section */}
          <ClientProjectsSection projects={projects} clientSlug={client.slug} />

          {/* Contacts Section */}
          <ClientContactsSection contacts={contacts} />

          {/* Messages Section */}
          <ClientEmailsSection
            messages={messages}
            currentUserId={currentUserId}
          />
        </div>
      </div>
    </div>
  )
}

type ClientDetailsWidgetProps = {
  client: HydratedClientDetail
  activeProjectCount: number
  otherProjectCount: number
  referralContact: ReferralContactInfo
}

function ClientDetailsWidget({
  client,
  activeProjectCount,
  otherProjectCount,
  referralContact,
}: ClientDetailsWidgetProps) {
  return (
    <section className='bg-card text-card-foreground overflow-hidden rounded-lg border'>
      <div className='flex items-center gap-3 border-b px-4 py-3'>
        <div className='flex h-7 w-7 items-center justify-center rounded-md bg-blue-500/10'>
          <Building2 className='h-4 w-4 text-blue-500' />
        </div>
        <h2 className='font-semibold'>Details</h2>
      </div>
      <div className='divide-y'>
        <DetailRow
          icon={CreditCard}
          label='Billing'
          value={getBillingTypeLabel(client.billingType)}
        />
        <DetailRow
          icon={FolderKanban}
          label='Projects'
          value={`${activeProjectCount} active${otherProjectCount > 0 ? `, ${otherProjectCount} other` : ''}`}
        />
        <DetailRow
          icon={Calendar}
          label='Created'
          value={format(new Date(client.createdAt), 'MMM d, yyyy')}
        />
        {client.website ? (
          <div className='flex items-center gap-3 px-4 py-2.5'>
            <Globe className='text-muted-foreground h-4 w-4' />
            <span className='text-muted-foreground text-sm'>Website</span>
            <a
              href={client.website}
              target='_blank'
              rel='noopener noreferrer'
              className='ml-auto text-sm font-medium text-blue-600 hover:underline dark:text-blue-400'
            >
              {new URL(client.website).hostname}
            </a>
          </div>
        ) : null}
        {referralContact ? (
          <div className='flex items-center gap-3 px-4 py-2.5'>
            <UserPlus className='text-muted-foreground h-4 w-4' />
            <span className='text-muted-foreground text-sm'>Referred By</span>
            <span className='ml-auto text-sm font-medium'>
              {referralContact.name ?? referralContact.email}
            </span>
          </div>
        ) : null}
        {client.slug ? (
          <div className='flex items-center gap-3 px-4 py-2.5'>
            <LinkIcon className='text-muted-foreground h-4 w-4' />
            <span className='text-muted-foreground text-sm'>Slug</span>
            <span className='ml-auto font-mono text-sm'>{client.slug}</span>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2
  label: string
  value: string
}) {
  return (
    <div className='flex items-center gap-3 px-4 py-2.5'>
      <Icon className='text-muted-foreground h-4 w-4' />
      <span className='text-muted-foreground text-sm'>{label}</span>
      <span className='ml-auto text-sm font-medium'>{value}</span>
    </div>
  )
}

type ClientProjectsSectionProps = {
  projects: ClientProject[]
  clientSlug: string | null
}

function ClientProjectsSection({
  projects,
  clientSlug,
}: ClientProjectsSectionProps) {
  return (
    <section className='bg-card text-card-foreground overflow-hidden rounded-lg border'>
      <div className='flex items-center gap-3 border-b px-4 py-3'>
        <div className='flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10'>
          <FolderKanban className='h-4 w-4 text-emerald-500' />
        </div>
        <h2 className='font-semibold'>Projects</h2>
        <Badge variant='secondary' className='ml-auto'>
          {projects.length}
        </Badge>
      </div>
      <div className='p-3'>
        {projects.length === 0 ? (
          <div className='text-muted-foreground rounded-md border border-dashed px-4 py-6 text-center text-sm'>
            No projects found for this client.
          </div>
        ) : (
          <div className='space-y-2'>
            {projects.map(project => (
              <ProjectRow
                key={project.id}
                project={project}
                clientSlug={clientSlug}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

type ProjectRowProps = {
  project: ClientProject
  clientSlug: string | null
}

function ProjectRow({ project, clientSlug }: ProjectRowProps) {
  const statusLabel = getProjectStatusLabel(project.status)
  const statusToken = getProjectStatusToken(project.status)
  const progressPercentage =
    project.totalTasks > 0
      ? Math.round((project.doneTasks / project.totalTasks) * 100)
      : 0

  // Build the project board URL
  const projectSlug = project.slug ?? project.id
  const clientPath = clientSlug ?? project.id
  const href = `/projects/${clientPath}/${projectSlug}/board`

  return (
    <Link
      href={href}
      className='hover:bg-muted/50 group flex items-center gap-3 rounded-md px-3 py-2.5 transition'
    >
      <div className='min-w-0 flex-1'>
        <div className='flex items-center gap-2'>
          <span className='truncate text-sm font-medium'>{project.name}</span>
          <Badge className={cn('shrink-0 text-[10px]', statusToken)}>
            {statusLabel}
          </Badge>
        </div>
        <div className='mt-1 flex items-center gap-3'>
          <Progress value={progressPercentage} className='h-1.5 flex-1' />
          <span className='text-muted-foreground shrink-0 text-xs'>
            {project.doneTasks}/{project.totalTasks}
          </span>
        </div>
      </div>
    </Link>
  )
}

type ClientOverviewActionsProps = {
  client: HydratedClientDetail
  clientRow: ClientRow
  clientUsers: ClientUserSummary[]
  clientMembers: Record<string, ClientUserSummary[]>
  contacts: ContactWithClientLink[]
}

function ClientOverviewActions({
  client,
  clientRow,
  clientUsers,
  clientMembers,
  contacts,
}: ClientOverviewActionsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSheetComplete = () => {
    setSheetOpen(false)
    router.refresh()
  }

  const handleSheetArchived = () => {
    router.push('/clients')
    router.refresh()
  }

  const handleConfirmArchive = () => {
    startTransition(async () => {
      const result = await softDeleteClient({ id: clientRow.id })

      if (result.error) {
        toast({
          title: 'Unable to archive client',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Client archived',
        description: `${client.name} is hidden from selectors but history remains accessible.`,
      })
      setConfirmOpen(false)
      router.push('/clients')
      router.refresh()
    })
  }

  const disabledReason = isPending ? PENDING_REASON : null

  return (
    <>
      <DisabledFieldTooltip disabled={isPending} reason={disabledReason}>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => setSheetOpen(true)}
          disabled={isPending}
          aria-label='Edit client'
          title='Edit client'
        >
          <Pencil className='h-4 w-4' />
          Edit client
        </Button>
      </DisabledFieldTooltip>
      <ClientSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onComplete={handleSheetComplete}
        onArchived={handleSheetArchived}
        client={clientRow}
        allClientUsers={clientUsers}
        clientMembers={clientMembers}
        clientContacts={contacts.map(c => ({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
        }))}
      />
      <ConfirmDialog
        open={confirmOpen}
        title={ARCHIVE_CLIENT_DIALOG_TITLE}
        description={getArchiveClientDialogDescription(client.name)}
        confirmLabel={ARCHIVE_CLIENT_CONFIRM_LABEL}
        confirmVariant='destructive'
        confirmDisabled={isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirmArchive}
      />
    </>
  )
}
