"use client";

import { useEffect, useState } from "react";
import { getShopRecipeContentForLocale } from "@/lib/shop";
import type { ShopRecipe } from "@/lib/shop.types";
import {
  CHEF_CHALLENGE_WRONG_MAX,
  normalizeChefChallengeQuestionDraft,
  shuffleChallengeOptions,
  validateChefChallengeQuestionDraft,
} from "@/lib/pawPrints";
import type {
  ChefChallengeQuestion,
  ChefChallengeQuestionDraft,
  ChefChallengeQuestionsResponse,
} from "@/lib/pawPrints.types";
import type { wordsStrings } from "../words.strings";
import ChefChallengeCard from "../shop/kitchen/ChefChallengeCard";
import { kitchenStrings } from "../shop/kitchen/kitchen.strings";
import { kitchenChefStrings } from "../shop/kitchen/kitchenChef.strings";
import { CHEF_CHALLENGE_POSES } from "../shop/kitchen/kitchenChef.types";
import {
  INPUT,
  LABEL,
  PANEL,
  SHOP_ADMIN_BUTTON_DESTRUCTIVE,
  SHOP_ADMIN_BUTTON_PRIMARY,
  SHOP_ADMIN_BUTTON_SECONDARY,
  TOGGLE_BUTTON,
} from "./shopAdmin.styles";

type ShopAdminStrings = (typeof wordsStrings)["en"]["shopAdmin"];
type Locale = "en" | "zh";
type Notice = { kind: "success" | "error"; message: string } | null;
type Editor = { id: string | null; prompt: string; correctAnswer: string; wrongAnswers: string[]; isActive: boolean };

const SECTION_CONTENT_ID = "shop-admin-chef-challenges-content";
const ENDPOINT = "/api/shop-admin/chef-questions";

function emptyEditor(): Editor {
  return { id: null, prompt: "", correctAnswer: "", wrongAnswers: ["", "", ""], isActive: true };
}

function editorFor(question: ChefChallengeQuestion): Editor {
  const wrong = [...question.wrongAnswers];
  while (wrong.length < CHEF_CHALLENGE_WRONG_MAX) wrong.push("");
  return {
    id: question.id,
    prompt: question.prompt,
    correctAnswer: question.correctAnswer,
    wrongAnswers: wrong,
    isActive: question.isActive,
  };
}

function draftOf(editor: Editor, recipeId: string): ChefChallengeQuestionDraft {
  return normalizeChefChallengeQuestionDraft({
    recipeId,
    prompt: editor.prompt,
    correctAnswer: editor.correctAnswer,
    wrongAnswers: editor.wrongAnswers,
    isActive: editor.isActive,
  });
}

/**
 * Shop Admin's third section (roadmap item T; spec section D): the platform admin
 * curates Chef Shrewy's Chinese-culture questions, one recipe at a time. Starts
 * collapsed like the other two. Every call goes through /api/shop-admin/chef-questions
 * (children can't read the question table at all). The preview renders the same
 * ChefChallengeCard the kitchen pop-up uses.
 */
