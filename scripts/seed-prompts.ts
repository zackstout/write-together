/**
 * Seed prompts into the database and create the first active period.
 * Run once during initial setup: npx tsx scripts/seed-prompts.ts
 */

import { createClient } from '@supabase/supabase-js'
import { prompts } from '../data/prompts'
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
  console.log(`Inserting ${prompts.length} prompts...`)

  const { data: insertedPrompts, error: promptsError } = await supabase
    .from('prompts')
    .insert(prompts)
    .select()

  if (promptsError) {
    console.error('Failed to insert prompts:', promptsError.message)
    process.exit(1)
  }

  console.log(`Inserted ${insertedPrompts.length} prompts.`)

  // Check if a period already exists
  const { data: existingPeriod } = await supabase
    .from('periods')
    .select('id')
    .is('ended_at', null)
    .single()

  if (existingPeriod) {
    console.log('An active period already exists. Skipping period creation.')
    process.exit(0)
  }

  // Create the first period using the first prompt
  const firstPrompt = insertedPrompts[0]
  const { error: periodError } = await supabase
    .from('periods')
    .insert({ prompt_id: firstPrompt.id })

  if (periodError) {
    console.error('Failed to create first period:', periodError.message)
    process.exit(1)
  }

  console.log(`Created first period with prompt: "${firstPrompt.text.slice(0, 60)}..."`)
  console.log('Done.')
}

main()
