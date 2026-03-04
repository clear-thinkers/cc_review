/**
 * Coin Celebration Sound Utility
 *
 * Handles playing celebratory sound effects when coins are earned.
 * Integrates with app-level sound settings.
 *
 * Last updated: 2026-03-04
 */

// Audio instance cached to avoid creating multiple instances
let celebrationAudio: HTMLAudioElement | null = null;

/**
 * Preloads the celebration sound file.
 * Called once on app initialization or on first use.
 */
function preloadCelebrationSound(): void {
  if (!celebrationAudio) {
    celebrationAudio = new Audio("/sound/celebration_chime.wav");
    // Preload but don't autoplay
    celebrationAudio.preload = "auto";
  }
}

/**
 * Plays celebration sound for coin earnings.
 *
 * Respects mute settings. Defaults to sound ON if no settings configured.
 * Gracefully handles missing audio file or playback errors.
 *
 * @param isMuted - Whether sound is muted. Defaults to false (sound enabled).
 */
export function playCelebrationSound(isMuted: boolean = false): void {
  try {
    if (isMuted) {
      return;
    }

    preloadCelebrationSound();

    if (celebrationAudio) {
      // Reset audio to start for rapid-fire plays
      celebrationAudio.currentTime = 0;
      
      const playPromise = celebrationAudio.play();
      
      // Handle promise-based playback (modern browsers)
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.warn("Failed to play celebration sound:", error);
        });
      }
    }
  } catch (error) {
    console.warn("Error playing celebration sound:", error);
    // Silently fail - don't disrupt gameplay
  }
}

/**
 * Stops and resets the celebration sound.
 * Useful for cleanup or testing.
 */
export function stopCelebrationSound(): void {
  if (celebrationAudio) {
    celebrationAudio.pause();
    celebrationAudio.currentTime = 0;
  }
}
