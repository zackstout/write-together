import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Period, Response } from '@/lib/types'

export default async function ArchivePage() {
  const supabase = await createClient()

  const { data: periods } = await supabase
    .from('periods')
    .select('*, prompt:prompts(*)')
    .not('ended_at', 'is', null)
    .order('ended_at', { ascending: false })

  if (!periods || periods.length === 0) {
    return <p className="text-gray-500">No past prompts yet.</p>
  }

  // Fetch responses for all past periods in one query
  const periodIds = periods.map((p: Period) => p.id)
  const { data: responses } = await supabase
    .from('responses')
    .select('*, profile:profiles(display_name)')
    .in('period_id', periodIds)
    .eq('is_draft', false)
    .eq('is_public', true)
    .order('submitted_at', { ascending: false })

  const responsesByPeriod = ((responses as Response[]) ?? []).reduce<
    Record<string, Response[]>
  >((acc, r) => {
    if (!acc[r.period_id]) acc[r.period_id] = []
    acc[r.period_id].push(r)
    return acc
  }, {})

  return (
    <div className="flex flex-col gap-12">
      <h1 className="text-2xl font-semibold">Archive</h1>
      {(periods as Period[]).map((period) => {
        const periodResponses = responsesByPeriod[period.id] ?? []
        return (
          <section key={period.id} className="flex flex-col gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">
                {new Date(period.started_at).toLocaleDateString()} –{' '}
                {period.ended_at
                  ? new Date(period.ended_at).toLocaleDateString()
                  : 'Present'}
              </p>
              <h2 className="text-lg font-semibold">{period.prompt?.text}</h2>
            </div>
            {periodResponses.length === 0 ? (
              <p className="text-sm text-gray-400">No public responses.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {periodResponses.map((r) => (
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
            )}
          </section>
        )
      })}
    </div>
  )
}
