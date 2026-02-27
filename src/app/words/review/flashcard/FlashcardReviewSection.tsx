"use client";

import { buildFlashcardLlmRequestKey } from "@/lib/flashcardLlm";
import type { WordsWorkspaceVM } from "../../shared/WordsWorkspaceVM";

export default function FlashcardReviewSection({ vm }: { vm: WordsWorkspaceVM }) {
  const {
    isFlashcardReviewPage,
    str,
    flashcardNotice,
    flashcardInProgress,
    currentFlashcardWord,
    flashcardIndex,
    flashcardQueue,
    handleStopFlashcardSession,
    setFlashcardRevealed,
    flashcardRevealed,
    flashcardInfoLoading,
    flashcardInfoError,
    flashcardLlmLoading,
    flashcardLlmError,
    pronunciationEntries,
    flashcardLlmData,
    gradeLabels,
    submitFlashcardGrade,
    flashcardSubmitting,
    flashcardCompleted,
    flashcardHistory,
    flashcardSummary,
  } = vm;

  if (!isFlashcardReviewPage) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="font-medium">{str.flashcard.pageTitle}</h2>
      {flashcardNotice ? <p className="text-sm text-blue-700">{flashcardNotice}</p> : null}

      {!flashcardInProgress ? (
        <p className="text-sm text-gray-700">
          {str.flashcard.noActiveSession}
        </p>
      ) : (
        <div className="space-y-3 rounded-md border p-3">
          {!currentFlashcardWord ? (
            <p className="text-sm text-gray-600">{str.flashcard.noCharacterLoaded}</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">
                    {str.flashcard.progress
                      .replace("{current}", String(flashcardIndex + 1))
                      .replace("{total}", String(flashcardQueue.length))}
                  </p>
                  <p className="text-5xl font-semibold">{currentFlashcardWord.hanzi}</p>
                </div>
                <button
                  type="button"
                  className="rounded-md border px-3 py-2"
                  onClick={handleStopFlashcardSession}
                >
                  {str.flashcard.stopButton}
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md border px-3 py-2"
                  onClick={() => setFlashcardRevealed((previous: boolean) => !previous)}
                >
                  {flashcardRevealed ? str.flashcard.hideButton : str.flashcard.revealButton}
                </button>
              </div>

              {flashcardRevealed ? (
                <div className="space-y-3">
                  {flashcardInfoLoading ? (
                    <p className="text-sm text-gray-600">{str.flashcard.loadingDict}</p>
                  ) : null}
                  {flashcardInfoError ? (
                    <p className="text-sm text-amber-700">{str.flashcard.noDictData}</p>
                  ) : null}
                  {!flashcardInfoLoading && !flashcardInfoError && flashcardLlmLoading ? (
                    <p className="text-sm text-gray-600">{str.flashcard.loadingContent}</p>
                  ) : null}
                  {flashcardLlmError ? <p className="text-sm text-amber-700">{flashcardLlmError}</p> : null}
                  {pronunciationEntries.length > 0 ? (
                    <div className="max-h-80 overflow-y-auto">
                      <ul className="space-y-3 text-sm">
                        {pronunciationEntries.map((entry, index) => (
                          <li
                            key={`${currentFlashcardWord.id}-pronunciation-${entry.pinyin}-${index}`}
                            className="rounded-md border p-3"
                          >
                            <p className="text-2xl font-semibold">
                              {str.flashcard.pronounciation.prefix}
                              {index + 1}: {entry.pinyin || str.flashcard.pronounciation.notAvailable}
                            </p>
                            {(() => {
                              if (!entry.pinyin) {
                                return (
                                  <p className="mt-2 text-gray-600">{str.flashcard.pronounciation.noMeanings}</p>
                                );
                              }

                              const requestKey = buildFlashcardLlmRequestKey({
                                character: currentFlashcardWord.hanzi,
                                pronunciation: entry.pinyin,
                              });
                              const llmResponse = flashcardLlmData[requestKey];

                              if (!llmResponse) {
                                return (
                                  <p className="mt-2 text-gray-600">
                                    {str.flashcard.pronounciation.noSavedContent}
                                  </p>
                                );
                              }

                              if (llmResponse.meanings.length === 0) {
                                return <p className="mt-2 text-gray-600">{str.flashcard.noPronunciations}</p>;
                              }

                              return (
                                <ul className="mt-2 grid grid-cols-1 gap-2 text-gray-700 sm:grid-cols-2">
                                  {llmResponse.meanings.map((meaning, meaningIndex: number) => (
                                    <li
                                      key={`${currentFlashcardWord.id}-pronunciation-${entry.pinyin}-meaning-${meaningIndex}`}
                                      className="rounded-md border bg-gray-50 p-3"
                                    >
                                      <p className="text-sm font-semibold text-gray-600">
                                        {str.flashcard.meaning.prefix} {meaningIndex + 1}
                                      </p>
                                      <p className="whitespace-pre-wrap text-base font-semibold">
                                        {meaning.definition}
                                      </p>
                                      {meaning.definition_en ? (
                                        <p className="mt-1 text-xs text-gray-500">{meaning.definition_en}</p>
                                      ) : null}

                                      <div className="mt-2 space-y-2">
                                        {meaning.phrases.map((phrase, phraseIndex: number) => (
                                          <div
                                            key={`${currentFlashcardWord.id}-pronunciation-${entry.pinyin}-meaning-${meaningIndex}-phrase-${phraseIndex}`}
                                            className="rounded border border-dashed p-2"
                                          >
                                            <p className="text-sm font-semibold text-gray-900">
                                              {phrase.phrase} ({phrase.pinyin})
                                            </p>
                                            <p className="mt-1 text-sm text-gray-700">
                                              {str.flashcard.meaning.examplePrefix} {phrase.example}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              );
                            })()}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">{str.flashcard.noPronunciations}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-600">{str.flashcard.revealPrompt}</p>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md border px-3 py-2"
                  disabled={!flashcardRevealed || flashcardSubmitting}
                  onClick={() => submitFlashcardGrade("again")}
                >
                  {gradeLabels.again}
                </button>
                <button
                  type="button"
                  className="rounded-md border px-3 py-2"
                  disabled={!flashcardRevealed || flashcardSubmitting}
                  onClick={() => submitFlashcardGrade("hard")}
                >
                  {gradeLabels.hard}
                </button>
                <button
                  type="button"
                  className="rounded-md border px-3 py-2"
                  disabled={!flashcardRevealed || flashcardSubmitting}
                  onClick={() => submitFlashcardGrade("good")}
                >
                  {gradeLabels.good}
                </button>
                <button
                  type="button"
                  className="rounded-md bg-black px-3 py-2 text-white disabled:opacity-50"
                  disabled={!flashcardRevealed || flashcardSubmitting}
                  onClick={() => submitFlashcardGrade("easy")}
                >
                  {gradeLabels.easy}
                </button>
              </div>
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
          <p className="text-sm text-gray-700">
            {gradeLabels.again} {flashcardSummary.again} | {gradeLabels.hard} {flashcardSummary.hard} |{" "}
            {gradeLabels.good} {flashcardSummary.good} | {gradeLabels.easy} {flashcardSummary.easy}
          </p>
        </div>
      ) : null}
    </section>
  );
}
