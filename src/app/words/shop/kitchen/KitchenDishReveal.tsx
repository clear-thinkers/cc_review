"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { playCelebrationSound } from "../../shared/coins.sound";
import { KITCHEN_DISH_REVEAL_FINISH_MS } from "./kitchen.types";
import styles from "./kitchenScene.animation.module.css";

const CONFETTI_COLORS = ["#ffcf5a", "#ff8fab", "#7bdff2", "#b8f2a1", "#c3a6ff", "#ff9f43"];
const CONFETTI_COUNT = 28;

/** Fixed, evenly fanned confetti (no randomness at render): direction, distance and spin per piece. */
const CONFETTI_PIECES = Array.from({ length: CONFETTI_COUNT }, (_, index) => {
  const angle = ((index * 360) / CONFETTI_COUNT + ((index * 37) % 17)) * (Math.PI / 180);
  const distance = 150 + ((index * 53) % 110);
  return {
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    dx: `${Math.round(Math.cos(angle) * distance)}px`,
    dy: `${Math.round(Math.sin(angle) * distance + 40)}px`,
    spin: `${(index % 2 === 0 ? 1 : -1) * (240 + ((index * 41) % 300))}deg`,
    delayMs: (index % 5) * 30,
  };
});

/**
 * The finished dish, full-size, after a recipe scene's ~3 s cook (2026-10-27). It
 * stays up until the child presses Finish -- the backdrop doesn't close it -- and
 * Finish plays the shared celebration chime (coins.sound.ts) with a ring burst and
 * confetti before calling `onFinished`. Rendered into document.body like the
 * kitchen's other modals; the confetti's direction/spin are per-piece CSS variables,
 * so inline style is the documented exception (BUILD_CONVENTIONS.md §7).
 */
export default function KitchenDishReveal({
  heading,
  iconPath,
  finishLabel,
  onFinished,
}: {
  heading: string;
  iconPath: string | null;
  finishLabel: string;
  onFinished: () => void;
}) {
  const [isFinishing, setIsFinishing] = useState(false);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    },
    []
  );

  if (typeof document === "undefined") return null;

  function handleFinish(): void {
    if (isFinishing) return;
    setIsFinishing(true);
    playCelebrationSound(false);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    finishTimerRef.current = setTimeout(onFinished, reducedMotion ? 500 : KITCHEN_DISH_REVEAL_FINISH_MS);
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/45 p-4">
      <div className="flex min-h-full items-center justify-center">
        <div
          className="relative w-full max-w-md rounded-[1.5rem] border-2 border-[#dcc38a] bg-[#fffaf0] p-6 text-center shadow-[0_24px_60px_rgba(85,122,84,0.18)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kitchen-dish-reveal-title"
        >
          <h2 id="kitchen-dish-reveal-title" className="text-2xl font-bold text-[#5c4720]">
            {heading}
          </h2>

          <div className="relative mx-auto mt-4 aspect-square w-full max-w-xs">
            <span aria-hidden="true" className={styles.revealRays} />
            {iconPath ? <img src={iconPath} alt="" draggable={false} className={styles.revealDish} /> : null}
            {isFinishing ? (
              <div aria-hidden="true">
                <span className={styles.finishRing} />
                {CONFETTI_PIECES.map((piece, index) => (
                  <span
                    key={index}
                    className={styles.confetti}
                    style={
                      {
                        background: piece.color,
                        "--dx": piece.dx,
                        "--dy": piece.dy,
                        "--spin": piece.spin,
                        animationDelay: `${piece.delayMs}ms`,
                      } as CSSProperties
                    }
                  />
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            autoFocus
            disabled={isFinishing}
            onClick={handleFinish}
            className="relative mt-5 w-full rounded-full border-2 border-[#8b6f2f] bg-[#f7ead0] px-6 py-3 text-lg font-bold text-[#5c4720] shadow-[0_3px_8px_rgba(139,111,47,0.3)] transition hover:bg-[#f0dfb8] disabled:opacity-60"
          >
            {finishLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
