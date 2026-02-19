"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import type { Word } from "@/lib/types";
import { makeId } from "@/lib/id";

export default function WordsPage() {
  const [words, setWords] = useState<Word[]>([]);
  const [hanzi, setHanzi] = useState("");
  const [pinyin, setPinyin] = useState("");
  const [meaning, setMeaning] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const all = await db.words.orderBy("createdAt").reverse().toArray();
    setWords(all);
  }

  useEffect(() => {
    (async () => {
      await refresh();
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
      ease: 2.5,
      nextReviewAt: now,
    };

    await db.words.add(newWord);

    setHanzi("");
    setPinyin("");
    setMeaning("");
    await refresh();
  }

  async function removeWord(id: string) {
    await db.words.delete(id);
    await refresh();
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Words</h1>

      <form onSubmit={addWord} className="space-y-3 rounded-lg border p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            className="rounded-md border px-3 py-2"
            placeholder="汉字"
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

        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-white"
        >
          Add
        </button>
      </form>

      <section className="space-y-3">
        {loading ? (
          <p>Loading…</p>
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
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
