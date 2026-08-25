"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WordsWorkspaceVM } from "../../shared/WordsWorkspaceVM";
import type { ParagraphQuizBlank } from "@/lib/paragraphQuizBuilder";
import { deriveParagraphBlankTier, resolveParagraphQuizBlanks } from "@/lib/paragraphQuizBuilder";
import { calculateSessionCoins } from "@/lib/coins";
import type { QuizSession } from "@/lib/quiz.types";
import type { RewardedIngredient } from "@/lib/shop.types";
import {
  completeReviewTestSession,
  gradeVocabPhrase,
  gradeWord,
  loadReviewSessionProgress,
  nudgeWordFamiliarity,
  recordQuizSession,
  rewardRandomIngredients,
  saveReviewSessionProgress,
} from "@/lib/supabase-service";
import { extractUniqueHanzi, resolveParagraphQuizResume } from "../../shared/words.shared.utils";
import {
  buildParagraphQuizGradeData,
  isPageComplete,
  isQuizComplete,
  isRevealEligible,
} from "./paragraphQuiz.utils";
import type { ParagraphQuizBlankProgress, ParagraphQuizHistoryItem, ParagraphQuizProgressData } from "./paragraphQuiz.types";
import ParagraphQuizRevealPopup from "./ParagraphQuizRevealPopup";
import IngredientRewardPanel from "../IngredientRewardPanel";

/**
 * Genuinely new quiz UI (Item I, Phase 3) -- not a reuse of the existing
 * bundled fill-test's per-round "up to 5 blanks, multiple-choice" mechanic
 * (FillTestReviewSection.tsx): a whole paragraph, paginated, with a shared
 * per-page word bank feeding many simultaneous blanks, wrong drops bounce
 * back with no penalty, grading is per-blank and immediate (not a batched
 * per-round submit). Mounts as a sibling of FillTestReviewSection under the
 * SAME /words/review/fill-test entry point (see FillTestReviewSection.tsx's
 * own added guard clause) -- the "third branch, same entry point" the
 * feature spec calls for, avoiding a second new-route boundary.
 */
