"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CAFE_VISIT_FREQUENCIES, validateCafeVisitFrequency, validateCharacterOrderDraft } from "@/lib/characterTokens";
import type {
  CafeLineMoment,
  CafeOrderItem,
  CafeVisitFrequency,
  CharacterTokenContent,
  LocalizedText,
  ShopCharacter,
  ShopCharacterOrder,
} from "@/lib/characterTokens.types";
import { getShopRecipeContentForLocale } from "@/lib/shop";
import type { ShopRecipe } from "@/lib/shop.types";
import {
  deleteCharacterTokenContent,
  deleteShopCharacterOrder,
  listCharacterTokenContents,
  listShopCharacterOrders,
  listShopCharacters,
  saveCharacterTokenContent,
  saveShopCharacter,
  saveShopCharacterOrder,
} from "@/lib/supabase-service";
import { cafeAdminStrings } from "./cafeAdmin.strings";
import {
  INPUT,
  LABEL,
  PANEL,
  SHOP_ADMIN_BUTTON_DESTRUCTIVE,
  SHOP_ADMIN_BUTTON_PRIMARY,
  SHOP_ADMIN_BUTTON_SECONDARY,
  TOGGLE_BUTTON,
} from "./shopAdmin.styles";

type Locale = "en" | "zh";
type Notice = { kind: "success" | "error"; message: string } | null;
type CharacterForm = {
  isNew: boolean;
  key: string;
  nameEn: string;
  nameZh: string;
  introEn: string;
  introZh: string;
  tokenEn: string;
  tokenZh: string;
  tokenIconPath: string;
  spriteWaiting: string;
  spriteDelighted: string;
  lines: Record<CafeLineMoment, string>;
  isActive: boolean;
  visitsCafe: boolean;
  visitFrequency: CafeVisitFrequency;
  /** As typed; blank when unlimited. */
  visitLimit: string;
};
type OrderForm = {
  id: string | null;
  tokenPrice: string;
  isActive: boolean;
  items: { recipeId: string; quantity: string }[];
};
type ContentForm = { id: string | null; title: string; body: string; isActive: boolean };

const KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;
const LINE_MOMENTS: readonly CafeLineMoment[] = ["order", "served", "dismissed"];
const SMALL_BUTTON = "px-3 py-1 text-xs font-semibold disabled:opacity-50";
const SECTION_CONTENT_ID = "shop-admin-cafe-characters-content";

function linesToText(lines: readonly LocalizedText[] | undefined): string {
  return (lines ?? []).map((line) => `${line.en} | ${line.zh}`).join("\n");
}

function textToLines(text: string): LocalizedText[] {
  return text
    .split("\n")
    .map((row) => row.trim())
    .filter((row) => row !== "")
    .map((row) => {
      const divider = row.indexOf("|");
      if (divider === -1) return { en: row, zh: row };
      return { en: row.slice(0, divider).trim(), zh: row.slice(divider + 1).trim() };
    });
}

function emptyCharacterForm(): CharacterForm {
  return {
    isNew: true,
    key: "",
    nameEn: "",
    nameZh: "",
    introEn: "",
    introZh: "",
    tokenEn: "",
    tokenZh: "",
    tokenIconPath: "",
    spriteWaiting: "",
    spriteDelighted: "",
    lines: { order: "", served: "", dismissed: "" },
    isActive: false,
    visitsCafe: true,
    visitFrequency: "unlimited",
    visitLimit: "",
  };
}

function characterFormFor(character: ShopCharacter): CharacterForm {
  return {
    isNew: false,
    key: character.key,
    nameEn: character.name.en,
    nameZh: character.name.zh,
    introEn: character.intro.en,
    introZh: character.intro.zh,
    tokenEn: character.tokenName.en,
    tokenZh: character.tokenName.zh,
    tokenIconPath: character.tokenIconPath ?? "",
    spriteWaiting: character.spritePaths.waiting ?? "",
    spriteDelighted: character.spritePaths.delighted ?? "",
    lines: {
      order: linesToText(character.lines.order),
      served: linesToText(character.lines.served),
      dismissed: linesToText(character.lines.dismissed),
    },
    isActive: character.isActive,
    visitsCafe: character.visitsCafe,
    visitFrequency: character.visitFrequency,
    visitLimit: character.visitLimit === null ? "" : String(character.visitLimit),
  };
}

