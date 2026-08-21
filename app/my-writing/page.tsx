import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Response, Period } from '@/lib/types'

export default async function MyWritingPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: responses } = await supabase
    .from('responses')
    .select('*, period:periods(*, prompt:prompts(*))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">My Writing</h1>

      {!responses || responses.length === 0 ? (
        <p className="text-gray-500">You have not written anything yet.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {(responses as (Response & { period: Period })[]).map((r) => {
            const prompt = r.period?.prompt
            return (
              <li key={r.id} className="border border-gray-200 rounded-lg p-4">
                <p className="text-xs text-gray-400 mb-1">
                  {new Date(r.created_at).toLocaleDateString()}
                  {r.is_draft && (
                    <span className="ml-2 bg-yellow-100 text-yellow-700 text-xs rounded px-1.5 py-0.5">
                      Draft
                    </span>
                  )}
                  {!r.is_public && !r.is_draft && (
                    <span className="ml-2 bg-gray-100 text-gray-500 text-xs rounded px-1.5 py-0.5">
                      Private
                    </span>
                  )}
                </p>
                {prompt && (
                  <p className="text-sm font-medium text-gray-900 mb-2 line-clamp-2">
                    {prompt.text}
                  </p>
                )}
                <p className="text-gray-600 text-sm line-clamp-3">{r.content || 'No content yet.'}</p>
                <div className="mt-3">
                  {r.is_draft ? (
                    <Link href="/respond" className="text-sm underline text-gray-900">
                      Continue writing
                    </Link>
                  ) : (
                    <Link href={`/responses/${r.id}`} className="text-sm underline text-gray-900">
                      View response
                    </Link>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
