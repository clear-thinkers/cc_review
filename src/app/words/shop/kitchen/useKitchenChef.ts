"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CHEF_LINE_DURATION_MS,
  CHEF_POSE_FOR_TRIGGER,
  CHEF_TAP_COOLDOWN_MS,
  type ChefPose,
  type ChefTrigger,
  type KitchenChefLocaleStrings,
} from "./kitchenChef.types";
import { canChefRespondToTap, pickChefLine } from "./kitchenChef.utils";

type ChefState = { pose: ChefPose; line: string | null };

const IDLE_STATE: ChefState = { pose: "idle", line: null };

/**
 * Drives Chef Shrewy: which pose is showing and what he's saying. `say` plays a
 * line for a trigger and returns him to idle after CHEF_LINE_DURATION_MS; `tap`
 * is the click handler (rate-limited by CHEF_TAP_COOLDOWN_MS so rapid taps never
 * stack lines). Purely presentational -- nothing here touches kitchen data.
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

  const say = useCallback(
    (trigger: ChefTrigger, options: { recipeSlug?: string | null; servedRecipeSlugs?: readonly string[] } = {}) => {
      const line = pickChefLine({
        trigger,
        strings: stringsRef.current,
        recipeSlug: options.recipeSlug,
        servedRecipeSlugs: options.servedRecipeSlugs,
        lastLine: lastLineRef.current,
      });
      if (line === null) return;

      lastLineRef.current = line;
      if (timerRef.current) clearTimeout(timerRef.current);
      setState({ pose: CHEF_POSE_FOR_TRIGGER[trigger], line });
      timerRef.current = setTimeout(() => setState(IDLE_STATE), CHEF_LINE_DURATION_MS);
    },
    []
  );

  const tap = useCallback(
    (servedRecipeSlugs: readonly string[]) => {
      const now = Date.now();
      if (!canChefRespondToTap(now, lastTapAtRef.current, CHEF_TAP_COOLDOWN_MS)) return;
      lastTapAtRef.current = now;
      say(servedRecipeSlugs.length > 0 ? "tapServed" : "tapEmpty", { servedRecipeSlugs });
    },
    [say]
  );

  return { pose: state.pose, line: state.line, say, tap };
}
