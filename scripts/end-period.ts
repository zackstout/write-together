/**
 * End the current active period and start the next one.
 * Run locally: npx tsx scripts/end-period.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // Find the active period
  const { data: activePeriod, error: fetchError } = await supabase
    .from('periods')
    .select('id, prompt_id, prompts(text)')
    .is('ended_at', null)
    .single()

  if (fetchError || !activePeriod) {
    console.error('No active period found.')
    process.exit(1)
  }

  console.log(`Ending period: ${activePeriod.id}`)

  // End the current period
  const { error: endError } = await supabase
    .from('periods')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', activePeriod.id)

  if (endError) {
    console.error('Failed to end period:', endError.message)
    process.exit(1)
  }

  console.log('Period ended.')

  // Find the next unused prompt
  const { data: usedPromptIds } = await supabase
    .from('periods')
    .select('prompt_id')

  const used = new Set((usedPromptIds ?? []).map((p: { prompt_id: string }) => p.prompt_id))

  const { data: allPrompts, error: promptsError } = await supabase
    .from('prompts')
    .select('id, text')
    .order('created_at', { ascending: true })

  if (promptsError || !allPrompts) {
    console.error('Failed to fetch prompts:', promptsError?.message)
    process.exit(1)
  }

  const nextPrompt = allPrompts.find((p: { id: string; text: string }) => !used.has(p.id))

  if (!nextPrompt) {
    console.log('All prompts have been used. No new period created.')
    process.exit(0)
  }

  // Start a new period
  const { error: newPeriodError } = await supabase
    .from('periods')
    .insert({ prompt_id: nextPrompt.id })

  if (newPeriodError) {
    console.error('Failed to create new period:', newPeriodError.message)
    process.exit(1)
  }

  console.log(`New period started with prompt: "${nextPrompt.text.slice(0, 80)}..."`)
  console.log('Done.')
}

main()
