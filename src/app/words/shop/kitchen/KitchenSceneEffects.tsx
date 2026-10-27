"use client";

import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import {
  KITCHEN_SCENE_COOK_MS,
  KITCHEN_SCENE_FLY_MS,
  type KitchenSceneEffectsLayout,
  type KitchenScenePoint,
  type KitchenScenePrepToken,
} from "./kitchen.types";
import styles from "./kitchenScene.animation.module.css";

/** md+ overrides that move the bubble from above the chef to beside him. */
const BUBBLE_BESIDE_ON_WIDE_CLASSES = {
  right: "md:bottom-auto md:mb-0 md:top-0 md:left-full md:right-auto md:ml-2",
  left: "md:bottom-auto md:mb-0 md:top-0 md:right-full md:left-auto md:mr-2",
} as const;

/** A press that moves less than this (px) is a tap, not a drag. */
const DRAG_THRESHOLD_PX = 6;

/** How far (as a fraction of the pot box) a drop may miss the pot and still count -- small hands. */
const POT_DROP_TOLERANCE = 0.35;

type Drag = { key: string; startX: number; startY: number; left: number; top: number; moved: boolean; overPot: boolean };
type Flight = { id: number; iconPath: string; from: KitchenScenePoint };

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The animation layer over a recipe's own kitchen scene (2026-10-27): ambient
 * steam, glow and sparkles; the prep step, where the child drags each needed
 * ingredient from its spot into the pot one unit at a time (a tap, or Enter on
 * the focused token, sends one in too); the ~3 s boil while `cooking` (the dish is
 * then revealed by KitchenDishReveal); and the painted chef's speech bubble plus a
 * tap area over him, since these scenes draw Chef Shrewy and hide his sprite. A unit counts the moment it's released over the pot; the arc into
 * the pot that follows is only decoration.
 *
 * Positions are percentage anchors tied to one artwork, so inline style is the same
 * documented exception KitchenChef and SceneHotspot use (BUILD_CONVENTIONS.md §7);
 * keyframes live in kitchenScene.animation.module.css. The layer is
 * pointer-events-none except the tokens and the chef's tap area, which sit clear
 * of every hotspot.
 */
