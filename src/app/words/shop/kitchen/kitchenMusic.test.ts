import { describe, expect, it } from "vitest";
import {
  KITCHEN_MUSIC_DUCKED_VOLUME,
  KITCHEN_MUSIC_SRC,
  KITCHEN_MUSIC_VOLUME,
  kitchenMusicStorageKey,
  parseKitchenMusicMuted,
  resolveKitchenMusicVolume,
  serializeKitchenMusicMuted,
  startKitchenMusicPlayback,
  type KitchenMusicDocument,
} from "./kitchenMusic.sound";

/**
 * Stands in for the audio element as playKitchenMusic sees it: play() stays pending
 * until the browser `begin`s playback, and pause() settles every pending play() as
 * failed (a real element rejects them with AbortError, which playKitchenMusic maps to
 * false). `allowed: false` mimics autoplay being blocked.
 */
function fakeMusic({ allowed = true }: { allowed?: boolean } = {}) {
  const state = { isPlaying: false, allowed, playCalls: 0 };
  let pending: Array<(started: boolean) => void> = [];
  return {
    state,
    play: (): Promise<boolean> => {
      state.playCalls += 1;
      if (!state.allowed) return Promise.resolve(false);
      return new Promise<boolean>((resolve) => pending.push(resolve));
    },
    pause: (): void => {
      state.isPlaying = false;
      pending.forEach((resolve) => resolve(false));
      pending = [];
    },
    begin: (): void => {
      if (pending.length === 0) return;
      state.isPlaying = true;
      pending.forEach((resolve) => resolve(true));
      pending = [];
    },
  };
}

class FakeDocument extends EventTarget {
  hidden = false;
}

function asDoc(doc: FakeDocument): KitchenMusicDocument {
  return doc as unknown as KitchenMusicDocument;
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe("kitchen music", () => {
  it("points at the kitchen track", () => {
    expect(KITCHEN_MUSIC_SRC).toBe("/sound/kitchen_01.mp3");
  });

  it("keys the mute choice per profile", () => {
    expect(kitchenMusicStorageKey("user-1")).toBe("hq-kitchen-music-muted:user-1");
    expect(kitchenMusicStorageKey("user-1")).not.toBe(kitchenMusicStorageKey("user-2"));
  });

  it("round-trips the mute choice", () => {
    expect(parseKitchenMusicMuted(serializeKitchenMusicMuted(true))).toBe(true);
    expect(parseKitchenMusicMuted(serializeKitchenMusicMuted(false))).toBe(false);
  });

  it("defaults to playing when nothing or junk is stored", () => {
    expect(parseKitchenMusicMuted(null)).toBe(false);
    expect(parseKitchenMusicMuted("")).toBe(false);
    expect(parseKitchenMusicMuted("true")).toBe(false);
    expect(parseKitchenMusicMuted("not json")).toBe(false);
  });

  it("plays quieter while ducked, and both levels stay quiet", () => {
    expect(resolveKitchenMusicVolume(false)).toBe(KITCHEN_MUSIC_VOLUME);
    expect(resolveKitchenMusicVolume(true)).toBe(KITCHEN_MUSIC_DUCKED_VOLUME);
    expect(KITCHEN_MUSIC_DUCKED_VOLUME).toBeLessThan(KITCHEN_MUSIC_VOLUME);
    expect(KITCHEN_MUSIC_VOLUME).toBeLessThanOrEqual(0.5);
  });
});

describe("startKitchenMusicPlayback", () => {
  it("still plays when an earlier attempt is stopped right before a new one (returning to the kitchen)", async () => {
    // React re-runs the effect on remount: start, stop, start. The first attempt
    // settling late must not pause the second (fix log 2026-10-28).
    const music = fakeMusic();
    const doc = new FakeDocument();
    const stopFirst = startKitchenMusicPlayback({ play: music.play, pause: music.pause, doc: asDoc(doc) });
    stopFirst();
    const stopSecond = startKitchenMusicPlayback({ play: music.play, pause: music.pause, doc: asDoc(doc) });
    await flush();
    music.begin();
    await flush();
    expect(music.state.isPlaying).toBe(true);
    stopSecond();
    expect(music.state.isPlaying).toBe(false);
  });

  it("waits for a tap when autoplay is blocked, then plays", async () => {
    const music = fakeMusic({ allowed: false });
    const doc = new FakeDocument();
    const stop = startKitchenMusicPlayback({ play: music.play, pause: music.pause, doc: asDoc(doc) });
    await flush();
    expect(music.state.playCalls).toBe(1);

    music.state.allowed = true;
    doc.dispatchEvent(new Event("pointerdown"));
    music.begin();
    await flush();
    expect(music.state.isPlaying).toBe(true);

    // Once playing, further taps don't call play again.
    doc.dispatchEvent(new Event("pointerdown"));
    expect(music.state.playCalls).toBe(2);
    stop();
  });

  it("stops listening for taps once stopped", async () => {
    const music = fakeMusic({ allowed: false });
    const doc = new FakeDocument();
    const stop = startKitchenMusicPlayback({ play: music.play, pause: music.pause, doc: asDoc(doc) });
    await flush();
    stop();
    doc.dispatchEvent(new Event("pointerdown"));
    doc.dispatchEvent(new Event("keydown"));
    expect(music.state.playCalls).toBe(1);
  });

  it("pauses while the tab is hidden and resumes when it is shown", async () => {
    const music = fakeMusic();
    const doc = new FakeDocument();
    const stop = startKitchenMusicPlayback({ play: music.play, pause: music.pause, doc: asDoc(doc) });
    music.begin();
    await flush();
    expect(music.state.isPlaying).toBe(true);

    doc.hidden = true;
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(music.state.isPlaying).toBe(false);

    doc.hidden = false;
    doc.dispatchEvent(new Event("visibilitychange"));
    music.begin();
    await flush();
    expect(music.state.isPlaying).toBe(true);
    stop();
  });

  it("does not start while the tab is hidden", async () => {
    const music = fakeMusic();
    const doc = new FakeDocument();
    doc.hidden = true;
    const stop = startKitchenMusicPlayback({ play: music.play, pause: music.pause, doc: asDoc(doc) });
    await flush();
    expect(music.state.playCalls).toBe(0);
    stop();
  });
});
