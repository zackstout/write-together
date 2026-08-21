import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Period, Response } from '@/lib/types'

export default async function HomePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch the active period and its prompt
  const { data: period } = await supabase
    .from('periods')
    .select('*, prompt:prompts(*)')
    .is('ended_at', null)
    .single<Period>()

  // Fetch public submitted responses for this period
  const { data: responses } = period
    ? await supabase
        .from('responses')
        .select('*, profile:profiles(display_name)')
        .eq('period_id', period.id)
        .eq('is_draft', false)
        .eq('is_public', true)
        .order('submitted_at', { ascending: false })
    : { data: [] }

  // Fetch the current user's response for this period (if any)
  const { data: myResponse } =
    user && period
      ? await supabase
          .from('responses')
          .select('id, is_draft, is_public, submitted_at')
          .eq('period_id', period.id)
          .eq('user_id', user.id)
          .single()
      : { data: null }

  return (
    <div className="flex flex-col gap-10">
      {/* Prompt */}
      {period?.prompt ? (
        <section>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-3">Current prompt</p>
          <h1 className="text-2xl font-semibold leading-snug">{period.prompt.text}</h1>
          <p className="text-sm text-gray-400 mt-2">
            Max {period.prompt.max_response_chars.toLocaleString()} characters
          </p>
        </section>
      ) : (
        <p className="text-gray-500">No active prompt right now. Check back soon.</p>
      )}

      {/* My draft CTA */}
      {user && period && (
        <section>
          {myResponse?.is_draft === false ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
              You have submitted your response for this prompt.{' '}
              <Link href={`/responses/${myResponse.id}`} className="underline text-gray-900">
                View it
              </Link>
            </div>
          ) : (
            <Link
              href="/respond"
              className="inline-block bg-gray-900 text-white rounded-md px-5 py-2.5 font-medium hover:bg-gray-700"
            >
              {myResponse ? 'Continue writing' : 'Start writing'}
            </Link>
          )}
        </section>
      )}

      {!user && (
        <Link href="/login" className="text-sm underline text-gray-500 hover:text-gray-900">
          Sign in to write a response
        </Link>
      )}

      {/* Other responses */}
      {responses && responses.length > 0 && (
        <section>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-4">Responses</p>
          <ul className="flex flex-col gap-4">
            {(responses as Response[]).map((r) => (
              <li key={r.id}>
                <Link
                  href={`/responses/${r.id}`}
                  className="block border border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    {r.profile?.display_name ?? 'Anonymous'}
                  </p>
                  <p className="text-gray-600 text-sm line-clamp-3">{r.content}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
