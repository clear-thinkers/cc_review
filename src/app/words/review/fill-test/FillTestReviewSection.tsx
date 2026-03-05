"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { WordsWorkspaceVM } from "../../shared/WordsWorkspaceVM";
import { CoinAnimation } from "./coins.animation";
import { playCelebrationSound } from "../../shared/coins.sound";

export default function FillTestReviewSection({ vm }: { vm: WordsWorkspaceVM }) {
  const router = useRouter();
  const {
    isFillTestReviewPage,
    str,
    fillTestDueWords,
    skippedDueCount,
    quizNotice,
    quizInProgress,
    QUIZ_SELECTION_MODES,
    quizSelectionMode,
    setQuizSelectionMode,
    getSelectionModeLabel,
    plannedQuizWords,
    quizCompleted,
    quizHistory,
    setQuizCompleted,
    startQuizSession,
    currentQuizWord,
    quizIndex,
    quizQueue,
    handleStopQuizSession,
    SLOT_INDICES,
    quizSelections,
    quizResult,
    quizActivePhraseIndex,
    setQuizActivePhraseIndex,
    quizDraggingPhraseIndex,
    handleQuizPhraseDragStart,
    handleQuizPhraseDragEnd,
    quizDropSentenceIndex,
    handleQuizSentenceTap,
    handleQuizSentenceDragOver,
    handleQuizSentenceDrop,
    setQuizDropSentenceIndex,
    updateQuizSelection,
    setQuizDraggingPhraseIndex,
    submitCurrentQuizWord,
    quizSubmitting,
    unansweredCount,
    moveQuizForward,
    quizSummary,
    quizSessionCoins,
    gradeLabels,
    calculateNextState,
    manualSelectionSet,
    toggleManualSelection,
    formatDateTime,
    getFamiliarity,
  } = vm;

  // Celebration animation state
  const [animationKey, setAnimationKey] = useState<number>(0);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  // Listen for easy grade events to trigger celebration
  useEffect(() => {
    const handleEasyGrade = () => {
      // Play celebration sound (not muted by default)
      playCelebrationSound(false);

      // Trigger animation from submit button
      if (submitButtonRef.current) {
        const rect = submitButtonRef.current.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        // Trigger animation by updating key
        setAnimationKey((prev) => prev + 1);
      }
    };

    // Check for easy grade event every 100ms
    const pollInterval = setInterval(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lastEvent = (window as any).__quizEasyGradeEvent;
      if (lastEvent && lastEvent > ((window as any).__lastProcessedEasyGradeEvent ?? 0)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__lastProcessedEasyGradeEvent = lastEvent;
        handleEasyGrade();
      }
    }, 100);

    return () => clearInterval(pollInterval);
  }, []);

  if (!isFillTestReviewPage) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      {/* Coin celebration animations */}
      {submitButtonRef.current && (
        <CoinAnimation
          key={`coin-${animationKey}`}
          x={submitButtonRef.current.getBoundingClientRect().left + submitButtonRef.current.getBoundingClientRect().width / 2}
          y={submitButtonRef.current.getBoundingClientRect().top + submitButtonRef.current.getBoundingClientRect().height / 2}
          duration={300}
        />
      )}

      <h2 className="font-medium">{str.fillTest.pageTitle}</h2>
      <p className="text-sm text-gray-700">
        {str.fillTest.dueNowLabel} {fillTestDueWords.length}
      </p>
      {skippedDueCount > 0 ? (
        <p className="text-sm text-amber-700">
          {skippedDueCount} {str.fillTest.noFillTests}
        </p>
      ) : null}
      {quizNotice ? <p className="text-sm text-blue-700">{quizNotice}</p> : null}

      {!quizInProgress ? (
        null
      ) : (
        <div className="space-y-3 rounded-md border p-3">
          {!currentQuizWord ? (
            <p className="text-sm text-gray-600">{str.fillTest.gameplay.noQuizCharacterLoaded}</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">
                    {str.fillTest.gameplay.characterProgress
                      .replace("{current}", String(quizIndex + 1))
                      .replace("{total}", String(quizQueue.length))}
                  </p>
                  <p className="text-3xl font-semibold">{currentQuizWord.hanzi}</p>
                </div>
                <button
                  type="button"
                  className="rounded-md border-2 border-red-500 bg-red-50 px-3 py-2 text-red-800"
                  onClick={handleStopQuizSession}
                >
                  {str.fillTest.gameplay.stopButton}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-[16rem_minmax(0,1fr)]">
                <aside className="rounded-md border bg-gray-50 p-3">
                  <p className="text-sm font-medium">{str.fillTest.gameplay.phraseBankHeader}</p>
                  <p className="mt-1 text-xs text-gray-600">{str.fillTest.gameplay.dragInstruction}</p>
                  <ul className="mt-3 space-y-2">
                    {currentQuizWord.fillTest.phrases.map((phrase: string, phraseIndex: number) => {
                      const typedPhraseIndex = phraseIndex as 0 | 1 | 2;
                      if (quizSelections.includes(typedPhraseIndex)) {
                        return null;
                      }

                      const selectedForTap = quizActivePhraseIndex === typedPhraseIndex;
                      const draggingNow = quizDraggingPhraseIndex === typedPhraseIndex;

                      return (
                        <li key={`${currentQuizWord.id}-phrase-${phraseIndex}`}>
                          <button
                            type="button"
                            draggable={!quizResult}
                            disabled={Boolean(quizResult)}
                            onClick={() =>
                              setQuizActivePhraseIndex((previous) =>
                                previous === typedPhraseIndex ? null : typedPhraseIndex
                              )
                            }
                            onDragStart={(event) => handleQuizPhraseDragStart(event, typedPhraseIndex)}
                            onDragEnd={handleQuizPhraseDragEnd}
                            className={
                              selectedForTap
                                ? "w-full rounded-md border-2 border-sky-500 bg-sky-50 px-3 py-2 text-center text-sm text-sky-900 disabled:opacity-60"
                                : draggingNow
                                  ? "w-full rounded-md border-2 border-sky-500 bg-sky-50 px-3 py-2 text-center text-sm text-sky-900 disabled:opacity-60"
                                  : "w-full rounded-md border bg-white px-3 py-2 text-center text-sm hover:border-gray-400 disabled:opacity-60"
                            }
                          >
                            <p className="text-base font-bold text-gray-900">{phrase}</p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </aside>

                <div className="space-y-3">
                  {SLOT_INDICES.map((sentenceIndex: 0 | 1 | 2) => {
                    const sentence = currentQuizWord.fillTest.sentences[sentenceIndex];
                    const [beforeBlank, ...afterParts] = sentence.text.split("___");
                    const afterBlank = afterParts.join("___");
                    const selectedPhraseIndex = quizSelections[sentenceIndex];
                    const selectedPhrase =
                      selectedPhraseIndex === null
                        ? null
                        : currentQuizWord.fillTest.phrases[selectedPhraseIndex];
                    const sentenceResult =
                      quizResult?.sentenceResults.find(
                        (resultItem) => resultItem.sentenceIndex === sentenceIndex
                      ) ?? null;
                    const isDropTarget = quizDropSentenceIndex === sentenceIndex;
                    const filledButtonClass =
                      "inline-flex items-center justify-center p-0 text-center align-middle text-base font-bold text-gray-900";
                    const selectedPhrasePillClass = !quizResult
                      ? "inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-blue-800"
                      : sentenceResult?.isCorrect
                        ? "inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-green-800"
                        : "inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-red-800";

                    return (
                      <div
                        key={`${currentQuizWord.id}-sentence-${sentenceIndex}`}
                        className="rounded-md border p-3"
                      >
                        <p className="mb-2 text-sm font-bold">
                          {str.fillTest.gameplay.sentenceLabel
                            .replace("{current}", String(sentenceIndex + 1))
                            .replace("{total}", String(3))}
                        </p>
                        <div className="flex flex-wrap items-center gap-1 text-base font-bold text-gray-900">
                          <span>{beforeBlank}</span>
                          <button
                            type="button"
                            className={
                              isDropTarget
                                ? "flex min-h-9 min-w-[10rem] items-center justify-center rounded-md border-2 border-sky-500 bg-sky-50 px-3 py-1 text-center text-base font-bold text-gray-900"
                                : selectedPhraseIndex !== null
                                  ? filledButtonClass
                                  : "flex min-h-9 min-w-[10rem] items-center justify-center rounded-md border border-dashed border-gray-400 bg-white px-3 py-1 text-center text-base font-bold text-gray-900"
                            }
                            disabled={Boolean(quizResult)}
                            onClick={() => handleQuizSentenceTap(sentenceIndex)}
                            onDragOver={(event) => handleQuizSentenceDragOver(event, sentenceIndex)}
                            onDrop={(event) => handleQuizSentenceDrop(event, sentenceIndex)}
                            onDragLeave={() =>
                              setQuizDropSentenceIndex((previous) =>
                                previous === sentenceIndex ? null : previous
                              )
                            }
                          >
                            {selectedPhraseIndex === null ? (
                              <span className="font-medium text-gray-500">
                                {str.fillTest.gameplay.dropPlaceholder}
                              </span>
                            ) : (
                              <span className={selectedPhrasePillClass}>{selectedPhrase}</span>
                            )}
                          </button>
                          <span>{afterBlank}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                            disabled={Boolean(quizResult) || selectedPhraseIndex === null}
                            onClick={() => {
                              updateQuizSelection(sentenceIndex, null);
                              setQuizDraggingPhraseIndex(null);
                              setQuizActivePhraseIndex(null);
                            }}
                          >
                            {str.fillTest.gameplay.clearButton}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {!quizResult ? (
                <div className="flex items-center gap-3">
                  <button
                    ref={submitButtonRef}
                    type="button"
                    className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
                    disabled={quizSubmitting}
                    onClick={submitCurrentQuizWord}
                  >
                    {str.fillTest.gameplay.submitButton}
                  </button>
                  <p className="text-sm text-gray-600">
                    {str.fillTest.gameplay.unansweredBlanks} {unansweredCount}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-sm font-bold">
                    {str.fillTest.results.scoreLabel.replace("{correct}", String(quizResult.correctCount))}
                    <span className="capitalize">{quizResult.tier}</span>
                  </p>
                  <ul className="space-y-1 text-sm">
                    {quizResult.sentenceResults.map((resultItem) => {
                      const expectedPhrase = currentQuizWord.fillTest.phrases[resultItem.expectedPhraseIndex];
                      const chosenPhrase =
                        resultItem.chosenPhraseIndex === null
                          ? str.fillTest.results.emptyChoice
                          : currentQuizWord.fillTest.phrases[resultItem.chosenPhraseIndex];

                      return (
                        <li
                          key={`${currentQuizWord.id}-result-${resultItem.sentenceIndex}`}
                          className={resultItem.isCorrect ? "text-green-700" : "text-red-700"}
                        >
                          {str.fillTest.results.sentenceResult
                            .replace("{index}", String(resultItem.sentenceIndex + 1))
                            .replace(
                              "{result}",
                              resultItem.isCorrect
                                ? str.fillTest.results.correct
                                : str.fillTest.results.incorrect
                            )
                            .replace("{chosen}", chosenPhrase)
                            .replace("{expected}", expectedPhrase)}
                        </li>
                      );
                    })}
                  </ul>
                  <button
                    type="button"
                    className="rounded-md border px-4 py-2"
                    disabled={quizSubmitting}
                    onClick={moveQuizForward}
                  >
                    {quizIndex >= quizQueue.length - 1
                      ? str.fillTest.results.finishButton
                      : str.fillTest.results.nextCharacterButton}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {quizCompleted && quizHistory.length > 0 ? (
        <div className="space-y-3">
          <div className="space-y-3 rounded-md border bg-amber-50 p-4">
            <h3 className="text-lg font-semibold">{str.fillTest.summary.title}</h3>
            <div className="space-y-2">
              <p className="text-base font-semibold text-gray-900">
                {str.fillTest.summary.charactersReviewed} <span className="text-xl text-amber-700">{quizHistory.length}</span>
              </p>
              <p className="text-base font-semibold text-gray-900">
                {str.fillTest.summary.correctBlanks} <span className="text-xl text-amber-700">{quizSummary.correct}/{quizHistory.length * 3}</span>
              </p>
            </div>
            
            <div className="border-t border-amber-200 pt-3 space-y-2">
              {(() => {
                const fullyCorrect = quizHistory.filter((item) => item.correctCount === 3);
                const partiallyCorrect = quizHistory.filter((item) => item.correctCount === 1 || item.correctCount === 2);
                const fullyWrong = quizHistory.filter((item) => item.correctCount === 0);

                return (
                  <>
                    {fullyCorrect.length > 0 && (
                      <p className="text-sm text-green-700">
                        <span className="font-semibold">全部正确：</span>{fullyCorrect.length}  （{fullyCorrect.map((item) => item.hanzi).join("")}）
                      </p>
                    )}
                    {partiallyCorrect.length > 0 && (
                      <p className="text-sm text-amber-700">
                        <span className="font-semibold">部分正确：</span>{partiallyCorrect.length}  （{partiallyCorrect.map((item) => item.hanzi).join("")}）
                      </p>
                    )}
                    {fullyWrong.length > 0 && (
                      <p className="text-sm text-red-700">
                        <span className="font-semibold">全部错误：</span>{fullyWrong.length}  （{fullyWrong.map((item) => item.hanzi).join("")}）
                      </p>
                    )}
                  </>
                );
              })()}
            </div>

            <p className="text-sm font-semibold text-amber-700 border-t border-amber-200 pt-2">
              🪙 {str.fillTest.summary.coinsEarned} {quizSessionCoins}
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border-4 border-amber-500 bg-amber-50 px-8 py-2 text-lg font-semibold text-amber-900 transition-colors hover:bg-amber-100"
            onClick={() => router.push("/words/review")}
          >
            {str.results.goToReviewPage}
          </button>
        </div>
      ) : null}
    </section>
  );
}