export default function KitchenSceneEffects({
  effects,
  prepTokens,
  prepComplete,
  prompt,
  tokenAriaLabel,
  onAddIngredient,
  cooking,
  chefLine,
  chefTapAria,
  onChefTap,
}: {
  effects: KitchenSceneEffectsLayout;
  prepTokens: readonly KitchenScenePrepToken[];
  prepComplete: boolean;
  prompt: string | null;
  tokenAriaLabel: (token: KitchenScenePrepToken) => string;
  onAddIngredient: (key: string) => void;
  /** True for the ~3 s the pot is on the stove: harder steam, bubbles, a progress bar. */
  cooking: boolean;
  chefLine: string | null;
  chefTapAria: string;
  onChefTap: () => void;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const nextFlightIdRef = useRef(0);
  const { pot, chef } = effects;
  const potCenterLeft = `calc(${pot.left} + ${pot.width} / 2)`;
  const potCenterTop = `calc(${pot.top} + ${pot.height} / 2)`;

  function toScenePercent(clientX: number, clientY: number): { left: number; top: number } | null {
    const rect = layerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return { left: ((clientX - rect.left) / rect.width) * 100, top: ((clientY - rect.top) / rect.height) * 100 };
  }

  function isOverPot(point: { left: number; top: number }): boolean {
    const [left, top, width, height] = [pot.left, pot.top, pot.width, pot.height].map(parseFloat);
    const padX = width * POT_DROP_TOLERANCE;
    const padY = height * POT_DROP_TOLERANCE;
    return (
      point.left >= left - padX &&
      point.left <= left + width + padX &&
      point.top >= top - padY &&
      point.top <= top + height + padY
    );
  }

  function sendIntoPot(token: KitchenScenePrepToken, from: KitchenScenePoint): void {
    onAddIngredient(token.key);
    if (prefersReducedMotion()) return;
    const id = nextFlightIdRef.current++;
    setFlights((current) => [...current, { id, iconPath: token.iconPath, from }]);
    // Fallback cleanup in case animationend never fires (e.g. the tab is hidden).
    setTimeout(() => setFlights((current) => current.filter((flight) => flight.id !== id)), KITCHEN_SCENE_FLY_MS + 400);
  }

  function handlePointerDown(token: KitchenScenePrepToken, event: ReactPointerEvent<HTMLButtonElement>): void {
    if (event.button !== 0 || drag) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      key: token.key,
      startX: event.clientX,
      startY: event.clientY,
      left: parseFloat(token.from.left),
      top: parseFloat(token.from.top),
      moved: false,
      overPot: false,
    });
  }

  function handlePointerMove(token: KitchenScenePrepToken, event: ReactPointerEvent<HTMLButtonElement>): void {
    if (!drag || drag.key !== token.key) return;
    const point = toScenePercent(event.clientX, event.clientY);
    if (!point) return;
    const moved =
      drag.moved || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > DRAG_THRESHOLD_PX;
    setDrag({ ...drag, ...(moved ? point : {}), moved, overPot: moved && isOverPot(point) });
  }

  function handlePointerUp(token: KitchenScenePrepToken): void {
    if (!drag || drag.key !== token.key) return;
    setDrag(null);
    if (!drag.moved) {
      sendIntoPot(token, token.from);
    } else if (drag.overPot) {
      sendIntoPot(token, { left: `${drag.left}%`, top: `${drag.top}%` });
    }
    // Otherwise it was dropped elsewhere: clearing `drag` glides it back home.
  }

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0">
      <div aria-hidden="true">
        <div className="absolute" style={{ left: pot.left, top: pot.top, width: pot.width, height: pot.height }}>
          <span
            className={`${styles.glow} ${drag?.overPot ? styles.glowHot : ""} ${cooking ? styles.glowCooking : ""}`}
          />
          {(cooking ? [0, 1, 2, 3, 4] : [0, 1, 2]).map((index, _, wisps) => (
            <span
              key={`${cooking ? "boil" : "idle"}-${index}`}
              className={`${styles.steam} ${cooking ? styles.steamFast : ""}`}
              style={{
                left: `${(cooking ? 10 : 22) + index * (cooking ? 18 : 22)}%`,
                animationDelay: `${(index * (cooking ? 1.5 : 3.6)) / wisps.length}s`,
              }}
            />
          ))}
          {cooking
            ? [18, 38, 55, 70, 30, 62].map((left, index) => (
                <span
                  key={index}
                  className={styles.bubble}
                  style={{ left: `${left}%`, animationDelay: `${index * 0.15}s` }}
                />
              ))
            : null}
          {prepComplete && !cooking ? (
            <span className={styles.flare} style={{ animationDelay: `${KITCHEN_SCENE_FLY_MS - 200}ms` }} />
          ) : null}
        </div>

        {effects.sparkles.map((point, index) => (
          <span
            key={index}
            className={styles.sparkle}
            style={{ left: point.left, top: point.top, animationDelay: `${index * 0.45}s` }}
          />
        ))}

        {flights.map((flight) => (
          <span
            key={flight.id}
            className={styles.fly}
            style={
              {
                "--from-left": flight.from.left,
                "--from-top": flight.from.top,
                "--to-left": potCenterLeft,
                "--to-top": potCenterTop,
              } as CSSProperties
            }
            onAnimationEnd={(event) => {
              if (event.target !== event.currentTarget) return;
              setFlights((current) => current.filter((candidate) => candidate.id !== flight.id));
            }}
          >
            <img src={flight.iconPath} alt="" draggable={false} className={styles.ingredientIcon} />
          </span>
        ))}
      </div>

      {prepTokens.map((token) => {
        const isDragging = drag?.key === token.key && drag.moved;
        return (
          <button
            key={token.key}
            type="button"
            aria-label={tokenAriaLabel(token)}
            className={`pointer-events-auto ${styles.token} ${isDragging ? styles.dragging : ""}`}
            style={isDragging ? { left: `${drag.left}%`, top: `${drag.top}%` } : { left: token.from.left, top: token.from.top }}
            onPointerDown={(event) => handlePointerDown(token, event)}
            onPointerMove={(event) => handlePointerMove(token, event)}
            onPointerUp={() => handlePointerUp(token)}
            onPointerCancel={() => setDrag(null)}
            onClick={(event) => {
              // Pointer presses are handled above; this is the keyboard path (detail 0).
              if (event.detail === 0) sendIntoPot(token, token.from);
            }}
          >
            <img src={token.iconPath} alt="" draggable={false} className={styles.ingredientIcon} />
            {token.remaining > 1 ? (
              <span className="absolute -bottom-1 -right-1 rounded-full border-2 border-white bg-amber-500 px-1.5 text-xs font-bold leading-5 text-white shadow">
                ×{token.remaining}
              </span>
            ) : null}
          </button>
        );
      })}

      {prompt ? (
        <p
          role="status"
          aria-live="polite"
          className="absolute inset-x-2 top-2 mx-auto w-fit text-center rounded-full border-2 border-[#dcc38a] bg-[#fffaf0] px-3 py-1 text-sm font-semibold text-[#5c4720] shadow-md"
        >
          {prompt}
          {cooking ? (
            <span
              aria-hidden="true"
              className={styles.progress}
              style={{ animationDuration: `${KITCHEN_SCENE_COOK_MS}ms` }}
            />
          ) : null}
        </p>
      ) : null}

      <div className="absolute" style={{ left: chef.left, top: chef.top, width: chef.width, height: chef.height }}>
        {chefLine ? (
          <p
            role="status"
            aria-live="polite"
            className={`absolute bottom-full mb-1 ${chef.bubbleAlign === "left" ? "left-0" : "right-0"} ${
              chef.bubbleBesideOnWide ? BUBBLE_BESIDE_ON_WIDE_CLASSES[chef.bubbleBesideOnWide] : ""
            } w-44 max-w-[60vw] rounded-2xl border-2 border-[#dcc38a] bg-[#fffaf0] px-3 py-2 text-sm font-medium leading-snug text-gray-800 shadow-md`}
          >
            {chefLine}
          </p>
        ) : null}
        <button
          type="button"
          onClick={onChefTap}
          aria-label={chefTapAria}
          className="pointer-events-auto absolute inset-0 rounded-xl outline-offset-2"
        />
      </div>
    </div>
  );
}
