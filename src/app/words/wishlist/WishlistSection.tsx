"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/app/shared/locale";
import { validateWishlistDraft, WISHLIST_TITLE_MAX, WISHLIST_TOKEN_MAX } from "@/lib/characterTokens";
import type { ShopCharacter, WishlistDraft, WishlistRedemption, WishlistReward } from "@/lib/characterTokens.types";
import {
  deleteWishlistPhotos,
  getWishlistPhotoUrls,
  listFamilyChildren,
  listShopCharacters,
  listWishlistRedemptions,
  listWishlistRewards,
  saveWishlistReward,
  uploadWishlistPhoto,
} from "@/lib/supabase-service";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";
import { wishlistStrings } from "./wishlist.strings";
import { compressWishlistPhoto } from "./wishlistPhoto";

type LoadState = "loading" | "ready" | "error";
type Notice = { tone: "success" | "error"; text: string } | null;
type Form = {
  id: string | null;
  title: string;
  childUserId: string;
  isRepeatable: boolean;
  isActive: boolean;
  /** characterKey -> the number as typed; blank means "not part of the price". */
  counts: Record<string, string>;
  /** The saved photo this reward keeps (null = none, or it was removed). */
  photoPath: string | null;
  /** A newly chosen photo, uploaded on save, replacing photoPath. */
  photoFile: File | null;
  /** Local preview of photoFile. */
  photoPreview: string | null;
};

const EMPTY_FORM: Form = {
  id: null,
  title: "",
  childUserId: "",
  isRepeatable: false,
  isActive: true,
  counts: {},
  photoPath: null,
  photoFile: null,
  photoPreview: null,
};

function fill(template: string, tokens: Record<string, string>): string {
  return Object.entries(tokens).reduce((text, [key, value]) => text.split(`{${key}}`).join(value), template);
}

function draftOf(form: Form): WishlistDraft {
  return {
    title: form.title.trim(),
    childUserId: form.childUserId || null,
    isRepeatable: form.isRepeatable,
    prices: Object.entries(form.counts)
      .filter(([, value]) => value.trim() !== "")
      .map(([characterKey, value]) => ({ characterKey, tokenCount: Number(value) })),
  };
}

function formFor(reward: WishlistReward): Form {
  return {
    id: reward.id,
    title: reward.title,
    childUserId: reward.childUserId ?? "",
    isRepeatable: reward.isRepeatable,
    isActive: reward.isActive,
    counts: Object.fromEntries(reward.prices.map((price) => [price.characterKey, String(price.tokenCount)])),
    photoPath: reward.imagePath,
    photoFile: null,
    photoPreview: null,
  };
}

/**
 * The parent's Wishlist Rewards page (/words/wishlist, roadmap item U). One short form:
 * what the reward is, what it costs, who it's for. Rewards are hidden rather than deleted,
 * so past redemptions keep their history. All writes go through save_wishlist_reward.
 */
