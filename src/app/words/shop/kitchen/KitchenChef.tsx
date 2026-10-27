"use client";

import { useEffect } from "react";
import { CHEF_POSES, CHEF_SPOTS, type ChefPose, type ChefSpot } from "./kitchenChef.types";

/**
 * Chef Shrewy over the kitchen illustration. Like SceneHotspot, his position is a
 * percentage box tied to this one artwork -- home is the ladder's middle rung, and
 * shelf-aware lines walk him to other CHEF_SPOTS (all shared by kitchen_empty /
 * half_stocked / stocked.png), so inline style is the same documented exception
 * (BUILD_CONVENTIONS.md §7). He glides between spots unless reduced motion is on.
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
  spot,
  tapAria,
  hideLabel,
  showLabel,
  hidden,
  onTap,
  onToggleHidden,
}: {
  pose: ChefPose;
  line: string | null;
  spot: ChefSpot;
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

  const layout = CHEF_SPOTS[spot];

  return (
    <div
      className="pointer-events-none absolute transition-[left,top] duration-500 ease-out motion-reduce:transition-none"
      style={{ left: layout.left, top: layout.top, width: "14%" }}
    >
      {line ? (
        <p
          role="status"
          aria-live="polite"
          className={`absolute ${layout.bubble === "above" ? "bottom-full mb-1" : "top-full mt-1"} ${
            layout.bubbleAlign === "left" ? "left-0" : "right-0"
          } w-44 max-w-[60vw] rounded-2xl border-2 border-[#dcc38a] bg-[#fffaf0] px-3 py-2 text-sm font-medium leading-snug text-gray-800 shadow-md`}
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