export default function ParagraphQuizReviewSection({ vm }: { vm: WordsWorkspaceVM }) {
  const {
    isFillTestReviewPage,
    str,
    activeReviewTestSession,
    activeReviewTestSessionRuntime,
    words,
    vocabPhrases,
    allFlashcardContents,
  } = vm;
  const paragraphQuiz = activeReviewTestSessionRuntime?.paragraphQuiz ?? null;
  const pqStr = str.paragraphQuiz;

  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [blankState, setBlankState] = useState<Record<string, ParagraphQuizBlankProgress>>({});
  const [wrongDragCounts, setWrongDragCounts] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<ParagraphQuizHistoryItem[]>([]);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [selectedBankSpanId, setSelectedBankSpanId] = useState<string | null>(null);
  const [draggingSpanId, setDraggingSpanId] = useState<string | null>(null);
  const [wrongSpanId, setWrongSpanId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [revealOpenSpanId, setRevealOpenSpanId] = useState<string | null>(null);
  const [rewardedIngredients, setRewardedIngredients] = useState<RewardedIngredient[] | null>(null);
  const loadedSessionIdRef = useRef<string | null>(null);

  const blanksBySpanId = useMemo((): Map<string, ParagraphQuizBlank> => {
    if (!paragraphQuiz) return new Map();
    const allSpanIds = paragraphQuiz.pages.flatMap((page) => page.bankSpanIds);
    const blanks = resolveParagraphQuizBlanks(paragraphQuiz.paragraph, allSpanIds);
    return new Map(blanks.map((blank) => [blank.spanId, blank]));
  }, [paragraphQuiz]);

  // Load saved progress (or start fresh) once per newly-active session.
  useEffect(() => {
    if (!activeReviewTestSession || !paragraphQuiz) return;
    if (loadedSessionIdRef.current === activeReviewTestSession.id) return;
    loadedSessionIdRef.current = activeReviewTestSession.id;

    let cancelled = false;
    (async () => {
      let resumed = false;
      try {
        const progress = await loadReviewSessionProgress(activeReviewTestSession.id);
        if (progress && progress.sourceType === "packaged") {
          const resolved = resolveParagraphQuizResume({
            progressData: progress.progressData,
            testModeId: paragraphQuiz.testMode.id,
            pages: paragraphQuiz.pages,
          });
          if (resolved.status === "ready" && !cancelled) {
            setCurrentPageIndex(resolved.currentPageIndex);
            setBlankState(resolved.blankState);
            setWrongDragCounts(resolved.wrongDragCounts);
            setSessionStartTime(resolved.sessionStartTime ?? Date.now());
            resumed = true;
          }
        }
      } catch (error) {
        console.error("Failed to load saved paragraph-quiz progress", error);
      }
      if (!cancelled && !resumed) {
        setCurrentPageIndex(0);
        setBlankState({});
        setWrongDragCounts({});
        setHistory([]);
        setSessionStartTime(Date.now());
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeReviewTestSession, paragraphQuiz]);

  function autosave(
    nextPageIndex: number,
    nextBlankState: Record<string, ParagraphQuizBlankProgress>,
    nextWrongDragCounts: Record<string, number> = wrongDragCounts
  ) {
    if (!activeReviewTestSession || !paragraphQuiz) return;
    const payload: ParagraphQuizProgressData = {
      testModeId: paragraphQuiz.testMode.id,
      currentPageIndex: nextPageIndex,
      blankState: nextBlankState,
      wrongDragCounts: nextWrongDragCounts,
      sessionStartTime,
    };
    saveReviewSessionProgress({
      clientSessionKey: activeReviewTestSession.id,
      sourceType: "packaged",
      packagedSessionId: activeReviewTestSession.id,
      progressData: payload,
      startedAt: sessionStartTime ?? undefined,
    }).catch((error) => console.error("Failed to autosave paragraph-quiz progress", error));
  }

  async function completeSessionAndReturn() {
    if (!activeReviewTestSession) return;
    try {
      await completeReviewTestSession(activeReviewTestSession.id);
      vm.returnToDueReviewAfterReviewTestSession("completed", activeReviewTestSession.name);
    } catch (error) {
      console.error("Failed to complete paragraph-quiz review test session:", error);
      setNotice(pqStr.reviewTestSession.completeError.replace("{name}", activeReviewTestSession.name));
    }
  }

  function handleRewardContinue() {
    setRewardedIngredients(null);
    void completeSessionAndReturn();
  }

  async function finishSession() {
    if (!activeReviewTestSession) return;
    let quizSessionId: string | null = null;
    try {
      const gradeData = buildParagraphQuizGradeData(history);
      const durationSeconds = sessionStartTime ? Math.round((Date.now() - sessionStartTime) / 1000) : 0;
      const session: QuizSession = {
        id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        sessionType: "fill-test",
        gradeData,
        fullyCorrectCount: gradeData.filter((entry) => entry.grade === "easy").length,
        failedCount: 0,
        partiallyCorrectCount: gradeData.filter((entry) => entry.grade !== "easy").length,
        totalGrades: gradeData.length,
        durationSeconds,
        coinsEarned: calculateSessionCoins(gradeData),
      };
      await recordQuizSession(session);
      quizSessionId = session.id;
    } catch (error) {
      console.error("Failed to save paragraph-quiz session:", error);
    }

    // Ingredient reward (feature spec 2026-08-22-paragraph-quiz-ingredient-reward.md):
    // a failure here, or an empty result (no unlocked recipes / empty pool /
    // already rewarded), must never block normal completion -- fall straight
    // through to completeSessionAndReturn exactly as before this feature.
    if (quizSessionId) {
      try {
        const rewards = await rewardRandomIngredients(quizSessionId);
        if (rewards.length > 0) {
          setRewardedIngredients(rewards);
          return;
        }
      } catch (error) {
        console.error("Failed to reward ingredients for paragraph-quiz session:", error);
      }
    }

    await completeSessionAndReturn();
  }

  async function handlePlacement(bankSpanId: string, targetSpanId: string) {
    if (!paragraphQuiz || submitting) return;
    setSelectedBankSpanId(null);
    setDraggingSpanId(null);

    if (bankSpanId !== targetSpanId) {
      // Wrong drop: bounce back to the bank. Bumps TWO independent counters:
      // blankState[targetSpanId].retryCount (grading tier -- keyed by which
      // BLANK was missed, whichever bank item caused it) and
      // wrongDragCounts[bankSpanId] (reveal-after-3-bounces eligibility --
      // keyed by which BANK ITEM was dragged wrong, cumulative across every
      // blank it was tried on, fix 2 / feature spec 2026-08-22). No grading
      // dispatch at all, matching the "wrong answer touches no character
      // state" precedent. Functional setState (not a direct closure read)
      // for both, since rapid consecutive wrong drops aren't guarded by
      // `submitting` the way a correct placement is.
      setWrongSpanId(targetSpanId);
      setTimeout(() => setWrongSpanId((current) => (current === targetSpanId ? null : current)), 400);

      let nextBlankState: Record<string, ParagraphQuizBlankProgress> = blankState;
      setBlankState((previous) => {
        nextBlankState = {
          ...previous,
          [targetSpanId]: {
            status: "unfilled" as const,
            retryCount: (previous[targetSpanId]?.retryCount ?? 0) + 1,
          },
        };
        return nextBlankState;
      });

      let nextWrongDragCounts: Record<string, number> = wrongDragCounts;
      setWrongDragCounts((previous) => {
        nextWrongDragCounts = { ...previous, [bankSpanId]: (previous[bankSpanId] ?? 0) + 1 };
        return nextWrongDragCounts;
      });

      autosave(currentPageIndex, nextBlankState, nextWrongDragCounts);
      return;
    }

    const blank = blanksBySpanId.get(targetSpanId);
    if (!blank) return;

    const retryCount = blankState[targetSpanId]?.retryCount ?? 0;
    const tier = deriveParagraphBlankTier(retryCount);

    setSubmitting(true);
    try {
      if (blank.wordId) {
        await gradeWord(blank.wordId, { grade: tier, source: "fillTest" });
      } else if (blank.vocabPhraseId) {
        await gradeVocabPhrase(blank.vocabPhraseId);
        const componentHanzi = extractUniqueHanzi(blank.text);
        for (const hanzi of componentHanzi) {
          const componentWord = words.find((word) => word.hanzi === hanzi);
          if (componentWord) {
            // Sequential, not Promise.all -- each nudge must read the
            // PREVIOUS nudge's just-updated state when a character shows up
            // in more than one correctly-answered phrase blank.
            await nudgeWordFamiliarity(componentWord.id, tier);
          }
        }
      }

      const nextBlankState: Record<string, ParagraphQuizBlankProgress> = {
        ...blankState,
        [targetSpanId]: { status: "correct", retryCount },
      };
      setBlankState(nextBlankState);
      setHistory((previous) => [
        ...previous,
        {
          spanId: blank.spanId,
          wordId: blank.wordId,
          vocabPhraseId: blank.vocabPhraseId,
          text: blank.text,
          tier,
          retryCount,
        },
      ]);

      const page = paragraphQuiz.pages[currentPageIndex];
      if (page && isPageComplete(page, nextBlankState)) {
        if (isQuizComplete(paragraphQuiz.pages, nextBlankState)) {
          autosave(currentPageIndex, nextBlankState);
          await finishSession();
          return;
        }
        const nextPageIndex = currentPageIndex + 1;
        setCurrentPageIndex(nextPageIndex);
        autosave(nextPageIndex, nextBlankState);
      } else {
        autosave(currentPageIndex, nextBlankState);
      }
    } catch (error) {
      console.error("Failed to grade paragraph-quiz blank:", error);
    } finally {
      setSubmitting(false);
    }
  }

  function handleStop() {
    if (history.length > 0) {
      const confirmed = window.confirm(pqStr.warning.confirmLeave.replace("{coins}", String(history.length)));
      if (!confirmed) return;
    }
    vm.returnToDueReviewAfterReviewTestSession("stopped");
  }

  if (!isFillTestReviewPage || !paragraphQuiz) {
    return null;
  }

  if (rewardedIngredients) {
    return (
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">{pqStr.pageLabel.replace("{name}", activeReviewTestSession?.name ?? "")}</h2>
        <IngredientRewardPanel
          ingredients={rewardedIngredients}
          strings={str.ingredientReward}
          onContinue={handleRewardContinue}
        />
      </section>
    );
  }

  const page = paragraphQuiz.pages[currentPageIndex];
  const bankItems = (page?.bankSpanIds ?? [])
    .filter((spanId) => blankState[spanId]?.status !== "correct")
    .map((spanId) => blanksBySpanId.get(spanId))
    .filter((blank): blank is ParagraphQuizBlank => Boolean(blank));

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="font-medium">{pqStr.pageLabel.replace("{name}", activeReviewTestSession?.name ?? "")}</h2>
      {notice ? <p className="text-sm text-rose-700">{notice}</p> : null}
      <p className="text-sm text-gray-600">
        {pqStr.pageProgress
          .replace("{current}", String(currentPageIndex + 1))
          .replace("{total}", String(paragraphQuiz.pages.length))}
      </p>

      <div className="flex flex-col items-start gap-4 lg:flex-row">
      <div className="flex-1 space-y-1 rounded-md border p-3 leading-normal">
        {(page?.sentences ?? []).map((sentence) => {
          const blankSpanIdSet = new Set(sentence.blankSpanIds);
          let cursor = 0;
          const parts: { key: string; node: React.ReactNode }[] = [];

          for (const blankSpanId of sentence.blankSpanIds) {
            const blank = blanksBySpanId.get(blankSpanId);
            if (!blank) continue;
            if (blank.startOffset > cursor) {
              parts.push({
                key: `text-${cursor}`,
                node: sentence.text.slice(cursor, blank.startOffset),
              });
            }
            const filled = blankState[blankSpanId]?.status === "correct";
            parts.push({
              key: `blank-${blankSpanId}`,
              node: (
                <button
                  type="button"
                  disabled={filled || submitting}
                  onDragOver={(event) => !filled && event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (draggingSpanId) void handlePlacement(draggingSpanId, blankSpanId);
                  }}
                  onClick={() => {
                    if (filled) return;
                    if (selectedBankSpanId) void handlePlacement(selectedBankSpanId, blankSpanId);
                  }}
                  className={
                    "mx-0.5 inline-flex min-w-[2rem] items-center justify-center rounded-full border-2 px-3 py-0.5 align-middle text-center leading-tight " +
                    (filled
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                      : wrongSpanId === blankSpanId
                        ? "border-rose-500 bg-rose-50"
                        : "border-dashed border-gray-400 bg-white")
                  }
                >
                  {filled ? blank.text : pqStr.dropPlaceholder}
                </button>
              ),
            });
            cursor = blank.startOffset + blank.text.length;
          }
          if (cursor < sentence.text.length) {
            parts.push({ key: `text-${cursor}-end`, node: sentence.text.slice(cursor) });
          }

          return (
            <p key={`sentence-${sentence.index}`}>
              {blankSpanIdSet.size > 0 ? parts.map((part) => <span key={part.key}>{part.node}</span>) : sentence.text}
            </p>
          );
        })}
      </div>

      <div className="w-full shrink-0 space-y-2 rounded-md border p-3 lg:sticky lg:top-4 lg:w-64">
        <h3 className="text-sm font-medium">{pqStr.wordBankHeader}</h3>
        <p className="text-xs text-gray-600">{pqStr.dragInstruction}</p>
        {bankItems.length === 0 ? (
          <p className="text-sm text-gray-500">{pqStr.wordBankEmpty}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {bankItems.map((blank) => {
              const wrongDragCount = wrongDragCounts[blank.spanId] ?? 0;
              const revealEligible = isRevealEligible(wrongDragCount);
              return (
                <span key={blank.spanId} className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    draggable
                    disabled={submitting}
                    onDragStart={() => setDraggingSpanId(blank.spanId)}
                    onDragEnd={() => setDraggingSpanId(null)}
                    onClick={() =>
                      setSelectedBankSpanId((current) => (current === blank.spanId ? null : blank.spanId))
                    }
                    className={
                      "rounded-md border-2 px-3 py-1 text-sm " +
                      (selectedBankSpanId === blank.spanId
                        ? "border-blue-500 bg-blue-50"
                        : revealEligible
                          ? "border-purple-500 bg-purple-50 text-purple-900"
                          : "border-gray-300 bg-white")
                    }
                  >
                    {blank.text}
                  </button>
                  {revealEligible ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setRevealOpenSpanId(blank.spanId);
                      }}
                      className="rounded-full border border-purple-400 bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800"
                    >
                      {pqStr.reveal.badgeLabel}
                    </button>
                  ) : null}
                </span>
              );
            })}
          </div>
        )}
      </div>
      </div>

      <button type="button" onClick={handleStop} className="btn-destructive rounded-md border-2 px-3 py-2">
        {pqStr.stopButton}
      </button>

      {revealOpenSpanId
        ? (() => {
            const revealBlank = blanksBySpanId.get(revealOpenSpanId);
            if (!revealBlank) return null;
            return (
              <ParagraphQuizRevealPopup
                blank={revealBlank}
                words={words}
                vocabPhrases={vocabPhrases}
                allFlashcardContents={allFlashcardContents}
                str={str}
                onClose={() => setRevealOpenSpanId(null)}
              />
            );
          })()
        : null}
    </section>
  );
}
