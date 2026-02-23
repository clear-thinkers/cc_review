"use client";

import { useEffect, useMemo, useState } from "react";
import { db, getDueWords, gradeWord } from "@/lib/db";
import { gradeFillTest, type FillResult, type Placement, type Tier } from "@/lib/fillTest";
import { makeId } from "@/lib/id";
import { calculateNextState } from "@/lib/scheduler";
import type { FillTest, Word } from "@/lib/types";

const SLOT_INDICES: Array<0 | 1 | 2> = [0, 1, 2];
const QUIZ_SELECTION_MODES = ["all", "10", "20", "30", "manual"] as const;

type QuizSelectionMode = (typeof QUIZ_SELECTION_MODES)[number];
type TestableWord = Word & { fillTest: FillTest };
type QuizHistoryItem = {
  wordId: string;
  hanzi: string;
  tier: Tier;
  correctCount: 0 | 1 | 2 | 3;
};

function cloneFillTest(fillTest: FillTest): FillTest {
  return {
    phrases: [...fillTest.phrases] as [string, string, string],
    sentences: fillTest.sentences.map((sentence) => ({ ...sentence })) as [
      FillTest["sentences"][0],
      FillTest["sentences"][1],
      FillTest["sentences"][2],
    ],
  };
}

function hasFillTest(word: Word): word is TestableWord {
  return Boolean(word.fillTest);
}

function formatDateTime(timestamp: number): string {
  if (!timestamp) {
    return "Now";
  }

  return new Date(timestamp).toLocaleString();
}

function getFamiliarity(word: Word): string {
  if (word.repetitions >= 10) {
    return "Strong";
  }

  if (word.repetitions >= 5) {
    return "Familiar";
  }

  if (word.repetitions >= 2) {
    return "Learning";
  }

  return "New";
}

function getSelectionModeLabel(mode: QuizSelectionMode): string {
  if (mode === "all") {
    return "All due";
  }

  if (mode === "manual") {
    return "Manual selection";
  }

  return `${mode} due words`;
}

