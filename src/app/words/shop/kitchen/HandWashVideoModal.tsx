"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { HAND_WASH_VIDEO_SRC, HAND_WASH_VIDEO_START_TIMEOUT_MS } from "./kitchen.types";

/**
 * The "Shrewy washes his hands" reward (roadmap item T; spec section C). Plays once
 * after every recipe choice once the child has redeemed it. It can't be skipped (no
 * close button, the backdrop does nothing) and plays even with reduced motion -- both
 * owner decisions. It must never block cooking: if playback hasn't started within
 * HAND_WASH_VIDEO_START_TIMEOUT_MS it retries muted once, and if that fails too (or the
 * file errors) it finishes as if the video had ended.
 */
export default function HandWashVideoModal({ ariaLabel, onFinished }: { ariaLabel: string; onFinished: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const finishedRef = useRef(false);
  const onFinishedRef = useRef(onFinished);

  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let started = false;
    let retriedMuted = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    // A cleaned-up run must never finish the video: its pending play() is rejected by
    // the cleanup's pause(), and acting on that would cut off the run that replaced it
    // (the same trap as fix log 2026-10-28-kitchen-music-silent-after-return).
    let active = true;

    function finish(): void {
      if (!active || finishedRef.current) return;
      finishedRef.current = true;
      onFinishedRef.current();
    }

    function tryPlay(): void {
      video?.play().catch(() => {
        if (!active) return;
        if (!retriedMuted && video) {
          retriedMuted = true;
          video.muted = true;
          video.play().catch(finish);
        } else {
          finish();
        }
      });
    }

    const handlePlaying = () => {
      started = true;
    };
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("ended", finish);
    video.addEventListener("error", finish);
    tryPlay();

    timers.push(
      setTimeout(() => {
        if (started) return;
        if (!retriedMuted) {
          retriedMuted = true;
          video.muted = true;
          video.play().catch(finish);
          timers.push(
            setTimeout(() => {
              if (!started) finish();
            }, HAND_WASH_VIDEO_START_TIMEOUT_MS)
          );
        } else {
          finish();
        }
      }, HAND_WASH_VIDEO_START_TIMEOUT_MS)
    );

    return () => {
      active = false;
      timers.forEach(clearTimeout);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("ended", finish);
      video.removeEventListener("error", finish);
      video.pause();
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className="w-full max-w-2xl overflow-hidden rounded-[1.5rem] border-2 border-[#dcc38a] bg-[#fffaf0] shadow-[0_24px_60px_rgba(85,122,84,0.25)]"
      >
        <video
          ref={videoRef}
          src={HAND_WASH_VIDEO_SRC}
          playsInline
          preload="auto"
          className="block aspect-video w-full bg-[#fcf3df]"
        />
      </div>
    </div>,
    document.body
  );
}
