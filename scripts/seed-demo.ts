/**
 * Seed demo accounts for App Store review.
 *
 * Creates two linked accounts with realistic historical data so the Apple
 * reviewer can see the full experience without needing two devices.
 *
 * Usage:
 *   npx tsx scripts/seed-demo.ts
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment
 * (load from server/.env or export manually).
 */

import { config } from 'dotenv'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

// Load env from server/.env
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', 'server', '.env') })

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Demo credentials -- change the password before submitting to App Store Connect
const RECOVERY_EMAIL = 'demo@circly.app'
const SUPPORTER_EMAIL = 'demo-supporter@circly.app'
const PASSWORD = 'Circly2026!'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function dateOnly(d: Date): string {
  return d.toISOString().split('T')[0]
}

async function upsertAuthUser(
  email: string,
  password: string,
  displayName: string,
): Promise<string> {
  // Check if user already exists
  const { data: existing } = await supabase.auth.admin.listUsers()
  const found = existing?.users?.find((u) => u.email === email)

  if (found) {
    console.log(`  auth user ${email} already exists (${found.id})`)
    return found.id
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName, context: 'recovery' },
  })

  if (error) throw new Error(`Failed to create auth user ${email}: ${error.message}`)
  console.log(`  created auth user ${email} (${data.user.id})`)
  return data.user.id
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding demo accounts...\n')

  // 1. Create auth users
  console.log('1. Creating auth users')
  const recoveryId = await upsertAuthUser(RECOVERY_EMAIL, PASSWORD, 'Alex')
  const supporterId = await upsertAuthUser(SUPPORTER_EMAIL, PASSWORD, 'Jordan')

  // 2. Create public.users rows
  console.log('\n2. Creating public.users rows')
  await supabase.from('users').upsert({
    id: recoveryId,
    email: RECOVERY_EMAIL,
    display_name: 'Alex',
    role: 'recovery',
    context: 'recovery',
  })
  await supabase.from('users').upsert({
    id: supporterId,
    email: SUPPORTER_EMAIL,
    display_name: 'Jordan',
    role: 'supporter',
    context: 'recovery',
  })
  console.log('  done')

  // 3. Create profiles
  console.log('\n3. Creating profiles')
  const sobrietyStart = dateOnly(daysAgo(35))
  await supabase.from('profiles').upsert({
    user_id: recoveryId,
    sobriety_start_date: sobrietyStart,
  })
  await supabase.from('profiles').upsert({
    user_id: supporterId,
  })
  console.log(`  recovery sobriety start: ${sobrietyStart} (35 days ago)`)

  // 4. Create relationship
  console.log('\n4. Creating relationship')
  const { data: existingRel } = await supabase
    .from('relationships')
    .select('id')
    .eq('recovery_user_id', recoveryId)
    .eq('supporter_id', supporterId)
    .maybeSingle()

  let relationshipId: string
  if (existingRel) {
    relationshipId = (existingRel as { id: string }).id
    await supabase
      .from('relationships')
      .update({ status: 'active' })
      .eq('id', relationshipId)
    console.log(`  relationship already exists (${relationshipId}), ensured active`)
  } else {
    const { data: rel, error: relErr } = await supabase
      .from('relationships')
      .insert({
        recovery_user_id: recoveryId,
        supporter_id: supporterId,
        status: 'active',
      })
      .select()
      .single()
    if (relErr) throw new Error(`Failed to create relationship: ${relErr.message}`)
    relationshipId = (rel as { id: string }).id
    console.log(`  created relationship (${relationshipId})`)
  }

  // 5. Create conversation
  console.log('\n5. Creating conversation')
  const { data: existingConvo } = await supabase
    .from('conversations')
    .select('id')
    .contains('participant_ids', [recoveryId, supporterId])
    .maybeSingle()

  let conversationId: string
  if (existingConvo) {
    conversationId = (existingConvo as { id: string }).id
    console.log(`  conversation already exists (${conversationId})`)
  } else {
    const { data: convo, error: convoErr } = await supabase
      .from('conversations')
      .insert({
        type: 'direct',
        participant_ids: [recoveryId, supporterId],
      })
      .select()
      .single()
    if (convoErr) throw new Error(`Failed to create conversation: ${convoErr.message}`)
    conversationId = (convo as { id: string }).id
    console.log(`  created conversation (${conversationId})`)
  }

  // 6. Seed check-ins (last 14 days)
  console.log('\n6. Seeding check-ins')
  const checkInStatuses: Array<'sober' | 'good_day' | 'struggling'> = [
    'sober', 'sober', 'good_day', 'sober', 'struggling', 'sober', 'good_day',
    'sober', 'sober', 'good_day', 'sober', 'sober', 'good_day', 'sober',
  ]
  for (let i = 0; i < checkInStatuses.length; i++) {
    const date = dateOnly(daysAgo(checkInStatuses.length - 1 - i))
    await supabase.from('check_ins').upsert(
      {
        id: randomUUID(),
        user_id: recoveryId,
        status: checkInStatuses[i],
        check_in_date: date,
        created_at: daysAgo(checkInStatuses.length - 1 - i).toISOString(),
      },
      { onConflict: 'user_id,check_in_date' },
    )
  }
  console.log(`  seeded ${checkInStatuses.length} check-ins`)

  // 7. Seed milestones
  console.log('\n7. Seeding milestones')
  const milestones: Array<{ type: string; daysAfterStart: number }> = [
    { type: '1d', daysAfterStart: 1 },
    { type: '7d', daysAfterStart: 7 },
    { type: '30d', daysAfterStart: 30 },
  ]
  for (const ms of milestones) {
    const achievedAt = new Date(new Date(sobrietyStart).getTime() + ms.daysAfterStart * 86400000)
    await supabase.from('milestones').upsert(
      {
        id: randomUUID(),
        user_id: recoveryId,
        type: ms.type,
        achieved_at: achievedAt.toISOString(),
      },
      { onConflict: 'user_id,type' },
    )
  }
  console.log(`  seeded ${milestones.length} milestones (1d, 7d, 30d)`)

  // 8. Seed journal entries
  console.log('\n8. Seeding journal entries')
  const journals = [
    { body: 'First week done. Harder than I expected but I made it.', mood: 'hopeful', daysAgo: 28 },
    { body: 'Had a tough day at work. Went for a walk instead.', mood: 'mixed', daysAgo: 20 },
    { body: 'Feeling stronger this week. The daily check-ins help.', mood: 'good', daysAgo: 10 },
    { body: '30 days. Still processing but grateful for my circle.', mood: 'grateful', daysAgo: 5 },
  ]
  for (const j of journals) {
    await supabase.from('journal_entries').insert({
      user_id: recoveryId,
      body: j.body,
      mood_tag: j.mood,
      is_private: true,
      created_at: daysAgo(j.daysAgo).toISOString(),
    })
  }
  console.log(`  seeded ${journals.length} journal entries`)

  // 9. Seed messages
  console.log('\n9. Seeding messages')
  const messages = [
    { sender: supporterId, body: 'Hey, just wanted you to know I am here for you.', daysAgo: 30 },
    { sender: recoveryId, body: 'Thanks Jordan, that means a lot.', daysAgo: 30 },
    { sender: supporterId, body: 'One week! So proud of you.', daysAgo: 28 },
    { sender: recoveryId, body: 'One day at a time.', daysAgo: 28 },
    { sender: supporterId, body: 'Saw your check-in today. You got this.', daysAgo: 14 },
    { sender: recoveryId, body: 'Rough day but hanging in there.', daysAgo: 14 },
    { sender: supporterId, body: '30 days!! Amazing.', daysAgo: 5 },
    { sender: recoveryId, body: 'Could not have done it without you.', daysAgo: 5 },
  ]
  for (const m of messages) {
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: m.sender,
      body: m.body,
      created_at: daysAgo(m.daysAgo).toISOString(),
    })
  }
  console.log(`  seeded ${messages.length} messages`)

  // 10. Seed okay taps (last 7 days)
  console.log('\n10. Seeding okay taps')
  for (let i = 0; i < 7; i++) {
    await supabase.from('okay_taps').insert({
      user_id: recoveryId,
      tapped_at: daysAgo(i).toISOString(),
    })
  }
  console.log('  seeded 7 okay taps')

  // 11. Seed silence settings
  console.log('\n11. Seeding silence settings')
  await supabase.from('silence_settings').upsert({
    user_id: recoveryId,
    okay_tap_enabled: true,
    okay_tap_time: '09:00',
    silence_threshold_days: 2,
  })
  console.log('  done')

  // Done
  console.log('\n---')
  console.log('Demo accounts seeded successfully!\n')
  console.log('Recovery account:')
  console.log(`  Email:    ${RECOVERY_EMAIL}`)
  console.log(`  Password: ${PASSWORD}`)
  console.log(`  Name:     Alex (35-day streak, 3 milestones)\n`)
  console.log('Supporter account:')
  console.log(`  Email:    ${SUPPORTER_EMAIL}`)
  console.log(`  Password: ${PASSWORD}\n`)
  console.log(`  Name:     Jordan (linked to Alex)\n`)
  console.log('Add the recovery credentials to App Store Connect:')
  console.log('  TestFlight > Test Information > Beta App Review Information')
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
