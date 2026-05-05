import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { supabase } from '../lib/supabase'

export const intentionsRouter = Router()

intentionsRouter.use(requireAuth)

intentionsRouter.get('/intentions/today', async (req, res) => {
  const userId = req.user!.id
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('daily_intentions')
    .select('intention, date')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json({ intention: data?.intention ?? null, date: today })
})

intentionsRouter.post('/intentions', async (req, res) => {
  const userId = req.user!.id
  const { intention } = req.body as { intention?: string }

  if (!intention || typeof intention !== 'string' || intention.trim().length === 0) {
    res.status(400).json({ error: 'intention is required' })
    return
  }

  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('daily_intentions')
    .upsert(
      { user_id: userId, intention: intention.trim(), date: today },
      { onConflict: 'user_id,date' }
    )
    .select('intention, date')
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json(data)
})
