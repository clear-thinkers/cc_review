"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { answerChefChallenge, getChefChallenge } from "@/lib/supabase-service";
import type { AnswerChefChallengeResult, ChefChallenge } from "@/lib/pawPrints.types";
import { playCelebrationSound } from "../../shared/coins.sound";
import ChefChallengeCard from "./ChefChallengeCard";
import type { KitchenLocaleStrings } from "./kitchen.strings";
import { CHEF_CHALLENGE_POSES, type KitchenChefLocaleStrings } from "./kitchenChef.types";
import styles from "./kitchenScene.animation.module.css";

type AnsweredResult = Extract<AnswerChefChallengeResult, { success: true }>;
type Phase = "asking" | "checking" | "answered" | "answerError" | "loadingNext" | "nextError";

function pickLine(lines: readonly string[]): string {
  return lines[Math.floor(Math.random() * lines.length)] ?? "";
}

function fill(template: string, tokens: Record<string, string>): string {
  return Object.entries(tokens).reduce((text, [key, value]) => text.split(`{${key}}`).join(value), template);
}

/**
 * Chef Shrewy's challenge pop-up (roadmap item T; spec section A, three questions since
 * 2026-10-29). Opened by tapping the painted chef while his paw badge shows. Questions
 * come one at a time ("第 1/3 题"); the server checks each answer (answer_chef_challenge)
 * and reveals the correct one and its 小知识 only afterwards.
 * - Correct with more to come: a quick praise line and "Next question" (get_chef_challenge
 *   hands out the next one).
 * - Wrong: that question's answer is shown and the challenge ends -- no paw print.
 * - The last correct answer of a fully correct challenge stamps a paw print with the chime.
 * Closing mid-way costs nothing: the next tap resumes with the next unanswered question.
 */
export default function ChefChallengeModal({
  recipeId,
  challenge: firstChallenge,
  strings,
  chefStrings,
  onClose,
}: {
  recipeId: string;
  challenge: ChefChallenge;
  strings: KitchenLocaleStrings;
  chefStrings: KitchenChefLocaleStrings;
  /** `finished` is false when the child left with questions still to answer. */
  onClose: (finished: boolean) => void;
}) {
  const [challenge, setChallenge] = useState(firstChallenge);
  const [offerLine] = useState(() => pickLine(chefStrings.challenge.offer));
  const [phase, setPhase] = useState<Phase>("asking");
  const [chosen, setChosen] = useState<string | null>(null);
  const [result, setResult] = useState<AnsweredResult | null>(null);
  const [resultLine, setResultLine] = useState("");

  if (typeof document === "undefined") return null;

  const isFinished = result?.challengeFinished === true;

  async function submit(option: string): Promise<void> {
    setChosen(option);
    setPhase("checking");
    try {
      const response = await answerChefChallenge(challenge.attemptId, option);
      if (!response.success) {
        setPhase("answerError");
        return;
      }
      setResult(response);
      setResultLine(
        pickLine(
          !response.isCorrect
            ? chefStrings.challenge.wrong
            : response.challengeFinished
              ? chefStrings.challenge.correct
              : chefStrings.challenge.nextCorrect
        )
      );
      setPhase("answered");
      if (response.pawPrintEarned) playCelebrationSound(false);
    } catch (error) {
      console.error("Failed to answer the chef challenge:", error);
      setPhase("answerError");
    }
  }

  async function loadNext(): Promise<void> {
    setPhase("loadingNext");
    try {
      const response = await getChefChallenge(recipeId);
      if (!response.success) {
        setPhase("nextError");
        return;
      }
      setChallenge(response.challenge);
      setChosen(null);
      setResult(null);
      setResultLine("");
      setPhase("asking");
    } catch (error) {
      console.error("Failed to load the next chef challenge question:", error);
      setPhase("nextError");
    }
  }

  function retry(): void {
    if (phase === "nextError") void loadNext();
    else if (chosen) void submit(chosen);
  }

  const pose =
    phase === "answered" && result
      ? CHEF_CHALLENGE_POSES[!result.isCorrect ? "wrong" : result.challengeFinished ? "correct" : "nextCorrect"]
      : CHEF_CHALLENGE_POSES.offer;
  const line =
    phase === "answered"
      ? resultLine
      : phase === "checking" || phase === "loadingNext"
        ? strings.challengeChecking
        : offerLine;
  const primaryButton =
    "w-full rounded-full border-2 border-[#8b6f2f] bg-[#f7ead0] px-6 py-3 text-lg font-bold text-[#5c4720] shadow-[0_3px_8px_rgba(139,111,47,0.3)] transition hover:bg-[#f0dfb8]";

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/45 p-4">
      <div className="flex min-h-full items-center justify-center">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={strings.challengeTitle}
          className="relative w-full max-w-md rounded-[1.5rem] border-2 border-[#dcc38a] bg-[#fffaf0] p-6 shadow-[0_24px_60px_rgba(85,122,84,0.18)]"
        >
          <ChefChallengeCard
            title={strings.challengeTitle}
            progressLabel={fill(strings.challengeProgressTemplate, {
              n: String(challenge.questionNumber),
              total: String(challenge.questionCount),
            })}
            pose={pose}
            line={line}
            prompt={challenge.prompt}
            options={challenge.options}
            chosenOption={chosen}
            correctAnswer={result?.correctAnswer ?? null}
            disabled={phase !== "asking"}
            correctAnswerLabel={strings.challengeCorrectAnswerLabel}
            explanation={result?.explanation ?? null}
            explanationLabel={strings.challengeExplanationLabel}
            onChoose={(option) => void submit(option)}
          />

          {phase === "answered" && result?.pawPrintEarned ? (
            <div className="mt-4 flex items-center justify-center gap-3 rounded-2xl bg-[#fcf3df] px-4 py-3">
              <img
                src="/paw-prints/shrewy_paw.png"
                alt=""
                aria-hidden="true"
                draggable={false}
                className={`h-16 w-16 select-none ${styles.stampThump}`}
              />
              <div className="text-sm font-semibold text-[#5c4720]">
                <p className="text-base font-bold text-emerald-800">{strings.challengePawEarned}</p>
                <p>{fill(strings.challengePawCountTemplate, { count: String(result.balance.collected) })}</p>
              </div>
            </div>
          ) : null}

          {phase === "answerError" || phase === "nextError" ? (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <p className="text-sm text-red-700">{strings.challengeAnswerError}</p>
              <button
                type="button"
                onClick={retry}
                className="btn-caution rounded-full border-2 px-4 py-1.5 text-sm font-semibold"
              >
                {strings.challengeRetry}
              </button>
            </div>
          ) : null}

          <div className="mt-5 flex justify-center">
            {phase === "answered" && !isFinished ? (
              <button type="button" autoFocus onClick={() => void loadNext()} className={primaryButton}>
                {strings.challengeNext}
              </button>
            ) : phase === "answered" ? (
              <button type="button" autoFocus onClick={() => onClose(true)} className={primaryButton}>
                {strings.challengeDone}
              </button>
            ) : (
              <button
                type="button"
                disabled={phase === "checking" || phase === "loadingNext"}
                onClick={() => onClose(false)}
                className="btn-nav rounded-full border-2 px-5 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {strings.challengeClose}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
