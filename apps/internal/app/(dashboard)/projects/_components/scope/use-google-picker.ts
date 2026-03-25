'use client'

import { useCallback, useRef, useState } from 'react'

type PickedDocument = {
  id: string
  name: string
  url: string
  mimeType: string
}

type UseGooglePickerOptions = {
  onPicked: (docs: PickedDocument[]) => void
}

type PickerToken = {
  accessToken: string
  clientId: string
}

function loadGapiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.gapi) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://apis.google.com/js/api.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google API script'))
    document.head.appendChild(script)
  })
}

function loadPickerApi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.gapi) {
      reject(new Error('gapi not loaded'))
      return
    }

    window.gapi.load('picker', () => {
      if (window.google?.picker) {
        resolve()
      } else {
        reject(new Error('Failed to load Picker API'))
      }
    })
  })
}

export function useGooglePicker({ onPicked }: UseGooglePickerOptions) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pickerApiLoaded = useRef(false)

  const openPicker = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Load the gapi script if not already loaded
      await loadGapiScript()

      // Load the picker API if not already loaded
      if (!pickerApiLoaded.current) {
        await loadPickerApi()
        pickerApiLoaded.current = true
      }

      // Fetch a fresh access token
      const res = await fetch('/api/google/picker-token')
      if (!res.ok) {
        throw new Error('Failed to get picker token. Check your Google OAuth connection.')
      }
      const { accessToken } = (await res.json()) as PickerToken

      const picker = window.google!.picker

      // Build the picker with Google Docs filter and multi-select
      const docsView = new picker.DocsView()
      docsView.setMimeTypes('application/vnd.google-apps.document')

      const pickerBuilder = new picker.PickerBuilder()
        .addView(docsView)
        .setOAuthToken(accessToken)
        .enableFeature(picker.Feature.MULTISELECT_ENABLED)
        .setTitle('Select SOW Documents')
        .setOrigin(window.location.origin)
        .setCallback((data: google.picker.ResponseObject) => {
          if (data.action === 'picked') {
            onPicked(
              data.docs.map(doc => ({
                id: doc.id,
                name: doc.name,
                url: doc.url,
                mimeType: doc.mimeType,
              }))
            )
          }
        })

      pickerBuilder.build().setVisible(true)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to open Google Drive picker'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [onPicked])

  return { openPicker, isLoading, error }
}
