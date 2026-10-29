"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CHEF_LINE_DURATION_MS,
  CHEF_POSE_FOR_TRIGGER,
  CHEF_TAP_COOLDOWN_MS,
  type ChefPose,
  type ChefReaction,
  type ChefSpot,
  type ChefTrigger,
  type KitchenChefLocaleStrings,
} from "./kitchenChef.types";
import { canChefRespondToTap, pickChefLine, pickChefTapReaction } from "./kitchenChef.utils";

type ChefState = { pose: ChefPose; line: string | null; spot: ChefSpot };

const IDLE_STATE: ChefState = { pose: "idle", line: null, spot: "ladder" };

/**
 * Drives Chef Shrewy: which pose is showing, what he's saying, and where he stands.
 * `say` plays a line for a trigger (from the ladder) and returns him to idle there
 * after CHEF_LINE_DURATION_MS; `tap` is the click handler (rate-limited by
 * CHEF_TAP_COOLDOWN_MS so rapid taps never stack lines), which may also pick one of
 * the situational `extraReactions` and walk him to its spot. Purely presentational --
 * nothing here touches kitchen data.
 */
export function useKitchenChef(strings: Pick<KitchenChefLocaleStrings, "generic" | "recipes">) {
  const [state, setState] = useState<ChefState>(IDLE_STATE);
  const stringsRef = useRef(strings);
  const lastLineRef = useRef<string | null>(null);
  const lastTapAtRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    stringsRef.current = strings;
  }, [strings]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const show = useCallback((reaction: ChefReaction) => {
    lastLineRef.current = reaction.line;
    if (timerRef.current) clearTimeout(timerRef.current);
    setState(reaction);
    timerRef.current = setTimeout(() => setState(IDLE_STATE), CHEF_LINE_DURATION_MS);
  }, []);

  const say = useCallback(
    (trigger: ChefTrigger, options: { recipeSlug?: string | null } = {}) => {
      const line = pickChefLine({
        trigger,
        strings: stringsRef.current,
        recipeSlug: options.recipeSlug,
        lastLine: lastLineRef.current,
      });
      if (line === null) return;
      show({ line, pose: CHEF_POSE_FOR_TRIGGER[trigger], spot: "ladder" });
    },
    [show]
  );

  const tap = useCallback(
    (servedRecipeSlugs: readonly string[], extraReactions: readonly ChefReaction[] = []) => {
      const now = Date.now();
      if (!canChefRespondToTap(now, lastTapAtRef.current, CHEF_TAP_COOLDOWN_MS)) return;
      lastTapAtRef.current = now;
      const reaction = pickChefTapReaction({
        trigger: servedRecipeSlugs.length > 0 ? "tapServed" : "tapEmpty",
        strings: stringsRef.current,
        servedRecipeSlugs,
        extraReactions,
        lastLine: lastLineRef.current,
      });
      if (reaction) show(reaction);
    },
    [show]
  );

  /** Plays one ready-made line (e.g. the chef challenge's dismiss line) from the ladder in the idle pose. */
  const sayLine = useCallback((line: string) => show({ line, pose: "idle", spot: "ladder" }), [show]);

  return { pose: state.pose, line: state.line, spot: state.spot, say, tap, sayLine };
}
