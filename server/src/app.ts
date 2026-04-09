import express from 'express'
import cors from 'cors'
import { meRouter } from './routes/me'
import { emergencyRouter } from './routes/emergency'
import { invitesRouter } from './routes/invites'
import { encouragementsRouter } from './routes/encouragements'

export const app = express()

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api', meRouter)
app.use('/api', emergencyRouter)
app.use('/api', invitesRouter)
app.use('/api', encouragementsRouter)
