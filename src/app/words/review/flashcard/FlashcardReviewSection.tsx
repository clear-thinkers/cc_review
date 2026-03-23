"use client";

import Link from "next/link";
import { useState } from "react";
import { buildFlashcardLlmRequestKey } from "@/lib/flashcardLlm";
import FlashcardCard from "./FlashcardCard";
import type { WordsWorkspaceVM } from "../../shared/WordsWorkspaceVM";

export default function FlashcardReviewSection({ vm }: { vm: WordsWorkspaceVM }) {
  const [showPinyin, setShowPinyin] = useState(false);

  const {
    isFlashcardReviewPage,
    str,
    flashcardNotice,
    flashcardInProgress,
    currentFlashcardWord,
    flashcardIndex,
    flashcardQueue,
    handleStopFlashcardSession,
    flashcardInfoLoading,
    flashcardInfoError,
    flashcardLlmLoading,
    flashcardLlmError,
    pronunciationEntries,
    flashcardLlmData,
    flashcardCompleted,
    flashcardHistory,
    setFlashcardIndex,
    activeReviewTestSession,
    activeReviewTestSessionQuizCount,
    continueReviewTestSessionToQuiz,
  } = vm;

  if (!isFlashcardReviewPage) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="font-medium">{str.flashcard.pageTitle}</h2>
      {flashcardNotice ? <p className="text-sm text-blue-700">{flashcardNotice}</p> : null}

      {!flashcardInProgress ? (
        <div className="space-y-3 rounded-md border border-dashed p-4">
          <div className="space-y-1">
            <h3 className="font-medium">{str.flashcard.emptyState.noSessionTitle}</h3>
            <p className="text-sm text-gray-700">{str.flashcard.emptyState.noSessionBody}</p>
            <p className="text-sm text-gray-600">{str.flashcard.noActiveSession}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/words/review"
              className="rounded-md border-2 border-green-500 bg-green-100 px-4 py-2 text-sm font-medium text-green-900"
            >
              {str.flashcard.emptyState.dueReviewButton}
            </Link>
            <Link
              href="/words"
              className="rounded-md border border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700"
            >
              {str.flashcard.emptyState.homeButton}
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-md border p-3">
          {!currentFlashcardWord ? (
            <p className="text-sm text-gray-600">{str.flashcard.noCharacterLoaded}</p>
          ) : (
            <>
              {/* Progress and stop button */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {str.flashcard.progress
                    .replace("{current}", String(flashcardIndex + 1))
                    .replace("{total}", String(flashcardQueue.length))}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-md border-2 border-blue-500 bg-blue-50 px-3 py-2 text-blue-800"
                    onClick={() => setShowPinyin((previous: boolean) => !previous)}
                  >
                    {showPinyin ? str.flashcard.hideButton : str.flashcard.revealButton}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border-2 border-red-500 bg-red-50 px-3 py-2 text-red-800"
                    onClick={handleStopFlashcardSession}
                  >
                    {str.flashcard.stopButton}
                  </button>
                </div>
              </div>

              {/* Loading states */}
              {flashcardInfoLoading && (
                <p className="text-sm text-gray-600">{str.flashcard.loadingDict}</p>
              )}
              {flashcardInfoError && (
                <p className="text-sm text-amber-700">{str.flashcard.noDictData}</p>
              )}
              {flashcardLlmLoading && !flashcardInfoLoading && (
                <p className="text-sm text-gray-600">{str.flashcard.loadingContent}</p>
              )}
              {flashcardLlmError && (
                <p className="text-sm text-amber-700">{flashcardLlmError}</p>
              )}

              {/* Flashcard Card - displays character, meaning, phrase-example pairs */}
              {!flashcardInfoLoading && !flashcardInfoError && pronunciationEntries.length > 0 && !flashcardLlmLoading ? (
                (() => {
                  const cards = pronunciationEntries
                    .map((entry, index) => {
                      if (!entry.pinyin) {
                        return null;
                      }

                      const requestKey = buildFlashcardLlmRequestKey({
                        character: currentFlashcardWord.hanzi,
                        pronunciation: entry.pinyin,
                      });
                      const llmResponse = flashcardLlmData[requestKey];

                      // Only render card if data exists; otherwise show placeholder
                      if (!llmResponse) {
                        return (
                          <div
                            key={`${currentFlashcardWord.id}-pronunciation-${entry.pinyin}-${index}`}
                            className="rounded-md border p-3 text-center text-sm text-gray-600"
                          >
                            {str.flashcard.pronounciation.noSavedContent}
                          </div>
                        );
                      }

                      return (
                        <FlashcardCard
                          key={`${currentFlashcardWord.id}-pronunciation-${entry.pinyin}-${index}`}
                          word={currentFlashcardWord}
                          flashcardContent={llmResponse}
                          str={str}
                          pronunciationLabel={entry.pinyin}
                          showPinyin={showPinyin}
                        />
                      );
                    })
                    .filter(Boolean);

                  return cards.length > 0 ? (
                    <div className="space-y-2">{cards}</div>
                  ) : (
                    <p className="text-sm text-gray-600">
                      {str.flashcard.pronounciation.noSavedContent}
                    </p>
                  );
                })()
              ) : !flashcardInfoLoading && !flashcardInfoError ? (
                <p className="text-sm text-gray-600">{str.flashcard.noPronunciations}</p>
              ) : null}
            </>
          )}
        </div>
      )}

      {flashcardCompleted && flashcardHistory.length > 0 ? (
        <div className="space-y-2 rounded-md border p-3">
          <h3 className="font-medium">{str.flashcard.summary.title}</h3>
          <p className="text-sm text-gray-700">
            {str.flashcard.summary.charactersReviewed} {flashcardHistory.length}
          </p>
        </div>
      ) : null}

      {flashcardInProgress ? (
        <div className="flex justify-center flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border-2 border-green-600 bg-green-50 px-3 py-2 text-sm font-medium text-green-800 disabled:opacity-50"
            disabled={flashcardIndex === 0}
            onClick={() => setFlashcardIndex(0)}
          >
            {str.flashcard.navigation.first}
          </button>
          <button
            type="button"
            className="rounded-md border-2 border-green-600 bg-green-50 px-3 py-2 text-sm font-medium text-green-800 disabled:opacity-50"
            disabled={flashcardIndex === 0}
            onClick={() => setFlashcardIndex((prev) => Math.max(0, prev - 1))}
          >
            {str.flashcard.navigation.previous}
          </button>
          <button
            type="button"
            className="rounded-md border-2 border-green-600 bg-green-50 px-3 py-2 text-sm font-medium text-green-800 disabled:opacity-50"
            disabled={flashcardIndex >= flashcardQueue.length - 1}
            onClick={() => setFlashcardIndex((prev) => Math.min(prev + 1, flashcardQueue.length - 1))}
          >
            {str.flashcard.navigation.next}
          </button>
          <button
            type="button"
            className="rounded-md border-2 border-green-600 bg-green-50 px-3 py-2 text-sm font-medium text-green-800 disabled:opacity-50"
            disabled={flashcardIndex >= flashcardQueue.length - 1}
            onClick={() => setFlashcardIndex(flashcardQueue.length - 1)}
          >
            {str.flashcard.navigation.end}
          </button>
          {activeReviewTestSession ? (
            <button
              type="button"
              className="rounded-md border-2 border-amber-500 bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900 disabled:opacity-50"
              disabled={flashcardIndex < flashcardQueue.length - 1 || activeReviewTestSessionQuizCount === 0}
              onClick={continueReviewTestSessionToQuiz}
            >
              {str.flashcard.reviewTestSession.startQuizButton}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
