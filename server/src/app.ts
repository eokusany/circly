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

app.get('/privacy', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Privacy Policy - Circly</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#1a1a1a;line-height:1.6}
h1{font-size:28px}h2{font-size:18px;margin-top:32px}p,ul{font-size:15px;color:#444}ul{padding-left:20px}</style></head>
<body>
<h1>privacy policy</h1>
<p style="color:#888">last updated: april 2026</p>

<h2>what circly is</h2>
<p>circly is a mobile app that helps people stay connected to the people who support them. it is not a medical device, therapy tool, or emergency service.</p>

<h2>what we collect</h2>
<p>when you create an account, we collect your email address, display name, and the role you choose (user or supporter).</p>
<p>when you use the app, we store:</p>
<ul>
<li>check-in statuses and dates</li>
<li>journal entries (always private, never shared with supporters)</li>
<li>"i'm okay" tap timestamps</li>
<li>messages you send in conversations</li>
<li>notification preferences and silence detection settings</li>
</ul>
<p>we do not collect location data, contacts, photos, or browsing history.</p>

<h2>how we use your data</h2>
<p>your data is used to:</p>
<ul>
<li>show your supporters the updates you have chosen to share</li>
<li>detect silence and send nudges to your supporters</li>
<li>deliver notifications (warm pings, encouragements, alerts)</li>
<li>calculate your streak and milestones</li>
</ul>
<p>we do not sell your data. we do not use your data for advertising. we do not share your data with third parties except as needed to run the service (hosting, push notifications).</p>

<h2>what supporters can see</h2>
<p>supporters can only see what you have explicitly allowed: check-in statuses, milestones, and messages in shared conversations. supporters can never see your journal entries, "i'm okay" tap history, or silence detection settings.</p>

<h2>journal privacy</h2>
<p>journal entries are always private. they are stored encrypted at rest and are never visible to supporters. journal data is protected by biometric authentication on your device.</p>

<h2>data storage and security</h2>
<p>your data is stored in a secure database with row-level security policies. all data is transmitted over HTTPS. authentication tokens are stored securely on your device.</p>

<h2>account deletion</h2>
<p>you can delete your account at any time from the profile screen. all data is permanently removed. this cannot be undone.</p>

<h2>children</h2>
<p>circly is not intended for use by anyone under 13. we do not knowingly collect personal information from children.</p>

<h2>changes to this policy</h2>
<p>if we make significant changes, we will notify you through the app. continued use constitutes acceptance of the updated policy.</p>

<h2>contact</h2>
<p>questions? reach us at support@circly.app</p>
</body></html>`)
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
