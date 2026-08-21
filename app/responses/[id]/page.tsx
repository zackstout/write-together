import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import CommentSection from '@/components/CommentSection'
import type { Response, Comment } from '@/lib/types'

export default async function ResponsePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: response } = await supabase
    .from('responses')
    .select('*, profile:profiles(id, display_name), period:periods(*, prompt:prompts(*))')
    .eq('id', id)
    .single<Response>()

  if (!response) notFound()

  // Only the owner can see private or draft responses
  const isOwner = user?.id === response.user_id
  if (!response.is_public && !isOwner) notFound()
  if (response.is_draft && !isOwner) notFound()

  const { data: comments } = await supabase
    .from('comments')
    .select('*, profile:profiles(display_name)')
    .eq('response_id', id)
    .order('created_at', { ascending: true })

  const prompt = (response.period as { prompt?: { text: string } })?.prompt

  return (
    <div className="flex flex-col gap-8">
      {/* Prompt context */}
      {prompt && (
        <section>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Prompt</p>
          <p className="text-gray-700 italic">{prompt.text}</p>
        </section>
      )}

      {/* Response */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <Link
            href={`/users/${response.profile?.id}`}
            className="text-sm font-medium text-gray-900 hover:underline"
          >
            {response.profile?.display_name ?? 'Anonymous'}
          </Link>
          <span className="text-xs text-gray-400">
            {response.submitted_at
              ? new Date(response.submitted_at).toLocaleDateString()
              : ''}
          </span>
        </div>
        <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
          {response.content}
        </div>
      </section>

      {/* Comments */}
      <section>
        <p className="text-xs uppercase tracking-widest text-gray-400 mb-4">Comments</p>
        <CommentSection
          responseId={id}
          initialComments={(comments as Comment[]) ?? []}
          isLoggedIn={!!user}
        />
      </section>
    </div>
  )
}
