"use client";

import type { WordsWorkspaceVM } from "../../shared/WordsWorkspaceVM";

export default function FillTestReviewSection({ vm }: { vm: WordsWorkspaceVM }) {
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
    gradeLabels,
    calculateNextState,
    manualSelectionSet,
    toggleManualSelection,
    formatDateTime,
    getFamiliarity,
  } = vm;

  if (!isFillTestReviewPage) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
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
        <div className="space-y-3 rounded-md border p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {QUIZ_SELECTION_MODES.map((mode) => (
              <label key={mode} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="quiz-selection-mode"
                  checked={quizSelectionMode === mode}
                  onChange={() => setQuizSelectionMode(mode)}
                />
                <span>{getSelectionModeLabel(mode, str)}</span>
              </label>
            ))}
          </div>

          {quizSelectionMode === "manual" ? (
            <p className="text-sm text-gray-600">
              {str.fillTest.selectedLabel} <strong>{plannedQuizWords.length}</strong>
            </p>
          ) : null}

          {quizSelectionMode === "manual" ? (
            <div className="space-y-2 overflow-x-auto rounded-md border p-2">
              <p className="text-sm font-medium">{str.fillTest.allCharactersSelection}</p>
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-2 py-1 text-left">{str.fillTest.manualTableHeaders.test}</th>
                    <th className="px-2 py-1 text-left">{str.fillTest.manualTableHeaders.hanzi}</th>
                    <th className="px-2 py-1 text-left">{str.fillTest.manualTableHeaders.dateAdded}</th>
                    <th className="px-2 py-1 text-left">{str.fillTest.manualTableHeaders.dateDue}</th>
                    <th className="px-2 py-1 text-left">{str.fillTest.manualTableHeaders.nextReviewDate}</th>
                    <th className="px-2 py-1 text-left">{str.fillTest.manualTableHeaders.familiarity}</th>
                  </tr>
                </thead>
                <tbody>
                  {fillTestDueWords.map((word) => {
                    const projected = calculateNextState(word, "good", Date.now()).nextReviewAt;
                    return (
                      <tr key={word.id} className="border-b align-top">
                        <td className="px-2 py-1">
                          <input
                            type="checkbox"
                            checked={manualSelectionSet.has(word.id)}
                            onChange={(event) =>
                              toggleManualSelection(word.id, event.currentTarget.checked)
                            }
                          />
                        </td>
                        <td className="px-2 py-1">{word.hanzi}</td>
                        <td className="px-2 py-1">{formatDateTime(word.createdAt)}</td>
                        <td className="px-2 py-1">{formatDateTime(word.nextReviewAt)}</td>
                        <td className="px-2 py-1">{formatDateTime(projected)}</td>
                        <td className="px-2 py-1">
                          {getFamiliarity(word)} (rep {word.repetitions})
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
              disabled={plannedQuizWords.length === 0}
              onClick={startQuizSession}
            >
              {str.fillTest.startButton}
            </button>
            {quizCompleted && quizHistory.length > 0 ? (
              <button
                type="button"
                className="rounded-md border px-4 py-2"
                onClick={() => setQuizCompleted(false)}
              >
                {str.fillTest.hideLastSummary}
              </button>
            ) : null}
          </div>
        </div>
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
                  className="rounded-md border px-3 py-2"
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
                        <li key={`${currentQuizWord.id}-result-${resultItem.sentenceIndex}`}>
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
        <div className="space-y-2 rounded-md border p-3">
          <h3 className="font-medium">{str.fillTest.summary.title}</h3>
          <p className="text-sm text-gray-700">
            {str.fillTest.summary.charactersReviewed} {quizHistory.length}
            {` ${str.fillTest.summary.correctBlanks} `} {quizSummary.correct}/{quizHistory.length * 3}
          </p>
          <p className="text-sm text-gray-700">
            {gradeLabels.again} {quizSummary.again} | {gradeLabels.hard} {quizSummary.hard} |{" "}
            {gradeLabels.good} {quizSummary.good} | {gradeLabels.easy} {quizSummary.easy}
          </p>
        </div>
      ) : null}
    </section>
  );
}
