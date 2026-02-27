"use client";

import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";

export default function AdminSection({ vm }: { vm: WordsWorkspaceVM }) {
  const {
    page,
    str,
    getAdminStatsCardClass,
    handleAdminStatsFilterClick,
    isAdminStatsFilterActive,
    adminUniqueCharacterCount,
    adminTargets,
    adminTargetsWithContentCount,
    adminMissingCount,
    adminTargetsReadyForTestingCount,
    adminTargetsExcludedForTestingCount,
    handleAdminPreloadAll,
    adminLoading,
    adminPreloading,
    adminProgressText,
    adminNotice,
    adminTableRenderRows,
    adminEmptyTableMessage,
    adminTargetByKey,
    adminJsonByKey,
    adminRegeneratingKey,
    adminSavingKey,
    adminDeletingKey,
    handleAdminRegenerate,
    handleAdminSave,
    handleAdminDeleteTarget,
    handleAdminAddMeaningRow,
    updateAdminPendingMeaningInput,
    handleAdminSavePendingMeaning,
    removeAdminPendingMeaning,
    handleAdminAddPhraseRow,
    updateAdminPendingPhraseInput,
    handleAdminSavePendingPhrase,
    removeAdminPendingPhrase,
    renderPhraseWithPinyin,
    handleAdminToggleFillTestInclude,
    handleAdminRegeneratePhrase,
    handleAdminDeletePhrase,
    adminEditingExampleRowKey,
    handleAdminInlineEditExample,
    renderSentenceWithPinyin,
    handleAdminRegenerateExample,
    handleAdminEditExample,
    handleAdminDeleteExample,
  } = vm;

  if (page !== "admin") {
    return null;
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="font-medium">{str.admin.pageTitle}</h2>
      <p className="text-sm text-gray-700">{str.admin.pageDescription}</p>

      <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          className={getAdminStatsCardClass("characters")}
          onClick={() => handleAdminStatsFilterClick("characters")}
          aria-pressed={isAdminStatsFilterActive("characters")}
          title={str.admin.filterTooltips.characters}
        >
          <p className="text-sm uppercase text-gray-600">
            {str.admin.stats.characters}
            {isAdminStatsFilterActive("characters") ? str.admin.filterStateOn : ""}
          </p>
          <p className="text-2xl font-semibold">{adminUniqueCharacterCount}</p>
        </button>
        <button
          type="button"
          className={getAdminStatsCardClass("targets")}
          onClick={() => handleAdminStatsFilterClick("targets")}
          aria-pressed={isAdminStatsFilterActive("targets")}
          title={str.admin.filterTooltips.allTargets}
        >
          <p className="text-sm uppercase text-gray-600">
            {str.admin.stats.allTargets}
            {isAdminStatsFilterActive("targets") ? str.admin.filterStateOn : ""}
          </p>
          <p className="text-2xl font-semibold">{adminTargets.length}</p>
        </button>
        <button
          type="button"
          className={getAdminStatsCardClass("with_content")}
          onClick={() => handleAdminStatsFilterClick("with_content")}
          aria-pressed={isAdminStatsFilterActive("with_content")}
          title={str.admin.filterTooltips.withContent}
        >
          <p className="text-sm uppercase text-gray-600">
            {str.admin.stats.withContent}
            {isAdminStatsFilterActive("with_content") ? str.admin.filterStateOn : ""}
          </p>
          <p className="text-2xl font-semibold">{adminTargetsWithContentCount}</p>
        </button>
        <button
          type="button"
          className={getAdminStatsCardClass("missing_content")}
          onClick={() => handleAdminStatsFilterClick("missing_content")}
          aria-pressed={isAdminStatsFilterActive("missing_content")}
          title={str.admin.filterTooltips.missingContent}
        >
          <p className="text-sm uppercase text-gray-600">
            {str.admin.stats.missingContent}
            {isAdminStatsFilterActive("missing_content") ? str.admin.filterStateOn : ""}
          </p>
          <p className="text-2xl font-semibold">{adminMissingCount}</p>
        </button>
      </div>
      <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
        <button
          type="button"
          className={getAdminStatsCardClass("ready_for_testing")}
          onClick={() => handleAdminStatsFilterClick("ready_for_testing")}
          aria-pressed={isAdminStatsFilterActive("ready_for_testing")}
          title={str.admin.filterTooltips.readyForTesting}
        >
          <p className="text-sm uppercase text-gray-600">
            {str.admin.stats.readyForTesting}
            {isAdminStatsFilterActive("ready_for_testing") ? str.admin.filterStateOn : ""}
          </p>
          <p className="text-2xl font-semibold">{adminTargetsReadyForTestingCount}</p>
        </button>
        <button
          type="button"
          className={getAdminStatsCardClass("excluded_for_testing")}
          onClick={() => handleAdminStatsFilterClick("excluded_for_testing")}
          aria-pressed={isAdminStatsFilterActive("excluded_for_testing")}
          title={str.admin.filterTooltips.excludedForTesting}
        >
          <p className="text-sm uppercase text-gray-600">
            {str.admin.stats.excludedForTesting}
            {isAdminStatsFilterActive("excluded_for_testing") ? str.admin.filterStateOn : ""}
          </p>
          <p className="text-2xl font-semibold">{adminTargetsExcludedForTestingCount}</p>
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
          onClick={handleAdminPreloadAll}
          disabled={adminLoading || adminPreloading || adminTargets.length === 0}
        >
          {adminPreloading ? str.admin.buttons.preloading : str.admin.buttons.preload}
        </button>
      </div>

      {adminProgressText ? <p className="text-sm text-gray-600">{adminProgressText}</p> : null}
      {adminNotice ? <p className="text-sm text-blue-700">{adminNotice}</p> : null}

      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="w-[15%] px-3 py-2 text-left">
                {str.admin.table.headers.character} ({str.admin.table.headers.pronunciation})
              </th>
              <th className="w-[25%] px-3 py-2 text-left">{str.admin.table.headers.meaningZh}</th>
              <th className="px-3 py-2 text-left">{str.admin.table.headers.phrase}</th>
              <th className="px-3 py-2 text-left">{str.admin.table.headers.example}</th>
            </tr>
          </thead>
          <tbody>
            {adminTableRenderRows.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-gray-600" colSpan={4}>
                  {adminEmptyTableMessage}
                </td>
              </tr>
            ) : (
              adminTableRenderRows.map((row) => {
                const target = adminTargetByKey.get(row.targetKey);
                const rawValue = target ? adminJsonByKey[target.key] ?? "" : "";
                const regenerating = target ? adminRegeneratingKey === target.key : false;
                const saving = target ? adminSavingKey === target.key : false;
                const deleting = target ? adminDeletingKey === target.key : false;
                const busy = adminPreloading || regenerating || saving || deleting;
                const canSave = Boolean(rawValue.trim());
                const isPendingPhraseRow = row.rowType === "pending_phrase";
                const isPendingMeaningRow = row.rowType === "pending_meaning";
                const isEmptyTargetRow = row.rowType === "empty_target";
                const isExistingRow = row.rowType === "existing";

                return (
                  <tr key={row.rowKey} className="border-b align-top">
                    {row.showCharacterCell ? (
                      <td className="px-3 py-2 text-base" rowSpan={row.characterRowSpan}>
                        <div className="flex min-h-[5rem] flex-col justify-between gap-2">
                          <p>
                            {row.character} ({row.pronunciation})
                          </p>
                          {!target ? null : (
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                className="rounded border-2 border-amber-400 bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-amber-900 disabled:opacity-50"
                                disabled={busy}
                                onClick={() => handleAdminRegenerate(target)}
                                title={str.admin.table.actionTooltips.regenerate}
                              >
                                {str.admin.table.actionButtons.regenerate}
                              </button>
                              <button
                                type="button"
                                className="rounded border-2 border-emerald-600 bg-emerald-600 px-1.5 py-0.5 text-[11px] font-medium leading-none text-white disabled:opacity-50"
                                disabled={busy || !canSave}
                                onClick={() => handleAdminSave(target)}
                                title={str.admin.table.actionTooltips.save}
                              >
                                {str.admin.table.actionButtons.save}
                              </button>
                              <button
                                type="button"
                                className="rounded border-2 border-rose-500 bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-rose-700 disabled:opacity-50"
                                disabled={busy}
                                onClick={() => handleAdminDeleteTarget(target)}
                                title={str.admin.table.actionTooltips.delete}
                              >
                                {str.admin.table.actionButtons.delete}
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center justify-center rounded border-2 border-sky-300 bg-sky-50 px-1.5 py-1 text-[11px] font-medium leading-tight text-sky-800 disabled:opacity-50"
                                disabled={busy}
                                onClick={() => handleAdminAddMeaningRow(target.key)}
                                title={str.admin.table.actionTooltips.addMeaning}
                              >
                                {str.admin.table.actionButtons.addMeaning}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    ) : null}
                    {row.showMeaningCell ? (
                      <td className="px-3 py-2" rowSpan={row.meaningRowSpan}>
                        {isPendingMeaningRow ? (
                          <div className="space-y-2">
                            <input
                              className="w-full rounded-md border px-2 py-1 text-sm"
                              value={row.meaningZh}
                              onChange={(event) => {
                                if (!row.pendingId) {
                                  return;
                                }
                                updateAdminPendingMeaningInput(
                                  row.pendingId,
                                  "meaningZhInput",
                                  event.target.value
                                );
                              }}
                              placeholder={str.admin.table.placeholders.newMeaning}
                            />
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                className="rounded border-2 border-emerald-600 bg-emerald-600 px-2 py-0.5 text-xs font-medium leading-none text-white disabled:opacity-50"
                                disabled={
                                  busy || !row.meaningZh.trim() || !row.phrase.trim() || !row.example.trim()
                                }
                                onClick={() => handleAdminSavePendingMeaning(row)}
                                title={str.admin.table.actionTooltips.saveNew}
                              >
                                {str.admin.table.actionButtons.saveNew}
                              </button>
                              <button
                                type="button"
                                className="rounded border-2 border-rose-500 bg-rose-50 px-2 py-0.5 text-xs font-medium leading-none text-rose-700 disabled:opacity-50"
                                disabled={busy}
                                onClick={() => {
                                  if (!row.pendingId) {
                                    return;
                                  }
                                  removeAdminPendingMeaning(row.pendingId);
                                }}
                                title={str.admin.table.actionTooltips.cancelAdd}
                              >
                                {str.admin.table.actionButtons.cancel}
                              </button>
                            </div>
                          </div>
                        ) : isEmptyTargetRow ? (
                          <p className="text-xs text-gray-500">
                            {str.admin.table.emptyMessages.noContent}
                          </p>
                        ) : (
                          <>
                            <p className="text-base leading-tight">{row.meaningZh}</p>
                            {row.meaningEn ? <p className="mt-1 text-xs text-gray-500">{row.meaningEn}</p> : null}
                            {!target ? null : (
                              <button
                                type="button"
                                className="mt-2 rounded border-2 border-sky-300 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800 disabled:opacity-50"
                                disabled={busy}
                                onClick={() =>
                                  handleAdminAddPhraseRow(row.targetKey, row.meaningZh, row.meaningEn)
                                }
                                title={str.admin.table.actionTooltips.addPhrase}
                              >
                                {str.admin.table.actionButtons.addPhrase}
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    ) : null}
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        {isPendingPhraseRow ? (
                          <input
                            className="w-full rounded-md border px-2 py-1 text-sm"
                            value={row.phrase}
                            onChange={(event) => {
                              if (!row.pendingId) {
                                return;
                              }
                              updateAdminPendingPhraseInput(row.pendingId, event.target.value);
                            }}
                            placeholder={str.admin.table.placeholders.newPhrase.replace("{char}", row.character)}
                          />
                        ) : isPendingMeaningRow ? (
                          <input
                            className="w-full rounded-md border px-2 py-1 text-sm"
                            value={row.phrase}
                            onChange={(event) => {
                              if (!row.pendingId) {
                                return;
                              }
                              updateAdminPendingMeaningInput(
                                row.pendingId,
                                "phraseInput",
                                event.target.value
                              );
                            }}
                            placeholder={str.admin.table.placeholders.newPhrase.replace("{char}", row.character)}
                          />
                        ) : isEmptyTargetRow ? (
                          <p className="text-xs text-gray-500">{str.admin.table.emptyMessages.addMeaningFirst}</p>
                        ) : (
                          <div className="text-base leading-tight">
                            {renderPhraseWithPinyin(row.phrase, row.phrasePinyin)}
                          </div>
                        )}
                        {!target || isEmptyTargetRow ? null : isPendingPhraseRow ? (
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              className="rounded border-2 border-emerald-600 bg-emerald-600 px-2 py-0.5 text-xs font-medium leading-none text-white disabled:opacity-50"
                              disabled={busy || !row.phrase.trim()}
                              onClick={() => handleAdminSavePendingPhrase(row)}
                              title={str.admin.table.actionTooltips.saveNew}
                            >
                              {str.admin.table.actionButtons.saveNew}
                            </button>
                            <button
                              type="button"
                              className="rounded border-2 border-rose-500 bg-rose-50 px-2 py-0.5 text-xs font-medium leading-none text-rose-700 disabled:opacity-50"
                              disabled={busy}
                              onClick={() => {
                                if (!row.pendingId) {
                                  return;
                                }
                                removeAdminPendingPhrase(row.pendingId);
                              }}
                              title={str.admin.table.actionTooltips.cancelAdd}
                            >
                              {str.admin.table.actionButtons.cancel}
                            </button>
                          </div>
                        ) : isPendingMeaningRow ? null : (
                          <div className="flex flex-wrap gap-1">
                            {isExistingRow ? (
                              <button
                                type="button"
                                className={
                                  row.includeInFillTest
                                    ? "rounded border-2 border-teal-600 bg-teal-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-teal-700 disabled:opacity-50"
                                    : "rounded border-2 border-gray-400 bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-gray-700 disabled:opacity-50"
                                }
                                disabled={busy}
                                onClick={() => {
                                  void handleAdminToggleFillTestInclude(row, !row.includeInFillTest);
                                }}
                                title={
                                  row.includeInFillTest
                                    ? str.admin.table.actionTooltips.fillTestOn
                                    : str.admin.table.actionTooltips.fillTestOff
                                }
                              >
                                {row.includeInFillTest
                                  ? str.admin.table.actionButtons.fillTestOn
                                  : str.admin.table.actionButtons.fillTestOff}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="rounded border-2 border-amber-400 bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-amber-900 disabled:opacity-50"
                              disabled={busy}
                              onClick={() => handleAdminRegeneratePhrase(row)}
                              title={str.admin.table.actionTooltips.regeneratePhrase}
                            >
                              {str.admin.table.actionButtons.regenerate}
                            </button>
                            <button
                              type="button"
                              className="rounded border-2 border-emerald-600 bg-emerald-600 px-1.5 py-0.5 text-[11px] font-medium leading-none text-white disabled:opacity-50"
                              disabled={busy || !canSave}
                              onClick={() => handleAdminSave(target)}
                              title={str.admin.table.actionTooltips.save}
                            >
                              {str.admin.table.actionButtons.save}
                            </button>
                            <button
                              type="button"
                              className="rounded border-2 border-rose-500 bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-rose-700 disabled:opacity-50"
                              disabled={busy}
                              onClick={() => handleAdminDeletePhrase(row)}
                              title={str.admin.table.actionTooltips.deletePhrase}
                            >
                              {str.admin.table.actionButtons.delete}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        {isPendingPhraseRow || isPendingMeaningRow ? (
                          isPendingMeaningRow ? (
                            <input
                              className="w-full rounded-md border px-2 py-1 text-sm"
                              value={row.example}
                              onChange={(event) => {
                                if (!row.pendingId) {
                                  return;
                                }
                                updateAdminPendingMeaningInput(
                                  row.pendingId,
                                  "exampleInput",
                                  event.target.value
                                );
                              }}
                              placeholder={str.admin.table.placeholders.matchingExample}
                            />
                          ) : (
                            <p className="text-xs text-gray-500">
                              {str.admin.table.helper.generatedOnSave}
                            </p>
                          )
                        ) : isEmptyTargetRow ? (
                          <p className="text-xs text-gray-500">
                            {str.admin.table.emptyMessages.addMeaningAndPhraseFirst}
                          </p>
                        ) : row.rowKey === adminEditingExampleRowKey ? (
                          <input
                            className="w-full rounded-md border px-2 py-1 text-sm"
                            value={row.example}
                            onChange={(event) => handleAdminInlineEditExample(row, event.target.value)}
                            placeholder={str.admin.table.placeholders.editExample}
                            autoFocus
                          />
                        ) : (
                          <div className="text-base leading-tight">
                            {renderSentenceWithPinyin(row.example, row.examplePinyin)}
                          </div>
                        )}
                        {!target || isPendingPhraseRow || isPendingMeaningRow || isEmptyTargetRow ? null : (
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              className="rounded border-2 border-amber-400 bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-amber-900 disabled:opacity-50"
                              disabled={busy}
                              onClick={() => handleAdminRegenerateExample(row)}
                              title={str.admin.table.actionTooltips.regenerateExample}
                            >
                              {str.admin.table.actionButtons.regenerate}
                            </button>
                            <button
                              type="button"
                              className="rounded border-2 border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-sky-800 disabled:opacity-50"
                              disabled={busy}
                              onClick={() => handleAdminEditExample(row)}
                              title={str.admin.table.actionTooltips.editExample}
                            >
                              {str.admin.table.actionButtons.edit}
                            </button>
                            <button
                              type="button"
                              className="rounded border-2 border-emerald-600 bg-emerald-600 px-1.5 py-0.5 text-[11px] font-medium leading-none text-white disabled:opacity-50"
                              disabled={busy || !canSave}
                              onClick={() => handleAdminSave(target)}
                              title={str.admin.table.actionTooltips.save}
                            >
                              {str.admin.table.actionButtons.save}
                            </button>
                            <button
                              type="button"
                              className="rounded border-2 border-rose-500 bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-rose-700 disabled:opacity-50"
                              disabled={busy}
                              onClick={() => handleAdminDeleteExample(row)}
                              title={str.admin.table.actionTooltips.deleteExample}
                            >
                              {str.admin.table.actionButtons.delete}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {adminLoading ? (
        <p className="text-sm text-gray-600">{str.admin.loading}</p>
      ) : adminTargets.length === 0 ? (
        <p className="text-sm text-gray-600">{str.admin.noTargets}</p>
      ) : null}
    </section>
  );
}


