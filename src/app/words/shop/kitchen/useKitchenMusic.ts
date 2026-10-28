"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  kitchenMusicStorageKey,
  parseKitchenMusicMuted,
  pauseKitchenMusic,
  playKitchenMusic,
  serializeKitchenMusicMuted,
  setKitchenMusicDucked,
  startKitchenMusicPlayback,
} from "./kitchenMusic.sound";

// The mute choice lives in localStorage per profile; this tiny store lets
// useSyncExternalStore read it without a hydration mismatch (the server snapshot is
// always "not muted"). The in-memory copy covers a storage-less private window.
const mutedInMemory = new Map<string, boolean>();
const muteListeners = new Set<() => void>();

function subscribeToMute(listener: () => void): () => void {
  muteListeners.add(listener);
  return () => muteListeners.delete(listener);
}

// With no profile id yet the choice is kept in memory only, under "".
function readMuted(userId: string | null): boolean {
  const remembered = mutedInMemory.get(userId ?? "");
  if (remembered !== undefined) return remembered;
  if (!userId) return false;
  try {
    return parseKitchenMusicMuted(window.localStorage.getItem(kitchenMusicStorageKey(userId)));
  } catch {
    return false;
  }
}

function writeMuted(userId: string | null, muted: boolean): void {
  mutedInMemory.set(userId ?? "", muted);
  if (userId) {
    try {
      window.localStorage.setItem(kitchenMusicStorageKey(userId), serializeKitchenMusicMuted(muted));
    } catch {
      // storage unavailable: the in-memory copy still holds it for this visit
    }
  }
  muteListeners.forEach((listener) => listener());
}

/**
 * Plays the kitchen's background music while `active` and not muted (feature spec
 * 2026-10-28-kitchen-background-music.md). Tries to start at once; if the browser
 * blocks autoplay, starts on the next tap or key press. Pauses when inactive or the
 * tab is hidden, and plays quieter while `ducked`. Purely presentational.
 */
export function useKitchenMusic({
  userId,
  active,
  ducked,
}: {
  userId: string | null;
  active: boolean;
  ducked: boolean;
}): { isMuted: boolean; toggleMuted: () => void } {
  const isMuted = useSyncExternalStore(
    subscribeToMute,
    () => readMuted(userId),
    () => false
  );
  const shouldPlay = active && !isMuted;

  useEffect(() => {
    if (!shouldPlay) {
      pauseKitchenMusic();
      return;
    }
    return startKitchenMusicPlayback();
  }, [shouldPlay]);

  useEffect(() => {
    setKitchenMusicDucked(ducked);
  }, [ducked]);

  const toggleMuted = useCallback(() => {
    const nextMuted = !readMuted(userId);
    writeMuted(userId, nextMuted);
    // Act inside the click itself too: some browsers only allow play() during the gesture.
    if (nextMuted) pauseKitchenMusic();
    else if (active) void playKitchenMusic();
  }, [userId, active]);

  return { isMuted, toggleMuted };
}
