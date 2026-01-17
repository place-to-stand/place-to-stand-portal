'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { stripHtmlTags } from '@/lib/email/compose-utils'
import type { ComposeMode } from '../compose-panel'

interface SignatureData {
  email: string
  displayName: string
  signature: string
  isPrimary: boolean
  isDefault: boolean
}

interface UseSignaturesOptions {
  mode: ComposeMode
  isDraft: boolean
  setBody: React.Dispatch<React.SetStateAction<string>>
}

interface UseSignaturesReturn {
  signatures: SignatureData[]
  selectedSignature: string | null
  isLoadingSignatures: boolean
  handleSignatureChange: (email: string) => void
  /** Clear signature from body */
  clearSignature: () => void
}

export function useSignatures({
  mode,
  isDraft,
  setBody,
}: UseSignaturesOptions): UseSignaturesReturn {
  const [signatures, setSignatures] = useState<SignatureData[]>([])
  const [selectedSignature, setSelectedSignature] = useState<string | null>(null)
  const [isLoadingSignatures, setIsLoadingSignatures] = useState(false)
  const signatureAppendedRef = useRef(false)

  // Fetch signatures on mount
  useEffect(() => {
    const fetchSignatures = async () => {
      setIsLoadingSignatures(true)
      try {
        const res = await fetch('/api/integrations/gmail/signatures')
        if (res.ok) {
          const data = await res.json()
          const sigs = data.signatures as SignatureData[]
          setSignatures(sigs)

          // Select default or primary signature
          const defaultSig = sigs.find(s => s.isDefault) || sigs.find(s => s.isPrimary)
          if (defaultSig) {
            setSelectedSignature(defaultSig.email)
          }
        }
      } catch (err) {
        console.error('Failed to fetch signatures:', err)
      } finally {
        setIsLoadingSignatures(false)
      }
    }

    fetchSignatures()
  }, [])

  // Auto-append signature for new emails (runs once when signature is selected)
  useEffect(() => {
    if (signatureAppendedRef.current) return
    if (isDraft) return // Don't append to existing drafts
    if (!selectedSignature || signatures.length === 0) return

    const sig = signatures.find(s => s.email === selectedSignature)
    if (!sig || !sig.signature) return

    // Only auto-append for new emails
    if (mode !== 'new') return

    signatureAppendedRef.current = true
    // Add signature with separator
    const separator = '\n\n--\n'
    // Strip HTML tags from signature for plain text display
    const plainSignature = stripHtmlTags(sig.signature)
    setBody(prev => {
      const trimmed = prev.trim()
      if (trimmed) {
        return prev + separator + plainSignature
      }
      return separator + plainSignature
    })
  }, [selectedSignature, signatures, mode, isDraft, setBody])

  // Handle signature change - uses signature separator marker for reliable replacement
  const handleSignatureChange = useCallback((email: string) => {
    const newSig = signatures.find(s => s.email === email)

    setBody(prev => {
      // Look for signature separator marker to find and replace signature block
      const separatorPattern = /\n\n--\n[\s\S]*$/
      const hasExistingSignature = separatorPattern.test(prev)

      if (newSig?.signature) {
        const newPlainSig = stripHtmlTags(newSig.signature)
        const separator = '\n\n--\n'

        if (hasExistingSignature) {
          // Replace everything after the separator
          return prev.replace(separatorPattern, separator + newPlainSig)
        }
        // Append new signature
        return prev + separator + newPlainSig
      } else {
        // No signature selected - remove existing signature block
        if (hasExistingSignature) {
          return prev.replace(separatorPattern, '')
        }
        return prev
      }
    })

    setSelectedSignature(email)
  }, [signatures, setBody])

  // Clear signature from body
  const clearSignature = useCallback(() => {
    setBody(prev => prev.replace(/\n\n--\n[\s\S]*$/, ''))
    setSelectedSignature(null)
  }, [setBody])

  return {
    signatures,
    selectedSignature,
    isLoadingSignatures,
    handleSignatureChange,
    clearSignature,
  }
}
