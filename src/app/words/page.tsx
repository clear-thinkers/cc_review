"use client";

import { useEffect, useState } from "react";
import { db, getDueWords, gradeWord } from "@/lib/db";
import { makeId } from "@/lib/id";
import type { Grade } from "@/lib/scheduler";
import type { Word } from "@/lib/types";

const REVIEW_GRADES: Grade[] = ["again", "hard", "good", "easy"];

export default function WordsPage() {
  const [words, setWords] = useState<Word[]>([]);
  const [dueWords, setDueWords] = useState<Word[]>([]);
  const [hanzi, setHanzi] = useState("");
  const [pinyin, setPinyin] = useState("");
  const [meaning, setMeaning] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAnswer, setShowAnswer] = useState(false);
  const [grading, setGrading] = useState(false);

  async function refreshWords() {
    const all = await db.words.orderBy("createdAt").reverse().toArray();
    setWords(all);
  }

  async function refreshDueWords() {
    const due = await getDueWords();
    setDueWords(due);
    return due;
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
    const trimmed = hanzi.trim();
    if (!trimmed) return;

    const now = Date.now();

    const newWord: Word = {
      id: makeId(),
      hanzi: trimmed,
      pinyin: pinyin.trim() || undefined,
      meaning: meaning.trim() || undefined,
      createdAt: now,
      repetitions: 0,
      intervalDays: 0,
      // word.ease is repurposed to store stabilityDays (S) for the forgetting curve model
      ease: 21,
      nextReviewAt: 0,
    };

    await db.words.add(newWord);

    setHanzi("");
    setPinyin("");
    setMeaning("");
    await refreshAll();
  }

  async function removeWord(id: string) {
    await db.words.delete(id);
    await refreshAll();
  }

  async function handleGrade(grade: Grade) {
    const currentWord = dueWords[0];
    if (!currentWord || grading) {
      return;
    }

    setGrading(true);

    try {
      await gradeWord(currentWord.id, { grade });
      await refreshAll();
      setShowAnswer(false);
    } catch (error) {
      console.error("Failed to grade word", error);
    } finally {
      setGrading(false);
    }
  }

  const currentWord = dueWords[0];

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Words</h1>

      <form onSubmit={addWord} className="space-y-3 rounded-lg border p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            className="rounded-md border px-3 py-2"
            placeholder="??"
            value={hanzi}
            onChange={(e) => setHanzi(e.target.value)}
          />
          <input
            className="rounded-md border px-3 py-2"
            placeholder="pinyin"
            value={pinyin}
            onChange={(e) => setPinyin(e.target.value)}
          />
          <input
            className="rounded-md border px-3 py-2"
            placeholder="meaning"
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
          />
        </div>

        <button type="submit" className="rounded-md bg-black px-4 py-2 text-white">
          Add
        </button>
      </form>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">Review</h2>
        <p className="text-sm text-gray-700">Due now: {dueWords.length}</p>

        {currentWord ? (
          <div className="space-y-4 rounded-lg border p-4">
            <div className="text-center text-4xl font-semibold">{currentWord.hanzi}</div>

            {showAnswer ? (
              <>
                <div className="text-center text-gray-700">{currentWord.pinyin || "(no pinyin)"}</div>
                <div className="text-center text-gray-700">{currentWord.meaning || "(no meaning)"}</div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {REVIEW_GRADES.map((grade) => (
                    <button
                      key={grade}
                      type="button"
                      className="rounded-md border px-3 py-2 capitalize disabled:opacity-50"
                      disabled={grading}
                      onClick={() => handleGrade(grade)}
                    >
                      {grade}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <button
                type="button"
                className="mx-auto block rounded-md border px-3 py-2"
                onClick={() => setShowAnswer(true)}
              >
                Show answer
              </button>
            )}
          </div>
        ) : (
          <p>All caught up ??</p>
        )}
      </section>

      <section className="space-y-3">
        {loading ? (
          <p>Loading...</p>
        ) : words.length === 0 ? (
          <p>No words yet.</p>
        ) : (
          <ul className="space-y-2">
            {words.map((w) => (
              <li key={w.id} className="rounded-lg border p-3">
                <div className="text-lg">{w.hanzi}</div>
                <div className="text-sm text-gray-600">
                  {w.pinyin} {w.meaning}
                </div>
                <button
                  type="button"
                  className="mt-2 rounded-md border px-2 py-1 text-sm"
                  onClick={() => removeWord(w.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
