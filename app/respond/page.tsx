import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ResponseEditor from '@/components/ResponseEditor'
import type { Period } from '@/lib/types'

export default async function RespondPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Get the active period
  const { data: period } = await supabase
    .from('periods')
    .select('*, prompt:prompts(*)')
    .is('ended_at', null)
    .single<Period>()

  if (!period?.prompt) {
    return (
      <p className="text-gray-500">
        There is no active prompt right now. Check back soon.
      </p>
    )
  }

  // Get or prepare the user's draft
  const { data: existingResponse } = await supabase
    .from('responses')
    .select('id, content, is_draft, is_public')
    .eq('period_id', period.id)
    .eq('user_id', user.id)
    .single()

  if (existingResponse && !existingResponse.is_draft) {
    redirect(`/responses/${existingResponse.id}`)
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Current prompt</p>
        <h1 className="text-xl font-semibold leading-snug">{period.prompt.text}</h1>
        <p className="text-sm text-gray-400 mt-1">
          Max {period.prompt.max_response_chars.toLocaleString()} characters
        </p>
      </section>

      <ResponseEditor
        periodId={period.id}
        maxChars={period.prompt.max_response_chars}
        initialContent={existingResponse?.content ?? ''}
        initialIsPublic={existingResponse?.is_public ?? true}
        responseId={existingResponse?.id ?? null}
      />
    </div>
  )
}
