"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";
import { getAllPendingWordsForAdmin, setWordContentReadyById, type AdminPendingWord } from "@/lib/supabase-service";
import { useSession } from "@/lib/authContext";
import { useLocale } from "@/app/shared/locale";
import { adminQueueStrings } from "./admin-queue.strings";

// ─── Section ─────────────────────────────────────────────────────────────────

export default function ContentQueueSection({ vm }: { vm: WordsWorkspaceVM }) {
  const { page, formatDateTime } = vm;
  const locale = useLocale();
  const str = adminQueueStrings[locale];
  const session = useSession();
  const router = useRouter();

  const [pendingWords, setPendingWords] = useState<AdminPendingWord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [shippingId, setShippingId] = useState<string | null>(null);

  // Load on mount, excluding the admin's own family words
  useEffect(() => {
    if (page !== "adminQueue") return;
    setLoading(true);
    getAllPendingWordsForAdmin()
      .then((words) => {
        // Derive character-level status from ALL families before filtering:
        // if any family's word for a hanzi is 'ready', the character is considered ready.
        const readyHanzi = new Set(
          words.filter((w) => w.contentStatus === "ready").map((w) => w.hanzi)
        );
        const withCharStatus = words.map((w) => ({
          ...w,
          contentStatus: readyHanzi.has(w.hanzi) ? ("ready" as const) : ("pending" as const),
        }));
        // Platform admin's own words already appear in Content Admin — exclude them
        const adminFamilyId = session?.familyId;
        setPendingWords(
          adminFamilyId ? withCharStatus.filter((w) => w.familyId !== adminFamilyId) : withCharStatus
        );
      })
      .catch((err: unknown) =>
        setLoadError(err instanceof Error ? err.message : "Failed to load")
      )
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Navigate to Content Admin with curation context
  function handleCurate(word: AdminPendingWord) {
    router.push(
      `/words/admin?curateWordId=${encodeURIComponent(word.id)}&curateFamilyId=${encodeURIComponent(word.familyId)}&curateHanzi=${encodeURIComponent(word.hanzi)}`
    );
  }

  // Ship: flip content_status → 'ready', making the word available to the family
  async function handleShip(word: AdminPendingWord) {
    setShippingId(word.id);
    try {
      await setWordContentReadyById(word.id);
      setPendingWords((prev) =>
        prev.map((w) => w.id === word.id ? { ...w, contentStatus: "ready" } : w)
      );
    } catch (err) {
      console.error("Ship failed:", err);
    } finally {
      setShippingId(null);
    }
  }

  if (page !== "adminQueue") return null;

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="font-medium">{str.pageTitle}</h2>
      <p className="text-sm text-gray-700">{str.pageDescription}</p>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      {loading ? (
        <p className="text-sm text-gray-600">{str.loading}</p>
      ) : !loadError && pendingWords.length === 0 ? (
        <p className="text-sm text-gray-600">{str.noWords}</p>
      ) : (
        <>
          <p className="text-xs text-gray-500">
            {pendingWords.length}&nbsp;
            {pendingWords.length === 1 ? str.tableCaption : str.tableCaptionPlural}
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left">{str.colCharacter}</th>
                  <th className="px-3 py-2 text-left">{str.colPinyin}</th>
                  <th className="px-3 py-2 text-left">{str.colFamily}</th>
                  <th className="px-3 py-2 text-left">{str.colDateAdded}</th>
                  <th className="px-3 py-2 text-left">{str.colStatus}</th>
                  <th className="px-3 py-2 text-left">{str.colAction}</th>
                </tr>
              </thead>
              <tbody>
                {pendingWords.map((word) => {
                  const isShipping = shippingId === word.id;
                  const isReady = word.contentStatus === "ready";
                  return (
                    <tr key={word.id} className="border-b align-top">
                      <td className="px-3 py-2 text-xl font-medium">{word.hanzi}</td>
                      <td className="px-3 py-2">{word.pinyin ?? str.noPinyin}</td>
                      <td className="px-3 py-2">
                        {word.familyName || word.familyId.slice(0, 8)}
                      </td>
                      <td className="px-3 py-2">{formatDateTime(word.createdAt)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            isReady
                              ? "inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800"
                              : "inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600"
                          }
                        >
                          {isReady ? str.statusReady : str.statusPending}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            className="rounded border-2 border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-sky-800 disabled:opacity-50"
                            onClick={() => handleCurate(word)}
                            disabled={isShipping}
                          >
                            {str.curateButton}
                          </button>
                          {!isReady && (
                            <button
                              type="button"
                              className="rounded border-2 border-emerald-600 bg-emerald-600 px-1.5 py-0.5 text-[11px] font-medium leading-none text-white disabled:opacity-50"
                              onClick={() => void handleShip(word)}
                              disabled={isShipping}
                            >
                              {isShipping ? str.shipping : str.shipButton}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
