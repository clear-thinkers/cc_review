"use client";

import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";

export default function AddSection({ vm }: { vm: WordsWorkspaceVM }) {
  const { page, str, formNotice, addWord, hanzi, setHanzi } = vm;
  if (page !== "add") {
    return null;
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="font-medium">{str.add.pageTitle}</h2>
      <p className="text-sm text-gray-700">{str.add.pageDescription}</p>
      {formNotice ? <p className="text-sm text-blue-700">{formNotice}</p> : null}

      <form onSubmit={addWord} className="space-y-3 rounded-md border p-3">
        <input
          className="w-full rounded-md border px-3 py-2"
          placeholder={str.add.inputPlaceholder}
          value={hanzi}
          onChange={(e) => setHanzi(e.target.value)}
        />

        <button type="submit" className="rounded-md bg-black px-4 py-2 text-white">
          {str.add.submitButton}
        </button>
      </form>
    </section>
  );
}
