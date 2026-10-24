"use client";

import { useEffect } from "react";
import { CHEF_POSES, type ChefPose } from "./kitchenChef.types";

/**
 * Chef Shrewy over the kitchen illustration. Like SceneHotspot, his position is a
 * percentage box tied to this one artwork -- he stands on the ladder's middle rung
 * (the ladder sits at the same spot in kitchen_empty / half_stocked / stocked.png),
 * so inline style is the same documented exception (BUILD_CONVENTIONS.md §7).
 *
 * The ladder neighbours the fridge and stove hotspots, so nothing here may steal
 * their clicks: the wrapper, sprite and speech bubble are all pointer-events-none,
 * and only a transparent button covering the chef's BODY (not the sprite's empty
 * margins) plus the hide button take clicks. Hiding him is the "collapse on small
 * screens" control.
 */
export default function KitchenChef({
  pose,
  line,
  tapAria,
  hideLabel,
  showLabel,
  hidden,
  onTap,
  onToggleHidden,
}: {
  pose: ChefPose;
  line: string | null;
  tapAria: string;
  hideLabel: string;
  showLabel: string;
  hidden: boolean;
  onTap: () => void;
  onToggleHidden: () => void;
}) {
  // Warm the browser cache so a pose swap never flashes an empty frame.
  useEffect(() => {
    for (const name of CHEF_POSES) {
      const image = new Image();
      image.src = `/kitchen/chef_${name}.png`;
    }
  }, []);

  if (hidden) {
    return (
      <button
        type="button"
        onClick={onToggleHidden}
        className="btn-nav absolute rounded-full border-2 px-3 py-1 text-xs font-semibold"
        style={{ right: "3%", bottom: "3%" }}
      >
        {showLabel}
      </button>
    );
  }

  return (
    <div className="pointer-events-none absolute" style={{ left: "22.5%", top: "31%", width: "14%" }}>
      {line ? (
        <p
          role="status"
          aria-live="polite"
          className="absolute bottom-full left-0 mb-1 w-44 max-w-[60vw] rounded-2xl border-2 border-[#dcc38a] bg-[#fffaf0] px-3 py-2 text-sm font-medium leading-snug text-gray-800 shadow-md"
        >
          {line}
        </p>
      ) : null}
      <img
        src={`/kitchen/chef_${pose}.png`}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="block h-auto w-full select-none drop-shadow-md"
      />
      <button
        type="button"
        onClick={onTap}
        aria-label={tapAria}
        className="pointer-events-auto absolute rounded-xl outline-offset-2"
        style={{ left: "14%", top: "8%", width: "64%", height: "84%" }}
      />
      <button
        type="button"
        onClick={onToggleHidden}
        aria-label={hideLabel}
        title={hideLabel}
        className="btn-nav pointer-events-auto absolute -right-2 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold leading-none"
      >
        ×
      </button>
    </div>
  );
}
