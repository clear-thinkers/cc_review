/**
 * Kitchen Background Music
 *
 * Loops the kitchen's instrumental track while the child is on /words/shop/kitchen
 * (feature spec 2026-10-28-kitchen-background-music.md). Same cached-element pattern
 * as shared/coins.sound.ts. The mute choice only affects this music, never the
 * celebration chime.
 *
 * Last updated: 2026-10-28
 */

export const KITCHEN_MUSIC_SRC = "/sound/kitchen_01.mp3";
export const KITCHEN_MUSIC_VOLUME = 0.3;
/** Volume while the dish-reveal popup is open, so the celebration chime stands out. */
export const KITCHEN_MUSIC_DUCKED_VOLUME = 0.1;

/** Per-profile localStorage key for the mute choice (same precedent as the chef's seen-unlock flag). */
export function kitchenMusicStorageKey(userId: string): string {
  return `hq-kitchen-music-muted:${userId}`;
}

/** "1" means muted; anything else (including nothing stored) means the music plays. */
export function parseKitchenMusicMuted(raw: string | null): boolean {
  return raw === "1";
}

export function serializeKitchenMusicMuted(muted: boolean): string {
  return muted ? "1" : "0";
}

export function resolveKitchenMusicVolume(ducked: boolean): number {
  return ducked ? KITCHEN_MUSIC_DUCKED_VOLUME : KITCHEN_MUSIC_VOLUME;
}

// Audio instance cached so leaving and returning resumes the same track position.
let kitchenMusic: HTMLAudioElement | null = null;

function getKitchenMusic(): HTMLAudioElement {
  if (!kitchenMusic) {
    kitchenMusic = new Audio(KITCHEN_MUSIC_SRC);
    kitchenMusic.loop = true;
    kitchenMusic.volume = KITCHEN_MUSIC_VOLUME;
  }
  return kitchenMusic;
}

/**
 * Starts (or resumes) the music. Resolves false when the browser refuses -- usually
 * autoplay before the child has interacted with the page -- so the caller can retry
 * on the next tap. Never throws.
 */
export async function playKitchenMusic(): Promise<boolean> {
  try {
    await getKitchenMusic().play();
    return true;
  } catch (error) {
    // NotAllowedError = autoplay blocked; AbortError = a pause() interrupted it. Both expected.
    const isExpected =
      error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "AbortError");
    if (!isExpected) console.warn("Failed to play kitchen music:", error);
    return false;
  }
}

export function pauseKitchenMusic(): void {
  kitchenMusic?.pause();
}

export function setKitchenMusicDucked(ducked: boolean): void {
  if (kitchenMusic) kitchenMusic.volume = resolveKitchenMusicVolume(ducked);
}

// Capture phase so a tap that a modal or hotspot stops still counts as the gesture.
// The object form (not a bare `true`) is removed reliably in every EventTarget.
const GESTURE_LISTENER_OPTIONS = { capture: true } as const;

export type KitchenMusicDocument = Pick<Document, "hidden" | "addEventListener" | "removeEventListener">;

/**
 * One "music should be playing" period, as used by useKitchenMusic's effect. Plays
 * now if it can; if the browser refuses, retries on the next tap or key press. Pauses
 * while the tab is hidden. Returns the stop function (the effect's cleanup).
 *
 * A stopped period must never pause on its own after stopping: stop() already paused,
 * and a late pause from an old period would cut off a newer one -- which is exactly
 * what happened on returning to the kitchen, when React re-runs the effect
 * (start, stop, start) and the first attempt finished after the second began
 * (fix log 2026-10-28-kitchen-music-silent-after-return).
 */
export function startKitchenMusicPlayback({
  play = playKitchenMusic,
  pause = pauseKitchenMusic,
  doc = document,
}: {
  play?: () => Promise<boolean>;
  pause?: () => void;
  doc?: KitchenMusicDocument;
} = {}): () => void {
  let isStopped = false;
  let isWaitingForGesture = false;

  function stopWaitingForGesture(): void {
    if (!isWaitingForGesture) return;
    isWaitingForGesture = false;
    doc.removeEventListener("pointerdown", handleGesture, GESTURE_LISTENER_OPTIONS);
    doc.removeEventListener("keydown", handleGesture, GESTURE_LISTENER_OPTIONS);
  }

  async function tryPlay(): Promise<void> {
    if (doc.hidden) return;
    const started = await play();
    if (isStopped) return;
    if (started) {
      stopWaitingForGesture();
    } else if (!isWaitingForGesture) {
      isWaitingForGesture = true;
      doc.addEventListener("pointerdown", handleGesture, GESTURE_LISTENER_OPTIONS);
      doc.addEventListener("keydown", handleGesture, GESTURE_LISTENER_OPTIONS);
    }
  }

  function handleGesture(): void {
    void tryPlay();
  }

  function handleVisibilityChange(): void {
    if (doc.hidden) pause();
    else void tryPlay();
  }

  doc.addEventListener("visibilitychange", handleVisibilityChange);
  void tryPlay();

  return () => {
    isStopped = true;
    stopWaitingForGesture();
    doc.removeEventListener("visibilitychange", handleVisibilityChange);
    pause();
  };
}
