import 'dotenv/config'
import { app } from './app'
import { detectSilentUsers } from './services/silenceDetector'

const PORT = process.env.PORT ?? 3000

const DETECTION_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

app.listen(PORT, () => {
  console.log(`circly server running on port ${PORT}`)

  // Run silence detection hourly.
  setInterval(async () => {
    try {
      const result = await detectSilentUsers()
      if (result.nudges_sent > 0) {
        console.log(`silence detection: ${result.users_detected} silent, ${result.nudges_sent} nudges sent`)
      }
    } catch (err) {
      console.error('silence detection error:', err)
    }
  }, DETECTION_INTERVAL_MS)
})
