import express from 'express'
import cors from 'cors'
import { meRouter } from './routes/me'

export const app = express()

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api', meRouter)
