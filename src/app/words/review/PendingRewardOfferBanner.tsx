"use client";

import { useEffect, useState } from "react";
import type { SessionRewardOffer } from "@/lib/shop.types";
import { claimSessionRewardOffer, listPendingRewardOffers } from "@/lib/supabase-service";
import IngredientRewardPanel, { type IngredientRewardPanelStrings } from "./IngredientRewardPanel";

/**
 * "You have a reward waiting!" on Due Review. A finished session's reward offer stays
 * claimable if the child left before picking (or the page failed mid-way), so it is
 * never lost -- they can open it here whenever they like. "Decide later" simply hides it
 * for this visit; the offer stays pending on the server.
 */
export default function PendingRewardOfferBanner({ strings }: { strings: IngredientRewardPanelStrings }) {
  const [offers, setOffers] = useState<SessionRewardOffer[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listPendingRewardOffers()
      .then((rows) => {
        if (!cancelled) setOffers(rows);
      })
      .catch((error) => {
        // A failed lookup just means no banner this visit; never block Due Review.
        console.error("Failed to load pending reward offers:", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const current = offers[0];
  if (!current) {
    return null;
  }

  if (isOpen) {
    return (
      <IngredientRewardPanel
        key={current.quizSessionId}
        offer={current}
        strings={strings}
        onClaim={(keys) => claimSessionRewardOffer(current.quizSessionId, keys)}
        onContinue={() => {
          setOffers((previous) => previous.slice(1));
          setIsOpen(false);
        }}
      />
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-purple-300 bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-3">
      <p className="font-semibold text-purple-900">{strings.pendingTitle}</p>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="btn-primary rounded-full border-2 px-5 py-2 text-sm font-bold"
      >
        {strings.pendingOpen}
      </button>
    </div>
  );
}