/**
 * Shop Admin's fourth section (roadmap item U): the platform admin sets up Café characters,
 * their orders (any mix of dishes and quantities for one token price) and the curated
 * content their tokens carry. Starts collapsed like the others. Writes are protected by
 * platform-admin RLS, and orders save atomically through save_shop_character_order.
 */
export default function CafeCharactersSection({ recipes, locale }: { recipes: ShopRecipe[]; locale: Locale }) {
  const str = cafeAdminStrings[locale];
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [characters, setCharacters] = useState<ShopCharacter[]>([]);
  const [orders, setOrders] = useState<ShopCharacterOrder[]>([]);
  const [contents, setContents] = useState<CharacterTokenContent[]>([]);
  const [form, setForm] = useState<CharacterForm | null>(null);
  const [orderForm, setOrderForm] = useState<OrderForm | null>(null);
  const [contentForm, setContentForm] = useState<ContentForm | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const reload = useCallback(async (): Promise<ShopCharacter[]> => {
    const [characterRows, orderRows, contentRows] = await Promise.all([
      listShopCharacters(),
      listShopCharacterOrders(),
      listCharacterTokenContents(),
    ]);
    setCharacters(characterRows);
    setOrders(orderRows);
    setContents(contentRows);
    return characterRows;
  }, []);

  useEffect(() => {
    if (isCollapsed || isLoaded) return;
    let isCancelled = false;
    reload()
      .then((rows) => {
        if (isCancelled) return;
        setIsLoaded(true);
        const first = rows.find((character) => character.visitsCafe) ?? rows[0];
        setForm(first ? characterFormFor(first) : emptyCharacterForm());
      })
      .catch((error) => {
        console.error("Failed to load Café characters:", error);
        if (!isCancelled) setLoadFailed(true);
      });
    return () => {
      isCancelled = true;
    };
  }, [isCollapsed, isLoaded, reload]);

  const cookableRecipes = useMemo(() => recipes.filter((recipe) => recipe.cookMethod !== null), [recipes]);
  const recipeTitle = (recipeId: string): string => {
    const recipe = recipes.find((entry) => entry.id === recipeId);
    return recipe ? getShopRecipeContentForLocale(recipe, locale).title : recipeId;
  };

  const activeKey = form && !form.isNew ? form.key : null;
  const characterOrders = orders.filter((order) => order.characterKey === activeKey);
  const characterContents = contents.filter((content) => content.characterKey === activeKey);

  function selectCharacter(key: string): void {
    const character = characters.find((entry) => entry.key === key);
    setForm(character ? characterFormFor(character) : emptyCharacterForm());
    setOrderForm(null);
    setContentForm(null);
    setNotice(null);
  }

  async function run(action: () => Promise<string | null>): Promise<void> {
    setIsSaving(true);
    setNotice(null);
    try {
      const success = await action();
      if (success) setNotice({ kind: "success", message: success });
    } catch (error) {
      console.error("Café admin action failed:", error);
      setNotice({ kind: "error", message: str.genericError });
    } finally {
      setIsSaving(false);
    }
  }

  function fail(message: string): null {
    setNotice({ kind: "error", message });
    return null;
  }

  function handleSaveCharacter(): void {
    if (!form) return;
    void run(async () => {
      const key = form.key.trim();
      if (!KEY_PATTERN.test(key)) return fail(str.characterErrors.invalid_key);
      if (form.isNew && characters.some((character) => character.key === key)) {
        return fail(str.characterErrors.duplicate_key);
      }
      if (!form.nameEn.trim() || !form.nameZh.trim()) return fail(str.characterErrors.missing_name);
      if (!form.tokenEn.trim() || !form.tokenZh.trim()) return fail(str.characterErrors.missing_token);
      const visitLimit = form.visitFrequency === "unlimited" || form.visitLimit.trim() === "" ? null : Number(form.visitLimit);
      const frequencyProblem = validateCafeVisitFrequency(form.visitFrequency, visitLimit);
      if (frequencyProblem) return fail(str.frequencyErrors[frequencyProblem]);

      const existing = characters.find((character) => character.key === key);
      const spritePaths: ShopCharacter["spritePaths"] = {};
      if (form.spriteWaiting.trim()) spritePaths.waiting = form.spriteWaiting.trim();
      if (form.spriteDelighted.trim()) spritePaths.delighted = form.spriteDelighted.trim();
      await saveShopCharacter({
        key,
        name: { en: form.nameEn.trim(), zh: form.nameZh.trim() },
        intro: { en: form.introEn.trim(), zh: form.introZh.trim() },
        tokenName: { en: form.tokenEn.trim(), zh: form.tokenZh.trim() },
        tokenIconPath: form.tokenIconPath.trim() || null,
        spritePaths,
        lines: {
          order: textToLines(form.lines.order),
          served: textToLines(form.lines.served),
          dismissed: textToLines(form.lines.dismissed),
        },
        visitsCafe: form.visitsCafe,
        visitFrequency: form.visitFrequency,
        visitLimit,
        isActive: form.isActive,
        displayOrder: existing?.displayOrder ?? characters.reduce((max, character) => Math.max(max, character.displayOrder + 1), 0),
      });
      const rows = await reload();
      const saved = rows.find((character) => character.key === key);
      if (saved) setForm(characterFormFor(saved));
      return str.characterSaved;
    });
  }

  function handleSaveOrder(): void {
    if (!orderForm || !activeKey) return;
    void run(async () => {
      const items: CafeOrderItem[] = orderForm.items
        .filter((item) => item.recipeId !== "")
        .map((item) => ({ recipeId: item.recipeId, quantity: Number(item.quantity) }));
      const tokenPrice = Number(orderForm.tokenPrice);
      const problem = validateCharacterOrderDraft({ tokenPrice, items });
      if (problem) return fail(str.orderErrors[problem]);
      const result = await saveShopCharacterOrder({
        orderId: orderForm.id,
        characterKey: activeKey,
        tokenPrice,
        isActive: orderForm.isActive,
        items,
      });
      if (!result.success) return fail(str.orderErrors[result.code]);
      await reload();
      setOrderForm(null);
      return str.orderSaved;
    });
  }

  function handleDeleteOrder(orderId: string): void {
    if (!window.confirm(str.deleteOrderConfirm)) return;
    void run(async () => {
      await deleteShopCharacterOrder(orderId);
      await reload();
      setOrderForm(null);
      return str.orderDeleted;
    });
  }

  function handleSaveContent(): void {
    if (!contentForm || !activeKey) return;
    void run(async () => {
      if (!contentForm.title.trim() || !contentForm.body.trim()) return fail(str.contentMissing);
      const existing = contents.find((content) => content.id === contentForm.id);
      await saveCharacterTokenContent({
        id: contentForm.id,
        characterKey: activeKey,
        title: contentForm.title,
        body: contentForm.body,
        isActive: contentForm.isActive,
        displayOrder: existing?.displayOrder ?? characterContents.length,
      });
      await reload();
      setContentForm(null);
      return str.contentSaved;
    });
  }

  function handleDeleteContent(contentId: string): void {
    if (!window.confirm(str.deleteContentConfirm)) return;
    void run(async () => {
      await deleteCharacterTokenContent(contentId);
      await reload();
      setContentForm(null);
      return str.contentDeleted;
    });
  }

  const textField = (label: string, field: keyof CharacterForm, disabled = false) =>
    form ? (
      <label className={LABEL}>
        {label}
        <input
          className={INPUT}
          disabled={disabled}
          value={String(form[field])}
          onChange={(event) => setForm({ ...form, [field]: event.target.value })}
        />
      </label>
    ) : null;

  return (
    <section className={PANEL}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--shop-admin-text-dark)]">{str.heading}</h2>
          <p className="mt-1 max-w-3xl text-sm text-[var(--shop-admin-support-text)]">{str.description}</p>
        </div>
        <button
          type="button"
          aria-expanded={!isCollapsed}
          aria-controls={SECTION_CONTENT_ID}
          onClick={() => setIsCollapsed((current) => !current)}
          className={TOGGLE_BUTTON}
        >
          {isCollapsed ? str.expand : str.collapse}
        </button>
      </div>

      <div id={SECTION_CONTENT_ID} hidden={isCollapsed} className="mt-4 space-y-5">
        {notice ? (
          <p
            role="status"
            className={
              notice.kind === "success"
                ? "rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800"
                : "rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700"
            }
          >
            {notice.message}
          </p>
        ) : null}

        {loadFailed ? (
          <p className="text-sm text-red-700">{str.loadError}</p>
        ) : !isLoaded || !form ? (
          <p className="text-sm text-[var(--shop-admin-support-text)]">{str.loading}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <label className={LABEL}>
                {str.pickCharacter}
                <select className={INPUT} value={form.isNew ? "" : form.key} onChange={(event) => selectCharacter(event.target.value)}>
                  {form.isNew ? <option value="">{str.newCharacter}</option> : null}
                  {characters.map((character) => (
                    <option key={character.key} value={character.key}>
                      {character.name[locale] || character.name.en}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => selectCharacter("")} className={`${SHOP_ADMIN_BUTTON_SECONDARY} px-4 py-2 text-sm font-semibold`}>
                {str.newCharacter}
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">{textField(str.keyLabel, "key", !form.isNew)}</div>
              {textField(str.nameEn, "nameEn")}
              {textField(str.nameZh, "nameZh")}
              {textField(str.introEn, "introEn")}
              {textField(str.introZh, "introZh")}
              {textField(str.tokenEn, "tokenEn")}
              {textField(str.tokenZh, "tokenZh")}
              <div className="md:col-span-2">{textField(str.tokenIcon, "tokenIconPath")}</div>
              {textField(str.spriteWaiting, "spriteWaiting")}
              {textField(str.spriteDelighted, "spriteDelighted")}
            </div>

            <fieldset className="space-y-2">
              <legend className={LABEL}>{str.linesHeading}</legend>
              <div className="grid gap-3 md:grid-cols-3">
                {LINE_MOMENTS.map((moment) => (
                  <label key={moment} className={LABEL}>
                    {moment === "order" ? str.lineOrder : moment === "served" ? str.lineServed : str.lineDismissed}
                    <textarea
                      rows={3}
                      className={INPUT}
                      value={form.lines[moment]}
                      onChange={(event) => setForm({ ...form, lines: { ...form.lines, [moment]: event.target.value } })}
                    />
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className={LABEL}>{str.frequencyLabel}</legend>
              <div className="flex flex-wrap items-end gap-3">
                <select
                  aria-label={str.frequencyLabel}
                  className={`${INPUT} mt-0 w-auto`}
                  value={form.visitFrequency}
                  onChange={(event) => {
                    const visitFrequency = event.target.value as CafeVisitFrequency;
                    setForm({ ...form, visitFrequency, visitLimit: visitFrequency === "unlimited" ? "" : form.visitLimit || "1" });
                  }}
                >
                  {CAFE_VISIT_FREQUENCIES.map((frequency) => (
                    <option key={frequency} value={frequency}>
                      {str.frequencyOptions[frequency]}
                    </option>
                  ))}
                </select>
                {form.visitFrequency !== "unlimited" ? (
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    {str.frequencyLimitLabel} =
                    <input
                      type="number"
                      min={1}
                      max={form.visitFrequency === "random_days" ? 31 : 100}
                      className={`${INPUT} mt-0 w-24`}
                      value={form.visitLimit}
                      onChange={(event) => setForm({ ...form, visitLimit: event.target.value })}
                    />
                  </label>
                ) : null}
              </div>
              <p className="text-xs text-[var(--shop-admin-support-text)]">{str.frequencyHelp}</p>
            </fieldset>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
                {str.activeLabel}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.visitsCafe} onChange={(event) => setForm({ ...form, visitsCafe: event.target.checked })} />
                {str.visitsLabel}
              </label>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveCharacter}
                className={`${SHOP_ADMIN_BUTTON_PRIMARY} px-5 py-2 text-sm font-semibold disabled:opacity-50`}
              >
                {str.saveCharacter}
              </button>
            </div>

            {activeKey ? (
              <>
                {/* Orders */}
                <div className="space-y-3 rounded-xl border bg-white p-4 [border-color:var(--shop-admin-card-border)]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-[var(--shop-admin-text-dark)]">{str.ordersHeading}</h3>
                    <button
                      type="button"
                      onClick={() => setOrderForm({ id: null, tokenPrice: "1", isActive: true, items: [{ recipeId: "", quantity: "1" }] })}
                      className={`${SHOP_ADMIN_BUTTON_SECONDARY} ${SMALL_BUTTON}`}
                    >
                      {str.addOrder}
                    </button>
                  </div>
                  {characterOrders.length === 0 ? <p className="text-sm text-[var(--shop-admin-support-text)]">{str.ordersEmpty}</p> : null}
                  <ul className="space-y-2">
                    {characterOrders.map((order) => (
                      <li key={order.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm">
                        <span className="min-w-0 flex-1">
                          {order.items.map((item) => `${recipeTitle(item.recipeId)} × ${item.quantity}`).join(" + ")}
                          {" → "}
                          {str.orderPaysTemplate.replace("{count}", String(order.tokenPrice))}
                          {order.isActive ? null : <span className="ml-2 text-xs text-gray-500">{str.orderInactiveBadge}</span>}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setOrderForm({
                              id: order.id,
                              tokenPrice: String(order.tokenPrice),
                              isActive: order.isActive,
                              items: order.items.map((item) => ({ recipeId: item.recipeId, quantity: String(item.quantity) })),
                            })
                          }
                          className={`${SHOP_ADMIN_BUTTON_SECONDARY} ${SMALL_BUTTON}`}
                        >
                          {str.editOrder}
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleDeleteOrder(order.id)}
                          className={`${SHOP_ADMIN_BUTTON_DESTRUCTIVE} ${SMALL_BUTTON}`}
                        >
                          {str.deleteOrder}
                        </button>
                      </li>
                    ))}
                  </ul>

                  {orderForm ? (
                    <div className="space-y-2 rounded-lg border p-3">
                      {orderForm.items.map((item, index) => (
                        <div key={index} className="flex flex-wrap items-end gap-2">
                          <label className={`${LABEL} min-w-[12rem] flex-1`}>
                            {str.orderDish}
                            <select
                              className={INPUT}
                              value={item.recipeId}
                              onChange={(event) =>
                                setOrderForm({
                                  ...orderForm,
                                  items: orderForm.items.map((entry, i) => (i === index ? { ...entry, recipeId: event.target.value } : entry)),
                                })
                              }
                            >
                              <option value="">{str.pickDish}</option>
                              {cookableRecipes.map((recipe) => (
                                <option key={recipe.id} value={recipe.id}>
                                  {getShopRecipeContentForLocale(recipe, locale).title}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className={`${LABEL} w-24`}>
                            {str.orderQuantity}
                            <input
                              type="number"
                              min={1}
                              max={9}
                              className={INPUT}
                              value={item.quantity}
                              onChange={(event) =>
                                setOrderForm({
                                  ...orderForm,
                                  items: orderForm.items.map((entry, i) => (i === index ? { ...entry, quantity: event.target.value } : entry)),
                                })
                              }
                            />
                          </label>
                          <button
                            type="button"
                            disabled={orderForm.items.length === 1}
                            onClick={() => setOrderForm({ ...orderForm, items: orderForm.items.filter((_, i) => i !== index) })}
                            className={`${SHOP_ADMIN_BUTTON_DESTRUCTIVE} ${SMALL_BUTTON} mb-1`}
                          >
                            {str.removeDish}
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setOrderForm({ ...orderForm, items: [...orderForm.items, { recipeId: "", quantity: "1" }] })}
                        className={`${SHOP_ADMIN_BUTTON_SECONDARY} ${SMALL_BUTTON}`}
                      >
                        {str.addDish}
                      </button>
                      <div className="flex flex-wrap items-end gap-3">
                        <label className={`${LABEL} w-32`}>
                          {str.orderPrice}
                          <input
                            type="number"
                            min={1}
                            max={50}
                            className={INPUT}
                            value={orderForm.tokenPrice}
                            onChange={(event) => setOrderForm({ ...orderForm, tokenPrice: event.target.value })}
                          />
                        </label>
                        <label className="flex items-center gap-2 pb-3 text-sm">
                          <input
                            type="checkbox"
                            checked={orderForm.isActive}
                            onChange={(event) => setOrderForm({ ...orderForm, isActive: event.target.checked })}
                          />
                          {str.orderActive}
                        </label>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={handleSaveOrder}
                          className={`${SHOP_ADMIN_BUTTON_PRIMARY} mb-1 px-4 py-2 text-sm font-semibold disabled:opacity-50`}
                        >
                          {str.saveOrder}
                        </button>
                        <button type="button" onClick={() => setOrderForm(null)} className="btn-neutral mb-1 rounded-full border-2 px-4 py-2 text-sm font-semibold">
                          {str.cancel}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Token content */}
                <div className="space-y-3 rounded-xl border bg-white p-4 [border-color:var(--shop-admin-card-border)]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-[var(--shop-admin-text-dark)]">{str.contentsHeading}</h3>
                    <button
                      type="button"
                      onClick={() => setContentForm({ id: null, title: "", body: "", isActive: true })}
                      className={`${SHOP_ADMIN_BUTTON_SECONDARY} ${SMALL_BUTTON}`}
                    >
                      {str.addContent}
                    </button>
                  </div>
                  {characterContents.length === 0 ? <p className="text-sm text-[var(--shop-admin-support-text)]">{str.contentsEmpty}</p> : null}
                  <ul className="space-y-2">
                    {characterContents.map((content) => (
                      <li key={content.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm">
                        <span className="min-w-0 flex-1">
                          <span className="font-semibold">{content.title}</span>
                          {content.isActive ? null : <span className="ml-2 text-xs text-gray-500">{str.orderInactiveBadge}</span>}
                          <span className="block truncate text-xs text-gray-600">{content.body}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setContentForm({ id: content.id, title: content.title, body: content.body, isActive: content.isActive })}
                          className={`${SHOP_ADMIN_BUTTON_SECONDARY} ${SMALL_BUTTON}`}
                        >
                          {str.editOrder}
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleDeleteContent(content.id)}
                          className={`${SHOP_ADMIN_BUTTON_DESTRUCTIVE} ${SMALL_BUTTON}`}
                        >
                          {str.deleteContent}
                        </button>
                      </li>
                    ))}
                  </ul>

                  {contentForm ? (
                    <div className="space-y-2 rounded-lg border p-3">
                      <label className={LABEL}>
                        {str.contentTitle}
                        <input
                          className={INPUT}
                          maxLength={60}
                          value={contentForm.title}
                          onChange={(event) => setContentForm({ ...contentForm, title: event.target.value })}
                        />
                      </label>
                      <label className={LABEL}>
                        {str.contentBody}
                        <textarea
                          rows={4}
                          maxLength={600}
                          className={INPUT}
                          value={contentForm.body}
                          onChange={(event) => setContentForm({ ...contentForm, body: event.target.value })}
                        />
                      </label>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={contentForm.isActive}
                            onChange={(event) => setContentForm({ ...contentForm, isActive: event.target.checked })}
                          />
                          {str.contentActive}
                        </label>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={handleSaveContent}
                          className={`${SHOP_ADMIN_BUTTON_PRIMARY} px-4 py-2 text-sm font-semibold disabled:opacity-50`}
                        >
                          {str.saveContent}
                        </button>
                        <button type="button" onClick={() => setContentForm(null)} className="btn-neutral rounded-full border-2 px-4 py-2 text-sm font-semibold">
                          {str.cancel}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
