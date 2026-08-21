'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  periodId: string
  maxChars: number
  initialContent: string
  initialIsPublic: boolean
  responseId: string | null
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function ResponseEditor({
  periodId,
  maxChars,
  initialContent,
  initialIsPublic,
  responseId,
}: Props) {
  const [content, setContent] = useState(initialContent)
  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [currentResponseId, setCurrentResponseId] = useState(responseId)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  const save = useCallback(
    async (text: string, pub: boolean) => {
      setSaveStatus('saving')
      try {
        const res = await fetch('/api/responses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            periodId,
            responseId: currentResponseId,
            content: text,
            isPublic: pub,
          }),
        })

        if (!res.ok) throw new Error('Save failed')

        const data = await res.json()
        if (!currentResponseId && data.id) {
          setCurrentResponseId(data.id)
        }
        setSaveStatus('saved')
      } catch {
        setSaveStatus('error')
      }
    },
    [periodId, currentResponseId]
  )

  useEffect(() => {
    if (content === initialContent && isPublic === initialIsPublic) return
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      save(content, isPublic)
    }, 1000)
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [content, isPublic, save, initialContent, initialIsPublic])

  async function handleSubmit() {
    if (!currentResponseId) {
      // Save first, then submit
      await save(content, isPublic)
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch(`/api/responses/${currentResponseId}/submit`, {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Submit failed')
      }

      const data = await res.json()
      router.push(`/responses/${data.id}`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  const charsRemaining = maxChars - content.length
  const overLimit = charsRemaining < 0

  return (
    <div className="flex flex-col gap-4">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write your response here..."
        rows={14}
        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-gray-900"
      />

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span className={overLimit ? 'text-red-500 font-medium' : ''}>
          {overLimit
            ? `${Math.abs(charsRemaining)} characters over limit`
            : `${charsRemaining} characters remaining`}
        </span>
        <span>
          {saveStatus === 'saving' && 'Saving...'}
          {saveStatus === 'saved' && 'Saved'}
          {saveStatus === 'error' && 'Save failed'}
        </span>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="rounded"
        />
        Visible to anyone (not just members)
      </label>

      {submitError && <p className="text-red-600 text-sm">{submitError}</p>}

      <button
        onClick={handleSubmit}
        disabled={submitting || overLimit || content.trim().length === 0}
        className="self-start bg-gray-900 text-white rounded-md px-5 py-2.5 font-medium hover:bg-gray-700 disabled:opacity-50"
      >
        {submitting ? 'Submitting...' : 'Submit response'}
      </button>

      <p className="text-xs text-gray-400">
        Once submitted, your response cannot be edited.
      </p>
    </div>
  )
}
