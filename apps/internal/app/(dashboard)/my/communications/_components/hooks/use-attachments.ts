'use client'

import { useState, useCallback, useRef } from 'react'

interface AttachmentMetadata {
  storageKey: string
  filename: string
  mimeType: string
  size: number
}

interface UseAttachmentsOptions {
  draftId: string | null
  /** Function to create/save draft and return the draft ID */
  ensureDraftExists: () => Promise<string | null>
  toast: (options: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void
}

interface UseAttachmentsReturn {
  attachments: AttachmentMetadata[]
  setAttachments: React.Dispatch<React.SetStateAction<AttachmentMetadata[]>>
  isUploadingAttachment: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  handleRemoveAttachment: (storageKey: string) => Promise<void>
}

export function useAttachments({
  draftId,
  ensureDraftExists,
  toast,
}: UseAttachmentsOptions): UseAttachmentsReturn {
  const [attachments, setAttachments] = useState<AttachmentMetadata[]>([])
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    let currentDraftId = draftId

    if (!currentDraftId) {
      // Create draft first
      setIsUploadingAttachment(true)
      currentDraftId = await ensureDraftExists()
      if (!currentDraftId) {
        toast({
          title: 'Error',
          description: 'Failed to create draft for attachment',
          variant: 'destructive',
        })
        setIsUploadingAttachment(false)
        return
      }
    }

    // Upload each file
    setIsUploadingAttachment(true)
    for (const file of Array.from(files)) {
      try {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch(`/api/integrations/gmail/drafts/${currentDraftId}/attachments`, {
          method: 'POST',
          body: formData,
        })

        if (res.ok) {
          const data = await res.json()
          setAttachments(data.attachments)
        } else {
          const errorData = await res.json().catch(() => ({}))
          toast({
            title: 'Upload failed',
            description: errorData.error || `Failed to upload ${file.name}`,
            variant: 'destructive',
          })
        }
      } catch {
        toast({
          title: 'Upload failed',
          description: `Failed to upload ${file.name}`,
          variant: 'destructive',
        })
      }
    }
    setIsUploadingAttachment(false)

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [draftId, ensureDraftExists, toast])

  const handleRemoveAttachment = useCallback(async (storageKey: string) => {
    if (!draftId) return

    try {
      const res = await fetch(`/api/integrations/gmail/drafts/${draftId}/attachments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storageKey }),
      })

      if (res.ok) {
        const data = await res.json()
        setAttachments(data.attachments)
      } else {
        throw new Error('Failed to remove attachment')
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to remove attachment',
        variant: 'destructive',
      })
    }
  }, [draftId, toast])

  return {
    attachments,
    setAttachments,
    isUploadingAttachment,
    fileInputRef,
    handleFileSelect,
    handleRemoveAttachment,
  }
}
