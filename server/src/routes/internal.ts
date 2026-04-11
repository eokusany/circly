import { Router } from 'express'
import { detectSilentUsers } from '../services/silenceDetector'

export const internalRouter = Router()

const INTERNAL_KEY = process.env.INTERNAL_API_KEY

// Trigger silence detection. Protected by a shared secret.
internalRouter.post('/internal/detect-silence', async (req, res) => {
  if (!INTERNAL_KEY || req.headers['x-internal-key'] !== INTERNAL_KEY) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  const result = await detectSilentUsers()
  res.json(result)
})
