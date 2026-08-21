import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { email } = await request.json()

  if (!email?.trim()) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  // Record the invitation
  const { error: inviteRecordError } = await supabase
    .from('invitations')
    .insert({ email: email.trim().toLowerCase(), invited_by: user.id })

  if (inviteRecordError) {
    return NextResponse.json({ error: inviteRecordError.message }, { status: 400 })
  }

  // Send the invite email via service role (bypasses RLS)
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(
    email.trim().toLowerCase()
  )

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
