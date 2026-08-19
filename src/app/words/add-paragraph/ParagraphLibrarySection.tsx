"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/app/shared/locale";
import { getVocabPhraseLessonTagsForFamily, listAllParagraphTestModes } from "@/lib/supabase-service";
import type { VocabPhraseLessonTagsMap, WordLessonTagsMap } from "@/lib/tagging.types";
import type { ParagraphTestMode } from "@/lib/paragraphTestMode.types";
import { matchesParagraphTitleFilter, resolveParagraphTagIds } from "@/lib/paragraphLibrary";
import {
  getAllTagFilterOptionIds,
  matchesSelectedTagFilter,
  NO_TAG_FILTER_ID,
  toggleTagFilterId,
} from "../shared/tagFilter.utils";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";
import { addParagraphStrings } from "./addParagraph.strings";

export default function ParagraphLibrarySection({ vm }: { vm: WordsWorkspaceVM }) {
  const locale = useLocale();
  const str = addParagraphStrings[locale];
  const libStr = str.library;

  const [vocabPhraseTagsMap, setVocabPhraseTagsMap] = useState<VocabPhraseLessonTagsMap>(new Map());
  const [testModesByParagraphId, setTestModesByParagraphId] = useState<Map<string, ParagraphTestMode[]>>(new Map());

  useEffect(() => {
    // This section stays mounted (self-gates on vm.paragraphViewMode by
    // returning null) rather than unmounting when the parent navigates to
    // Continue Import / Prep Fill Test, so vm.paragraphs changing is not
    // enough to catch test modes created/edited/deleted elsewhere -- those
    // never touch vm.paragraphs at all. Re-fetch every time the library
    // becomes the active view again, not just when the paragraph list itself
    // changes.
    if (vm.paragraphViewMode !== "library") return;

    getVocabPhraseLessonTagsForFamily().then(setVocabPhraseTagsMap).catch(() => setVocabPhraseTagsMap(new Map()));
    listAllParagraphTestModes()
      .then((modes) => {
        const grouped = new Map<string, ParagraphTestMode[]>();
        for (const mode of modes) {
          const list = grouped.get(mode.paragraphId) ?? [];
          list.push(mode);
          grouped.set(mode.paragraphId, list);
        }
        setTestModesByParagraphId(grouped);
      })
      .catch(() => setTestModesByParagraphId(new Map()));
  }, [vm.paragraphs, vm.paragraphViewMode]);

  const availableTagsWithIds = useMemo(() => {
    const tagMap = new Map<string, { id: string; textbookName: string; grade: string; unit: string; lesson: string }>();
    const addFrom = (map: WordLessonTagsMap | VocabPhraseLessonTagsMap) => {
      map.forEach((tags) => {
        tags.forEach((tag) => {
          const key = `${tag.textbookName} · ${tag.grade} · ${tag.unit} · ${tag.lesson}`;
          if (!tagMap.has(key)) {
            tagMap.set(key, {
              id: tag.lessonTagId,
              textbookName: tag.textbookName,
              grade: tag.grade,
              unit: tag.unit,
              lesson: tag.lesson,
            });
          }
        });
      });
    };
    addFrom(vm.wordTagsMap);
    addFrom(vocabPhraseTagsMap);
    return Array.from(tagMap.values());
  }, [vm.wordTagsMap, vocabPhraseTagsMap]);

  const filteredParagraphs = useMemo(() => {
    return vm.paragraphs.filter((paragraph) => {
      if (!matchesParagraphTitleFilter(paragraph, vm.paragraphFilterTitle)) return false;
      if (vm.paragraphFilterSelectedTagIds.length > 0) {
        const resolvedTagIds = resolveParagraphTagIds(paragraph, vm.wordTagsMap, vocabPhraseTagsMap);
        if (!matchesSelectedTagFilter(resolvedTagIds, vm.paragraphFilterSelectedTagIds)) return false;
      }
      return true;
    });
  }, [vm.paragraphs, vm.paragraphFilterTitle, vm.paragraphFilterSelectedTagIds, vm.wordTagsMap, vocabPhraseTagsMap]);

  const hasActiveFilters = vm.paragraphFilterTitle.trim() !== "" || vm.paragraphFilterSelectedTagIds.length > 0;

  function handleClearFilters() {
    vm.setParagraphFilterTitle("");
    vm.setParagraphFilterSelectedTagIds([]);
  }

  function handleContinueImport(paragraphId: string) {
    vm.setParagraphSelectedId(paragraphId);
    vm.setParagraphViewMode("continueImport");
  }

  function handlePrepFillTest(paragraphId: string) {
    vm.setParagraphSelectedId(paragraphId);
    vm.setParagraphViewMode("testModes");
  }

  function spanCount(paragraph: (typeof vm.paragraphs)[number]): number {
    return paragraph.sentences.reduce((sum, sentence) => sum + sentence.spans.length, 0);
  }

  if (vm.page !== "addParagraph" || vm.paragraphViewMode !== "library") {
    return null;
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">{str.pageTitle}</h2>
        <button
          type="button"
          onClick={() => vm.setParagraphViewMode("import")}
          className="btn-primary rounded-md border-2 px-4 py-2"
        >
          {libStr.importNewButton}
        </button>
      </div>

      {vm.paragraphs.length === 0 ? (
        <p className="text-sm text-gray-500">{libStr.emptyState}</p>
      ) : (
        <>
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex flex-wrap items-end gap-6">
              <div className="space-y-1">
                <label className="block text-xs text-gray-600">{libStr.filterTitleLabel}</label>
                <input
                  type="text"
                  className="w-full max-w-xs rounded-md border px-2 py-1 text-sm"
                  placeholder={libStr.filterTitlePlaceholder}
                  value={vm.paragraphFilterTitle}
                  onChange={(event) => vm.setParagraphFilterTitle(event.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs text-gray-600">{libStr.filterTagsLabel}</label>
                <details className="group">
                  <summary className="cursor-pointer rounded-md border bg-gray-50 px-2 py-1 text-sm hover:bg-gray-100">
                    {vm.paragraphFilterSelectedTagIds.length === 0
                      ? libStr.filterTagsPlaceholder
                      : libStr.filterTagsSelectedCount.replace("{count}", String(vm.paragraphFilterSelectedTagIds.length))}
                  </summary>
                  <div className="mt-2 max-h-96 space-y-1 overflow-y-auto rounded-md border bg-white p-2">
                    <div className="mb-2 flex flex-wrap items-center gap-2 border-b pb-2">
                      <button
                        type="button"
                        className="btn-secondary rounded border-2 px-1.5 py-0.5 text-[11px] font-medium leading-none disabled:opacity-50"
                        onClick={() => vm.setParagraphFilterSelectedTagIds(getAllTagFilterOptionIds(availableTagsWithIds))}
                        disabled={availableTagsWithIds.length === 0}
                      >
                        {libStr.filterTagsSelectAll}
                      </button>
                      <button
                        type="button"
                        className="btn-neutral rounded border-2 px-1.5 py-0.5 text-[11px] font-medium leading-none disabled:opacity-50"
                        onClick={() => vm.setParagraphFilterSelectedTagIds([])}
                        disabled={vm.paragraphFilterSelectedTagIds.length === 0}
                      >
                        {libStr.filterTagsClearAll}
                      </button>
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={vm.paragraphFilterSelectedTagIds.includes(NO_TAG_FILTER_ID)}
                        onChange={(event) =>
                          vm.setParagraphFilterSelectedTagIds((previous) =>
                            toggleTagFilterId(previous, NO_TAG_FILTER_ID, event.target.checked)
                          )
                        }
                      />
                      <span>{libStr.filterTagsNoneOption}</span>
                    </label>
                    {availableTagsWithIds.map((tag) => {
                      const tagDisplay = `${tag.textbookName} · ${tag.grade} · ${tag.unit} · ${tag.lesson}`;
                      return (
                        <label
                          key={tag.id}
                          className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={vm.paragraphFilterSelectedTagIds.includes(tag.id)}
                            onChange={(event) =>
                              vm.setParagraphFilterSelectedTagIds((previous) =>
                                toggleTagFilterId(previous, tag.id, event.target.checked)
                              )
                            }
                          />
                          <span>{tagDisplay}</span>
                        </label>
                      );
                    })}
                  </div>
                </details>
              </div>

              <button
                type="button"
                onClick={handleClearFilters}
                disabled={!hasActiveFilters}
                className="text-xs text-blue-600 underline disabled:opacity-50"
              >
                {libStr.filterClearButton}
              </button>
            </div>
          </div>

          {filteredParagraphs.length === 0 ? (
            <p className="text-sm text-gray-500">{libStr.noResultsNotice}</p>
          ) : (
            <ul className="space-y-2">
              {filteredParagraphs.map((paragraph) => (
                <li key={paragraph.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{paragraph.title || libStr.untitledLabel}</p>
                    <p className="text-xs text-gray-500">
                      {libStr.spanCountLabel.replace("{count}", String(spanCount(paragraph)))}
                      {" · "}
                      {libStr.testModeCountLabel.replace(
                        "{count}",
                        String((testModesByParagraphId.get(paragraph.id) ?? []).length)
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleContinueImport(paragraph.id)}
                      className="btn-nav rounded-md border-2 px-3 py-1 text-xs hover:bg-[#fff1cd]"
                    >
                      {libStr.continueImportAction}
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrepFillTest(paragraph.id)}
                      className="btn-nav rounded-md border-2 px-3 py-1 text-xs hover:bg-[#fff1cd]"
                    >
                      {libStr.prepFillTestAction}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
