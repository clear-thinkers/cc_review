"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { answerChefChallenge } from "@/lib/supabase-service";
import type { AnswerChefChallengeResult, ChefChallenge } from "@/lib/pawPrints.types";
import { playCelebrationSound } from "../../shared/coins.sound";
import ChefChallengeCard from "./ChefChallengeCard";
import type { KitchenLocaleStrings } from "./kitchen.strings";
import { CHEF_CHALLENGE_POSES, type KitchenChefLocaleStrings } from "./kitchenChef.types";
import styles from "./kitchenScene.animation.module.css";

type AnsweredResult = Extract<AnswerChefChallengeResult, { success: true }>;
type Phase = "asking" | "checking" | "error" | "answered";

function pickLine(lines: readonly string[]): string {
  return lines[Math.floor(Math.random() * lines.length)] ?? "";
}

function replaceToken(template: string, token: string, value: string): string {
  return template.split(token).join(value);
}

/**
 * Chef Shrewy's challenge pop-up (roadmap item T; spec section A). Opened by tapping
 * the painted chef while his paw badge shows. The server checks the answer
 * (answer_chef_challenge) -- the correct one is only revealed after answering. A correct
 * answer stamps a paw print with the celebration chime; a wrong one shows the answer
 * with a gentle line and no retry. Closing before answering costs nothing.
 */
export default function ChefChallengeModal({
  challenge,
  strings,
  chefStrings,
  onClose,
}: {
  challenge: ChefChallenge;
  strings: KitchenLocaleStrings;
  chefStrings: KitchenChefLocaleStrings;
  /** `answered` is false when the child closed it without answering. */
  onClose: (answered: boolean) => void;
}) {
  const [offerLine] = useState(() => pickLine(chefStrings.challenge.offer));
  const [phase, setPhase] = useState<Phase>("asking");
  const [chosen, setChosen] = useState<string | null>(null);
  const [result, setResult] = useState<AnsweredResult | null>(null);
  const [resultLine, setResultLine] = useState("");

  if (typeof document === "undefined") return null;

  async function submit(option: string): Promise<void> {
    setChosen(option);
    setPhase("checking");
    try {
      const response = await answerChefChallenge(challenge.attemptId, option);
      if (!response.success) {
        setPhase("error");
        return;
      }
      setResult(response);
      setResultLine(pickLine(response.isCorrect ? chefStrings.challenge.correct : chefStrings.challenge.wrong));
      setPhase("answered");
      if (response.isCorrect) playCelebrationSound(false);
    } catch (error) {
      console.error("Failed to answer the chef challenge:", error);
      setPhase("error");
    }
  }

  const pose =
    phase === "answered" && result
      ? CHEF_CHALLENGE_POSES[result.isCorrect ? "correct" : "wrong"]
      : CHEF_CHALLENGE_POSES.offer;
  const line = phase === "answered" ? resultLine : phase === "checking" ? strings.challengeChecking : offerLine;

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
            pose={pose}
            line={line}
            prompt={challenge.prompt}
            options={challenge.options}
            chosenOption={chosen}
            correctAnswer={result?.correctAnswer ?? null}
            disabled={phase !== "asking"}
            correctAnswerLabel={strings.challengeCorrectAnswerLabel}
            onChoose={(option) => void submit(option)}
          />

          {phase === "answered" && result?.isCorrect ? (
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
                <p>{replaceToken(strings.challengePawCountTemplate, "{count}", String(result.balance.collected))}</p>
              </div>
            </div>
          ) : null}

          {phase === "error" ? (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <p className="text-sm text-red-700">{strings.challengeAnswerError}</p>
              {chosen ? (
                <button
                  type="button"
                  onClick={() => void submit(chosen)}
                  className="btn-caution rounded-full border-2 px-4 py-1.5 text-sm font-semibold"
                >
                  {strings.challengeRetry}
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 flex justify-center">
            {phase === "answered" ? (
              <button
                type="button"
                autoFocus
                onClick={() => onClose(true)}
                className="w-full rounded-full border-2 border-[#8b6f2f] bg-[#f7ead0] px-6 py-3 text-lg font-bold text-[#5c4720] shadow-[0_3px_8px_rgba(139,111,47,0.3)] transition hover:bg-[#f0dfb8]"
              >
                {strings.challengeDone}
              </button>
            ) : (
              <button
                type="button"
                disabled={phase === "checking"}
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