export default function WishlistSection({ vm }: { vm: WordsWorkspaceVM }) {
  const locale = useLocale();
  const str = wishlistStrings[locale];
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [characters, setCharacters] = useState<ShopCharacter[]>([]);
  const [children, setChildren] = useState<{ id: string; name: string }[]>([]);
  const [rewards, setRewards] = useState<WishlistReward[]>([]);
  const [redemptions, setRedemptions] = useState<WishlistRedemption[]>([]);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  /** Signed links for saved photos, keyed by storage path. */
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Free the local preview when it's replaced or the page goes away.
  useEffect(() => {
    const preview = form.photoPreview;
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [form.photoPreview]);

  useEffect(() => {
    if (vm.page !== "wishlist") return;
    let isCancelled = false;
    Promise.all([listShopCharacters(), listFamilyChildren(), listWishlistRewards(), listWishlistRedemptions({ wholeFamily: true })])
      .then(([characterRows, childRows, rewardRows, redemptionRows]) => {
        if (isCancelled) return;
        setCharacters(characterRows);
        setChildren(childRows);
        setRewards(rewardRows);
        setRedemptions(redemptionRows);
        setLoadState("ready");
        void refreshPhotoUrls(rewardRows);
      })
      .catch((error) => {
        console.error("Failed to load wishlist rewards:", error);
        if (!isCancelled) setLoadState("error");
      });
    return () => {
      isCancelled = true;
    };
  }, [vm.page]);

  const childNameById = useMemo(() => new Map(children.map((child) => [child.id, child.name])), [children]);
  const characterByKey = useMemo(() => new Map(characters.map((character) => [character.key, character])), [characters]);

  if (vm.page !== "wishlist") return null;

  const priceLabel = (reward: WishlistReward): string =>
    reward.prices
      .map((price) => {
        const character = characterByKey.get(price.characterKey);
        const token = character?.tokenName[locale] || character?.tokenName.en || price.characterKey;
        return `${price.tokenCount} ${token}`;
      })
      .join(" + ");

  async function refreshPhotoUrls(rows: readonly WishlistReward[]): Promise<void> {
    try {
      setPhotoUrls(await getWishlistPhotoUrls(rows.flatMap((reward) => (reward.imagePath ? [reward.imagePath] : []))));
    } catch (error) {
      // Photos are optional; the list still works without them.
      console.error("Failed to load wishlist photos:", error);
    }
  }

  /** Best effort: a leftover file only wastes a little storage, so a failure never blocks saving. */
  function discardPhotos(paths: (string | null)[]): void {
    const real = paths.filter((path): path is string => Boolean(path));
    if (real.length > 0) deleteWishlistPhotos(real).catch((error) => console.error("Failed to remove an old photo:", error));
  }

  /**
   * Saves the reward with its full photo state. A newly chosen photo is shrunk and uploaded
   * first; afterwards the photo the reward no longer uses is removed.
   */
  async function persist(
    rewardId: string | null,
    draft: WishlistDraft,
    isActive: boolean,
    photo: { keepPath: string | null; newFile: File | null }
  ): Promise<boolean> {
    setIsSaving(true);
    setNotice(null);
    let uploadedPath: string | null = null;
    try {
      if (photo.newFile) {
        let compressed: Blob;
        try {
          compressed = await compressWishlistPhoto(photo.newFile);
        } catch (error) {
          console.error("Failed to read the photo:", error);
          setNotice({ tone: "error", text: str.photoReadError });
          return false;
        }
        try {
          uploadedPath = await uploadWishlistPhoto(compressed);
        } catch (error) {
          console.error("Failed to upload the photo:", error);
          setNotice({ tone: "error", text: str.photoUploadError });
          return false;
        }
      }
      const imagePath = uploadedPath ?? photo.keepPath;
      const result = await saveWishlistReward(rewardId, draft, isActive, imagePath);
      if (!result.success) {
        discardPhotos([uploadedPath]);
        setNotice({ tone: "error", text: str.saveErrors[result.code] });
        return false;
      }
      const previousPath = rewards.find((reward) => reward.id === rewardId)?.imagePath ?? null;
      if (previousPath && previousPath !== imagePath) discardPhotos([previousPath]);
      const rows = await listWishlistRewards();
      setRewards(rows);
      await refreshPhotoUrls(rows);
      setNotice({ tone: "success", text: str.savedNotice });
      return true;
    } catch (error) {
      console.error("Failed to save wishlist reward:", error);
      setNotice({ tone: "error", text: str.saveErrors.unknown });
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmit(): Promise<void> {
    const draft = draftOf(form);
    const problem = validateWishlistDraft(draft);
    if (problem) {
      setNotice({ tone: "error", text: str.formErrors[problem] });
      return;
    }
    if (await persist(form.id, draft, form.isActive, { keepPath: form.photoPath, newFile: form.photoFile })) {
      setForm(EMPTY_FORM);
    }
  }

  async function handleToggleHidden(reward: WishlistReward): Promise<void> {
    // Hiding or showing keeps the photo as it is.
    await persist(
      reward.id,
      { title: reward.title, childUserId: reward.childUserId, isRepeatable: reward.isRepeatable, prices: reward.prices },
      !reward.isActive,
      { keepPath: reward.imagePath, newFile: null }
    );
  }

  function handlePhotoChosen(file: File | undefined): void {
    if (!file) return;
    setForm({ ...form, photoFile: file, photoPreview: URL.createObjectURL(file) });
  }

  function handleRemovePhoto(): void {
    setForm({ ...form, photoPath: null, photoFile: null, photoPreview: null });
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  const formPhotoSrc = form.photoPreview ?? (form.photoPath ? photoUrls[form.photoPath] : undefined);

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
        <>
          <form
            className="space-y-3 rounded-lg border p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <h3 className="font-semibold">{form.id ? str.editHeading : str.addHeading}</h3>

            <label className="block text-sm font-medium text-gray-700">
              {str.titleLabel}
              <input
                value={form.title}
                maxLength={WISHLIST_TITLE_MAX}
                placeholder={str.titlePlaceholder}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                className="mt-1 w-full rounded-md border px-3 py-2"
              />
            </label>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-gray-700">{str.priceLabel}</legend>
              <p className="text-xs text-gray-600">{str.priceHelp}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {characters.filter((character) => character.isActive || form.counts[character.key]).map((character) => {
                  const name = character.name[locale] || character.name.en;
                  const token = character.tokenName[locale] || character.tokenName.en;
                  return (
                    <label key={character.key} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      {character.tokenIconPath ? (
                        <img src={character.tokenIconPath} alt="" aria-hidden="true" className="h-6 w-6 object-contain" />
                      ) : null}
                      <span className="flex-1">
                        {name} · {token}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={WISHLIST_TOKEN_MAX}
                        inputMode="numeric"
                        aria-label={fill(str.tokenCountAriaTemplate, { name, token })}
                        value={form.counts[character.key] ?? ""}
                        onChange={(event) =>
                          setForm({ ...form, counts: { ...form.counts, [character.key]: event.target.value } })
                        }
                        className="w-20 rounded-md border px-2 py-1 text-sm"
                      />
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">{str.photoLabel}</p>
              <p className="text-xs text-gray-600">{str.photoHelp}</p>
              <div className="flex flex-wrap items-center gap-3">
                {formPhotoSrc ? (
                  <img
                    src={formPhotoSrc}
                    alt={fill(str.photoAltTemplate, { title: form.title || str.titlePlaceholder })}
                    className="h-24 w-32 rounded-md border object-cover"
                  />
                ) : null}
                <input
                  ref={photoInputRef}
                  id="wishlist-photo-input"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => handlePhotoChosen(event.target.files?.[0])}
                />
                <label
                  htmlFor="wishlist-photo-input"
                  className="btn-secondary cursor-pointer rounded-md border-2 px-3 py-1.5 text-sm font-medium"
                >
                  {formPhotoSrc ? str.replacePhoto : str.choosePhoto}
                </label>
                {formPhotoSrc ? (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="btn-neutral rounded-md border-2 px-3 py-1.5 text-sm font-medium"
                  >
                    {str.removePhoto}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-4">
              {children.length > 1 ? (
                <label className="text-sm font-medium text-gray-700">
                  {str.childLabel}
                  <select
                    value={form.childUserId}
                    onChange={(event) => setForm({ ...form, childUserId: event.target.value })}
                    className="mt-1 block rounded-md border px-2 py-2 text-sm"
                  >
                    <option value="">{str.everyChild}</option>
                    {children.map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="flex items-center gap-2 py-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.isRepeatable}
                  onChange={(event) => setForm({ ...form, isRepeatable: event.target.checked })}
                />
                {str.repeatLabel}
              </label>
            </div>

            <div className="flex gap-2">
              <button type="submit" disabled={isSaving} className="btn-primary rounded-md border-2 px-4 py-2 font-medium disabled:opacity-50">
                {isSaving ? str.saving : str.saveButton}
              </button>
              {form.id ? (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setForm(EMPTY_FORM)}
                  className="btn-neutral rounded-md border-2 px-4 py-2 font-medium disabled:opacity-50"
                >
                  {str.cancelButton}
                </button>
              ) : null}
            </div>
          </form>

          <div className="space-y-2">
            <h3 className="font-semibold">{str.listHeading}</h3>
            {rewards.length === 0 ? (
              <p className="text-sm text-gray-600">{str.empty}</p>
            ) : (
              <ul className="space-y-2">
                {rewards.map((reward) => (
                  <li key={reward.id} className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${reward.isActive ? "" : "opacity-60"}`}>
                    {reward.imagePath && photoUrls[reward.imagePath] ? (
                      <img
                        src={photoUrls[reward.imagePath]}
                        alt={fill(str.photoAltTemplate, { title: reward.title })}
                        className="h-14 w-14 rounded-md border object-cover"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {reward.title}
                        {reward.isActive ? null : <span className="ml-2 text-xs text-gray-500">{str.hiddenBadge}</span>}
                      </p>
                      <p className="text-sm text-gray-700">{priceLabel(reward)}</p>
                      <p className="text-xs text-gray-500">
                        {reward.childUserId
                          ? fill(str.forChildTemplate, { name: childNameById.get(reward.childUserId) ?? "" })
                          : str.forEveryChild}
                        {" · "}
                        {reward.isRepeatable ? str.repeatable : str.oneTime}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => setForm(formFor(reward))}
                      className="btn-secondary rounded border-2 px-2 py-1 text-xs font-medium disabled:opacity-50"
                    >
                      {str.editButton}
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void handleToggleHidden(reward)}
                      className="btn-neutral rounded border-2 px-2 py-1 text-xs font-medium disabled:opacity-50"
                    >
                      {reward.isActive ? str.hideButton : str.showButton}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">{str.historyHeading}</h3>
            {redemptions.length === 0 ? (
              <p className="text-sm text-gray-600">{str.historyEmpty}</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {redemptions.map((redemption) => (
                  <li key={redemption.id} className="rounded-md border px-3 py-2">
                    <span className="font-medium">{redemption.title}</span>
                    {" · "}
                    {new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { dateStyle: "medium" }).format(redemption.redeemedAt)}
                    {" · "}
                    <span className="text-gray-600">
                      {fill(str.historyRowTemplate, { child: redemption.childSignature, parent: redemption.parentSignature })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
