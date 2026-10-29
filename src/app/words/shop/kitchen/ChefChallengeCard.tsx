"use client";

import type { ChefPose } from "./kitchenChef.types";

export interface ChefChallengeCardProps {
  title: string;
  pose: ChefPose;
  line: string;
  prompt: string;
  options: readonly string[];
  /** The option the child tapped (highlighted while it's being checked). */
  chosenOption: string | null;
  /** Set once answered: the right option turns green, a wrong pick turns rose. */
  correctAnswer: string | null;
  disabled: boolean;
  correctAnswerLabel: string;
  onChoose: (option: string) => void;
}

function optionClass(option: string, chosen: string | null, correct: string | null): string {
  const base =
    "w-full rounded-2xl border-2 px-4 py-3 text-left text-lg font-semibold transition disabled:cursor-default";
  if (correct !== null) {
    if (option === correct) return `${base} border-emerald-500 bg-emerald-50 text-emerald-900`;
    if (option === chosen) return `${base} border-rose-400 bg-rose-50 text-rose-800`;
    return `${base} border-[#e8dcc0] bg-white text-gray-400`;
  }
  if (option === chosen) return `${base} border-[#8b6f2f] bg-[#f7ead0] text-[#5c4720]`;
  return `${base} border-[#dcc38a] bg-white text-[#5c4720] hover:bg-[#fff6e3]`;
}

/**
 * Chef Shrewy's challenge as the child sees it (roadmap item T): his sprite in the
 * moment's pose with a speech bubble, the Chinese-only question, and its options.
 * Purely presentational -- shared by the kitchen pop-up (ChefChallengeModal) and the
 * Shop Admin preview, so the admin sees exactly what the child will.
 */
export default function ChefChallengeCard({
  title,
  pose,
  line,
  prompt,
  options,
  chosenOption,
  correctAnswer,
  disabled,
  correctAnswerLabel,
  onChoose,
}: ChefChallengeCardProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-center text-xl font-bold text-[#5c4720]">{title}</h2>

      <div className="flex items-end gap-3">
        <img
          src={`/kitchen/chef_${pose}.png`}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="h-24 w-24 shrink-0 select-none object-contain drop-shadow-md"
        />
        <p
          role="status"
          aria-live="polite"
          className="mb-4 rounded-2xl border-2 border-[#dcc38a] bg-white px-3 py-2 text-sm font-medium leading-snug text-gray-800 shadow-sm"
        >
          {line}
        </p>
      </div>

      <p lang="zh" className="rounded-2xl bg-[#fcf3df] px-4 py-3 text-xl font-semibold leading-relaxed text-[#3f3218]">
        {prompt}
      </p>

      <div className="grid gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            lang="zh"
            disabled={disabled}
            onClick={() => onChoose(option)}
            className={optionClass(option, chosenOption, correctAnswer)}
          >
            {option}
          </button>
        ))}
      </div>

      {correctAnswer !== null && chosenOption !== correctAnswer ? (
        <p className="text-center text-sm font-semibold text-emerald-800">
          {correctAnswerLabel} <span lang="zh">{correctAnswer}</span>
        </p>
      ) : null}
    </div>
  );
}
