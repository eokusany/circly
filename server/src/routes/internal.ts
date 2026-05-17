import { Router } from 'express'
import { timingSafeEqual } from 'node:crypto'
import { detectSilentUsers } from '../services/silenceDetector'

export const internalRouter = Router()

const INTERNAL_KEY = process.env.INTERNAL_API_KEY
const EXPECTED_KEY_BUF = INTERNAL_KEY ? Buffer.from(INTERNAL_KEY, 'utf8') : null

function keysMatch(provided: unknown): boolean {
  if (!EXPECTED_KEY_BUF || typeof provided !== 'string') return false
  const providedBuf = Buffer.from(provided, 'utf8')
  if (providedBuf.length !== EXPECTED_KEY_BUF.length) return false
  return timingSafeEqual(providedBuf, EXPECTED_KEY_BUF)
}

// Trigger silence detection. Protected by a shared secret.
internalRouter.post('/internal/detect-silence', async (req, res) => {
  if (!keysMatch(req.headers['x-internal-key'])) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  const result = await detectSilentUsers()
  res.json(result)
})