export default function ChefChallengeQuestionsSection({
  recipes,
  locale,
  strings,
  accessToken,
}: {
  recipes: ShopRecipe[];
  locale: Locale;
  strings: ShopAdminStrings;
  accessToken: string;
}) {
  const str = strings.chefChallenges;
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [recipeId, setRecipeId] = useState<string>("");
  const [questions, setQuestions] = useState<ChefChallengeQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [preview, setPreview] = useState<{ question: ChefChallengeQuestion; options: string[] } | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const selectedRecipeId = recipeId || recipes[0]?.id || "";

  useEffect(() => {
    if (isCollapsed || !selectedRecipeId || !accessToken) return;
    let isCancelled = false;
    fetch(`${ENDPOINT}?recipeId=${encodeURIComponent(selectedRecipeId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as ChefChallengeQuestionsResponse;
        if (!isCancelled) setQuestions(body.questions);
      })
      .catch((error) => {
        console.error("Failed to load chef challenge questions:", error);
        if (!isCancelled) setNotice({ kind: "error", message: str.loadError });
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [isCollapsed, selectedRecipeId, accessToken, str.loadError]);

  async function send(method: "POST" | "PATCH" | "DELETE", body?: unknown, query = ""): Promise<boolean> {
    setIsSaving(true);
    setNotice(null);
    try {
      const response = await fetch(`${ENDPOINT}${query}`, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<ChefChallengeQuestionsResponse> & {
        code?: string;
      };
      if (!response.ok || !payload.questions) {
        const validation = str.validation as Record<string, string | undefined>;
        const message =
          (payload.code && validation[payload.code]) || (method === "DELETE" ? str.deleteError : str.saveError);
        setNotice({ kind: "error", message });
        return false;
      }
      setQuestions(payload.questions);
      setNotice({ kind: "success", message: method === "DELETE" ? str.deleted : str.saved });
      return true;
    } catch (error) {
      console.error("Failed to save chef challenge question:", error);
      setNotice({ kind: "error", message: method === "DELETE" ? str.deleteError : str.saveError });
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSave(): Promise<void> {
    if (!editor) return;
    const draft = draftOf(editor, selectedRecipeId);
    const problem = validateChefChallengeQuestionDraft(draft);
    if (problem) {
      setNotice({ kind: "error", message: str.validation[problem] });
      return;
    }
    const saved = await send(editor.id ? "PATCH" : "POST", editor.id ? { id: editor.id, draft } : { draft });
    if (saved) setEditor(null);
  }

  async function handleToggleActive(question: ChefChallengeQuestion): Promise<void> {
    const draft = draftOf({ ...editorFor(question), isActive: !question.isActive }, question.recipeId);
    await send("PATCH", { id: question.id, draft });
  }

  async function handleDelete(question: ChefChallengeQuestion): Promise<void> {
    // Confirmed on purpose: these are hand-written questions (spec section D).
    if (!window.confirm(str.deleteConfirm)) return;
    if (await send("DELETE", undefined, `?id=${encodeURIComponent(question.id)}&recipeId=${encodeURIComponent(question.recipeId)}`)) {
      if (editor?.id === question.id) setEditor(null);
      if (preview?.question.id === question.id) setPreview(null);
    }
  }

  function selectRecipe(nextId: string): void {
    setRecipeId(nextId);
    setQuestions([]);
    setEditor(null);
    setPreview(null);
    setNotice(null);
    setIsLoading(true);
  }

  return (
    <section className={`shop-admin-pane ${PANEL}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className={LABEL}>{str.title}</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--shop-admin-text-dark)]">{str.heading}</h2>
          <p className="mt-2 max-w-4xl text-sm leading-7 text-[var(--shop-admin-support-text)]">{str.helper}</p>
        </div>
        <button
          type="button"
          aria-controls={SECTION_CONTENT_ID}
          aria-expanded={!isCollapsed}
          onClick={() => {
            if (isCollapsed && selectedRecipeId) setIsLoading(true);
            setIsCollapsed((current) => !current);
          }}
          className={TOGGLE_BUTTON}
        >
          {isCollapsed ? strings.collapsible.expand : strings.collapsible.collapse}
        </button>
      </div>

      <div id={SECTION_CONTENT_ID} hidden={isCollapsed} className="mt-6 space-y-5">
        <label className="block max-w-md">
          <span className={LABEL}>{str.recipeLabel}</span>
          <select
            value={selectedRecipeId}
            onChange={(event) => selectRecipe(event.target.value)}
            className={INPUT}
          >
            {recipes.map((recipe) => (
              <option key={recipe.id} value={recipe.id}>
                {getShopRecipeContentForLocale(recipe, locale).title}
              </option>
            ))}
          </select>
        </label>

        {notice ? (
          <p
            role="status"
            className={`rounded-2xl border px-4 py-3 text-sm ${
              notice.kind === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {notice.message}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[var(--shop-admin-support-text)]">
            {str.questionCountTemplate.split("{count}").join(String(questions.length))}
          </p>
          <button
            type="button"
            disabled={isSaving || !selectedRecipeId}
            onClick={() => {
              setEditor(emptyEditor());
              setPreview(null);
            }}
            className={`${SHOP_ADMIN_BUTTON_SECONDARY} px-4 py-2 text-sm font-semibold disabled:opacity-50`}
          >
            {str.addButton}
          </button>
        </div>

        {editor ? (
          <div className="space-y-3 rounded-[1.25rem] border bg-white p-4 [border-color:var(--shop-admin-card-border)]">
            <p className="font-semibold text-[var(--shop-admin-text-dark)]">
              {editor.id ? str.editQuestionHeading : str.newQuestionHeading}
            </p>
            <label className="block">
              <span className={LABEL}>{str.promptLabel}</span>
              <textarea
                lang="zh"
                rows={2}
                value={editor.prompt}
                onChange={(event) => setEditor({ ...editor, prompt: event.target.value })}
                className={INPUT}
              />
            </label>
            <label className="block">
              <span className={LABEL}>{str.correctLabel}</span>
              <input
                lang="zh"
                value={editor.correctAnswer}
                onChange={(event) => setEditor({ ...editor, correctAnswer: event.target.value })}
                className={INPUT}
              />
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              {editor.wrongAnswers.map((answer, index) => (
                <label key={index} className="block">
                  <span className={LABEL}>
                    {str.wrongLabelTemplate.split("{n}").join(String(index + 1))}
                    {index === CHEF_CHALLENGE_WRONG_MAX - 1 ? ` (${str.wrongOptionalHint})` : ""}
                  </span>
                  <input
                    lang="zh"
                    value={answer}
                    onChange={(event) =>
                      setEditor({
                        ...editor,
                        wrongAnswers: editor.wrongAnswers.map((current, i) => (i === index ? event.target.value : current)),
                      })
                    }
                    className={INPUT}
                  />
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-[var(--shop-admin-text-dark)]">
              <input
                type="checkbox"
                checked={editor.isActive}
                onChange={(event) => setEditor({ ...editor, isActive: event.target.checked })}
              />
              {str.activeLabel}
            </label>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setEditor(null)}
                className="btn-neutral rounded-full border-2 px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {str.cancelButton}
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void handleSave()}
                className={`${SHOP_ADMIN_BUTTON_PRIMARY} px-5 py-2 text-sm font-semibold disabled:opacity-50`}
              >
                {isSaving ? str.savingButton : str.saveButton}
              </button>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-[var(--shop-admin-support-text)]">{str.loading}</p>
        ) : questions.length === 0 ? (
          <p className="text-sm text-[var(--shop-admin-support-text)]">{str.emptyList}</p>
        ) : (
          <ul className="space-y-3">
            {questions.map((question) => (
              <li
                key={question.id}
                className="rounded-[1.25rem] border bg-white p-4 [border-color:var(--shop-admin-card-border)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <p lang="zh" className="font-semibold text-[var(--shop-admin-text-dark)]">
                      {question.prompt}
                      {!question.isActive ? (
                        <span className="ml-2 rounded-full bg-[var(--shop-admin-badge-soft-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--shop-admin-badge-soft-text)]">
                          {str.inactiveBadge}
                        </span>
                      ) : null}
                    </p>
                    <div lang="zh" className="flex flex-wrap gap-2 text-sm">
                      <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 font-semibold text-emerald-800">
                        ✓ {question.correctAnswer}
                      </span>
                      {question.wrongAnswers.map((answer) => (
                        <span key={answer} className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-gray-700">
                          {answer}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPreview({ question, options: shuffleChallengeOptions(question.correctAnswer, question.wrongAnswers) })
                      }
                      className={`${TOGGLE_BUTTON} px-3 py-1.5`}
                    >
                      {str.previewButton}
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => {
                        setEditor(editorFor(question));
                        setPreview(null);
                      }}
                      className={`${SHOP_ADMIN_BUTTON_SECONDARY} px-3 py-1.5 text-sm font-semibold disabled:opacity-50`}
                    >
                      {str.editButton}
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void handleToggleActive(question)}
                      className={`${TOGGLE_BUTTON} px-3 py-1.5 disabled:opacity-50`}
                    >
                      {question.isActive ? str.deactivateButton : str.activateButton}
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void handleDelete(question)}
                      className={`${SHOP_ADMIN_BUTTON_DESTRUCTIVE} px-3 py-1.5 text-sm font-semibold disabled:opacity-50`}
                    >
                      {str.deleteButton}
                    </button>
                  </div>
                </div>

                {preview?.question.id === question.id ? (
                  <div className="mt-4 rounded-[1.25rem] border-2 border-[#dcc38a] bg-[#fffaf0] p-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className={LABEL}>{str.previewHeading}</p>
                      <button type="button" onClick={() => setPreview(null)} className={`${TOGGLE_BUTTON} px-3 py-1`}>
                        {str.closePreviewButton}
                      </button>
                    </div>
                    <div className="mx-auto max-w-md">
                      <ChefChallengeCard
                        title={kitchenStrings[locale].challengeTitle}
                        pose={CHEF_CHALLENGE_POSES.offer}
                        line={kitchenChefStrings[locale].challenge.offer[0]}
                        prompt={preview.question.prompt}
                        options={preview.options}
                        chosenOption={null}
                        correctAnswer={null}
                        disabled
                        correctAnswerLabel={kitchenStrings[locale].challengeCorrectAnswerLabel}
                        onChoose={() => undefined}
                      />
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
