'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@pts/ui/avatar'
import { Button } from '@pts/ui/button'
import { DisabledFieldTooltip } from '@/components/ui/disabled-field-tooltip'
import { useToast } from '@/components/ui/use-toast'

const UPLOAD_ENDPOINT = '/api/uploads/user-avatar'

type Props = {
  value: string | null
  onChange: (next: string | null) => void
  onRemovalChange: (removed: boolean) => void
  /** Mirror of the in-flight upload state — parents should block Save while true. */
  onUploadingChange?: (uploading: boolean) => void
  initials: string
  displayName?: string | null
  disabled?: boolean
  targetUserId?: string
  existingUserId?: string | null
  /** The person whose photo this is (preferred over a user id). */
  contactId?: string | null
}

export function AvatarUploadField({
  value,
  onChange,
  onRemovalChange,
  onUploadingChange,
  initials,
  displayName,
  disabled,
  targetUserId,
  existingUserId,
  contactId,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { toast } = useToast()
  // Uploads staged this session, by path, with a local preview of each. All
  // stay until the field goes away: undo and redo can bring any of them back.
  const [stagedPreviews, setStagedPreviews] = useState<Record<string, string>>(
    {}
  )
  const previewUrl = value ? (stagedPreviews[value] ?? null) : null
  const [cacheBuster, setCacheBuster] = useState<string>(() =>
    String(Date.now())
  )
  const [isUploading, setIsUploading] = useState(false)
  // Paths of uploads staged this session. Uploads land in the pending storage
  // folder; the save action moves the saved one into the user's folder, so
  // anything still pending when the field goes away is an orphan.
  const stagedPathsRef = useRef(new Set<string>())
  // Set on unmount so an upload that resolves afterwards deletes its own
  // staged object instead of orphaning it (the unmount cleanup has already
  // run by then, with pendingUploadRef still null).
  const isUnmountedRef = useRef(false)

  const deletePendingUpload = useCallback(
    (path: string) => {
      void fetch(UPLOAD_ENDPOINT, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, targetUserId }),
        keepalive: true,
      }).catch(error => {
        console.error('Failed to clean up pending avatar upload', error)
      })
    },
    [targetUserId]
  )

  const avatarLabel = useMemo(
    () => displayName ?? initials,
    [displayName, initials]
  )

  const openFilePicker = useCallback(() => {
    if (disabled || isUploading) {
      return
    }

    fileInputRef.current?.click()
  }, [disabled, isUploading])

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]

      if (!file) {
        return
      }

      setIsUploading(true)
      onUploadingChange?.(true)

      const formData = new FormData()
      formData.append('file', file)

      if (targetUserId) {
        formData.append('targetUserId', targetUserId)
      }

      try {
        const response = await fetch(UPLOAD_ENDPOINT, {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string
          } | null
          throw new Error(payload?.error ?? 'Upload failed')
        }

        const payload = (await response.json()) as { path: string }

        // The field unmounted while the upload was in flight (e.g. the form
        // was saved or the sheet closed) — the result can no longer be
        // applied, so delete the staged object instead of orphaning it.
        if (isUnmountedRef.current) {
          deletePendingUpload(payload.path)
          return
        }

        const objectUrl = URL.createObjectURL(file)
        // An earlier staged upload stays until the field goes away: undo can
        // bring it back.
        stagedPathsRef.current.add(payload.path)
        setStagedPreviews(current => ({
          ...current,
          [payload.path]: objectUrl,
        }))

        onChange(payload.path)
        onRemovalChange(false)
        setCacheBuster(String(Date.now()))
      } catch (error) {
        console.error('Avatar upload failed', error)
        toast({
          title: 'Unable to upload photo',
          description:
            error instanceof Error ? error.message : 'Please try again.',
          variant: 'destructive',
        })
      } finally {
        setIsUploading(false)
        onUploadingChange?.(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    },
    [
      deletePendingUpload,
      onChange,
      onRemovalChange,
      onUploadingChange,
      targetUserId,
      toast,
    ]
  )

  const removeAvatar = useCallback(() => {
    // Removal of the saved avatar is deferred to the save action via
    // onRemovalChange; a staged upload stays until the field goes away, so
    // undo can bring it back.
    onChange(null)
    onRemovalChange(true)
    setCacheBuster(String(Date.now()))
  }, [onChange, onRemovalChange])

  const remoteImage = useMemo(() => {
    if (previewUrl) {
      return previewUrl
    }

    if (value && contactId) {
      return `/api/storage/person-avatar/${contactId}?v=${cacheBuster}`
    }

    const resolvedUserId = existingUserId ?? targetUserId

    if (value && resolvedUserId) {
      return `/api/storage/user-avatar/${resolvedUserId}?v=${cacheBuster}`
    }

    return null
  }, [cacheBuster, contactId, existingUserId, previewUrl, targetUserId, value])

  const disableButtons = disabled || isUploading
  const disabledReason = disableButtons
    ? 'Please wait for the current request to finish.'
    : null

  // Previews are freed when the field goes away (undo may still show one).
  const stagedPreviewsRef = useRef(stagedPreviews)
  useEffect(() => {
    stagedPreviewsRef.current = stagedPreviews
  })
  useEffect(
    () => () => {
      for (const url of Object.values(stagedPreviewsRef.current)) {
        URL.revokeObjectURL(url)
      }
    },
    []
  )

  // Abandoned-upload cleanup: if the field unmounts (sheet/dialog closed)
  // while a staged upload was never saved, delete the orphaned object. After
  // a successful save the object has been moved out of the pending folder, so
  // this delete is a harmless no-op.
  useEffect(() => {
    // Mounted (again): React runs effects twice in development, and this
    // effect re-runs when its callback changes, so the flag must reset here
    // or every later upload looks abandoned and is deleted.
    isUnmountedRef.current = false
    const stagedPaths = stagedPathsRef.current
    return () => {
      isUnmountedRef.current = true
      for (const path of stagedPaths) deletePendingUpload(path)
      stagedPaths.clear()
    }
  }, [deletePendingUpload])

  return (
    <div className='flex items-start gap-4'>
      <Avatar size='xl'>
        {remoteImage ? (
          <AvatarImage src={remoteImage} alt={avatarLabel ?? 'Photo'} />
        ) : null}
        <AvatarFallback className='font-semibold uppercase'>
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className='flex flex-col gap-2'>
        <div className='flex flex-wrap gap-2'>
          <DisabledFieldTooltip
            disabled={disableButtons}
            reason={disabledReason}
          >
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={openFilePicker}
              disabled={disableButtons}
            >
              {isUploading ? (
                <Loader2 className='animate-spin' />
              ) : (
                <ImagePlus />
              )}
              {value || previewUrl ? 'Replace photo' : 'Upload photo'}
            </Button>
          </DisabledFieldTooltip>
          {(value || previewUrl) && (
            <DisabledFieldTooltip
              disabled={disableButtons}
              reason={disabledReason}
            >
              <Button
                type='button'
                variant='secondary'
                size='sm'
                onClick={removeAvatar}
                disabled={disableButtons}
              >
                <Trash2 /> Remove
              </Button>
            </DisabledFieldTooltip>
          )}
        </div>
        <p className='text-muted-foreground text-xs'>
          Square image up to 2MB. PNG, JPEG, WEBP, or GIF.
        </p>
      </div>
      <input
        ref={fileInputRef}
        type='file'
        accept='image/png,image/jpeg,image/webp,image/gif'
        hidden
        onChange={handleFileChange}
      />
    </div>
  )
}
