import 'dotenv/config'
import { app } from './app'
import { detectSilentUsers } from './services/silenceDetector'

const PORT = process.env.PORT ?? 3000

const DETECTION_INTERVAL_MS = 60 * 60 * 1000 // 1 hour
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 30 * 1000 // 30 seconds

async function runSilenceDetection(attempt = 1): Promise<void> {
  try {
    const result = await detectSilentUsers()
    console.log(
      `[silence-detection] run complete — ${result.users_detected} silent, ${result.nudges_sent} nudges sent`,
    )
  } catch (err) {
    console.error(`[silence-detection] attempt ${attempt} failed:`, err)
    if (attempt < MAX_RETRIES) {
      console.log(`[silence-detection] retrying in ${RETRY_DELAY_MS / 1000}s...`)
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
      return runSilenceDetection(attempt + 1)
    }
    console.error('[silence-detection] all retries exhausted')
  }
}

app.listen(PORT, () => {
  console.log(`circly server running on port ${PORT}`)

  // Run silence detection on startup (delayed 10s to let connections settle)
  // and then hourly.
  setTimeout(() => {
    runSilenceDetection()
    setInterval(runSilenceDetection, DETECTION_INTERVAL_MS)
  }, 10_000)
})
