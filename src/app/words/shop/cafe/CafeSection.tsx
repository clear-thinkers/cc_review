"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/app/shared/locale";
import {
  buildVisitorBoard,
  dishMatchesOrderItem,
  groupShelfDishes,
  pickCharacterLine,
  resolveOrderReadiness,
} from "@/lib/characterTokens";
import type {
  CafeLineMoment,
  CafeOrderItem,
  CafeVisit,
  LocalizedText,
  ShopCharacter,
  ShopCharacterOrder,
} from "@/lib/characterTokens.types";
import {
  getShopRecipeContentForLocale,
  resolveShopRecipeIconPath,
  resolveShopRecipeVariant,
  resolveShopRecipeVariantTitle,
} from "@/lib/shop";
import type { ShopCookedDish, ShopRecipe } from "@/lib/shop.types";
import {
  dismissCafeVisit,
  getCafeVisit,
  listShopCharacterOrders,
  listShopCharacters,
  listShopCookedDishes,
  listShopRecipeUnlocks,
  listShopRecipes,
  serveCafeVisit,
} from "@/lib/supabase-service";
import { playCelebrationSound } from "../../shared/coins.sound";
import type { WordsWorkspaceVM } from "../../shared/WordsWorkspaceVM";
import { cafeStrings } from "./cafe.strings";

type LoadState = "loading" | "ready" | "error";
type BoardState = "idle" | LoadState;
type VisitorSpot = "door" | "counter" | "table";
type Notice = { tone: "success" | "error"; text: string } | null;
/** A line that stays up until the child taps it (owner, 2026-11-25: they flashed by too fast). */
type Talk = "served" | "dismissed" | null;

/**
 * Percentage boxes over public/shop/shop.png (1448×1086), like the kitchen's SceneHotspot.
 * The scene is one flat image, so a visitor is always drawn over it: each spot puts the feet
 * on open floor, never over furniture (owner, 2026-11-27: the old counter spot stood Mom
 * inside the back chair, and one just above it left her feet on the counter front, floating).
 * The counter spot is the owner's pick: on the rug, feet near (671, 732), so the visitor
 * stands before the register without hiding it. The table spot is further along the rug,
 * clear of the front chair even for a wide delighted pose.
 */
const VISITOR_SPOTS: Record<VisitorSpot, { left: string; top: string }> = {
  door: { left: "68.5%", top: "38%" },
  counter: { left: "34.35%", top: "32.4%" },
  table: { left: "24.5%", top: "40%" },
};
// Sized for 960 x 1080 sprites (width % = sprite width / 40 on this 1448 x 1086 scene).
const VISITOR_SIZE = { width: "24%", height: "36%" };
const DISPLAY_CASE_BOX = { left: "10%", top: "34%", width: "35%", height: "24%" };
/** The register's screen (scene px 765-907 x 319-422): opens the visitor board. */
const REGISTER_SCREEN_BOX = { left: "52.8%", top: "29.4%", width: "9.8%", height: "9.5%" };

const WALK_START_MS = 60;
const EATING_MS = 2200;
const NEXT_VISITOR_MS = 900;

function fill(template: string, tokens: Record<string, string>): string {
  return Object.entries(tokens).reduce((text, [key, value]) => text.split(`{${key}}`).join(value), template);
}

/**
 * The Café (/words/shop/cafe, roadmap item U). Child + platform admin only. One visitor at
 * a time orders a mix of dishes; serving the whole order sells those dishes off the shelf
 * for good and pays the child in that character's token. The server picks the visitor,
 * checks the shelf and writes everything; this page only presents it.
 */
