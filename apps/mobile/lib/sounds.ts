import { Audio } from 'expo-av'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const EMERGENCY_ASSET = require('../assets/emergency.mp3')

let emergencySound: Audio.Sound | null = null

/**
 * Play an urgent alert sound for emergency notifications.
 */
export async function playEmergencySound(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
    })

    if (emergencySound) {
      await emergencySound.unloadAsync()
      emergencySound = null
    }

    const { sound } = await Audio.Sound.createAsync(
      EMERGENCY_ASSET,
      { shouldPlay: true, volume: 1.0 },
    )
    emergencySound = sound

    sound.setOnPlaybackStatusUpdate((status) => {
      if ('didJustFinish' in status && status.didJustFinish) {
        sound.unloadAsync()
        emergencySound = null
      }
    })
  } catch (err) {
    // Best-effort: sound may fail on simulator or without audio focus
  }
}

/**
 * Stop and unload the emergency sound if currently playing.
 */
export async function stopEmergencySound(): Promise<void> {
  if (emergencySound) {
    await emergencySound.stopAsync()
    await emergencySound.unloadAsync()
    emergencySound = null
  }
}
