import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { Sentry } from './lib/sentry'
import { meRouter } from './routes/me'
import { emergencyRouter } from './routes/emergency'
import { invitesRouter } from './routes/invites'
import { encouragementsRouter } from './routes/encouragements'
import { okayTapRouter } from './routes/okay-tap'
import { silenceSettingsRouter } from './routes/silence-settings'
import { warmPingRouter } from './routes/warm-ping'
import { internalRouter } from './routes/internal'
import { messagesRouter } from './routes/messages'
import { pushTokenRouter } from './routes/push-token'

export const app = express()

app.use(helmet())
app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api', meRouter)
app.use('/api', emergencyRouter)
app.use('/api', invitesRouter)
app.use('/api', encouragementsRouter)
app.use('/api', okayTapRouter)
app.use('/api', silenceSettingsRouter)
app.use('/api', warmPingRouter)
app.use('/api', internalRouter)
app.use('/api', messagesRouter)
app.use('/api', pushTokenRouter)

// Sentry error handler — must be registered after all controllers
Sentry.setupExpressErrorHandler(app)

// Fallback error handler — return safe response
app.use((_err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'something went wrong' } })
})