export default function WordsPage() {
  const [words, setWords] = useState<Word[]>([]);
  const [dueWords, setDueWords] = useState<TestableWord[]>([]);
  const [skippedDueCount, setSkippedDueCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [hanzi, setHanzi] = useState("");
  const [formPhrases, setFormPhrases] = useState<[string, string, string]>(["", "", ""]);
  const [formSentences, setFormSentences] = useState<[string, string, string]>(["", "", ""]);
  const [formNotice, setFormNotice] = useState<string | null>(null);

  const [quizSelectionMode, setQuizSelectionMode] = useState<QuizSelectionMode>("all");
  const [manualSelectedWordIds, setManualSelectedWordIds] = useState<string[]>([]);
  const [quizInProgress, setQuizInProgress] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [quizQueue, setQuizQueue] = useState<TestableWord[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizSelections, setQuizSelections] = useState<[0 | 1 | 2 | null, 0 | 1 | 2 | null, 0 | 1 | 2 | null]>([
    null,
    null,
    null,
  ]);
  const [quizResult, setQuizResult] = useState<FillResult | null>(null);
  const [quizHistory, setQuizHistory] = useState<QuizHistoryItem[]>([]);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizNotice, setQuizNotice] = useState<string | null>(null);

  function updateFormPhrase(index: 0 | 1 | 2, value: string) {
    setFormPhrases((previous) => {
      const next = [...previous] as [string, string, string];
      next[index] = value;
      return next;
    });
  }

  function updateFormSentence(index: 0 | 1 | 2, value: string) {
    setFormSentences((previous) => {
      const next = [...previous] as [string, string, string];
      next[index] = value;
      return next;
    });
  }

  function buildFillTestFromForm(): FillTest | null {
    const normalizedHanzi = hanzi.trim();
    const normalizedPhrases = formPhrases.map((phrase) => phrase.trim()) as [string, string, string];
    const normalizedSentences = formSentences.map((sentence) => sentence.trim()) as [
      string,
      string,
      string,
    ];

    if (!normalizedHanzi) {
      setFormNotice("Character is required.");
      return null;
    }

    if (normalizedPhrases.some((phrase) => !phrase)) {
      setFormNotice("All 3 phrases are required.");
      return null;
    }

    if (normalizedSentences.some((sentence) => !sentence)) {
      setFormNotice("All 3 sentences are required.");
      return null;
    }

    const missingBlankIndex = normalizedSentences.findIndex((sentence) => !sentence.includes("___"));
    if (missingBlankIndex >= 0) {
      setFormNotice(`Sentence ${missingBlankIndex + 1} must include ___ as the blank.`);
      return null;
    }

    return {
      phrases: normalizedPhrases,
      sentences: [
        { text: normalizedSentences[0], answerIndex: 0 },
        { text: normalizedSentences[1], answerIndex: 1 },
        { text: normalizedSentences[2], answerIndex: 2 },
      ],
    };
  }

  function clearForm() {
    setHanzi("");
    setFormPhrases(["", "", ""]);
    setFormSentences(["", "", ""]);
  }

  function resetQuizWordState() {
    setQuizSelections([null, null, null]);
    setQuizResult(null);
  }

  function stopQuizSession() {
    setQuizInProgress(false);
    setQuizQueue([]);
    setQuizIndex(0);
    resetQuizWordState();
  }

  async function handleStopQuizSession() {
    stopQuizSession();
    setQuizNotice("Quiz stopped.");
    await refreshAll();
  }

  async function refreshWords() {
    const all = await db.words.orderBy("createdAt").reverse().toArray();
    setWords(all);
  }

  async function refreshDueWords() {
    const due = await getDueWords();
    const dueWithFillTest = due
      .filter(hasFillTest)
      .sort((left, right) => {
        const leftDue = left.nextReviewAt || 0;
        const rightDue = right.nextReviewAt || 0;
        if (leftDue === rightDue) {
          return left.createdAt - right.createdAt;
        }

        return leftDue - rightDue;
      });

    setDueWords(dueWithFillTest);
    setSkippedDueCount(due.length - dueWithFillTest.length);
    setManualSelectedWordIds((previous) =>
      previous.filter((id) => dueWithFillTest.some((word) => word.id === id))
    );
    return dueWithFillTest;
  }

  async function refreshAll() {
    await refreshWords();
    await refreshDueWords();
  }

  useEffect(() => {
    (async () => {
      await refreshAll();
      setLoading(false);
    })();
  }, []);

  async function addWord(e: React.FormEvent) {
    e.preventDefault();
    const normalizedHanzi = hanzi.trim();
    const fillTest = buildFillTestFromForm();
    if (!normalizedHanzi || !fillTest) {
      return;
    }

    const now = Date.now();
    const newWord: Word = {
      id: makeId(),
      hanzi: normalizedHanzi,
      fillTest: cloneFillTest(fillTest),
      createdAt: now,
      repetitions: 0,
      intervalDays: 0,
      ease: 21,
      nextReviewAt: 0,
    };

    await db.words.add(newWord);
    clearForm();
    setFormNotice(`Added "${normalizedHanzi}" with fill test.`);
    await refreshAll();
  }

  async function removeWord(id: string) {
    await db.words.delete(id);
    await refreshAll();
  }

  const manualSelectionSet = useMemo(() => new Set(manualSelectedWordIds), [manualSelectedWordIds]);

  const plannedQuizWords = useMemo(() => {
    if (quizSelectionMode === "manual") {
      return dueWords.filter((word) => manualSelectionSet.has(word.id));
    }

    if (quizSelectionMode === "all") {
      return dueWords;
    }

    const limit = Number(quizSelectionMode);
    return dueWords.slice(0, Math.max(0, limit));
  }, [dueWords, manualSelectionSet, quizSelectionMode]);

  const currentQuizWord = quizInProgress ? quizQueue[quizIndex] : undefined;
  const unansweredCount = quizSelections.filter((selection) => selection === null).length;
  const quizSummary = useMemo(() => {
    return quizHistory.reduce(
      (accumulator, item) => {
        accumulator[item.tier] += 1;
        accumulator.correct += item.correctCount;
        return accumulator;
      },
      { again: 0, hard: 0, good: 0, easy: 0, correct: 0 }
    );
  }, [quizHistory]);

  function toggleManualSelection(wordId: string, checked: boolean) {
    setManualSelectedWordIds((previous) => {
      if (checked) {
        return previous.includes(wordId) ? previous : [...previous, wordId];
      }

      return previous.filter((id) => id !== wordId);
    });
  }

  function updateQuizSelection(index: 0 | 1 | 2, value: 0 | 1 | 2 | null) {
    setQuizSelections((previous) => {
      const next = [...previous] as [0 | 1 | 2 | null, 0 | 1 | 2 | null, 0 | 1 | 2 | null];
      next[index] = value;
      return next;
    });
  }

  function startQuizSession() {
    if (plannedQuizWords.length === 0) {
      setQuizNotice("No due words match this selection.");
      return;
    }

    setQuizQueue(plannedQuizWords.map((word) => ({ ...word, fillTest: cloneFillTest(word.fillTest) })));
    setQuizIndex(0);
    resetQuizWordState();
    setQuizHistory([]);
    setQuizCompleted(false);
    setQuizInProgress(true);
    setQuizNotice(null);
  }

  async function submitCurrentQuizWord() {
    if (!currentQuizWord || quizResult || quizSubmitting) {
      return;
    }

    const placements: Placement[] = SLOT_INDICES.flatMap((sentenceIndex) => {
      const selectedPhrase = quizSelections[sentenceIndex];
      if (selectedPhrase === null) {
        return [];
      }

      return [
        {
          sentenceIndex,
          chosenPhraseIndex: selectedPhrase,
        },
      ];
    });

    const result = gradeFillTest(currentQuizWord.fillTest, placements);
    setQuizResult(result);
    setQuizSubmitting(true);
    setQuizNotice(null);

    try {
      await gradeWord(currentQuizWord.id, { grade: result.tier });
      setQuizHistory((previous) => [
        ...previous,
        {
          wordId: currentQuizWord.id,
          hanzi: currentQuizWord.hanzi,
          tier: result.tier,
          correctCount: result.correctCount,
        },
      ]);
    } catch (error) {
      console.error("Failed to grade fill test word", error);
      setQuizNotice(`Saved answer view, but failed to update schedule for "${currentQuizWord.hanzi}".`);
    } finally {
      setQuizSubmitting(false);
    }
  }

  async function moveQuizForward() {
    if (!quizResult) {
      return;
    }

    const isLastWord = quizIndex >= quizQueue.length - 1;
    if (isLastWord) {
      stopQuizSession();
      setQuizCompleted(true);
      setQuizNotice("Quiz complete.");
      await refreshAll();
      return;
    }

    setQuizIndex((previous) => previous + 1);
    resetQuizWordState();
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Words</h1>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">Add Word + Fill Test</h2>
        <p className="text-sm text-gray-700">
          Add one character with exactly 3 phrases and 3 matching sentences. Sentence 1 maps to
          Phrase 1, Sentence 2 to Phrase 2, Sentence 3 to Phrase 3.
        </p>
        {formNotice ? <p className="text-sm text-blue-700">{formNotice}</p> : null}

        <form onSubmit={addWord} className="space-y-3 rounded-md border p-3">
          <input
            className="w-full rounded-md border px-3 py-2"
            placeholder="Character (hanzi)"
            value={hanzi}
            onChange={(e) => setHanzi(e.target.value)}
          />

          {SLOT_INDICES.map((index) => (
            <div key={`new-word-slot-${index}`} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                className="rounded-md border px-3 py-2"
                placeholder={`Phrase ${index + 1}`}
                value={formPhrases[index]}
                onChange={(e) => updateFormPhrase(index, e.target.value)}
              />
              <input
                className="sm:col-span-2 rounded-md border px-3 py-2"
                placeholder={`Sentence ${index + 1} (must include ___)`}
                value={formSentences[index]}
                onChange={(e) => updateFormSentence(index, e.target.value)}
              />
            </div>
          ))}

          <button type="submit" className="rounded-md bg-black px-4 py-2 text-white">
            Add word
          </button>
        </form>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">Fill Test Quiz</h2>
        <p className="text-sm text-gray-700">Due now: {dueWords.length}</p>
        {skippedDueCount > 0 ? (
          <p className="text-sm text-amber-700">
            Skipping {skippedDueCount} due word{skippedDueCount > 1 ? "s" : ""} with no fill test.
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
                  <span>{getSelectionModeLabel(mode)}</span>
                </label>
              ))}
            </div>

            <p className="text-sm text-gray-600">
              Planned quiz size: <strong>{plannedQuizWords.length}</strong>
            </p>

            {quizSelectionMode === "manual" ? (
              <div className="space-y-2 overflow-x-auto rounded-md border p-2">
                <p className="text-sm font-medium">Manual selection from due words</p>
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-2 py-1 text-left">Test</th>
                      <th className="px-2 py-1 text-left">Character</th>
                      <th className="px-2 py-1 text-left">Date added</th>
                      <th className="px-2 py-1 text-left">Date due</th>
                      <th className="px-2 py-1 text-left">Next review due date</th>
                      <th className="px-2 py-1 text-left">Familiarity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dueWords.map((word) => {
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
                Start fill-test quiz
              </button>
              {quizCompleted && quizHistory.length > 0 ? (
                <button
                  type="button"
                  className="rounded-md border px-4 py-2"
                  onClick={() => setQuizCompleted(false)}
                >
                  Hide last summary
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-3 rounded-md border p-3">
            {!currentQuizWord ? (
              <p className="text-sm text-gray-600">No quiz word loaded.</p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">
                      Word {quizIndex + 1} of {quizQueue.length}
                    </p>
                    <p className="text-3xl font-semibold">{currentQuizWord.hanzi}</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2"
                    onClick={handleStopQuizSession}
                  >
                    Stop quiz
                  </button>
                </div>

                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-sm font-medium">Phrases</p>
                  <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-3">
                    {currentQuizWord.fillTest.phrases.map((phrase, index) => (
                      <li key={`${currentQuizWord.id}-phrase-${index}`} className="rounded border px-2 py-1">
                        Phrase {index + 1}: {phrase}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-3">
                  {SLOT_INDICES.map((sentenceIndex) => {
                    const sentence = currentQuizWord.fillTest.sentences[sentenceIndex];
                    const [beforeBlank, ...afterParts] = sentence.text.split("___");
                    const afterBlank = afterParts.join("___");

                    return (
                      <label
                        key={`${currentQuizWord.id}-sentence-${sentenceIndex}`}
                        className="block rounded-md border p-3"
                      >
                        <p className="mb-2 text-sm font-medium">Sentence {sentenceIndex + 1}</p>
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span>{beforeBlank}</span>
                          <select
                            className="rounded-md border px-2 py-1"
                            disabled={Boolean(quizResult)}
                            value={quizSelections[sentenceIndex] === null ? "" : quizSelections[sentenceIndex]}
                            onChange={(event) =>
                              updateQuizSelection(
                                sentenceIndex,
                                event.target.value === ""
                                  ? null
                                  : (Number(event.target.value) as 0 | 1 | 2)
                              )
                            }
                          >
                            <option value="">(empty)</option>
                            {currentQuizWord.fillTest.phrases.map((phrase, phraseIndex) => (
                              <option
                                key={`${currentQuizWord.id}-option-${sentenceIndex}-${phraseIndex}`}
                                value={phraseIndex}
                              >
                                {phraseIndex + 1}. {phrase}
                              </option>
                            ))}
                          </select>
                          <span>{afterBlank}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {!quizResult ? (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
                      disabled={quizSubmitting}
                      onClick={submitCurrentQuizWord}
                    >
                      Submit answer
                    </button>
                    <p className="text-sm text-gray-600">Unanswered blanks: {unansweredCount}</p>
                  </div>
                ) : (
                  <div className="space-y-2 rounded-md border p-3">
                    <p className="text-sm font-medium">
                      Score: {quizResult.correctCount}/3, scheduler tier:{" "}
                      <span className="capitalize">{quizResult.tier}</span>
                    </p>
                    <ul className="space-y-1 text-sm">
                      {quizResult.sentenceResults.map((resultItem) => {
                        const expectedPhrase =
                          currentQuizWord.fillTest.phrases[resultItem.expectedPhraseIndex];
                        const chosenPhrase =
                          resultItem.chosenPhraseIndex === null
                            ? "(empty)"
                            : currentQuizWord.fillTest.phrases[resultItem.chosenPhraseIndex];

                        return (
                          <li key={`${currentQuizWord.id}-result-${resultItem.sentenceIndex}`}>
                            Sentence {resultItem.sentenceIndex + 1}:{" "}
                            {resultItem.isCorrect ? "correct" : "incorrect"} (chosen: {chosenPhrase}, expected:{" "}
                            {expectedPhrase})
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
                      {quizIndex >= quizQueue.length - 1 ? "Finish quiz" : "Next word"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {quizCompleted && quizHistory.length > 0 ? (
          <div className="space-y-2 rounded-md border p-3">
            <h3 className="font-medium">Last Quiz Summary</h3>
            <p className="text-sm text-gray-700">
              Words tested: {quizHistory.length}, correct blanks: {quizSummary.correct}/
              {quizHistory.length * 3}
            </p>
            <p className="text-sm text-gray-700">
              again {quizSummary.again} | hard {quizSummary.hard} | good {quizSummary.good} | easy{" "}
              {quizSummary.easy}
            </p>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        {loading ? (
          <p>Loading...</p>
        ) : words.length === 0 ? (
          <p>No words yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left">Character</th>
                  <th className="px-3 py-2 text-left">Date added</th>
                  <th className="px-3 py-2 text-left">Date due</th>
                  <th className="px-3 py-2 text-left">Familiarity</th>
                  <th className="px-3 py-2 text-left">Phrases</th>
                  <th className="px-3 py-2 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {words.map((word) => (
                  <tr key={word.id} className="border-b align-top">
                    <td className="px-3 py-2">{word.hanzi}</td>
                    <td className="px-3 py-2">{formatDateTime(word.createdAt)}</td>
                    <td className="px-3 py-2">{formatDateTime(word.nextReviewAt)}</td>
                    <td className="px-3 py-2">
                      {getFamiliarity(word)} (rep {word.repetitions})
                    </td>
                    <td className="px-3 py-2">{word.fillTest ? word.fillTest.phrases.join(" / ") : "(none)"}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="rounded-md border px-2 py-1 text-sm"
                        onClick={() => removeWord(word.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
