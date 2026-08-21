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
