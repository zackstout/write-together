'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Comment } from '@/lib/types'

type Props = {
  responseId: string
  initialComments: Comment[]
  isLoggedIn: boolean
}

export default function CommentSection({ responseId, initialComments, isLoggedIn }: Props) {
  const [comments, setComments] = useState(initialComments)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseId, content: text.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to post comment')
      }

      const newComment = await res.json()
      setComments((prev) => [...prev, newComment])
      setText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {comments.length === 0 ? (
        <p className="text-sm text-gray-400">No comments yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((c) => (
            <li key={c.id} className="border-l-2 border-gray-200 pl-3">
              <p className="text-xs font-medium text-gray-500 mb-0.5">
                {c.profile?.display_name ?? 'Anonymous'} ·{' '}
                {new Date(c.created_at).toLocaleDateString()}
              </p>
              <p className="text-sm text-gray-800">{c.content}</p>
            </li>
          ))}
        </ul>
      )}

      {isLoggedIn ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 mt-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Leave a comment..."
            rows={3}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
          />
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !text.trim()}
            className="self-start bg-gray-900 text-white rounded-md px-4 py-1.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
          >
            {submitting ? 'Posting...' : 'Post comment'}
          </button>
        </form>
      ) : (
        <p className="text-sm text-gray-400">
          <Link href="/login" className="underline text-gray-700">
            Sign in
          </Link>{' '}
          to leave a comment.
        </p>
      )}
    </div>
  )
}
