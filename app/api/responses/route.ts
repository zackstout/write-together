import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { periodId, responseId, content, isPublic } = await request.json()

  // Look up the character limit from the active period's prompt
  const lookupPeriodId = periodId ?? (
    responseId
      ? (await supabase.from('responses').select('period_id').eq('id', responseId).single()).data?.period_id
      : null
  )

  if (lookupPeriodId) {
    const { data: period } = await supabase
      .from('periods')
      .select('prompt:prompts(max_response_chars)')
      .eq('id', lookupPeriodId)
      .single()

    const maxChars = (period?.prompt as { max_response_chars?: number } | null)?.max_response_chars
    if (maxChars && typeof content === 'string' && content.length > maxChars) {
      return NextResponse.json(
        { error: `Response exceeds the ${maxChars} character limit` },
        { status: 400 }
      )
    }
  }

  if (responseId) {
    // Update existing draft
    const { data, error } = await supabase
      .from('responses')
      .update({ content, is_public: isPublic })
      .eq('id', responseId)
      .eq('user_id', user.id)
      .eq('is_draft', true)
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data)
  }

  // Create new draft
  const { data, error } = await supabase
    .from('responses')
    .insert({
      period_id: periodId,
      user_id: user.id,
      content,
      is_public: isPublic,
      is_draft: true,
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data, { status: 201 })
}
