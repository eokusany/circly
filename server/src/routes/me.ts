import { Router } from 'express'
import { requireAuth } from '../middleware/auth'

export const meRouter = Router()

meRouter.get('/me', requireAuth, (req, res) => {
  // requireAuth guarantees req.user is populated
  res.json({ id: req.user!.id, email: req.user!.email })
})
