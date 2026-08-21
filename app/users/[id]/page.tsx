import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Response } from '@/lib/types'

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('id', id)
    .single()

  if (!profile) notFound()

  const { data: responses } = await supabase
    .from('responses')
    .select('*, period:periods(*, prompt:prompts(*))')
    .eq('user_id', id)
    .eq('is_draft', false)
    .eq('is_public', true)
    .order('submitted_at', { ascending: false })

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">{profile.display_name}</h1>

      {!responses || responses.length === 0 ? (
        <p className="text-gray-500">No public responses yet.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {(responses as Response[]).map((r) => {
            const prompt = (r.period as { prompt?: { text: string } })?.prompt
            return (
              <li key={r.id}>
                <Link
                  href={`/responses/${r.id}`}
                  className="block border border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors"
                >
                  {prompt && (
                    <p className="text-xs text-gray-400 italic mb-1 line-clamp-1">
                      {prompt.text}
                    </p>
                  )}
                  <p className="text-gray-700 text-sm line-clamp-3">{r.content}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {r.submitted_at
                      ? new Date(r.submitted_at).toLocaleDateString()
                      : ''}
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