export default function CafeSection({ vm }: { vm: WordsWorkspaceVM }) {
  const locale = useLocale();
  const str = cafeStrings[locale];
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [characters, setCharacters] = useState<ShopCharacter[]>([]);
  const [recipes, setRecipes] = useState<ShopRecipe[]>([]);
  const [dishes, setDishes] = useState<ShopCookedDish[]>([]);
  const [visit, setVisit] = useState<CafeVisit | null>(null);
  const [spot, setSpot] = useState<VisitorSpot>("door");
  const [isDelighted, setIsDelighted] = useState(false);
  const [line, setLine] = useState<LocalizedText | null>(null);
  const [talk, setTalk] = useState<Talk>(null);
  /** Why no visitor came: nobody set up, or everyone has used up their visits for now. */
  const [isOutOfVisits, setIsOutOfVisits] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isShelfOpen, setIsShelfOpen] = useState(false);
  const [isBoardOpen, setIsBoardOpen] = useState(false);
  const [boardState, setBoardState] = useState<BoardState>("idle");
  const [boardOrders, setBoardOrders] = useState<ShopCharacterOrder[]>([]);
  const [unlockedRecipeIds, setUnlockedRecipeIds] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState<Notice>(null);
  const timersRef = useRef<number[]>([]);
  const lastLineRef = useRef<LocalizedText | null>(null);

  const clearTimers = useCallback((): void => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const after = useCallback((ms: number, run: () => void): void => {
    timersRef.current.push(window.setTimeout(run, ms));
  }, []);

  const say = useCallback((character: ShopCharacter | undefined, moment: CafeLineMoment): void => {
    const next = pickCharacterLine(character?.lines[moment], lastLineRef.current);
    lastLineRef.current = next;
    setLine(next);
  }, []);

  /** The visitor appears at the door, then walks to the counter. */
  const arrive = useCallback(
    (next: CafeVisit | null, roster: readonly ShopCharacter[]): void => {
      setVisit(next);
      setIsDelighted(false);
      setTalk(null);
      setSpot("door");
      if (!next) {
        setLine(null);
        return;
      }
      say(roster.find((character) => character.key === next.characterKey), "order");
      after(WALK_START_MS, () => setSpot("counter"));
    },
    [after, say]
  );

  const fetchNextVisit = useCallback(
    async (roster: readonly ShopCharacter[]): Promise<void> => {
      const result = await getCafeVisit();
      setIsOutOfVisits(!result.success && result.code === "no_visitors_today");
      arrive(result.success ? result.visit : null, roster);
    },
    [arrive]
  );

  useEffect(() => {
    if (vm.page !== "cafe") return;
    let isCancelled = false;
    Promise.all([listShopCharacters(), listShopRecipes(), listShopCookedDishes(), getCafeVisit()])
      .then(([characterRows, recipeRows, dishRows, visitResult]) => {
        if (isCancelled) return;
        setCharacters(characterRows);
        setRecipes(recipeRows);
        setDishes(dishRows);
        setLoadState("ready");
        setIsOutOfVisits(!visitResult.success && visitResult.code === "no_visitors_today");
        arrive(visitResult.success ? visitResult.visit : null, characterRows);
      })
      .catch((error) => {
        console.error("Failed to load the Café:", error);
        if (!isCancelled) setLoadState("error");
      });
    return () => {
      isCancelled = true;
      clearTimers();
    };
  }, [vm.page, arrive, clearTimers]);

  const recipesById = useMemo(() => new Map(recipes.map((recipe) => [recipe.id, recipe])), [recipes]);
  const shelfGroups = useMemo(() => groupShelfDishes(dishes), [dishes]);
  const visitorBoard = useMemo(() => buildVisitorBoard(characters, boardOrders), [characters, boardOrders]);
  const character = characters.find((entry) => entry.key === visit?.characterKey);
  const readiness = useMemo(() => resolveOrderReadiness(visit?.items ?? [], dishes), [visit, dishes]);

  if (vm.page !== "cafe") return null;

  /** A dish's name and icon for a set of special ingredients (none = the plain dish). */
  const recipeTitle = (recipeId: string, specialIngredientKeys: string[] = []): string => {
    const recipe = recipesById.get(recipeId);
    if (!recipe) return str.unknownDish;
    const title = getShopRecipeContentForLocale(recipe, locale).title;
    return resolveShopRecipeVariantTitle(recipe.variantIconRules, specialIngredientKeys, locale, title);
  };
  const recipeIcon = (recipeId: string, specialIngredientKeys: string[] = []): string | null => {
    const recipe = recipesById.get(recipeId);
    return recipe ? resolveShopRecipeIconPath(recipe.variantIconRules, specialIngredientKeys) : null;
  };
  /**
   * Special ingredients a shelf dish has beyond its named variant (e.g. an egg in 阳春面), so
   * two dishes that share a name and icon can still be told apart. Empty when there are none.
   */
  const extraIngredientNames = (recipeId: string, specialIngredientKeys: string[]): string => {
    const recipe = recipesById.get(recipeId);
    if (!recipe) return "";
    const named = resolveShopRecipeVariant(recipe.variantIconRules, specialIngredientKeys)?.match ?? [];
    const names = new Map(
      getShopRecipeContentForLocale(recipe, locale).specialIngredients.map((ingredient) => [ingredient.ingredientKey ?? "", ingredient.name])
    );
    return specialIngredientKeys
      .filter((key) => !named.includes(key))
      .map((key) => names.get(key) || key)
      .join(str.namesSeparator);
  };

  const characterName = character?.name[locale] || character?.name.en || "";
  const tokenName = character?.tokenName[locale] || character?.tokenName.en || "";
  const spritePath = isDelighted
    ? character?.spritePaths.delighted ?? character?.spritePaths.waiting
    : character?.spritePaths.waiting ?? character?.spritePaths.delighted;
  const fallbackLine = isDelighted ? str.fallbackServedLine : str.fallbackOrderLine;
  const bubbleText = line?.[locale] || line?.en || fallbackLine;

  async function handleServe(): Promise<void> {
    if (!visit || isBusy) return;
    setIsBusy(true);
    setNotice(null);
    try {
      const result = await serveCafeVisit(visit.visitId);
      if (!result.success) {
        setNotice({ tone: "error", text: str.serveErrors[result.code] });
        setDishes(await listShopCookedDishes());
        if (result.code === "visit_closed" || result.code === "no_visit") await fetchNextVisit(characters);
        setIsBusy(false);
        return;
      }
      setDishes(await listShopCookedDishes());
      setIsDelighted(true);
      say(character, "served");
      playCelebrationSound(false);
      setNotice({
        tone: "success",
        text: fill(str.paidTemplate, { name: characterName, count: String(result.tokensEarned), token: tokenName }),
      });
      // The thank-you line stays until the child taps it (handleTalkTap).
      setTalk("served");
    } catch (error) {
      console.error("Failed to serve the visitor:", error);
      setNotice({ tone: "error", text: str.serveErrors.unknown });
      setIsBusy(false);
    }
    // A successful serve stays busy until the next visitor arrives (handleTalkTap, then timers).
  }

  /** Walks the visitor out, then brings the next one in. */
  function leaveAndFetchNext(): void {
    setSpot("door");
    after(NEXT_VISITOR_MS, () => {
      fetchNextVisit(characters)
        .catch((error) => console.error("Failed to fetch the next visitor:", error))
        .finally(() => setIsBusy(false));
    });
  }

  /** Eating at the table; reopening the line pauses this, closing it starts it again. */
  function startEating(): void {
    clearTimers();
    after(EATING_MS, leaveAndFetchNext);
  }

  /** Tapping an open line (or the visitor while it's open) closes it and moves the visit on. */
  function handleTalkTap(): void {
    if (talk === "dismissed") {
      setTalk(null);
      leaveAndFetchNext();
      return;
    }
    if (talk === "served") {
      setTalk(null);
      setSpot("table");
      startEating();
    }
  }

  /** While eating, tapping the visitor brings back what they said after being served. */
  function handleVisitorTap(): void {
    if (talk) {
      handleTalkTap();
      return;
    }
    if (isDelighted && spot === "table") {
      clearTimers();
      setTalk("served");
    }
  }

  /** Opens the register's visitor board, loading the orders and unlocks the first time. */
  function openBoard(): void {
    setIsBoardOpen(true);
    if (boardState === "ready" || boardState === "loading") return;
    setBoardState("loading");
    Promise.all([listShopCharacterOrders(), listShopRecipeUnlocks()])
      .then(([orderRows, unlockRows]) => {
        setBoardOrders(orderRows);
        setUnlockedRecipeIds(new Set(unlockRows.map((unlock) => unlock.recipeId)));
        setBoardState("ready");
      })
      .catch((error) => {
        console.error("Failed to load the visitor board:", error);
        setBoardState("error");
      });
  }

  /** A dish as the board lists it. A mystery food the child hasn't unlocked keeps its secret. */
  const boardDish = (item: CafeOrderItem): { title: string; icon: string | null } => {
    const recipe = recipesById.get(item.recipeId);
    if (!recipe) return { title: str.unknownDish, icon: null };
    if (recipe.isMystery && !unlockedRecipeIds.has(recipe.id)) return { title: str.mysteryDish, icon: null };
    const icon = recipeIcon(item.recipeId, item.specialIngredientKeys);
    if (item.specialIngredientKeys?.length === 0) {
      return { title: fill(str.plainDishTemplate, { dish: recipeTitle(item.recipeId) }), icon };
    }
    return { title: recipeTitle(item.recipeId, item.specialIngredientKeys), icon };
  };

  async function handleNotNow(): Promise<void> {
    if (!visit || isBusy) return;
    setIsBusy(true);
    setNotice(null);
    try {
      const result = await dismissCafeVisit(visit.visitId);
      if (!result.success && result.code !== "visit_closed" && result.code !== "no_visit") {
        setNotice({ tone: "error", text: str.dismissError });
        setIsBusy(false);
        return;
      }
      say(character, "dismissed");
      setLine((current) => current ?? { en: cafeStrings.en.fallbackDismissedLine, zh: cafeStrings.zh.fallbackDismissedLine });
      // The goodbye line stays until the child taps it (handleTalkTap).
      setTalk("dismissed");
    } catch (error) {
      console.error("Failed to dismiss the visitor:", error);
      setNotice({ tone: "error", text: str.dismissError });
      setIsBusy(false);
    }
  }


  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div className="space-y-2">
        <h2 className="font-medium">{str.pageTitle}</h2>
        <p className="max-w-3xl text-sm text-gray-700">{str.pageDescription}</p>
      </div>

      {notice ? (
        <p
          role="status"
          className={
            notice.tone === "success"
              ? "rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              : "rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
          }
        >
          {notice.text}
        </p>
      ) : null}

      {loadState === "loading" ? (
        <p className="text-sm text-gray-600">{str.loading}</p>
      ) : loadState === "error" ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{str.loadError}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          {/* Percentage boxes over the art use inline styles: the SceneHotspot exception. */}
          <div className="relative overflow-hidden rounded-[1.5rem] border-2 border-[#dcc38a] bg-[#fffaf0]">
            <img src="/shop/shop.png" alt={str.sceneAlt} draggable={false} className="block w-full select-none" />

            <button
              type="button"
              onClick={() => setIsShelfOpen(true)}
              aria-label={str.displayCaseAria}
              aria-haspopup="dialog"
              className="group absolute rounded-xl outline-offset-2 transition hover:bg-white/25 focus-visible:bg-white/25"
              style={DISPLAY_CASE_BOX}
            >
              <span className="pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 rounded-full border border-[#dcc38a] bg-[#fffaf0]/95 px-2 py-0.5 text-[11px] font-bold text-[#6a5530] shadow-sm">
                {str.displayCaseLabel}
              </span>
            </button>

            <button
              type="button"
              onClick={openBoard}
              aria-label={str.registerAria}
              aria-haspopup="dialog"
              className="group absolute rounded-lg outline-offset-2 transition hover:bg-white/25 focus-visible:bg-white/25"
              style={REGISTER_SCREEN_BOX}
            >
              <span className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-[#dcc38a] bg-[#fffaf0]/95 px-2 py-0.5 text-[11px] font-bold text-[#6a5530] shadow-sm">
                {str.registerLabel}
              </span>
            </button>

            {visit && character ? (
              <div
                className="pointer-events-none absolute transition-[left,top] duration-700 ease-in-out motion-reduce:transition-none"
                style={{ ...VISITOR_SPOTS[spot], ...VISITOR_SIZE }}
              >
                {talk ? (
                  <button
                    type="button"
                    autoFocus
                    onClick={handleTalkTap}
                    className="pointer-events-auto absolute bottom-full left-1/2 mb-1 w-52 -translate-x-1/2 rounded-xl border-2 border-[#dcc38a] bg-white px-3 py-2 text-center text-sm font-semibold text-[#5c4720] shadow-lg"
                  >
                    {bubbleText}
                    <span className="mt-1 block text-[11px] font-medium text-[#a08a5a]">{str.tapToContinue}</span>
                  </button>
                ) : spot === "counter" && !isDelighted ? (
                  <p className="absolute bottom-full left-1/2 mb-1 w-40 -translate-x-1/2 rounded-xl border border-[#dcc38a] bg-white/95 px-2 py-1 text-center text-xs font-semibold text-[#5c4720] shadow">
                    {bubbleText}
                  </p>
                ) : null}
                {talk || (isDelighted && spot === "table") ? (
                  // Only the middle of the sprite box takes taps, so its transparent edges
                  // never block the display case hotspot.
                  <button
                    type="button"
                    onClick={handleVisitorTap}
                    aria-label={talk ? str.tapToContinue : fill(str.talkAgainAriaTemplate, { name: characterName })}
                    className="pointer-events-auto absolute bottom-0 left-1/4 top-[10%] z-10 w-1/2 rounded-full"
                  />
                ) : null}
                {spritePath ? (
                  <img src={spritePath} alt={characterName} draggable={false} className="h-full w-full select-none object-contain object-bottom" />
                ) : (
                  <div
                    role="img"
                    aria-label={characterName}
                    className="absolute bottom-0 left-1/2 flex aspect-square w-4/5 -translate-x-1/2 items-center justify-center rounded-full border-2 border-[#dcc38a] bg-[#fff6e3] text-3xl font-bold text-[#8b6f2f] shadow"
                  >
                    {characterName.slice(0, 1)}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* The order */}
          <div className="rounded-[1.5rem] border-2 border-[#dcc38a] bg-[#fffaf0] p-4">
            {visit && character ? (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-[#6a5530]">
                  {fill(str.orderHeadingTemplate, { name: characterName })}
                </h3>
                {character.intro[locale] ? <p className="text-sm text-gray-700">{character.intro[locale]}</p> : null}
                <ul className="space-y-2">
                  {readiness.items.map((item) => {
                    const icon = recipeIcon(item.recipeId, item.specialIngredientKeys);
                    const pinnedNote = !item.specialIngredientKeys
                      ? null
                      : item.specialIngredientKeys.length === 0
                        ? str.pinnedPlainNote
                        : str.pinnedVariantNote;
                    return (
                      <li key={item.recipeId} className="flex items-center gap-3 rounded-xl border border-[#e8dcc0] bg-white/70 p-2">
                        {icon ? <img src={icon} alt="" aria-hidden="true" className="h-12 w-12 object-contain" /> : null}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[#5c4720]">
                            {recipeTitle(item.recipeId, item.specialIngredientKeys)} × {item.quantity}
                          </p>
                          {pinnedNote ? <p className="text-xs text-[#8b6f2f]">{pinnedNote}</p> : null}
                          <p className={`text-xs font-semibold ${item.isReady ? "text-emerald-700" : "text-amber-700"}`}>
                            {fill(str.onShelfTemplate, {
                              have: String(Math.min(item.onShelf, item.quantity)),
                              need: String(item.quantity),
                            })}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="flex items-center gap-2 text-sm font-semibold text-[#8b6f2f]">
                  {character.tokenIconPath ? (
                    <img src={character.tokenIconPath} alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
                  ) : null}
                  {fill(str.payTemplate, { count: String(visit.tokenPrice), token: tokenName })}
                </p>
                {!readiness.isReady ? <p className="text-xs text-gray-600">{str.notReadyHint}</p> : null}
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleNotNow()}
                    className="btn-neutral rounded-full border-2 px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
                  >
                    {str.notNowButton}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy || !readiness.isReady}
                    onClick={() => void handleServe()}
                    className="btn-primary rounded-full border-2 px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
                  >
                    {isBusy ? str.serving : str.serveButton}
                  </button>
                </div>
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-[#8b6f2f]">{isOutOfVisits ? str.noVisitorsToday : str.noVisitors}</p>
            )}
          </div>
        </div>
      )}

      {isBoardOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => setIsBoardOpen(false)}>
              <div
                role="dialog"
                aria-modal="true"
                aria-label={str.boardTitle}
                onClick={(event) => event.stopPropagation()}
                className="max-h-[85vh] w-full max-w-xl space-y-3 overflow-y-auto rounded-[1.5rem] border-2 border-[#dcc38a] bg-[#fffaf0] p-5 shadow-xl"
              >
                <h3 className="text-lg font-semibold text-[#5c4720]">{str.boardTitle}</h3>
                <p className="text-sm text-gray-700">{str.boardIntro}</p>
                {boardState === "error" ? (
                  <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{str.boardError}</p>
                ) : boardState !== "ready" ? (
                  <p className="text-sm text-[#8b6f2f]">{str.boardLoading}</p>
                ) : visitorBoard.length === 0 ? (
                  <p className="text-sm text-[#8b6f2f]">{str.boardEmpty}</p>
                ) : (
                  <ul className="space-y-3">
                    {visitorBoard.map(({ character: guest, orders }) => {
                      const guestName = guest.name[locale] || guest.name.en;
                      const guestToken = guest.tokenName[locale] || guest.tokenName.en;
                      const portrait = guest.spritePaths.waiting ?? guest.spritePaths.delighted;
                      const limit = String(guest.visitLimit ?? "");
                      return (
                        <li key={guest.key} className="flex gap-3 rounded-xl border border-[#e8dcc0] bg-white/70 p-3">
                          {portrait ? (
                            <img src={portrait} alt="" aria-hidden="true" className="h-24 w-20 shrink-0 object-contain object-bottom" />
                          ) : null}
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <p className="flex items-center gap-2 font-semibold text-[#5c4720]">
                              {guestName}
                              {guest.tokenIconPath ? (
                                <img src={guest.tokenIconPath} alt="" aria-hidden="true" className="h-6 w-6 object-contain" />
                              ) : null}
                            </p>
                            {guest.intro[locale] ? <p className="text-xs text-gray-700">{guest.intro[locale]}</p> : null}
                            <p className="text-xs font-semibold text-emerald-700">
                              {fill(str.frequencyTemplates[guest.visitFrequency], { n: limit })}
                            </p>
                            <p className="text-xs font-semibold text-[#8b6f2f]">{str.boardLikesHeading}</p>
                            <ul className="space-y-1">
                              {orders.map((order) => (
                                <li key={order.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#5c4720]">
                                  {order.items.map((item, index) => {
                                    const dish = boardDish(item);
                                    return (
                                      <span key={item.recipeId} className="flex items-center gap-1">
                                        {index > 0 ? <span aria-hidden="true">+</span> : null}
                                        {dish.icon ? (
                                          <img src={dish.icon} alt="" aria-hidden="true" className="h-6 w-6 object-contain" />
                                        ) : (
                                          <span aria-hidden="true" className="text-amber-500">✦</span>
                                        )}
                                        {dish.title} × {item.quantity}
                                      </span>
                                    );
                                  })}
                                  <span className="font-semibold text-[#8b6f2f]">
                                    {fill(str.boardPaysTemplate, { count: String(order.tokenPrice), token: guestToken })}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <button
                  type="button"
                  autoFocus
                  onClick={() => setIsBoardOpen(false)}
                  className="btn-nav w-full rounded-full border-2 px-4 py-2 font-semibold"
                >
                  {str.closeButton}
                </button>
              </div>
            </div>,
            document.body
          )
        : null}

      {isShelfOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => setIsShelfOpen(false)}>
              <div
                role="dialog"
                aria-modal="true"
                aria-label={str.shelfTitle}
                onClick={(event) => event.stopPropagation()}
                className="max-h-[85vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-[1.5rem] border-2 border-[#dcc38a] bg-[#fffaf0] p-5 shadow-xl"
              >
                <h3 className="text-lg font-semibold text-[#5c4720]">{str.shelfTitle}</h3>
                {shelfGroups.length === 0 ? (
                  <p className="text-sm text-[#8b6f2f]">{str.shelfEmpty}</p>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {shelfGroups.map((group) => {
                      const { recipeId, specialIngredientKeys, count } = group;
                      const icon = recipeIcon(recipeId, specialIngredientKeys);
                      const extras = extraIngredientNames(recipeId, specialIngredientKeys);
                      const isOrdered = visit?.items.some((item) => dishMatchesOrderItem(group, item)) ?? false;
                      return (
                        <div
                          key={`${recipeId}|${specialIngredientKeys.join(",")}`}
                          className={`rounded-xl border-2 bg-white/70 p-2 text-center ${isOrdered ? "border-emerald-400" : "border-[#e8dcc0]"}`}
                        >
                          {icon ? <img src={icon} alt="" aria-hidden="true" className="mx-auto h-14 w-14 object-contain" /> : null}
                          <p className="text-xs font-semibold text-[#5c4720]">{recipeTitle(recipeId, specialIngredientKeys)}</p>
                          {extras ? (
                            <p className="text-[11px] text-[#8b6f2f]">{fill(str.shelfExtrasTemplate, { names: extras })}</p>
                          ) : null}
                          <p className="text-xs text-gray-600">{fill(str.shelfCountTemplate, { count: String(count) })}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
                <button
                  type="button"
                  autoFocus
                  onClick={() => setIsShelfOpen(false)}
                  className="btn-nav w-full rounded-full border-2 px-4 py-2 font-semibold"
                >
                  {str.closeButton}
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  );
}
